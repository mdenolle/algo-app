import { visionConfig } from '../config';
import type { VisionProvider, VisionResult } from '../types';

export const remoteVisionProvider: VisionProvider = {
  id: 'remote',
  displayName: visionConfig.remote.modelName,
  async analyze({ imageUri }) {
    if (!visionConfig.remote.endpoint) {
      throw new Error('EXPO_PUBLIC_VISION_ENDPOINT has not been configured.');
    }

    const body = new FormData();
    body.append('photo', { uri: imageUri, name: 'lego-pieces.jpg', type: 'image/jpeg' } as unknown as Blob);
    const response = await fetch(visionConfig.remote.endpoint, { method: 'POST', body });
    if (!response.ok) throw new Error(`Scanner server returned ${response.status}.`);

    const result = (await response.json()) as Omit<
      VisionResult,
      'providerId' | 'modelName' | 'processingLocation'
    >;
    return {
      ...result,
      providerId: 'remote',
      modelName: visionConfig.remote.modelName,
      processingLocation: 'server',
    };
  },
};
