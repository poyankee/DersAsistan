package com.dersasistani.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridge.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        super.onPause();
        // Uygulamadan çıkınca widget'ı güncel tut
        TodayWidget.refreshAll(this);
    }
}
