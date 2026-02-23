"use client"

import { usePathname } from 'next/navigation';
import { useOfflineStatus } from '@/hooks/use-offline';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function OfflineIndicator() {
  const { isOnline, queueCount } = useOfflineStatus();
  const pathname = usePathname();

  // Don't show on login page
  if (pathname === '/login' || pathname?.startsWith('/login')) {
    return null;
  }

  // Don't show if online and no queued requests
  if (isOnline && queueCount === 0) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 
      flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium
      ${isOnline 
        ? 'bg-green-100 text-green-800 border border-green-300' 
        : 'bg-orange-100 text-orange-800 border border-orange-300'
      }`}
    >
      {isOnline ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Back online • {queueCount} pending</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Offline mode • {queueCount} queued</span>
        </>
      )}
    </div>
  );
}
