// A link that opens with Inspect (docs/specs/007-editor/wireframe-pages.md "A link that opens with Inspect"): the
// `inspect` parameter, read once as the editor opens, and the link Copy Inspect Link copies.
import { wantsFlag, withFlag } from './link-flag';

/** The URL parameter that opens a wireframe tab with Inspect on. */
export const INSPECT_PARAM = 'inspect';

/** Whether an address asks to open with Inspect (`?inspect`, `?inspect=1`; never `?inspect=0`). */
export function wantsInspect(search: string): boolean {
  return wantsFlag(search, INSPECT_PARAM);
}

/** A link with the inspect parameter added (kept once if it is already there). */
export function withInspect(href: string): string {
  return withFlag(href, INSPECT_PARAM);
}

/** The fields of an index share link this reads. */
export type InspectableLink = {
  code: string;
  level: string;
  tabId: string | null;
  expiresAt: number | null;
  public?: boolean;
};

/** The design's live Viewer link to hand a builder: one for every tab first, else this tab's; never a Community
 *  post's public link or one that has run out. Null when there is none. */
export function inspectViewLink<T extends InspectableLink>(
  links: readonly T[],
  tabId: string,
  now: number,
): T | null {
  const live = links.filter(
    (l) => l.level === 'view' && l.public !== true && (l.expiresAt === null || l.expiresAt > now),
  );
  return live.find((l) => l.tabId === null) ?? live.find((l) => l.tabId === tabId) ?? null;
}
