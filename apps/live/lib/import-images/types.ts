// The import image pipeline's vocabulary (docs/specs/020-import-export/import-image-pipeline.md).

import type { AcceptedImageType } from '@livediagram/api-schema';

// Bytes an importer found in a file: a `data:` URL (Excalidraw's `files`) or a
// Blob with its MIME type (archive formats).
export type ImportImageSource =
  | { kind: 'data-url'; dataUrl: string; name?: string }
  | { kind: 'blob'; blob: Blob; name?: string };

// Size of the element the image fills, in canvas units. Only SVG sizing reads it.
export type DisplayHint = { width: number; height: number };

// Named, non-fatal failures, in the order the report lists them.
export const IMPORT_IMAGE_FAILURES = [
  'missing-bytes',
  'unsupported',
  'too-large',
  'gallery-full',
  'images-unavailable',
  'offline-budget',
  'upload-failed',
] as const;
export type ImportImageFailure = (typeof IMPORT_IMAGE_FAILURES)[number];

export type StoredImportImageKind = 'uploaded' | 'deduped' | 'embedded';

export type StoredImportImage = {
  ok: true;
  imageId: string;
  width: number;
  height: number;
  kind: StoredImportImageKind;
};

export type ImportImageFailed = { ok: false; failure: ImportImageFailure };

export type ImportImageOutcome = StoredImportImage | ImportImageFailed;

// One image element an importer wants filled. Requests sharing a `key` (an
// Excalidraw fileId) are processed once. A null source is `missing-bytes`.
export type ImportImageRequest = {
  elementId: string;
  key: string;
  source: ImportImageSource | null;
  hint?: DisplayHint;
};

// A picture ready to store: accepted type, final bytes, natural size.
export type PreparedImportImage = {
  blob: Blob;
  mimeType: AcceptedImageType;
  width: number;
  height: number;
};

// Counted per image element; the three add up to the requests.
export type ImportImageReport = {
  imported: number;
  deduped: number;
  placeholders: Partial<Record<ImportImageFailure, number>>;
};

export type ImportImageProgress = { done: number; total: number };

export type ImportImageSession = {
  store(source: ImportImageSource, hint?: DisplayHint): Promise<ImportImageOutcome>;
};

export type DecodedImage = { width: number; height: number; close(): void };

// The DOM seam: the browser implementation lives in browser.ts, tests fake it.
export type ImageCodec = {
  decode(blob: Blob, mimeType: string): Promise<DecodedImage | null>;
  encode(
    image: DecodedImage,
    width: number,
    height: number,
    type: string,
    quality: number,
  ): Promise<Blob | null>;
};
