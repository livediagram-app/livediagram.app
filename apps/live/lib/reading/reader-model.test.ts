import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromPretrained = vi.fn(async () => ({}));
vi.mock('@huggingface/transformers', () => ({
  AutoProcessor: { from_pretrained: vi.fn(async () => ({})) },
  AutoModelForVision2Seq: { from_pretrained: fromPretrained },
  RawImage: { fromURL: vi.fn(async () => ({ width: 200, height: 120 })) },
}));

import { loadReader, MODEL_ID, readOne, type LoadedReader } from './reader-model';

// Which weights each engine loads (docs/research/vision/handwriting-readers.md). On the
// processor the embedding table is loaded at q8: its q4 file is the fp32 table,
// so q8 is 85 MB less to download for the same answers (78 of 86 identical,
// the same score). On the graphics card q8 embedding produced garbage, so it
// is never used there.
describe('loadReader', () => {
  beforeEach(() => fromPretrained.mockClear());

  it('loads the q8 embedding on the processor', async () => {
    await loadReader(() => {}, 'wasm');
    expect(fromPretrained).toHaveBeenCalledWith(
      MODEL_ID,
      expect.objectContaining({
        device: 'wasm',
        dtype: { embed_tokens: 'q8', vision_encoder: 'q4', decoder_model_merged: 'q4' },
      }),
    );
  });

  it('keeps half precision on a graphics card that has it', async () => {
    await loadReader(() => {}, 'webgpu', { f16: true });
    expect(fromPretrained).toHaveBeenCalledWith(
      MODEL_ID,
      expect.objectContaining({
        device: 'webgpu',
        dtype: { embed_tokens: 'fp16', vision_encoder: 'fp16', decoder_model_merged: 'q4' },
      }),
    );
  });

  it('runs the q4 weights in full precision on a card without half precision', async () => {
    // Not the q8 embedding: on the graphics card it produced garbage.
    await loadReader(() => {}, 'webgpu', { f16: false });
    expect(fromPretrained).toHaveBeenCalledWith(
      MODEL_ID,
      expect.objectContaining({ device: 'webgpu', dtype: 'q4' }),
    );
  });
});

// A model that answers its prompt's five token ids and then three of its own, and a processor that
// decodes ids as text: what reading keeps is the answer alone.
describe('readOne', () => {
  const ids = [1, 2, 3, 4, 5, 60, 70, 80];
  const tokens = {
    dims: [1, ids.length],
    slice: (_rows: null, [from, to]: [number, number | null]) => ids.slice(from, to ?? undefined),
  };
  const inputs = { input_ids: { dims: [1, 5] }, pixel_values: { dims: [1, 3] } };
  const generate = vi.fn(async () => tokens);
  const processor = Object.assign(
    vi.fn(async () => inputs),
    {
      apply_chat_template: vi.fn(() => 'prompt'),
      batch_decode: vi.fn((answer: number[]) => [answer.join(' ')]),
    },
  );
  const loaded = { processor, model: { generate }, backend: 'wasm' } as unknown as LoadedReader;

  it('asks once, greedily, with the input tensors, and keeps only the answer', async () => {
    expect(await readOne(loaded, { id: 1, image: 'data:image/png;base64,' })).toBe('60 70 80');
    expect(generate).toHaveBeenCalledWith({ ...inputs, max_new_tokens: 48, do_sample: false });
  });
});
