"use client"

import { useEffect } from 'react';
import { OfflineService } from '@/lib/offline-service';

interface OfflineProviderProps {
  children: React.ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('[OfflineProvider] Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('[OfflineProvider] Service Worker registration failed:', error);
        });
    }

    // Initialize offline service
    OfflineService.init();

    // Request notification permission for emergency alerts
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('[OfflineProvider] Notification permission:', permission);
      });
    }
  }, []);

  return (
    <>
      {children}
    </>
  );
}
