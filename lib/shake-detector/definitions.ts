import { Plugin, PluginListenerHandle } from '@capacitor/core';

export interface ShakeDetectorPlugin extends Plugin {
  startListening(): Promise<{ success: boolean; message?: string }>;
  stopListening(): Promise<{ success: boolean; message?: string }>;
  addListener(
    eventName: 'shakeStarted' | 'shakeCompleted' | 'shakeCancelled',
    listenerFunc: (event: ShakeEvent) => void
  ): Promise<PluginListenerHandle>;
}

export interface ShakeEvent {
  gesture?: string;
  durationMs?: number;
  shakeCount?: number;
}
