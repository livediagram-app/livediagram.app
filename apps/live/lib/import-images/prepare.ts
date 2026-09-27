// Decode, plan, encode and pick the bytes to store for one imported image
// (docs/specs/020-import-export/blueprints/import-image-pipeline.md "prepareImportImage").
// The DOM work sits behind the injected codec, so this runs under Node.

import { MAX_IMAGE_BYTES, sniffImageType } from '@livediagram/api-schema';
import { IMPORT_IMAGE_JPEG_QUALITY, IMPORT_IMAGE_WEBP_QUALITY } from './constants';
import { fallbackOutputType, planImageEncoding } from './policy';
import type {
  DecodedImage,
  DisplayHint,
  ImageCodec,
  ImportImageFailure,
  PreparedImportImage,
} from './types';

export type PrepareResult =
  (PreparedImportImage & { ok: true }) | { ok: false; failure: ImportImageFailure };

const fail = (failure: ImportImageFailure): PrepareResult => ({ ok: false, failure });

export async function prepareImportImage(
  bytes: Uint8Array,
  mimeType: string,
  hint: DisplayHint | undefined,
  codec: ImageCodec,
): Promise<PrepareResult> {
  const original = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mimeType });
  let decoded: DecodedImage | null;
  try {
    decoded = await codec.decode(original, mimeType);
  } catch {
    decoded = null;
  }
  if (!decoded) return fail('unsupported');

  try {
    const plan = planImageEncoding({
      mimeType,
      width: decoded.width,
      height: decoded.height,
      byteLength: bytes.byteLength,
      hint,
    });
    let chosen = original;
    let width = decoded.width;
    let height = decoded.height;
    if (plan.action === 'encode') {
      const encoded = await encodeWithFallback(decoded, plan.width, plan.height, mimeType, codec);
      if (!encoded) return fail('unsupported');
      if (!(plan.keepIfSmaller && original.size <= encoded.size)) {
        chosen = encoded;
        width = plan.width;
        height = plan.height;
      }
    }
    return await finalise(chosen, width, height);
  } finally {
    decoded.close();
  }
}

async function encodeWithFallback(
  decoded: DecodedImage,
  width: number,
  height: number,
  sourceMime: string,
  codec: ImageCodec,
): Promise<Blob | null> {
  try {
    const webp = await codec.encode(
      decoded,
      width,
      height,
      'image/webp',
      IMPORT_IMAGE_WEBP_QUALITY,
    );
    if (!webp || webp.type === 'image/webp') return webp;
    const type = fallbackOutputType(sourceMime);
    const quality = type === 'image/jpeg' ? IMPORT_IMAGE_JPEG_QUALITY : 1;
    return await codec.encode(decoded, width, height, type, quality);
  } catch {
    return null;
  }
}

// The gallery only takes accepted types under the per-file cap; check the
// bytes themselves, not what the encoder claimed.
async function finalise(blob: Blob, width: number, height: number): Promise<PrepareResult> {
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const mimeType = sniffImageType(head);
  if (!mimeType) return fail('unsupported');
  if (blob.size > MAX_IMAGE_BYTES) return fail('too-large');
  const typed = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
  return { ok: true, blob: typed, mimeType, width, height };
}
