package com.alyousifisoft.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public MainActivity() {
        registerPlugin(BackupDirectoryPlugin.class);
        registerPlugin(MessagingPlugin.class);
    }
}
