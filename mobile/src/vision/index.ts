import { visionConfig } from './config';
import { demoVisionProvider } from './providers/demo';
import { onDeviceVisionProvider } from './providers/onDevice';
import { remoteVisionProvider } from './providers/remote';
import type { VisionProvider } from './types';

const providers: Record<string, VisionProvider> = {
  demo: demoVisionProvider,
  'on-device': onDeviceVisionProvider,
  remote: remoteVisionProvider,
};

export const visionProvider = providers[visionConfig.activeProvider];
export const analyzeLegoPhoto = visionProvider.analyze.bind(visionProvider);

export * from './config';
export * from './providers/onDevice';
export * from './types';
