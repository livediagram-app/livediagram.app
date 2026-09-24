import { describe, expect, it } from 'vitest';
import { TELEMETRY_TYPE_PATTERN } from '@livediagram/api-schema';
import { BOUNDARY_BACKENDS, BOUNDARY_FAILURES } from './protocol';
import { detectorTelemetryType } from './telemetry';

describe('detectorTelemetryType', () => {
  it('names the hybrid by its backend', () => {
    expect(detectorTelemetryType({ path: 'hybrid', backend: 'webgpu' })).toBe(
      'PhotoDetectHybridWebGpu',
    );
    expect(detectorTelemetryType({ path: 'hybrid', backend: 'wasm' })).toBe(
      'PhotoDetectHybridWasm',
    );
  });

  it('names the classical detector by why the model did not run', () => {
    expect(detectorTelemetryType({ path: 'classical', reason: 'timeout' })).toBe(
      'PhotoDetectClassicalTimeout',
    );
    expect(detectorTelemetryType({ path: 'classical', reason: 'inference-failed' })).toBe(
      'PhotoDetectClassicalInferenceFailed',
    );
  });

  it('gives every outcome a distinct token the wire accepts', () => {
    const tokens = [
      ...BOUNDARY_BACKENDS.map((backend) => detectorTelemetryType({ path: 'hybrid', backend })),
      ...BOUNDARY_FAILURES.map((reason) => detectorTelemetryType({ path: 'classical', reason })),
    ];
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const t of tokens) expect(t).toMatch(TELEMETRY_TYPE_PATTERN);
  });
});
