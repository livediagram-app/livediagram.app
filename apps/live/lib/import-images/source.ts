// An image source (a `data:` URL or a Blob from an imported file) to bytes and
// a MIME type, or a named failure (docs/specs/020-import-export/blueprints/import-image-pipeline.md).

import { sniffImageType } from '@livediagram/api-schema';
import { IMPORT_IMAGE_MAX_SOURCE_BYTES } from './constants';
import type { ImportImageFailure, ImportImageSource } from './types';

export type ReadImportImage =
  { ok: true; bytes: Uint8Array; mimeType: string } | { ok: false; failure: ImportImageFailure };

const DATA_URL = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/s;
const SVG_SNIFF_BYTES = 1024;

const fail = (failure: ImportImageFailure): ReadImportImage => ({ ok: false, failure });

export async function readImportImageSource(source: ImportImageSource): Promise<ReadImportImage> {
  let bytes: Uint8Array;
  let declared: string;
  if (source.kind === 'data-url') {
    const decoded = decodeDataUrl(source.dataUrl);
    if (!decoded.ok) return decoded;
    ({ bytes, declared } = decoded);
  } else {
    if (source.blob.size > IMPORT_IMAGE_MAX_SOURCE_BYTES) return fail('too-large');
    bytes = new Uint8Array(await source.blob.arrayBuffer());
    declared = source.blob.type.toLowerCase();
  }
  if (bytes.byteLength === 0) return fail('missing-bytes');
  if (bytes.byteLength > IMPORT_IMAGE_MAX_SOURCE_BYTES) return fail('too-large');
  return { ok: true, bytes, mimeType: sniffMime(bytes, declared) };
}

function decodeDataUrl(
  dataUrl: string,
): { ok: true; bytes: Uint8Array; declared: string } | { ok: false; failure: ImportImageFailure } {
  const match = DATA_URL.exec(dataUrl);
  if (!match) return { ok: false, failure: 'unsupported' };
  const [, type = '', params = '', payload = ''] = match;
  const isBase64 = params.split(';').some((p) => p.trim().toLowerCase() === 'base64');
  const body = isBase64 ? payload.replace(/\s+/g, '') : payload;
  // Estimate before decoding so a huge string is never materialised as bytes.
  const estimate = isBase64 ? Math.floor((body.length * 3) / 4) : body.length;
  if (estimate > IMPORT_IMAGE_MAX_SOURCE_BYTES) return { ok: false, failure: 'too-large' };
  try {
    const bytes = isBase64
      ? Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(body));
    return { ok: true, bytes, declared: type.toLowerCase() };
  } catch {
    return { ok: false, failure: 'unsupported' };
  }
}

// The bytes win over what the file declared: Excalidraw files are hand-editable.
function sniffMime(bytes: Uint8Array, declared: string): string {
  const raster = sniffImageType(bytes);
  if (raster) return raster;
  const head = new TextDecoder().decode(bytes.subarray(0, SVG_SNIFF_BYTES));
  if (head.includes('<svg')) return 'image/svg+xml';
  return declared || 'application/octet-stream';
}
