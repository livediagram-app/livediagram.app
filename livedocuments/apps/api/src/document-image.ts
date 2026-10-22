import {
  getDocumentTabImageSvg,
  getDocumentThumbnailSvg,
  type ThumbnailOptions,
  type ThumbnailSubject,
} from './thumbnail';
import type { Env } from './types';

// The image a reader of a document gets (docs/specs/006-document/document-snapshots.md): their tab when the link is
// scoped to one, else the first-tab snapshot. One choice for the share image and the document thumbnail routes.
export async function documentImageSvg(
  env: Env,
  liveDoc: ThumbnailSubject,
  tabId: string | null,
  opts: ThumbnailOptions = {},
): Promise<string | null> {
  if (tabId) return getDocumentTabImageSvg(env, liveDoc, tabId);
  return getDocumentThumbnailSvg(env, liveDoc, opts);
}
