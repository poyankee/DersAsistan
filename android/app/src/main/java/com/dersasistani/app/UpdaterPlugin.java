package com.dersasistani.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Uygulama içi güncelleme.
 * - Arayüz paketi: indirilen klasörü Capacitor'ın yerel sunucusuna gösterir (APK kurmadan güncelleme).
 *   Yeni paket üç açılışta onaylanmazsa (açılmıyor demektir) bir önceki pakete kendiliğinden dönülür.
 * - APK: indirilen dosya için Android kurulum ekranını açar (yerel kod değiştiğinde, nadiren).
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
    /** Yerel (Java/Android) kod düzeyi. Yalnızca yerel kod değişince artırılır; arayüz paketi bunu karşılamalı. */
    public static final int NATIVE_LEVEL = 1;

    static final String PREFS = "DaUpdater";
    static final String KEY_PENDING = "pending";
    static final String KEY_TRIES = "tries";
    static final String KEY_PREV = "previous";

    private SharedPreferences capPrefs() {
        return getContext().getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE);
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        try {
            PackageInfo p = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            r.put("versionCode", Build.VERSION.SDK_INT >= 28 ? (int) p.getLongVersionCode() : p.versionCode);
            r.put("versionName", p.versionName);
        } catch (Exception e) {
            r.put("versionCode", 0);
        }
        r.put("nativeLevel", NATIVE_LEVEL);
        r.put("bundle", capPrefs().getString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, ""));
        r.put("pending", prefs().getBoolean(KEY_PENDING, false));
        r.put("canInstall", Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(r);
    }

    /** path: uygulama klasörüne göre (ör. "guncelleme/36"); reload: hemen yeni paketle yeniden aç */
    @PluginMethod
    public void applyBundle(PluginCall call) {
        String rel = call.getString("path");
        if (rel == null || rel.contains("..")) {
            call.reject("Geçersiz yol");
            return;
        }
        File dir = new File(getContext().getFilesDir(), rel);
        if (!new File(dir, "index.html").exists()) {
            call.reject("Paket eksik: index.html yok");
            return;
        }
        String current = capPrefs().getString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, "");
        prefs().edit().putBoolean(KEY_PENDING, true).putInt(KEY_TRIES, 0).putString(KEY_PREV, current == null ? "" : current).apply();
        capPrefs().edit().putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, dir.getAbsolutePath()).apply();
        call.resolve();
        if (Boolean.TRUE.equals(call.getBoolean("reload", false))) {
            getActivity().runOnUiThread(() -> getBridge().setServerBasePath(dir.getAbsolutePath()));
        }
    }

    /** Yeni paket sorunsuz açıldı */
    @PluginMethod
    public void confirmBundle(PluginCall call) {
        prefs().edit().putBoolean(KEY_PENDING, false).putInt(KEY_TRIES, 0).apply();
        call.resolve();
    }

    /** APK ile gelen ilk arayüze dön */
    @PluginMethod
    public void resetBundle(PluginCall call) {
        capPrefs().edit().putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, "").apply();
        prefs().edit().putBoolean(KEY_PENDING, false).apply();
        call.resolve();
        getActivity().runOnUiThread(() -> getBridge().setServerAssetPath("public"));
    }

    /** name: önbellek klasöründeki APK dosyasının adı */
    @PluginMethod
    public void installApk(PluginCall call) {
        String name = call.getString("name");
        if (name == null || name.contains("/") || name.contains("..")) {
            call.reject("Geçersiz dosya");
            return;
        }
        File apk = new File(getContext().getCacheDir(), name);
        if (!apk.exists()) {
            call.reject("APK bulunamadı");
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                // Önce "bu kaynaktan yüklemeye izin ver" ayarını aç
                Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(s);
                JSObject r = new JSObject();
                r.put("needsPermission", true);
                call.resolve(r);
                return;
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve(new JSObject());
        } catch (Exception e) {
            call.reject("Kurulum açılamadı: " + e.getMessage(), e);
        }
    }

    /**
     * Açılışta (köprü kurulmadan önce) çağrılır: onaylanmamış yeni paket üst üste 3 kez açılamadıysa
     * bir önceki pakete döner.
     */
    static void guardBundle(Context context) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!p.getBoolean(KEY_PENDING, false)) return;
        int tries = p.getInt(KEY_TRIES, 0) + 1;
        if (tries >= 3) {
            SharedPreferences cap = context.getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE);
            cap.edit().putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, p.getString(KEY_PREV, "")).apply();
            p.edit().putBoolean(KEY_PENDING, false).putInt(KEY_TRIES, 0).putBoolean("rolledBack", true).apply();
        } else {
            p.edit().putInt(KEY_TRIES, tries).apply();
        }
    }
}
