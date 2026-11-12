<?php
/**
 * Ders Asistanı — eşitleme sunucusu
 *
 * Paylaşımlı hostingde çalışır (PHP 7.4+ ve PDO SQLite; çoğu hostingde hazır gelir).
 * Kurulum: bu klasörü hostinge yükleyin (ör. public_html/ders/), uygulamada
 * Ayarlar → Eşitleme → sunucu adresi olarak https://alanadiniz.com/ders/api.php yazın.
 *
 * Gizlilik: Kayıtların içeriği telefonda/tablette parolanızdan türetilen anahtarla şifrelenir;
 * sunucu ve hosting firması yalnızca şifreli veriyi görür. Parolanın kendisi de sunucuya gitmez.
 */

declare(strict_types=1);

const API_VERSION = 1;
const MAX_BODY = 20 * 1024 * 1024;   // tek istekte en fazla 20 MB
const PULL_LIMIT = 2000;              // tek seferde gönderilen kayıt sayısı
const LOGIN_WINDOW = 900;             // 15 dk
const LOGIN_MAX_FAILS = 10;           // 15 dk içinde en fazla hatalı giriş

// Veri klasörü: mümkünse web kökünün dışına alın (ayarlar.php içinde $DATA_DIR ile)
$DATA_DIR = __DIR__ . '/veri';
// Uygulamanın web sürümünü başka bir adresten kullanacaksanız buraya ekleyin
$ALLOWED_ORIGINS = ['https://localhost', 'http://localhost', 'capacitor://localhost'];
if (is_file(__DIR__ . '/ayarlar.php')) {
    require __DIR__ . '/ayarlar.php';
}

// ---------------------------------------------------------------------------

function respond(int $code, array $body): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
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
    $self = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '');
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

function db(string $dir): PDO
{
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        fail(500, 'Veri klasörü oluşturulamadı: klasöre yazma izni verin (755/775).');
    }
    // Veri klasörü web'den okunamasın
    if (!is_file("$dir/.htaccess")) {
        @file_put_contents("$dir/.htaccess", "Require all denied\nDeny from all\n");
        @file_put_contents("$dir/index.html", '');
    }
    if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        fail(500, 'Hostingde PDO SQLite eklentisi yok. Panelden PHP eklentilerinde pdo_sqlite\'ı açın.');
    }
    // Dosya adı tahmin edilemez: .htaccess'i dikkate almayan sunucularda da indirilemesin
    $found = glob($dir . '/ders-*.sqlite') ?: [];
    $file = $found[0] ?? ($dir . '/ders-' . bin2hex(random_bytes(12)) . '.sqlite');
    $pdo = new PDO('sqlite:' . $file);
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
    return $pdo;
}

function body(): array
{
    $raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
    if ($raw === false || strlen($raw) > MAX_BODY) fail(413, 'İstek çok büyük');
    if ($raw === '') return [];
    $j = json_decode($raw, true);
    if (!is_array($j)) fail(400, 'Geçersiz istek');
    return $j;
}

function str($v, int $max, string $name): string
{
    if (!is_string($v) || $v === '' || strlen($v) > $max) fail(400, "Geçersiz alan: $name");
    return $v;
}

function client_ip(): string
{
    return (string)($_SERVER['REMOTE_ADDR'] ?? '?');
}

function too_many_attempts(PDO $pdo): bool
{
    $pdo->prepare('DELETE FROM attempts WHERE at < ?')->execute([time() - LOGIN_WINDOW]);
    $q = $pdo->prepare('SELECT COUNT(*) FROM attempts WHERE ip = ?');
    $q->execute([client_ip()]);
    return (int)$q->fetchColumn() >= LOGIN_MAX_FAILS;
}

function auth_user(PDO $pdo): array
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($h === '' && function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) $h = $v;
        }
    }
    // Bazı hostingler Authorization başlığını iletmez; yedek başlık
    if ($h === '') $h = $_SERVER['HTTP_X_DA_TOKEN'] ?? '';
    if (!preg_match('/^(?:Bearer\s+)?([A-Za-z0-9_-]{20,200})$/', trim($h), $m)) fail(401, 'Oturum açılmamış');
    $q = $pdo->prepare('SELECT t.user_id, t.device, t.hash, u.rev FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.hash = ?');
    $q->execute([hash('sha256', $m[1])]);
    $row = $q->fetch();
    if (!$row) fail(401, 'Oturum geçersiz; yeniden giriş yapın');
    $pdo->prepare('UPDATE tokens SET last_seen = ? WHERE hash = ?')->execute([time(), $row['hash']]);
    return $row;
}

// ---------------------------------------------------------------------------

cors($ALLOWED_ORIGINS);
$action = (string)($_GET['a'] ?? 'durum');

try {
    $pdo = db($DATA_DIR);

    switch ($action) {
        case 'durum': {
            $n = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
            respond(200, ['ok' => true, 'app' => 'ders-asistani', 'api' => API_VERSION, 'setup' => $n > 0, 'php' => PHP_VERSION]);
        }

        // İlk kurulum: hesap yoksa oluşturur (tek kullanıcılı)
        case 'kurulum': {
            $b = body();
            $n = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
            if ($n > 0) fail(409, 'Bu sunucuda zaten bir hesap var. Giriş yapın.');
            $name = mb_strtolower(trim(str($b['user'] ?? null, 100, 'user')));
            $salt = str($b['salt'] ?? null, 200, 'salt');
            $kdf = str($b['kdf'] ?? null, 200, 'kdf');
            $auth = str($b['auth'] ?? null, 200, 'auth');
            $pdo->prepare('INSERT INTO users (name, salt, kdf, auth, created) VALUES (?, ?, ?, ?, ?)')
                ->execute([$name, $salt, $kdf, password_hash($auth, PASSWORD_DEFAULT), time()]);
            respond(200, ['ok' => true]);
        }

        // Anahtar türetmek için tuz bilgisi (parola sunucuya hiç gönderilmez)
        case 'on-giris': {
            $b = body();
            $name = mb_strtolower(trim(str($b['user'] ?? null, 100, 'user')));
            $q = $pdo->prepare('SELECT salt, kdf FROM users WHERE name = ?');
            $q->execute([$name]);
            $u = $q->fetch();
            if (!$u) fail(404, 'Bu kullanıcı adı bulunamadı');
            respond(200, ['ok' => true, 'salt' => $u['salt'], 'kdf' => $u['kdf']]);
        }

        case 'giris': {
            $b = body();
            if (too_many_attempts($pdo)) fail(429, 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
            $name = mb_strtolower(trim(str($b['user'] ?? null, 100, 'user')));
            $auth = str($b['auth'] ?? null, 200, 'auth');
            $device = mb_substr(trim((string)($b['device'] ?? 'Cihaz')), 0, 60) ?: 'Cihaz';
            $q = $pdo->prepare('SELECT id, auth FROM users WHERE name = ?');
            $q->execute([$name]);
            $u = $q->fetch();
            if (!$u || !password_verify($auth, $u['auth'])) {
                $pdo->prepare('INSERT INTO attempts (ip, at) VALUES (?, ?)')->execute([client_ip(), time()]);
                fail(403, 'Kullanıcı adı ya da parola yanlış');
            }
            $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
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
            if (!is_array($changes) || count($changes) > 5000) fail(400, 'Geçersiz değişiklik listesi');
            $pdo->beginTransaction();
            $q = $pdo->prepare('SELECT updated FROM records WHERE user_id = ? AND coll = ? AND id = ?');
            $up = $pdo->prepare('INSERT INTO records (user_id, coll, id, data, updated, rev, device) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, coll, id) DO UPDATE SET data = excluded.data, updated = excluded.updated, rev = excluded.rev, device = excluded.device');
            $rev = (int)$pdo->query('SELECT rev FROM users WHERE id = ' . (int)$me['user_id'])->fetchColumn();
            $applied = 0;
            $skipped = 0;
            foreach ($changes as $c) {
                if (!is_array($c)) continue;
                $coll = str($c['c'] ?? null, 40, 'c');
                $id = str($c['i'] ?? null, 300, 'i');
                $data = $c['d'] ?? null;
                if ($data !== null && (!is_string($data) || strlen($data) > 2 * 1024 * 1024)) fail(400, 'Geçersiz kayıt');
                $u = (int)($c['u'] ?? 0);
                $q->execute([$me['user_id'], $coll, $id]);
                $cur = $q->fetchColumn();
                if ($cur !== false && (int)$cur > $u) {
                    $skipped++;
                    continue;
                }
                $rev++;
                $up->execute([$me['user_id'], $coll, $id, $data, $u, $rev, $me['device']]);
                $applied++;
            }
            $pdo->prepare('UPDATE users SET rev = ? WHERE id = ?')->execute([$rev, $me['user_id']]);
            $pdo->commit();
            respond(200, ['ok' => true, 'rev' => $rev, 'applied' => $applied, 'skipped' => $skipped]);
        }

        case 'cihazlar': {
            $me = auth_user($pdo);
            $q = $pdo->prepare('SELECT device, created, last_seen, hash = ? AS current FROM tokens WHERE user_id = ? ORDER BY last_seen DESC');
            $q->execute([$me['hash'], $me['user_id']]);
            respond(200, ['ok' => true, 'devices' => array_map(function ($r) {
                return ['device' => $r['device'], 'created' => (int)$r['created'], 'lastSeen' => (int)$r['last_seen'], 'current' => (bool)$r['current']];
            }, $q->fetchAll())]);
        }

        case 'cikis': {
            $me = auth_user($pdo);
            $pdo->prepare('DELETE FROM tokens WHERE hash = ?')->execute([$me['hash']]);
            respond(200, ['ok' => true]);
        }

        // Sunucudaki tüm kayıtları siler (hesap kalır); cihazlardaki veriler etkilenmez
        case 'sifirla': {
            $me = auth_user($pdo);
            $pdo->beginTransaction();
            $pdo->prepare('DELETE FROM records WHERE user_id = ?')->execute([$me['user_id']]);
            $pdo->prepare('UPDATE users SET rev = rev + 1 WHERE id = ?')->execute([$me['user_id']]);
            $pdo->commit();
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
