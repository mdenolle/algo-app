import { visionConfig } from '../config';
import type { OnDeviceVisionRunner, VisionProvider } from '../types';

let nativeRunner: OnDeviceVisionRunner | undefined;

// The future native model module calls this once when the app starts. Keeping
// this registration point small makes it easy to compare different models.
export function registerOnDeviceVisionRunner(runner: OnDeviceVisionRunner) {
  nativeRunner = runner;
}

export const onDeviceVisionProvider: VisionProvider = {
  id: 'on-device',
  displayName: visionConfig.onDevice.modelName,
  async analyze(request) {
    if (!nativeRunner) {
      throw new Error(
        'The on-device model is selected, but its native runner is not installed yet. Use a development build and register an ONNX, ExecuTorch, MediaPipe, or LiteRT runner.',
      );
    }

    const result = await nativeRunner(request, visionConfig.onDevice.modelName);
    return {
      ...result,
      providerId: 'on-device',
      modelName: visionConfig.onDevice.modelName,
      processingLocation: 'device',
    };
  },
};
