export type VisionProviderId = 'demo' | 'on-device' | 'remote';

export type LegoColor =
  | 'blue'
  | 'red'
  | 'yellow'
  | 'green'
  | 'white'
  | 'black'
  | 'gray';

export type LegoShape =
  | 'brick'
  | 'short'
  | 'plate'
  | 'slope'
  | 'curve'
  | 'wheel'
  | 'axle';

export type DetectedPiece = {
  color: LegoColor;
  shape: LegoShape;
  count: number;
  name: string;
  confidence?: number;
};

export type VisionRequest = {
  imageUri: string;
};

export type VisionResult = {
  pieces: DetectedPiece[];
  totalPieces: number;
  providerId: VisionProviderId;
  modelName: string;
  processingLocation: 'demo' | 'device' | 'server';
  warnings?: string[];
};

export interface VisionProvider {
  readonly id: VisionProviderId;
  readonly displayName: string;
  analyze(request: VisionRequest): Promise<VisionResult>;
}

// This is the tiny bridge a native ONNX, ExecuTorch, MediaPipe, or LiteRT
// implementation must provide. The UI and build generator never need to change.
export type OnDeviceVisionRunner = (
  request: VisionRequest,
  modelName: string,
) => Promise<Omit<VisionResult, 'providerId' | 'modelName' | 'processingLocation'>>;
