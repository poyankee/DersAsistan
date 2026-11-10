package com.dersasistani.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Web tarafından çağrılır: veri değişince ana ekran widget'ını yeniler */
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
}
