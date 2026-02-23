import { registerPlugin } from '@capacitor/core';
import type { VolumeKeyPlugin } from './definitions';

const VolumeKey = registerPlugin<VolumeKeyPlugin>('VolumeKey', {
  web: () => import('./web').then(m => new m.VolumeKeyWeb()),
});

export * from './definitions';
export { VolumeKey };
