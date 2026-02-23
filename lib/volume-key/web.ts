import { WebPlugin } from '@capacitor/core';
import type { VolumeKeyPlugin } from './definitions';

export class VolumeKeyWeb extends WebPlugin implements VolumeKeyPlugin {
  async startListening(): Promise<{ success: boolean }> {
    console.log('VolumeKey plugin is not available on web platform');
    return { success: false };
  }

  async stopListening(): Promise<{ success: boolean }> {
    return { success: false };
  }
}
