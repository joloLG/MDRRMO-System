"use client"

import { useState, useEffect, useCallback } from 'react';
import { OfflineService } from '@/lib/offline-service';

interface OfflineStatus {
  isOnline: boolean;
  queueCount: number;
  isSyncing: boolean;
}

export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    queueCount: 0,
    isSyncing: false
  });

  useEffect(() => {
    // Initialize offline service
    OfflineService.init();

    const updateStatus = () => {
      const queueStatus = OfflineService.getQueueStatus();
      setStatus(prev => ({
        ...prev,
        isOnline: queueStatus.isOnline,
        queueCount: queueStatus.count
      }));
    };

    // Update initially
    updateStatus();

    // Listen for changes
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    // Poll queue status every 5 seconds
    const interval = setInterval(updateStatus, 5000);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearInterval(interval);
    };
  }, []);

  return status;
}

export function useOfflineFetch() {
  const fetchWithOffline = useCallback(async (
    url: string, 
    options?: RequestInit
  ): Promise<Response | null> => {
    return OfflineService.fetchWithOfflineSupport(url, options);
  }, []);

  const syncNow = useCallback(async () => {
    if (navigator.onLine) {
      await OfflineService.syncQueuedRequests();
    }
  }, []);

  return { fetchWithOffline, syncNow };
}
