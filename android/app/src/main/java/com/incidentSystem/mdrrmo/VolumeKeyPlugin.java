package com.incidentSystem.mdrrmo;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VolumeKey")
public class VolumeKeyPlugin extends Plugin {

    private static final long GESTURE_DURATION_MS = 2000; // 2 seconds

    private boolean volumeUpPressed = false;
    private boolean volumeDownPressed = false;
    private long bothPressedStartTime = 0;
    private boolean gestureTriggered = false;

    @PluginMethod
    public void startListening(PluginCall call) {
        gestureTriggered = false;
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    // Called from MainActivity when volume keys are pressed
    public void onVolumeKeyPressed(int keyCode, boolean isPressed) {
        boolean wasBothPressed = volumeUpPressed && volumeDownPressed;

        if (keyCode == android.view.KeyEvent.KEYCODE_VOLUME_UP) {
            volumeUpPressed = isPressed;
        } else if (keyCode == android.view.KeyEvent.KEYCODE_VOLUME_DOWN) {
            volumeDownPressed = isPressed;
        }

        boolean isBothPressed = volumeUpPressed && volumeDownPressed;

        // Both buttons just pressed together
        if (isBothPressed && !wasBothPressed && !gestureTriggered) {
            bothPressedStartTime = System.currentTimeMillis();
            notifyListeners("volumeGestureStarted", new JSObject());
            
            // Start a timer to check after 2 seconds
            getBridge().getActivity().runOnUiThread(() -> {
                android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
                handler.postDelayed(() -> {
                    if (volumeUpPressed && volumeDownPressed && !gestureTriggered) {
                        long pressDuration = System.currentTimeMillis() - bothPressedStartTime;
                        if (pressDuration >= GESTURE_DURATION_MS) {
                            gestureTriggered = true;
                            JSObject event = new JSObject();
                            event.put("gesture", "volumeBothHeld");
                            event.put("durationMs", pressDuration);
                            notifyListeners("volumeGestureCompleted", event);
                        }
                    }
                }, GESTURE_DURATION_MS);
            });
        }

        // Both buttons released
        if (!isBothPressed && wasBothPressed) {
            if (!gestureTriggered) {
                notifyListeners("volumeGestureCancelled", new JSObject());
            }
            gestureTriggered = false;
        }
    }
}
