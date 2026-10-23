// The import image pipeline's vocabulary (docs/specs/020-import-export/import-image-pipeline.md).

import type { AcceptedImageType } from '@livedocuments/api-schema';

// Picture bytes to store: a `data:` URL or a Blob with its MIME type.
export type ImportImageSource =
  | { kind: 'data-url'; dataUrl: string; name?: string }
  | { kind: 'blob'; blob: Blob; name?: string };

// Size of the element the image fills, in canvas units. Only SVG sizing reads it.
export type DisplayHint = { width: number; height: number };

// Named, non-fatal failures.
export type ImportImageFailure =
  | 'missing-bytes'
  | 'unsupported'
  | 'too-large'
  | 'gallery-full'
  | 'images-unavailable'
  | 'offline-budget'
  | 'upload-failed';

type StoredImportImageKind = 'uploaded' | 'deduped' | 'embedded';

export type StoredImportImage = {
  ok: true;
  imageId: string;
  width: number;
  height: number;
  kind: StoredImportImageKind;
};

export type ImportImageFailed = { ok: false; failure: ImportImageFailure };

export type ImportImageOutcome = StoredImportImage | ImportImageFailed;

// A picture ready to store: accepted type, final bytes, natural size.
export type PreparedImportImage = {
  blob: Blob;
  mimeType: AcceptedImageType;
  width: number;
  height: number;
};

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
