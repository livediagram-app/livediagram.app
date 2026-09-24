import type { PhotoDetector } from '../photo-detect';
import type { BoundaryBackend, ClassicalReason } from './protocol';

// Which detector found a photo's boxes, as the one closed telemetry token the
// photo import sends per photo (spec/22): `AI`·`Used`·`PhotoDetect…`. Whether
// the model runs out there, on which backend, and why not when it does not, is
// what decides whether it earns its download.

const BACKEND: Record<BoundaryBackend, string> = { webgpu: 'WebGpu', wasm: 'Wasm' };

const FAILURE: Record<ClassicalReason, string> = {
  'no-worker': 'NoWorker',
  'no-backend': 'NoBackend',
  'load-failed': 'LoadFailed',
  'inference-failed': 'InferenceFailed',
  timeout: 'Timeout',
  'flat-image': 'FlatImage',
};

export function detectorTelemetryType(detector: PhotoDetector): string {
  return detector.path === 'hybrid'
    ? `PhotoDetectHybrid${BACKEND[detector.backend]}`
    : `PhotoDetectClassical${FAILURE[detector.reason]}`;
}
