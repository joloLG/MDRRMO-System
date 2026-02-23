package com.incidentSystem.mdrrmo;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "ShakeDetector",
    permissions = {}
)
public class ShakeDetectorPlugin extends Plugin implements SensorEventListener {

    private static final float SHAKE_THRESHOLD = 15.0f; // Acceleration threshold
    private static final long SHAKE_DURATION_MS = 4000; // 4 seconds
    private static final long MIN_SHAKE_INTERVAL = 200; // Minimum time between shake detections

    private SensorManager sensorManager;
    private Sensor accelerometer;
    
    private long shakeStartTime = 0;
    private long lastShakeTime = 0;
    private int shakeCount = 0;
    private boolean isListening = false;
    private boolean shakeCompleted = false;

    @PluginMethod
    public void startListening(PluginCall call) {
        if (isListening) {
            call.resolve(createResponse(true, "Already listening"));
            return;
        }

        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager == null) {
            call.reject("SensorManager not available");
            return;
        }

        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        if (accelerometer == null) {
            call.reject("Accelerometer not available on this device");
            return;
        }

        shakeStartTime = 0;
        shakeCount = 0;
        shakeCompleted = false;
        isListening = true;

        sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
        
        call.resolve(createResponse(true, "Shake detection started"));
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        stopDetection();
        call.resolve(createResponse(true, "Shake detection stopped"));
    }

    private void stopDetection() {
        isListening = false;
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        shakeStartTime = 0;
        shakeCount = 0;
        shakeCompleted = false;
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
                        notifyListeners("shakeStarted", new JSObject());
                    } else {
                        shakeCount++;
                    }
                    lastShakeTime = now;
                }

                // Check if shaken for 4 seconds
                if (shakeStartTime > 0 && (now - shakeStartTime) >= SHAKE_DURATION_MS) {
                    if (!shakeCompleted) {
                        shakeCompleted = true;
                        JSObject result = new JSObject();
                        result.put("gesture", "shake");
                        result.put("durationMs", now - shakeStartTime);
                        result.put("shakeCount", shakeCount);
                        notifyListeners("shakeCompleted", result);
                        stopDetection();
                    }
                }
            } else {
                // No significant movement - check if we should cancel
                if (shakeStartTime > 0 && (now - lastShakeTime) > 500) {
                    // Paused shaking for more than 500ms, reset
                    notifyListeners("shakeCancelled", new JSObject());
                    shakeStartTime = 0;
                    shakeCount = 0;
                }
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not used
    }

    private JSObject createResponse(boolean success, String message) {
        JSObject ret = new JSObject();
        ret.put("success", success);
        ret.put("message", message);
        return ret;
    }

    @Override
    protected void handleOnDestroy() {
        stopDetection();
        super.handleOnDestroy();
    }
}
