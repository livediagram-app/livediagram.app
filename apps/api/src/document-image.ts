import {
  getCommunityThumbnailSvg,
  getDocumentTabImageSvg,
  getDocumentThumbnailSvg,
  type ThumbnailOptions,
  type ThumbnailSubject,
} from './thumbnail';
import type { Runtime } from './types';

// The image a reader of a document gets (docs/specs/006-document/document-snapshots.md): their tab when the link is
// scoped to one, else the first-tab snapshot; for a Community reader, always drawn from the redacted tab, never the
// owner's snapshot. One choice for the share image and the document thumbnail routes.
export async function documentImageSvg(
  env: Runtime,
  liveDoc: ThumbnailSubject,
  reader: { tabId: string | null; community: boolean },
  opts: ThumbnailOptions = {},
): Promise<string | null> {
  if (reader.tabId) return getDocumentTabImageSvg(env, liveDoc, reader.tabId, reader.community);
  return reader.community
    ? getCommunityThumbnailSvg(env, liveDoc, opts)
    : getDocumentThumbnailSvg(env, liveDoc, opts);
}
