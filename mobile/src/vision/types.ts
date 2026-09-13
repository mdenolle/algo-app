import type { KidColor, PartFamily } from '../catalog/types';

export type VisionProviderId = 'demo' | 'on-device' | 'remote';

// Kid-facing vocabulary now comes from the verified catalog (mobile/src/catalog),
// so a scan result can never name a color or shape the catalog does not know.
export type LegoColor = KidColor;
export type LegoShape = PartFamily;

export type DetectedPiece = {
  /** Rebrickable / LEGO design number, e.g. "3001" (Brick 2 x 4). */
  partNum: string;
  /** Rebrickable color id, e.g. 1 (Blue). */
  colorId: number;
  /** LEGO element id for this exact part+color, when the catalog has one. */
  elementId?: string;
  /** Derived from the catalog for drawing: kid color word and visual family. */
  color: LegoColor;
  shape: LegoShape;
  /** Spoken name, e.g. "blue 2 × 4 brick". */
  name: string;
  count: number;
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
// The model's class labels must map to catalog part numbers and Rebrickable
// color ids; use describePiece() from ../catalog to fill the derived fields.
export type OnDeviceVisionRunner = (
  request: VisionRequest,
  modelName: string,
) => Promise<Omit<VisionResult, 'providerId' | 'modelName' | 'processingLocation'>>;
