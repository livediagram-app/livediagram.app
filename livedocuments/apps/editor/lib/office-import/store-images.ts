// The pictures inside an Office file stored through the import image pipeline
// (docs/specs/020-import-export/office-import.md "Images"; the blueprint's "storePictures"): each picture part once,
// at most OFFICE_MAX_IMAGES of them, three at a time, so at most three pictures' bytes are unpacked at once.

import {
  IMPORT_IMAGE_CONCURRENCY,
  IMPORT_IMAGE_MAX_SOURCE_BYTES,
} from '@liveworkspace/workbench/lib/import-images/constants';
import type { ImportImageOutcome, ImportImageSession } from '../import-images';
import type { OfficePicture } from './docx';
import { OfficeImportError } from './errors';
import { OFFICE_MAX_IMAGES } from './limits';
import type { OfficePackage } from './package';
import { zipKey } from './zip';

/** A stored picture's outcome, or 'over-cap' for one past OFFICE_MAX_IMAGES. */
export type PictureOutcome = ImportImageOutcome | 'over-cap';

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  emf: 'image/x-emf',
  wmf: 'image/x-wmf',
};

/** A picture part's MIME type by its extension; the pipeline names what it cannot decode `unsupported`. */
export function pictureMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

export async function storePictures(
  pkg: Pick<OfficePackage, 'readBytes'>,
  pictures: readonly OfficePicture[],
  session: ImportImageSession,
  onProgress: (done: number, total: number) => void = () => {},
): Promise<Map<string, PictureOutcome>> {
  const out = new Map<string, PictureOutcome>();
  const firsts = new Map<string, OfficePicture>();
  for (const p of pictures) {
    const key = zipKey(p.path);
    if (!firsts.has(key)) firsts.set(key, p);
  }
  const queue = [...firsts.entries()];
  for (const [key] of queue.slice(OFFICE_MAX_IMAGES)) out.set(key, 'over-cap');
  const work = queue.slice(0, OFFICE_MAX_IMAGES);
  let done = 0;
  let next = 0;
  onProgress(0, work.length);

  const one = async (key: string, picture: OfficePicture): Promise<PictureOutcome> => {
    let bytes: Uint8Array | null;
    try {
      bytes = await pkg.readBytes(picture.path, IMPORT_IMAGE_MAX_SOURCE_BYTES);
    } catch (error) {
      const tooLarge = error instanceof OfficeImportError && error.failure === 'unpacks-too-large';
      return { ok: false, failure: tooLarge ? 'too-large' : 'missing-bytes' };
    }
    if (!bytes) return { ok: false, failure: 'missing-bytes' };
    const blob = new Blob([bytes as BlobPart], { type: pictureMimeType(key) });
    const name = picture.path.split('/').pop();
    const hint =
      picture.widthPx > 0 && picture.heightPx > 0
        ? { width: picture.widthPx, height: picture.heightPx }
        : undefined;
    return session.store({ kind: 'blob', blob, ...(name ? { name } : {}) }, hint);
  };

  const worker = async () => {
    while (next < work.length) {
      const [key, picture] = work[next++]!;
      out.set(key, await one(key, picture));
      done += 1;
      onProgress(done, work.length);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(IMPORT_IMAGE_CONCURRENCY, work.length) }, worker),
  );
  return out;
}
