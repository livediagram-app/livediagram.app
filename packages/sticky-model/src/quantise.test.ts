import { describe, expect, it } from 'vitest';
import { dequantise, quantiseWeights, type WeightSpec } from './quantise';

// Weights to int8-sized storage the way TensorFlow.js reads it back
// (`quantization: { dtype: 'uint8', min, scale }` per tensor).

const specs: WeightSpec[] = [
  { name: 'conv/kernel', shape: [4, 8], dtype: 'float32' },
  { name: 'bn/gamma', shape: [4], dtype: 'float32' },
];
const kernel = Float32Array.from({ length: 32 }, (_, i) => Math.sin(i) * 0.7 - 0.1);
const gamma = Float32Array.from([1.1, 0.9, 1.3, 0.8]);
const data = new Float32Array([...kernel, ...gamma]).buffer;

describe('quantiseWeights', () => {
  it('stores big tensors as one byte each and small ones as they were', () => {
    const out = quantiseWeights(specs, data, { minElements: 16 });
    expect(out.specs[0]!.quantization).toMatchObject({ dtype: 'uint8' });
    expect(out.specs[1]!.quantization).toBeUndefined();
    expect(out.data.byteLength).toBe(32 + 4 * 4);
  });

  it('reads back within half a step of every weight', () => {
    const out = quantiseWeights(specs, data, { minElements: 16 });
    const back = dequantise(out.specs, out.data);
    const q = out.specs[0]!.quantization!;
    for (let i = 0; i < kernel.length; i += 1) {
      expect(Math.abs(back[0]![i]! - kernel[i]!)).toBeLessThanOrEqual(q.scale! / 2 + 1e-7);
    }
    expect([...back[1]!]).toEqual([...gamma]);
  });

  it('keeps a constant tensor exact', () => {
    const flat: WeightSpec[] = [{ name: 'k', shape: [20], dtype: 'float32' }];
    const out = quantiseWeights(flat, new Float32Array(20).fill(0.25).buffer, { minElements: 1 });
    expect([...dequantise(out.specs, out.data)[0]!]).toEqual(new Array(20).fill(0.25));
  });
});
