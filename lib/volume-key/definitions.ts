import { Plugin, PluginListenerHandle } from '@capacitor/core';

export interface VolumeKeyPlugin extends Plugin {
  startListening(): Promise<{ success: boolean }>;
  stopListening(): Promise<{ success: boolean }>;
  addListener(
    eventName: 'volumeGestureStarted' | 'volumeGestureCompleted' | 'volumeGestureCancelled',
    listenerFunc: (event: any) => void
  ): Promise<PluginListenerHandle>;
}

export interface VolumeGestureEvent {
  gesture: 'volumeBothHeld';
  durationMs: number;
}
