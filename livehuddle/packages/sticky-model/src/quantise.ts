// Weights stored in a byte each (experiment J4): the boundary model's
// convolution kernels as per-tensor affine uint8, in the format TensorFlow.js
// dequantises on load (`weight = byte * scale + min`), so the browser fetches
// a quarter of the bytes and runs the same float graph. Small tensors (batch
// norm, biases) stay float32: they cost nothing and carry the scale of every
// channel.

export type WeightSpec = {
  name: string;
  shape: number[];
  dtype: 'float32';
  quantization?: { dtype: 'uint8'; min: number; scale: number };
};

const count = (shape: number[]) => shape.reduce((a, b) => a * b, 1);

export function quantiseWeights(
  specs: readonly WeightSpec[],
  data: ArrayBuffer,
  opts: { minElements: number },
): { specs: WeightSpec[]; data: ArrayBuffer } {
  const floats = new Float32Array(data);
  const parts: Uint8Array[] = [];
  const out: WeightSpec[] = [];
  let offset = 0;
  for (const spec of specs) {
    const n = count(spec.shape);
    const values = floats.subarray(offset, offset + n);
    offset += n;
    if (n < opts.minElements) {
      out.push({ name: spec.name, shape: spec.shape, dtype: spec.dtype });
      parts.push(new Uint8Array(Float32Array.from(values).buffer));
      continue;
    }
    let min = Infinity;
    let max = -Infinity;
    for (const v of values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const scale = (max - min) / 255;
    const bytes = new Uint8Array(n);
    if (scale > 0) {
      for (let i = 0; i < n; i += 1) bytes[i] = Math.round((values[i]! - min) / scale);
    }
    out.push({ ...spec, quantization: { dtype: 'uint8', min, scale } });
    parts.push(bytes);
  }
  const total = parts.reduce((a, p) => a + p.byteLength, 0);
  const joined = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    joined.set(p, at);
    at += p.byteLength;
  }
  return { specs: out, data: joined.buffer };
}

// The weights back as floats, tensor by tensor: what the browser will run.
export function dequantise(specs: readonly WeightSpec[], data: ArrayBuffer): Float32Array[] {
  const out: Float32Array[] = [];
  let at = 0;
  for (const spec of specs) {
    const n = count(spec.shape);
    const q = spec.quantization;
    if (q) {
      const bytes = new Uint8Array(data, at, n);
      out.push(Float32Array.from(bytes, (b) => b * q.scale + q.min));
      at += n;
    } else {
      out.push(new Float32Array(data.slice(at, at + n * 4)));
      at += n * 4;
    }
  }
  return out;
}
