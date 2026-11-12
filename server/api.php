<?php
/**
 * Ders Asistanı — eşitleme sunucusu
 *
 * Paylaşımlı hostingde çalışır (PHP 7.4+ ve PDO SQLite; çoğu hostingde hazır gelir).
 * Kurulum: docs/ESITLEME-KURULUM.md
 *
 * Güvenlik özeti (ayrıntı: docs/GUVENLIK.md):
 * - Kayıtların içeriği cihazda parolanızdan türetilen anahtarla şifrelenir (AES-256-GCM); sunucu yalnızca
 *   şifreli veri görür. Parola sunucuya gitmez; giriş için ayrı türetilmiş bir değer gönderilir.
 * - İlk hesap yalnızca veri klasöründeki KURULUM-KODU.txt dosyasındaki kodla açılabilir.
 * - Hatalı girişler IP'ye ve toplamda sınırlanır; oturum anahtarları sunucuda yalnızca özet olarak tutulur.
 */

declare(strict_types=1);

const API_VERSION = 2;
const MAX_BODY = 20 * 1024 * 1024;   // tek istekte en fazla 20 MB
const MAX_RECORD = 2 * 1024 * 1024;  // tek kayıt en fazla 2 MB (şifreli)
const MAX_CHANGES = 5000;            // tek istekte en fazla değişiklik
const PULL_LIMIT = 2000;             // tek seferde gönderilen kayıt sayısı
const FAIL_WINDOW = 900;             // 15 dk
const FAIL_MAX_IP = 10;              // 15 dk'da bir IP'den en fazla hatalı deneme
const FAIL_MAX_ALL = 50;             // 15 dk'da toplam en fazla hatalı deneme (IP değiştirerek denemeye karşı)
const TOKEN_IDLE_DAYS = 180;         // 180 gün kullanılmayan oturum kapanır
const CLOCK_SKEW_MS = 120000;        // cihaz saati en fazla 2 dk ileride kabul edilir

// Veri klasörü: mümkünse web kökünün dışına alın (ayarlar.php içinde $DATA_DIR ile)
$DATA_DIR = __DIR__ . '/veri';
// Uygulama (Android) ve isteğe bağlı web sürümü için izinli kaynaklar
$ALLOWED_ORIGINS = ['https://localhost', 'capacitor://localhost'];
if (is_file(__DIR__ . '/ayarlar.php')) {
    require __DIR__ . '/ayarlar.php';
}

// ---------------------------------------------------------------------------

function security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    header('Cache-Control: no-store');
    if (is_https()) header('Strict-Transport-Security: max-age=31536000');
    header_remove('X-Powered-By');
}

function is_https(): bool
{
    return (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
}

function respond(int $code, array $body): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $code, string $message): void
{
    respond($code, ['ok' => false, 'error' => $message]);
}

function cors(array $allowed): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $self = (is_https() ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '');
    if ($origin !== '' && ($origin === $self || in_array($origin, $allowed, true))) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-DA-Token');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Max-Age: 86400');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function protect_dir(string $dir): void
{
    if (!is_file("$dir/.htaccess")) {
        // Apache 2.4 ve 2.2 ile uyumlu: klasör web'den okunamaz
        @file_put_contents("$dir/.htaccess", "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
    }
    if (!is_file("$dir/index.html")) @file_put_contents("$dir/index.html", '');
}

function db(string $dir): PDO
{
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        fail(500, 'Veri klasörü oluşturulamadı: klasöre yazma izni verin (755).');
    }
    protect_dir($dir);
    if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        fail(500, 'Hostingde PDO SQLite eklentisi yok. Panelden PHP eklentilerinde pdo_sqlite\'ı açın.');
    }
    // Dosya adı tahmin edilemez: .htaccess'i dikkate almayan sunucularda da indirilemesin
    $found = glob($dir . '/ders-*.sqlite') ?: [];
    $file = $found[0] ?? ($dir . '/ders-' . bin2hex(random_bytes(16)) . '.sqlite');
    $pdo = new PDO('sqlite:' . $file);
    @chmod($file, 0600);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    $pdo->exec('CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        salt TEXT NOT NULL,
        kdf TEXT NOT NULL,
        auth TEXT NOT NULL,
        rev INTEGER NOT NULL DEFAULT 0,
        created INTEGER NOT NULL
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS tokens (
        hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        device TEXT NOT NULL,
        created INTEGER NOT NULL,
        last_seen INTEGER NOT NULL
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS records (
        user_id INTEGER NOT NULL,
        coll TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT,
        updated INTEGER NOT NULL,
        rev INTEGER NOT NULL,
        device TEXT NOT NULL DEFAULT \'\',
        PRIMARY KEY (user_id, coll, id)
    )');
    $pdo->exec('CREATE INDEX IF NOT EXISTS records_rev ON records (user_id, rev)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS attempts (ip TEXT NOT NULL, at INTEGER NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS secrets (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
    return $pdo;
}

/** Sunucuya özel gizli değer (sahte tuz üretmek için) */
function server_secret(PDO $pdo): string
{
    $v = $pdo->query("SELECT value FROM secrets WHERE name = 'main'")->fetchColumn();
    if ($v === false) {
        $v = bin2hex(random_bytes(32));
        $pdo->prepare("INSERT OR IGNORE INTO secrets (name, value) VALUES ('main', ?)")->execute([$v]);
        $v = $pdo->query("SELECT value FROM secrets WHERE name = 'main'")->fetchColumn();
    }
    return (string)$v;
}

function has_account(PDO $pdo): bool
{
    return (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0;
}

/** Hesap yokken kurulum kodu dosyası oluşturur; kodu yalnızca hosting paneline erişebilen kişi görebilir */
function setup_code(string $dir): string
{
    $f = "$dir/KURULUM-KODU.txt";
    if (!is_file($f)) {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $code = '';
        for ($i = 0; $i < 10; $i++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        @file_put_contents($f, "Ders Asistanı kurulum kodu (uygulamada ilk hesabı oluştururken girin):\n\n$code\n\nHesap oluşturulunca bu dosya kendiliğinden silinir.\n");
        @chmod($f, 0600);
    }
    $txt = (string)@file_get_contents($f);
    return preg_match('/\n([A-Z2-9]{10})\n/', $txt, $m) ? $m[1] : '';
}

function body(): array
{
    $len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > MAX_BODY) fail(413, 'İstek çok büyük');
    $raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
    if ($raw === false || strlen($raw) > MAX_BODY) fail(413, 'İstek çok büyük');
    if ($raw === '') return [];
    $j = json_decode($raw, true, 32);
    if (!is_array($j)) fail(400, 'Geçersiz istek');
    return $j;
}

function str($v, int $max, string $name, string $pattern = ''): string
{
    if (!is_string($v) || $v === '' || strlen($v) > $max) fail(400, "Geçersiz alan: $name");
    if ($pattern !== '' && !preg_match($pattern, $v)) fail(400, "Geçersiz alan: $name");
    return $v;
}

function username($v): string
{
    $name = mb_strtolower(trim(str($v, 100, 'user')), 'UTF-8');
    if ($name === '' || preg_match('/[\x00-\x1f]/', $name)) fail(400, 'Geçersiz kullanıcı adı');
    return $name;
}

function client_ip(): string
{
    return (string)($_SERVER['REMOTE_ADDR'] ?? '?');
}

function blocked(PDO $pdo): bool
{
    $pdo->prepare('DELETE FROM attempts WHERE at < ?')->execute([time() - FAIL_WINDOW]);
    $q = $pdo->prepare('SELECT COUNT(*) FROM attempts WHERE ip = ?');
    $q->execute([client_ip()]);
    if ((int)$q->fetchColumn() >= FAIL_MAX_IP) return true;
    return (int)$pdo->query('SELECT COUNT(*) FROM attempts')->fetchColumn() >= FAIL_MAX_ALL;
}

function record_fail(PDO $pdo): void
{
    $pdo->prepare('INSERT INTO attempts (ip, at) VALUES (?, ?)')->execute([client_ip(), time()]);
    usleep(random_int(200000, 400000)); // kaba kuvveti yavaşlat
}

function auth_user(PDO $pdo): array
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($h === '' && function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $k => $v) {
            if (strcasecmp((string)$k, 'Authorization') === 0) $h = (string)$v;
        }
    }
    // Bazı hostingler Authorization başlığını iletmez; yedek başlık
    if ($h === '') $h = $_SERVER['HTTP_X_DA_TOKEN'] ?? '';
    if (!preg_match('/^(?:Bearer\s+)?([A-Za-z0-9_-]{40,100})$/', trim((string)$h), $m)) fail(401, 'Oturum açılmamış');
    $q = $pdo->prepare('SELECT t.user_id, t.device, t.hash, t.last_seen, u.rev FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.hash = ?');
    $q->execute([hash('sha256', $m[1])]);
    $row = $q->fetch();
    if (!$row || (int)$row['last_seen'] < time() - TOKEN_IDLE_DAYS * 86400) {
        if ($row) $pdo->prepare('DELETE FROM tokens WHERE hash = ?')->execute([$row['hash']]);
        fail(401, 'Oturum geçersiz; yeniden giriş yapın');
    }
    if ((int)$row['last_seen'] < time() - 60) {
        $pdo->prepare('UPDATE tokens SET last_seen = ? WHERE hash = ?')->execute([time(), $row['hash']]);
    }
    return $row;
}

/** Cihaz kimliği: oturum özetinin ilk 16 karakteri (oturum anahtarının kendisi değil) */
function device_id(string $hash): string
{
    return substr($hash, 0, 16);
}

// ---------------------------------------------------------------------------

security_headers();
cors($ALLOWED_ORIGINS);
$action = (string)($_GET['a'] ?? 'durum');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($action !== 'durum' && $method !== 'POST') fail(405, 'Yalnızca POST');

try {
    $pdo = db($DATA_DIR);

    switch ($action) {
        case 'durum': {
            $setup = has_account($pdo);
            if (!$setup) setup_code($DATA_DIR);
            respond(200, ['ok' => true, 'app' => 'ders-asistani', 'api' => API_VERSION, 'setup' => $setup, 'https' => is_https()]);
        }

        // İlk kurulum: hesap yoksa ve kurulum kodu doğruysa oluşturur (tek kullanıcılı)
        case 'kurulum': {
            $b = body();
            if (blocked($pdo)) fail(429, 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
            if (has_account($pdo)) fail(409, 'Bu sunucuda zaten bir hesap var. Giriş yapın.');
            $code = setup_code($DATA_DIR);
            $given = strtoupper(preg_replace('/[\s-]+/', '', (string)($b['code'] ?? '')));
            if ($code === '' || !hash_equals($code, $given)) {
                record_fail($pdo);
                fail(403, 'Kurulum kodu yanlış. Kod, hosting panelindeki Dosya Yöneticisi\'nde veri klasöründeki KURULUM-KODU.txt dosyasındadır.');
            }
            $name = username($b['user'] ?? null);
            $salt = str($b['salt'] ?? null, 100, 'salt', '/^[A-Za-z0-9+\/=]+$/');
            $kdf = str($b['kdf'] ?? null, 60, 'kdf', '/^pbkdf2-sha256-\d{6,7}$/');
            $auth = str($b['auth'] ?? null, 64, 'auth', '/^[0-9a-f]{64}$/');
            $pdo->prepare('INSERT INTO users (name, salt, kdf, auth, created) VALUES (?, ?, ?, ?, ?)')
                ->execute([$name, $salt, $kdf, password_hash($auth, PASSWORD_DEFAULT), time()]);
            @unlink("$DATA_DIR/KURULUM-KODU.txt");
            respond(200, ['ok' => true]);
        }

        // Anahtar türetmek için tuz bilgisi. Bilinmeyen kullanıcı adına da tutarlı sahte bir tuz döner,
        // böylece kullanıcı adının var olup olmadığı anlaşılmaz.
        case 'on-giris': {
            $b = body();
            $name = username($b['user'] ?? null);
            $q = $pdo->prepare('SELECT salt, kdf FROM users WHERE name = ?');
            $q->execute([$name]);
            $u = $q->fetch();
            if (!$u) {
                $fake = base64_encode(substr(hash_hmac('sha256', 'salt:' . $name, server_secret($pdo), true), 0, 16));
                respond(200, ['ok' => true, 'salt' => $fake, 'kdf' => 'pbkdf2-sha256-600000']);
            }
            respond(200, ['ok' => true, 'salt' => $u['salt'], 'kdf' => $u['kdf']]);
        }

        case 'giris': {
            $b = body();
            if (blocked($pdo)) fail(429, 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
            $name = username($b['user'] ?? null);
            $auth = (string)($b['auth'] ?? '');
            $device = mb_substr(preg_replace('/[\x00-\x1f<>]/', '', trim((string)($b['device'] ?? 'Cihaz'))), 0, 40, 'UTF-8') ?: 'Cihaz';
            $q = $pdo->prepare('SELECT id, auth FROM users WHERE name = ?');
            $q->execute([$name]);
            $u = $q->fetch();
            // Kullanıcı yoksa da aynı süre harcanır (zamanlama ile kullanıcı adı anlaşılmasın)
            $ok = $u ? password_verify($auth, $u['auth']) : password_verify($auth, '$2y$10$mTG2pwEJOFAXkbKrBqwDh.GrkLq520yzD1DHVBdYBF4U/qX0MFoK2');
            if (!$u || !$ok || !preg_match('/^[0-9a-f]{64}$/', $auth)) {
                record_fail($pdo);
                fail(403, 'Kullanıcı adı ya da parola yanlış');
            }
            if (password_needs_rehash($u['auth'], PASSWORD_DEFAULT)) {
                $pdo->prepare('UPDATE users SET auth = ? WHERE id = ?')->execute([password_hash($auth, PASSWORD_DEFAULT), $u['id']]);
            }
            $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
            $pdo->prepare('DELETE FROM tokens WHERE last_seen < ?')->execute([time() - TOKEN_IDLE_DAYS * 86400]);
            $pdo->prepare('INSERT INTO tokens (hash, user_id, device, created, last_seen) VALUES (?, ?, ?, ?, ?)')
                ->execute([hash('sha256', $token), $u['id'], $device, time(), time()]);
            respond(200, ['ok' => true, 'token' => $token]);
        }

        // Sunucudaki değişiklikleri al: since'ten sonraki kayıtlar
        case 'al': {
            $me = auth_user($pdo);
            $b = body();
            $since = max(0, (int)($b['since'] ?? 0));
            $q = $pdo->prepare('SELECT coll, id, data, updated, rev FROM records WHERE user_id = ? AND rev > ? ORDER BY rev LIMIT ' . PULL_LIMIT);
            $q->execute([$me['user_id'], $since]);
            $rows = $q->fetchAll();
            $out = [];
            $last = $since;
            foreach ($rows as $r) {
                $out[] = ['c' => $r['coll'], 'i' => $r['id'], 'd' => $r['data'], 'u' => (int)$r['updated']];
                $last = (int)$r['rev'];
            }
            $more = count($rows) === PULL_LIMIT;
            respond(200, ['ok' => true, 'rev' => $more ? $last : max($last, (int)$me['rev']), 'more' => $more, 'changes' => $out]);
        }

        // Değişiklikleri gönder. Aynı kayıt sunucuda daha yeniyse sunucudaki korunur.
        case 'gonder': {
            $me = auth_user($pdo);
            $b = body();
            $changes = $b['changes'] ?? null;
            if (!is_array($changes) || count($changes) > MAX_CHANGES) fail(400, 'Geçersiz değişiklik listesi');
            $nowMs = (int)(microtime(true) * 1000);
            $pdo->beginTransaction();
            $q = $pdo->prepare('SELECT updated FROM records WHERE user_id = ? AND coll = ? AND id = ?');
            $up = $pdo->prepare('INSERT OR REPLACE INTO records (user_id, coll, id, data, updated, rev, device) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $rev = (int)$pdo->query('SELECT rev FROM users WHERE id = ' . (int)$me['user_id'])->fetchColumn();
            $applied = 0;
            $skipped = 0;
            foreach ($changes as $c) {
                if (!is_array($c)) fail(400, 'Geçersiz değişiklik');
                $coll = str($c['c'] ?? null, 20, 'c', '/^[A-Za-z]+$/');
                $id = str($c['i'] ?? null, 300, 'i');
                $data = $c['d'] ?? null;
                if ($data !== null && (!is_string($data) || strlen($data) > MAX_RECORD || !preg_match('/^[A-Za-z0-9+\/=]+$/', $data))) fail(400, 'Geçersiz kayıt');
                // Saati ileride olan bir cihaz kayıtları "kilitleyemesin"
                $u = min(max(0, (int)($c['u'] ?? 0)), $nowMs + CLOCK_SKEW_MS);
                $q->execute([$me['user_id'], $coll, $id]);
                $cur = $q->fetchColumn();
                if ($cur !== false && (int)$cur > $u) {
                    $skipped++;
                    continue;
                }
                $rev++;
                $up->execute([$me['user_id'], $coll, $id, $data, $u, $rev, device_id($me['hash'])]);
                $applied++;
            }
            $pdo->prepare('UPDATE users SET rev = ? WHERE id = ?')->execute([$rev, $me['user_id']]);
            $pdo->commit();
            respond(200, ['ok' => true, 'rev' => $rev, 'applied' => $applied, 'skipped' => $skipped]);
        }

        case 'cihazlar': {
            $me = auth_user($pdo);
            $q = $pdo->prepare('SELECT hash, device, created, last_seen FROM tokens WHERE user_id = ? ORDER BY last_seen DESC');
            $q->execute([$me['user_id']]);
            respond(200, ['ok' => true, 'devices' => array_map(function ($r) use ($me) {
                return ['id' => device_id($r['hash']), 'device' => $r['device'], 'created' => (int)$r['created'], 'lastSeen' => (int)$r['last_seen'], 'current' => $r['hash'] === $me['hash']];
            }, $q->fetchAll())]);
        }

        // Kaybolan/çalınan bir cihazın oturumunu kapatır
        case 'cihaz-kaldir': {
            $me = auth_user($pdo);
            $b = body();
            $id = str($b['id'] ?? null, 16, 'id', '/^[0-9a-f]{16}$/');
            $q = $pdo->prepare('DELETE FROM tokens WHERE user_id = ? AND substr(hash, 1, 16) = ?');
            $q->execute([$me['user_id'], $id]);
            respond(200, ['ok' => true, 'removed' => $q->rowCount()]);
        }

        case 'cikis': {
            $me = auth_user($pdo);
            $pdo->prepare('DELETE FROM tokens WHERE hash = ?')->execute([$me['hash']]);
            respond(200, ['ok' => true]);
        }

        default:
            fail(404, 'Bilinmeyen işlem');
    }
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Ders Asistanı: ' . $e->getMessage());
    fail(500, 'Sunucu hatası');
}
