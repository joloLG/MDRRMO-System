package com.incidentSystem.mdrrmo;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class ServiceRestartReceiver extends BroadcastReceiver {
    
    private static final String TAG = "ServiceRestartReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        
        if ("com.incidentSystem.mdrrmo.RESTART_SHAKE_SERVICE".equals(action)) {
            Log.d(TAG, "Restarting BackgroundShakeService");
            
            try {
                Intent serviceIntent = new Intent(context, BackgroundShakeService.class);
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
                Log.d(TAG, "BackgroundShakeService restarted successfully");
            } catch (Exception e) {
                Log.e(TAG, "Failed to restart BackgroundShakeService", e);
            }
        }
    }
}
