import { WebPlugin } from '@capacitor/core';
import type { ShakeDetectorPlugin } from './definitions';

export class ShakeDetectorWeb extends WebPlugin implements ShakeDetectorPlugin {
  async startListening(): Promise<{ success: boolean; message?: string }> {
    console.log('ShakeDetector plugin is not available on web platform');
    return { success: false, message: 'Shake detection only available on mobile app' };
  }

  async stopListening(): Promise<{ success: boolean; message?: string }> {
    return { success: false };
  }
}
