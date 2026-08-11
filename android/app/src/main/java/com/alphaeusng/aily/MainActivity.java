package com.alphaeusng.aily;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import java.util.List;

public class MainActivity extends BridgeActivity {

    static List<Class<? extends Plugin>> nativePlugins() {
        return List.of(AilyUsagePlugin.class);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugins(nativePlugins());
        super.onCreate(savedInstanceState);
    }
}
