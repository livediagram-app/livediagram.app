// The readers reader-bench.mts can drive, each loaded once and then asked one
// crop at a time. SmolVLM goes through the editor's OWN `readOne` (prompt,
// generation settings, answer slicing), so the number describes what ships.
import { MODEL_ID, readOne, type LoadedReader } from '../lib/reading/reader-model';

export type BenchReader = { load: () => Promise<(image: string) => Promise<string>> };

type Transformers = typeof import('@huggingface/transformers');
const transformers = (): Promise<Transformers> => import('@huggingface/transformers');

// The editor's reader, on the CPU instead of WASM: the same q4 weights.
function smolvlm(modelId: string): BenchReader {
  return {
    load: async () => {
      const { AutoProcessor, AutoModelForVision2Seq } = await transformers();
      const processor = await AutoProcessor.from_pretrained(modelId);
      const model = await AutoModelForVision2Seq.from_pretrained(modelId, {
        device: 'cpu',
        dtype: 'q4',
      });
      const loaded = { processor, model, backend: 'wasm' } as LoadedReader;
      return (image) => readOne(loaded, { id: 0, image });
    },
  };
}

// A line recogniser (TrOCR): one line of text per image, which a sticky is not
// — measured anyway, because it is the obvious small candidate.
function imageToText(modelId: string, dtype: 'q8' | 'fp32' = 'q8'): BenchReader {
  return {
    load: async () => {
      const { pipeline } = await transformers();
      const reader = await pipeline('image-to-text', modelId, { device: 'cpu', dtype });
      return async (image) => {
        const out = (await reader(image)) as { generated_text: string }[];
        return out[0]?.generated_text ?? '';
      };
    },
  };
}

// Florence-2's OCR task.
function florence(modelId: string): BenchReader {
  return {
    load: async () => {
      const { AutoProcessor, Florence2ForConditionalGeneration, RawImage } = await transformers();
      const processor = await AutoProcessor.from_pretrained(modelId);
      const model = await Florence2ForConditionalGeneration.from_pretrained(modelId, {
        device: 'cpu',
        dtype: 'fp32',
      });
      return async (image) => {
        const raw = await RawImage.fromURL(image);
        const task = '<OCR>';
        const prompts = (
          processor as unknown as { construct_prompts: (t: string) => string[] }
        ).construct_prompts(task);
        const inputs = await (processor as unknown as (i: unknown, p: unknown) => Promise<object>)(
          raw,
          prompts,
        );
        const ids = await model.generate({ ...inputs, max_new_tokens: 48 } as never);
        const text = processor.batch_decode(ids as never, { skip_special_tokens: false })[0] ?? '';
        const parsed = (
          processor as unknown as {
            post_process_generation: (
              t: string,
              task: string,
              size: number[],
            ) => Record<string, string>;
          }
        ).post_process_generation(text, task, raw.size);
        return parsed[task] ?? '';
      };
    },
  };
}

export const READERS: Record<string, BenchReader> = {
  'smolvlm-256m': smolvlm(MODEL_ID),
  'smolvlm-500m': smolvlm('HuggingFaceTB/SmolVLM-500M-Instruct'),
  'trocr-small-handwritten': imageToText('Xenova/trocr-small-handwritten'),
  'trocr-small-printed': imageToText('Xenova/trocr-small-printed'),
  'trocr-base-handwritten': imageToText('Xenova/trocr-base-handwritten'),
  'florence-2-base': florence('onnx-community/Florence-2-base-ft'),
};
