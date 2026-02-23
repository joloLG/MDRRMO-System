package com.incidentSystem.mdrrmo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class BackgroundShakeService extends Service implements SensorEventListener {
    
    private static final String TAG = "BackgroundShakeService";
    private static final String CHANNEL_ID = "shake_service_channel";
    private static final int NOTIFICATION_ID = 1001;
    
    private static final float SHAKE_THRESHOLD = 18.0f; // Higher threshold to prevent false triggers
    private static final long SHAKE_DURATION_MS = 4000; // 4 seconds
    private static final long MIN_SHAKE_INTERVAL = 300; // Minimum time between shakes
    
    private SensorManager sensorManager;
    private Sensor accelerometer;
    
    private long shakeStartTime = 0;
    private long lastShakeTime = 0;
    private int shakeCount = 0;
    private boolean shakeCompleted = false;
    private boolean isListening = false;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "BackgroundShakeService created");
        
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, createNotification());
        
        initShakeDetection();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "BackgroundShakeService started");
        
        if (!isListening) {
            startShakeDetection();
        }
        
        // Restart if killed
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "BackgroundShakeService destroyed");
        stopShakeDetection();
        
        // Restart service if it was killed (unless user force stopped)
        Intent broadcastIntent = new Intent();
        broadcastIntent.setAction("com.incidentSystem.mdrrmo.RESTART_SHAKE_SERVICE");
        broadcastIntent.setPackage(getPackageName());
        sendBroadcast(broadcastIntent);
    }

    private void initShakeDetection() {
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        }
    }

    private void startShakeDetection() {
        if (sensorManager != null && accelerometer != null) {
            shakeStartTime = 0;
            shakeCount = 0;
            shakeCompleted = false;
            isListening = true;
            
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
            Log.d(TAG, "Shake detection started");
        }
    }

    private void stopShakeDetection() {
        isListening = false;
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!isListening || shakeCompleted) {
            return;
        }

        if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            float x = event.values[0];
            float y = event.values[1];
            float z = event.values[2];

            // Calculate acceleration magnitude
            float acceleration = (float) Math.sqrt(x * x + y * y + z * z);
            float delta = acceleration - SensorManager.GRAVITY_EARTH;

            long now = System.currentTimeMillis();

            // Detect shake
            if (Math.abs(delta) > SHAKE_THRESHOLD) {
                if (now - lastShakeTime > MIN_SHAKE_INTERVAL) {
                    if (shakeStartTime == 0) {
                        // First shake detected
                        shakeStartTime = now;
                        shakeCount = 1;
                        Log.d(TAG, "Shake started");
                    } else {
                        shakeCount++;
                    }
                    lastShakeTime = now;
                }

                // Check if shaken for 4 seconds
                if (shakeStartTime > 0 && (now - shakeStartTime) >= SHAKE_DURATION_MS) {
                    if (!shakeCompleted) {
                        shakeCompleted = true;
                        Log.d(TAG, "Shake completed - Opening app!");
                        
                        // Open the app
                        openApp();
                        
                        // Reset after opening
                        resetShakeDetection();
                    }
                }
            } else {
                // No significant movement - check if we should cancel
                if (shakeStartTime > 0 && (now - lastShakeTime) > 500) {
                    Log.d(TAG, "Shake cancelled - too long between shakes");
                    resetShakeDetection();
                }
            }
        }
    }

    private void resetShakeDetection() {
        shakeStartTime = 0;
        shakeCount = 0;
        shakeCompleted = false;
    }

    private void openApp() {
        try {
            // Create intent to open MainActivity
            Intent intent = new Intent(this, SplashActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | 
                           Intent.FLAG_ACTIVITY_CLEAR_TOP | 
                           Intent.FLAG_ACTIVITY_CLEAR_TASK);
            intent.putExtra("fromShake", true);
            
            // Start the activity
            startActivity(intent);
            
            // Also show a notification that app was opened
            showOpenedNotification();
            
            Log.d(TAG, "App opened successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error opening app", e);
        }
    }

    private void showOpenedNotification() {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle("Bulan Emergency App Opened")
            .setContentText("Shake gesture detected - App opened automatically")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true);

        NotificationManager notificationManager = 
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify(1002, builder.build());
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Shake Detection Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background service for shake gesture detection");
            channel.setShowBadge(false);
            
            NotificationManager notificationManager = 
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, SplashActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Bulan Emergency App")
            .setContentText("Shake detection active - Shake phone to open app")
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build();
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not used
    }
}
