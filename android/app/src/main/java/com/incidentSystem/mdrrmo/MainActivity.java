package com.incidentSystem.mdrrmo;

import android.content.Context;
import android.os.Bundle;
import android.os.Build;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register ShakeDetector plugin
        registerPlugin(ShakeDetectorPlugin.class);
        
        // Setup window for all Android versions (11 through 15+)
        setupWindow();
        
        // Configure WebView for session persistence
        configureWebView();
    }
    
    private void setupWindow() {
        Window window = getWindow();
        
        // Enable edge-to-edge display compatible with all Android versions
        WindowCompat.setDecorFitsSystemWindows(window, false);
        
        // Set status bar and navigation bar to be transparent on Android 11+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
            window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            // Android 5.0+ but less than 11
            window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
            window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        }
        
        // Configure system bars appearance
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            // Light status bar icons for dark backgrounds
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }
    }
    
    private void configureWebView() {
        // Get the WebView from the bridge
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            
            // Enable DOM storage for localStorage support
            settings.setDomStorageEnabled(true);
            
            // Enable database storage
            settings.setDatabaseEnabled(true);
            
            // Enable local storage
            String databasePath = getApplicationContext().getDir("database", Context.MODE_PRIVATE).getPath();
            settings.setDatabasePath(databasePath);
            
            // Enable cookies
            android.webkit.CookieManager cookieManager = android.webkit.CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(webView, true);
            
            // Ensure localStorage is available
            webView.evaluateJavascript("localStorage.setItem('test', 'test'); localStorage.removeItem('test');", null);
        }
    }
}
