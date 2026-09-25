import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromPretrained = vi.fn(async () => ({}));
vi.mock('@huggingface/transformers', () => ({
  AutoProcessor: { from_pretrained: vi.fn(async () => ({})) },
  AutoModelForVision2Seq: { from_pretrained: fromPretrained },
}));

import { loadReader, MODEL_ID } from './reader-model';

// Which weights each engine loads (docs/vision/handwriting-readers.md). On the
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
    await loadReader(() => {}, 'webgpu');
    expect(fromPretrained).toHaveBeenCalledWith(
      MODEL_ID,
      expect.objectContaining({
        device: 'webgpu',
        dtype: { embed_tokens: 'fp16', vision_encoder: 'fp16', decoder_model_merged: 'q4' },
      }),
    );
  });
});
