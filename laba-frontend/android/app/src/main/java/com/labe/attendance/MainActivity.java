package com.labe.attendance;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LabeLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
