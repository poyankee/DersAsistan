package com.dersasistani.app;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Web tarafından çağrılan küçük yerel işlemler: widget'ı yenileme ve yazdırma / PDF */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridge extends Plugin {
    @PluginMethod
    public void refresh(PluginCall call) {
        try {
            TodayWidget.refreshAll(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("Widget yenilenemedi", e);
        }
    }

    /** Sayfanın yazdırma görünümünü Android yazdırma hizmetine verir ("PDF olarak kaydet" dahil) */
    @PluginMethod
    public void print(PluginCall call) {
        String name = call.getString("name", "Ders Asistani");
        boolean landscape = Boolean.TRUE.equals(call.getBoolean("landscape", false));
        getActivity().runOnUiThread(() -> {
            try {
                WebView web = getBridge().getWebView();
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter adapter = web.createPrintDocumentAdapter(name);
                PrintAttributes attrs = new PrintAttributes.Builder()
                    .setMediaSize(landscape ? PrintAttributes.MediaSize.ISO_A4.asLandscape() : PrintAttributes.MediaSize.ISO_A4)
                    .build();
                pm.print(name, adapter, attrs);
                call.resolve();
            } catch (Exception e) {
                call.reject("Yazdırma başlatılamadı", e);
            }
        });
    }
}
