import type { ModelCues } from '@livediagram/sticky-vision';

// What the page and the boundary-model worker say to each other (docs/specs/021-event-storming/event-storming.md
// Phase 9). Closed vocabularies throughout: the backend and the failure reason
// are logged and counted as they are, so neither may ever carry free text.

// The backends tried, in order: WebGPU is tens of milliseconds a photo on a
// GPU; single-thread WASM runs everywhere in under a second on a desktop CPU.
// Threaded WASM would need the whole app cross-origin isolated.
export const BOUNDARY_BACKENDS = ['webgpu', 'wasm'] as const;
export type BoundaryBackend = (typeof BOUNDARY_BACKENDS)[number];

// Why the classical detector ran alone.
export const BOUNDARY_FAILURES = [
  // The browser cannot start a module worker.
  'no-worker',
  // Neither backend initialised.
  'no-backend',
  // The runtime chunk, the WASM binary or the weights did not arrive or parse.
  'load-failed',
  // The network ran and threw.
  'inference-failed',
  // No answer inside the time the import will wait.
  'timeout',
] as const;
export type BoundaryFailure = (typeof BOUNDARY_FAILURES)[number];

// Why the classical detector ran alone: the model failed (above), or it was
// not asked, because the image is a flat drawing (a screenshot, a drawn wall)
// and the model learnt photographs (`isFlatImage`).
export const CLASSICAL_REASONS = [...BOUNDARY_FAILURES, 'flat-image'] as const;
export type ClassicalReason = (typeof CLASSICAL_REASONS)[number];

export type WorkerRequest =
  | { type: 'warm' }
  | { type: 'cues'; id: number; width: number; height: number; data: Uint8ClampedArray };

export type WorkerResponse =
  | { type: 'ready'; backend: BoundaryBackend }
  | { type: 'cues'; id: number; backend: BoundaryBackend; cues: ModelCues; ms: number }
  | { type: 'failed'; id: number | null; reason: BoundaryFailure; detail: string };

export type BoundaryOutcome =
  { ok: true; backend: BoundaryBackend; cues: ModelCues } | { ok: false; reason: BoundaryFailure };
