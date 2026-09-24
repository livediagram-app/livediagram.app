import type { NoteCrop } from '@livediagram/api-schema';
import { downloadProgress, type ModelDownload, type ModelProgressEvent } from './download-progress';
import type { ReaderBackend } from './reader-protocol';

// Reading the handwriting with a model that runs HERE (spec/139 Phase 9).
//
// A small vision-language model, not an OCR engine. That is the finding the
// whole module rests on: measured on a real workshop wall, Tesseract read ONE
// note in twenty-four and invented words on every blank crop, while this reads
// about four words in five (docs/vision/handwriting-readers.md). OCR engines
// are trained on printed text; a marker scrawl on coloured paper is a
// different problem, and a small VLM is the smallest thing that actually does
// it.
//
// It runs in a WORKER (reader.worker.ts), never on the page: a wall is
// hundreds of generations, and on the page they took the main thread whole.
//
// Nothing leaves the machine: the weights come down once and the crops are
// read locally. This is the reader a deployment with no model key gets, and it
// is why the photo import needs no key at all.

// The model, and why this one. SmolVLM-256M is the smallest that reads real
// handwriting; the 500M variant is twice the download for about two points of
// accuracy, which is the wrong trade on a phone. q4 for the decoder is what
// makes it ~190MB rather than a gigabyte.
const MODEL_ID = 'HuggingFaceTB/SmolVLM-256M-Instruct';

// Ask for the words and nothing else. Deliberately plain: a firmer
// instruction ("reply with only the words, nothing else") made the model drop
// whole LINES from a multi-line note — at this size the prompt is part of the
// measurement, so it is not to be "improved" without re-running the bench.
const PROMPT =
  'Read the handwriting on this sticky note. Reply with only the words written, exactly as written. If there is no writing, reply with nothing.';

// What the model says when the paper is blank. It answers this consistently on
// an empty crop, which is a better blank-detector than asking it for a
// sentinel token (asking changed how it read real text).
export const BLANK_ANSWERS = /^(no|none|nothing|n\/a|blank|no writing|no text)\b[.!]?$/i;

// A note is a phrase. Past this the model is repeating itself, which small
// models do when they cannot read the image.
const MAX_NEW_TOKENS = 48;

type Transformers = typeof import('@huggingface/transformers');
type Tensor = InstanceType<Transformers['Tensor']>;
type Processor = Awaited<ReturnType<Transformers['AutoProcessor']['from_pretrained']>>;
type VisionModel = Awaited<ReturnType<Transformers['AutoModelForVision2Seq']['from_pretrained']>>;

type Loaded = { processor: Processor; model: VisionModel; backend: ReaderBackend };

export type LoadedReader = Loaded;

// Loaded once by the worker, which keeps it: the weights are the expensive
// part, and a second import in the same session should not pay for them
// again. The import is dynamic so the model runtime is its own chunk.
export async function loadReader(onDownload: (d: ModelDownload) => void): Promise<Loaded> {
  return (async () => {
    const { AutoProcessor, AutoModelForVision2Seq } = await import('@huggingface/transformers');
    // The weights: `.onnx` files, and the external-data files beside them.
    const progress = downloadProgress({ counts: (file) => /\.onnx(_data)?$/.test(file) });
    const progress_callback = (event: ModelProgressEvent) => {
      progress.update(event);
      onDownload(progress.current());
    };
    // The processor's few small files load first and are not reported: counted,
    // they filled the bar to 100% before the model's own files had begun, and
    // then it fell back. The WEIGHTS start together, so from their first
    // event the total is the real one.
    const processor = await AutoProcessor.from_pretrained(MODEL_ID);
    // WebGPU where it works, WASM everywhere else. WebGPU is ~14x faster but
    // needs `shader-f16`, which some drivers do not expose; asking for it and
    // falling back is the only way to know, since the adapter reports a GPU
    // either way.
    let backend: ReaderBackend = 'webgpu';
    const model = await AutoModelForVision2Seq.from_pretrained(MODEL_ID, {
      device: 'webgpu',
      dtype: { embed_tokens: 'fp16', vision_encoder: 'fp16', decoder_model_merged: 'q4' },
      progress_callback,
    }).catch(() => {
      backend = 'wasm';
      return AutoModelForVision2Seq.from_pretrained(MODEL_ID, {
        device: 'wasm',
        dtype: 'q4',
        progress_callback,
      });
    });
    // However the files arrived — from the network or the browser's cache —
    // the bar ends here.
    progress_callback({ status: 'ready' });
    return { processor, model, backend };
  })();
}

export async function readOne(loaded: Loaded, crop: NoteCrop): Promise<string> {
  const { RawImage } = await import('@huggingface/transformers');
  const image = await RawImage.fromURL(crop.image);
  // A multimodal turn is a LIST of parts (an image and a question), which is
  // how the library's own vision examples call it — but its published `Message`
  // type still says `content: string`, from the text-only days. The cast is
  // that gap, not a shortcut.
  const messages = [
    { role: 'user', content: [{ type: 'image' }, { type: 'text', text: PROMPT }] },
  ] as unknown as Parameters<Processor['apply_chat_template']>[0];
  const prompt = loaded.processor.apply_chat_template(messages, { add_generation_prompt: true });
  // No image splitting: it tiles the crop at higher resolution, and while that
  // helped this model slightly it costs about four times the time — too slow
  // for the WASM path, which is the one that has to work everywhere.
  const inputs = await loaded.processor(prompt, [image], { do_image_splitting: false });
  const generated = await loaded.model.generate({
    ...inputs,
    max_new_tokens: MAX_NEW_TOKENS,
    do_sample: false,
  });
  // `generate` is typed as the union of every shape it can return; asking for
  // plain token ids (no scores, no dict) always yields the tensor.
  const tokens = generated as Tensor;
  // Drop the prompt's own tokens: what was asked is not what was read.
  const answerTokens = tokens.slice(null, [inputs.input_ids.dims.at(-1), null]);
  const decoded = loaded.processor.batch_decode(answerTokens, {
    skip_special_tokens: true,
  })[0] as string;
  return decoded ?? '';
}
