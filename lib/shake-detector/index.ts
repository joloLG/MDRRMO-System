import { registerPlugin } from '@capacitor/core';
import type { ShakeDetectorPlugin } from './definitions';

const ShakeDetector = registerPlugin<ShakeDetectorPlugin>('ShakeDetector', {
  web: () => import('./web').then(m => new m.ShakeDetectorWeb()),
});

export * from './definitions';
export { ShakeDetector };
