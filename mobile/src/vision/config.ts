import type { VisionProviderId } from './types';

const requestedProvider = process.env.EXPO_PUBLIC_VISION_PROVIDER;

export const visionConfig = {
  // Change EXPO_PUBLIC_VISION_PROVIDER to demo, on-device, or remote.
  activeProvider: (
    requestedProvider === 'on-device' || requestedProvider === 'remote'
      ? requestedProvider
      : 'demo'
  ) as VisionProviderId,

  onDevice: {
    // Replace this name when Alex chooses or trains an open-source model.
    // The runner can use ONNX Runtime, ExecuTorch, MediaPipe, or LiteRT.
    modelName: process.env.EXPO_PUBLIC_VISION_MODEL ?? 'algo-lego-detector-v1',
  },

  remote: {
    // This should be Alex's own parent-controlled server, never a secret API key
    // embedded in the app.
    endpoint: process.env.EXPO_PUBLIC_VISION_ENDPOINT ?? '',
    modelName: process.env.EXPO_PUBLIC_VISION_MODEL ?? 'server-selected-model',
  },
} as const;
