package com.incidentSystem.mdrrmo;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class EmergencyAlertMessagingService extends FirebaseMessagingService {
    
    private static final String TAG = "EmergencyAlertService";
    private static final String CHANNEL_ID_EARTHQUAKE = "earthquake_alerts";
    private static final String CHANNEL_ID_TSUNAMI = "tsunami_alerts";
    private static final String CHANNEL_ID_EMERGENCY = "emergency_alerts";
    
    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }
    
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token: " + token);
        // Send token to your server
        sendTokenToServer(token);
    }
    
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        
        Log.d(TAG, "From: " + remoteMessage.getFrom());
        
        Map<String, String> data = remoteMessage.getData();
        
        if (data.size() > 0) {
            Log.d(TAG, "Message data payload: " + data);
            
            String alertType = data.get("alertType");
            String title = data.get("title");
            String message = data.get("message");
            String severity = data.get("severity"); // high, medium, low
            
            if (title != null && message != null) {
                showEmergencyNotification(alertType, title, message, severity);
            }
        }
        
        // Also check notification payload
        RemoteMessage.Notification notification = remoteMessage.getNotification();
        if (notification != null) {
            Log.d(TAG, "Message Notification Body: " + notification.getBody());
        }
    }
    
    private void showEmergencyNotification(String alertType, String title, String message, String severity) {
        String channelId;
        int priority;
        int color;
        Uri soundUri;
        
        // Configure based on alert type
        switch (alertType != null ? alertType.toLowerCase() : "emergency") {
            case "earthquake":
                channelId = CHANNEL_ID_EARTHQUAKE;
                priority = NotificationCompat.PRIORITY_HIGH;
                color = 0xFFFF0000; // Red
                soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                break;
            case "tsunami":
                channelId = CHANNEL_ID_TSUNAMI;
                priority = NotificationCompat.PRIORITY_HIGH;
                color = 0xFFFF6600; // Orange
                soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                break;
            default:
                channelId = CHANNEL_ID_EMERGENCY;
                priority = NotificationCompat.PRIORITY_DEFAULT;
                color = 0xFFFF8C00; // MDRRMO Orange
                soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
        
        // Create intent to open the app
        Intent intent = new Intent(this, SplashActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("alertType", alertType);
        intent.putExtra("alertTitle", title);
        intent.putExtra("alertMessage", message);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            intent, 
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );
        
        // Build notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(message)
            .setAutoCancel(true)
            .setPriority(priority)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setColor(color)
            .setContentIntent(pendingIntent);
        
        // Add sound and vibration for high priority alerts
        if ("high".equals(severity) || "earthquake".equals(alertType) || "tsunami".equals(alertType)) {
            builder.setSound(soundUri)
                   .setVibrate(new long[]{0, 1000, 500, 1000, 500, 1000})
                   .setLights(color, 300, 1000);
        }
        
        // Show notification
        NotificationManager notificationManager = 
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        
        if (notificationManager != null) {
            int notificationId = (int) System.currentTimeMillis();
            notificationManager.notify(notificationId, builder.build());
        }
    }
    
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = 
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            
            if (notificationManager == null) return;
            
            // Earthquake Channel
            NotificationChannel earthquakeChannel = new NotificationChannel(
                CHANNEL_ID_EARTHQUAKE,
                "Earthquake Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            earthquakeChannel.setDescription("Critical earthquake warnings and alerts");
            earthquakeChannel.enableVibration(true);
            earthquakeChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000});
            earthquakeChannel.enableLights(true);
            earthquakeChannel.setLightColor(0xFFFF0000);
            
            AudioAttributes earthquakeAudio = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            earthquakeChannel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), earthquakeAudio);
            
            // Tsunami Channel
            NotificationChannel tsunamiChannel = new NotificationChannel(
                CHANNEL_ID_TSUNAMI,
                "Tsunami Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            tsunamiChannel.setDescription("Critical tsunami warnings and evacuation alerts");
            tsunamiChannel.enableVibration(true);
            tsunamiChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000});
            tsunamiChannel.enableLights(true);
            tsunamiChannel.setLightColor(0xFFFF6600);
            
            AudioAttributes tsunamiAudio = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            tsunamiChannel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), tsunamiAudio);
            
            // General Emergency Channel
            NotificationChannel emergencyChannel = new NotificationChannel(
                CHANNEL_ID_EMERGENCY,
                "Emergency Alerts",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            emergencyChannel.setDescription("General emergency notifications");
            
            // Register all channels
            notificationManager.createNotificationChannel(earthquakeChannel);
            notificationManager.createNotificationChannel(tsunamiChannel);
            notificationManager.createNotificationChannel(emergencyChannel);
            
            Log.d(TAG, "Notification channels created");
        }
    }
    
    private void sendTokenToServer(String token) {
        // TODO: Implement token registration with your backend
        // This should send the FCM token to your server so you can target this device
        Log.d(TAG, "Token should be sent to server: " + token);
    }
}
