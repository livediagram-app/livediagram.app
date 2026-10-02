// Storing a picked search result (docs/specs/009-elements/image-search.md
// "Where the requests go"): download the full picture in the browser, falling
// back to Openverse's thumbnail, and hand the bytes to the import image
// pipeline, which resizes, dedupes and uploads (or embeds offline).

import type { ImportImageFailure, ImportImageOutcome, ImportImageSource } from '../import-images';
import type { PickedImage } from '../upload-image';
import { creditFor, galleryNameFor, type OpenverseImage } from './openverse';
import { debugLog } from '@/lib/debug-log';

export type PickFailure = ImportImageFailure | 'download-failed';

export type PickOutcome = { ok: true; picked: PickedImage } | { ok: false; failure: PickFailure };

// The slice of an import session a pick needs.
export type PickStore = (source: ImportImageSource) => Promise<ImportImageOutcome>;

// Failures where the thumbnail is worth a try: the full file wasn't a picture
// the pipeline could read. Gallery full, no storage, offline budget are final.
const RETRY_WITH_THUMBNAIL: ReadonlySet<ImportImageFailure> = new Set([
  'unsupported',
  'missing-bytes',
]);

async function download(url: string, fetchImpl: typeof fetch): Promise<Blob | string> {
  try {
    const res = await fetchImpl(url, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) return `status-${res.status}`;
    const type = res.headers.get('content-type') ?? '';
    if (!type.toLowerCase().startsWith('image/')) return 'not-an-image';
    return await res.blob();
  } catch {
    return 'network';
  }
}

export async function storeSearchResult(
  result: OpenverseImage,
  store: PickStore,
  fetchImpl: typeof fetch = fetch,
  // Told once when the full picture is given up on for the thumbnail.
  onFallback: (reason: string) => void = () => {},
): Promise<PickOutcome> {
  const fallBack = (reason: string) => {
    debugLog('[image-search] thumbnail fallback', `reason=${reason}`);
    onFallback(reason);
  };
  const name = galleryNameFor(result);
  const done = (outcome: ImportImageOutcome & { ok: true }): PickOutcome => ({
    ok: true,
    picked: {
      id: outcome.imageId,
      width: outcome.width,
      height: outcome.height,
      originalName: name,
      credit: creditFor(result),
    },
  });

  const full = await download(result.url, fetchImpl);
  if (typeof full !== 'string') {
    const outcome = await store({ kind: 'blob', blob: full, name });
    if (outcome.ok) return done(outcome);
    if (!RETRY_WITH_THUMBNAIL.has(outcome.failure)) return { ok: false, failure: outcome.failure };
    fallBack(outcome.failure);
  } else {
    fallBack(full);
  }

  const thumb = await download(result.thumbnail, fetchImpl);
  if (typeof thumb === 'string') return { ok: false, failure: 'download-failed' };
  const outcome = await store({ kind: 'blob', blob: thumb, name });
  return outcome.ok ? done(outcome) : { ok: false, failure: outcome.failure };
}

// The copy a failed pick shows under the grid.
export function pickFailureMessage(failure: PickFailure): string {
  switch (failure) {
    case 'gallery-full':
      return 'Your image gallery is full. Delete some images and try again.';
    case 'images-unavailable':
      return 'Image uploads are not available on this server.';
    case 'too-large':
    case 'offline-budget':
      return 'That image is too large to add.';
    default:
      return 'Couldn’t download that image. Try another one.';
  }
}
