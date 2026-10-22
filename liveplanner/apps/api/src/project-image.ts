import {
  getProjectTabImageSvg,
  getProjectThumbnailSvg,
  type ThumbnailOptions,
  type ThumbnailSubject,
} from './thumbnail';
import type { Env } from './types';

// The image a reader of a project gets (docs/specs/006-project/project-snapshots.md): their tab when the link is
// scoped to one, else the first-tab snapshot. One choice for the share image and the project thumbnail routes.
export async function projectImageSvg(
  env: Env,
  liveDoc: ThumbnailSubject,
  tabId: string | null,
  opts: ThumbnailOptions = {},
): Promise<string | null> {
  if (tabId) return getProjectTabImageSvg(env, liveDoc, tabId);
  return getProjectThumbnailSvg(env, liveDoc, opts);
}
