import {
  getDesignTabImageSvg,
  getDesignThumbnailSvg,
  type ThumbnailSubject,
} from './thumbnail';
import type { Env } from './types';

// The image a reader of a design gets (docs/specs/006-design/design-snapshots.md): their tab when the link is
// scoped to one, else the first-tab snapshot. One choice for the share image and the design thumbnail routes.
export async function designImageSvg(
  env: Env,
  liveDoc: ThumbnailSubject,
  tabId: string | null,
): Promise<string | null> {
  if (tabId) return getDesignTabImageSvg(env, liveDoc, tabId);
  return getDesignThumbnailSvg(env, liveDoc);
}
