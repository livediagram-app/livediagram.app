// The readers reader-bench.mts can drive, each loaded once and then asked one
// crop at a time. SmolVLM goes through the editor's OWN `readOne` (prompt,
// generation settings, answer slicing), so the number describes what ships.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { MODEL_ID, readOne, type LoadedReader } from '../lib/reading/reader-model';
import {
  doctrRead,
  PADDLE_RAPIDOCR,
  PADDLE_V6,
  paddleDetect,
  paddleDictFromYaml,
  paddleRead,
  readLines,
  type PaddleSettings,
  type Ort,
  type OrtSession,
  type Rgb,
} from './reader-bench-ocr.mts';
import { sharp } from './reader-bench-sharp.mts';

export type BenchReader = { load: () => Promise<(image: string) => Promise<string>> };

type Transformers = typeof import('@huggingface/transformers');

// Weights are cached outside the repository, once for every checkout.
export const MODEL_CACHE = process.env.READER_BENCH_CACHE ?? `${homedir()}/models/transformersjs`;

const transformers = async (): Promise<Transformers> => {
  const t = await import('@huggingface/transformers');
  t.env.cacheDir = MODEL_CACHE;
  return t;
};

// The editor's cap on one note's answer, for every generative reader.
const MAX_NEW_TOKENS = 48;

type ModelOptions = NonNullable<
  Parameters<Transformers['AutoModelForVision2Seq']['from_pretrained']>[1]
>;
// A weight precision, whole or per part ('q8' is the `_quantized` files).
type Dtype = ModelOptions['dtype'];

// The editor's reader, on the CPU instead of WASM: the same q4 weights. The
// embedding table barely shrinks at q4 (its q4 file is its fp32 one), so
// `embedQ8` is the same model with that one part at q8: a smaller download.
const SMOLVLM_Q4: Dtype = 'q4';
const SMOLVLM_Q4_EMBED_Q8: Dtype = {
  embed_tokens: 'q8',
  vision_encoder: 'q4',
  decoder_model_merged: 'q4',
};

function smolvlm(modelId: string, dtype: Dtype = SMOLVLM_Q4): BenchReader {
  return {
    load: async () => {
      const { AutoProcessor, AutoModelForVision2Seq } = await transformers();
      const processor = await AutoProcessor.from_pretrained(modelId);
      const model = await AutoModelForVision2Seq.from_pretrained(modelId, {
        device: 'cpu',
        dtype,
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
        const out = (await reader(image, { max_new_tokens: MAX_NEW_TOKENS })) as {
          generated_text: string;
        }[];
        return out[0]?.generated_text ?? '';
      };
    },
  };
}

type FlorenceProcessor = {
  construct_prompts: (task: string) => string[];
  post_process_generation: (
    text: string,
    task: string,
    size: number[],
  ) => Record<string, string | { labels: string[] }>;
};

// Florence-2's OCR. `<OCR>` runs a note's lines together with no space
// between them, so `<OCR_WITH_REGION>` is measured too: one label per line,
// joined with spaces, at the price of eight location tokens a line (hence the
// larger cap). q8 by default: its fp32 files are a gigabyte.
const FLORENCE_REGION_TOKENS = 128;

function florence(
  modelId: string,
  task: '<OCR>' | '<OCR_WITH_REGION>',
  dtype: Dtype = 'q8',
): BenchReader {
  return {
    load: async () => {
      const { AutoProcessor, Florence2ForConditionalGeneration, RawImage } = await transformers();
      const processor = await AutoProcessor.from_pretrained(modelId);
      const florenceProcessor = processor as unknown as FlorenceProcessor &
        ((image: unknown, prompts: unknown) => Promise<object>);
      const model = await Florence2ForConditionalGeneration.from_pretrained(modelId, {
        device: 'cpu',
        dtype,
      });
      const max_new_tokens = task === '<OCR>' ? MAX_NEW_TOKENS : FLORENCE_REGION_TOKENS;
      return async (image) => {
        const raw = await RawImage.fromURL(image);
        const inputs = await florenceProcessor(raw, florenceProcessor.construct_prompts(task));
        const ids = await model.generate({ ...inputs, max_new_tokens } as never);
        const text = processor.batch_decode(ids as never, { skip_special_tokens: false })[0] ?? '';
        const parsed = florenceProcessor.post_process_generation(text, task, raw.size)[task];
        if (typeof parsed === 'string') return parsed;
        return (parsed?.labels ?? []).map((l) => l.replace(/<\/?s>/g, '').trim()).join(' ');
      };
    },
  };
}

// ---- Detect-then-recognise OCR, on onnxruntime directly --------------------

// The runtime transformers.js already brings: the version the editor's
// worker would load.
const fromTransformers = createRequire(import.meta.resolve('@huggingface/transformers'));
type OrtNode = Ort & {
  InferenceSession: { create: (path: string) => Promise<OrtSession> };
};

const OCR_CACHE = `${homedir()}/models`;

// A weight file, fetched once into the cache.
async function weights(url: string, file: string): Promise<string> {
  const path = `${OCR_CACHE}/${file}`;
  if (existsSync(path)) return path;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

async function rgbOf(image: string): Promise<Rgb> {
  const { data, info } = await sharp(image)
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

const RAPIDOCR = 'https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/master';

// Where a PP-OCR generation's files are: a detector, a recogniser, and the
// recogniser's characters (a text file, one per line, or v6's inference.yml).
type PaddleFiles = {
  det: string;
  rec: string;
  dict: { url: string; format: 'txt' | 'yml' };
  settings: PaddleSettings;
};

// PaddleOCR mobile v4/v5: the files RapidOCR publishes (Apache-2.0).
const PADDLE_V4: PaddleFiles = {
  det: `${RAPIDOCR}/onnx/PP-OCRv4/det/ch_PP-OCRv4_det_mobile.onnx`,
  rec: `${RAPIDOCR}/onnx/PP-OCRv4/rec/en_PP-OCRv4_rec_mobile.onnx`,
  dict: {
    url: `${RAPIDOCR}/paddle/PP-OCRv4/rec/en_PP-OCRv4_rec_mobile/en_dict.txt`,
    format: 'txt',
  },
  settings: PADDLE_RAPIDOCR,
};
const PADDLE_V5: PaddleFiles = {
  det: `${RAPIDOCR}/onnx/PP-OCRv5/det/ch_PP-OCRv5_det_mobile.onnx`,
  rec: `${RAPIDOCR}/onnx/PP-OCRv5/rec/en_PP-OCRv5_rec_mobile.onnx`,
  dict: {
    url: `${RAPIDOCR}/paddle/PP-OCRv5/rec/en_PP-OCRv5_rec_mobile/ppocrv5_en_dict.txt`,
    format: 'txt',
  },
  settings: PADDLE_RAPIDOCR,
};

// PP-OCRv6 (tiny / small / medium): PaddlePaddle's own ONNX exports.
const ppocrV6 = (tier: 'tiny' | 'small' | 'medium'): PaddleFiles => {
  const repo = (part: string) =>
    `https://huggingface.co/PaddlePaddle/PP-OCRv6_${tier}_${part}_onnx/resolve/main`;
  return {
    det: `${repo('det')}/inference.onnx`,
    rec: `${repo('rec')}/inference.onnx`,
    dict: { url: `${repo('rec')}/inference.yml`, format: 'yml' },
    settings: PADDLE_V6,
  };
};

// The cache file for a URL: its name, prefixed by the repository for
// PaddlePaddle's own (every file there is called inference.*).
const cacheName = (url: string) => {
  const parts = url.split('/');
  return url.startsWith('https://huggingface.co/') ? `${parts[4]}-${parts.at(-1)}` : parts.at(-1)!;
};

function paddle(files: PaddleFiles): BenchReader {
  return {
    load: async () => {
      const ort = fromTransformers('onnxruntime-node') as OrtNode;
      const get = (url: string) => weights(url, `paddleocr-onnx/${cacheName(url)}`);
      const det = await ort.InferenceSession.create(await get(files.det));
      const rec = await ort.InferenceSession.create(await get(files.rec));
      const text = readFileSync(await get(files.dict.url), 'utf8');
      const dict = files.dict.format === 'yml' ? paddleDictFromYaml(text) : text.split('\n');
      if (dict.at(-1) === '') dict.pop();
      const settings = files.settings;
      return async (image) => paddleRead({ ort, det, rec, dict, settings }, await rgbOf(image));
    },
  };
}

// A handwriting line recogniser needs lines: PP-OCR's detector finds them,
// TrOCR reads each one. Every line is kept (TrOCR gives no confidence).
function linesThenTrocr(files: PaddleFiles, modelId: string): BenchReader {
  return {
    load: async () => {
      const ort = fromTransformers('onnxruntime-node') as OrtNode;
      const det = await ort.InferenceSession.create(
        await weights(files.det, `paddleocr-onnx/${cacheName(files.det)}`),
      );
      const { pipeline, RawImage } = await transformers();
      const trocr = await pipeline('image-to-text', modelId, { device: 'cpu', dtype: 'q8' });
      const recognise = async (line: Rgb) => {
        const image = new RawImage(line.data, line.width, line.height, 3);
        const out = (await trocr(image, { max_new_tokens: MAX_NEW_TOKENS })) as {
          generated_text: string;
        }[];
        return { text: out[0]?.generated_text.trim() ?? '', score: 1 };
      };
      return async (image) => {
        const img = await rgbOf(image);
        const lines = await paddleDetect({ ort, det, settings: files.settings }, img);
        return readLines(lines, img, recognise, 0);
      };
    },
  };
}

const ONNXTR = 'https://github.com/felixdittrich92/OnnxTR/releases/download';

// docTR's DBNet (MobileNetV3) and PARSeq, as OnnxTR publishes them (Apache-2.0).
// fp32: OnnxTR's statically quantised 8-bit detectors find nothing (v0.2.0) or
// noise (v0.1.2) on onnxruntime 1.21.
const DOCTR_FP32 = {
  det: 'v0.2.0/db_mobilenet_v3_large-4987e7bd.onnx',
  rec: 'v0.0.1/parseq-00b40714.onnx',
};

function doctr(files: { det: string; rec: string }): BenchReader {
  return {
    load: async () => {
      const ort = fromTransformers('onnxruntime-node') as OrtNode;
      const get = (f: string) => weights(`${ONNXTR}/${f}`, `onnxtr/${f.split('/').pop()}`);
      const det = await ort.InferenceSession.create(await get(files.det));
      const rec = await ort.InferenceSession.create(await get(files.rec));
      return async (image) => doctrRead({ ort, det, rec }, await rgbOf(image));
    },
  };
}

export const READERS: Record<string, BenchReader> = {
  'smolvlm-256m': smolvlm(MODEL_ID),
  'smolvlm-256m-embed-q8': smolvlm(MODEL_ID, SMOLVLM_Q4_EMBED_Q8),
  'smolvlm-500m': smolvlm('HuggingFaceTB/SmolVLM-500M-Instruct'),
  'smolvlm-500m-embed-q8': smolvlm('HuggingFaceTB/SmolVLM-500M-Instruct', SMOLVLM_Q4_EMBED_Q8),
  'smolvlm2-256m': smolvlm('HuggingFaceTB/SmolVLM2-256M-Video-Instruct'),
  'smolvlm2-500m': smolvlm('HuggingFaceTB/SmolVLM2-500M-Video-Instruct', SMOLVLM_Q4_EMBED_Q8),
  'trocr-small-handwritten': imageToText('Xenova/trocr-small-handwritten'),
  'trocr-small-printed': imageToText('Xenova/trocr-small-printed'),
  'trocr-base-handwritten': imageToText('Xenova/trocr-base-handwritten'),
  'florence-2-base': florence('onnx-community/Florence-2-base-ft', '<OCR>'),
  'florence-2-base-regions': florence('onnx-community/Florence-2-base-ft', '<OCR_WITH_REGION>'),
  'paddleocr-v4-mobile': paddle(PADDLE_V4),
  'paddleocr-v5-mobile': paddle(PADDLE_V5),
  'ppocr-v6-tiny': paddle(ppocrV6('tiny')),
  'ppocr-v6-small': paddle(ppocrV6('small')),
  'ppocr-v6-medium': paddle(ppocrV6('medium')),
  'doctr-db-mobilenet-parseq': doctr(DOCTR_FP32),
  'ppocr-v6-det+trocr-small-handwritten': linesThenTrocr(
    ppocrV6('small'),
    'Xenova/trocr-small-handwritten',
  ),
  'ppocr-v6-det+trocr-base-handwritten': linesThenTrocr(
    ppocrV6('small'),
    'Xenova/trocr-base-handwritten',
  ),
};
