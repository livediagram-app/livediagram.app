// A link that opens with Inspect (docs/specs/007-editor/wireframe-pages.md "A link that opens with Inspect"): the
// `inspect` parameter, read once as the editor opens, and the link Copy Inspect Link copies.

/** The URL parameter that opens a wireframe tab with Inspect on. */
export const INSPECT_PARAM = 'inspect';

/** Whether an address asks to open with Inspect (`?inspect`, `?inspect=1`; never `?inspect=0`). */
export function wantsInspect(search: string): boolean {
  const params = new URLSearchParams(search);
  if (!params.has(INSPECT_PARAM)) return false;
  const v = params.get(INSPECT_PARAM);
  return v !== '0' && v !== 'false';
}

/** A link with the inspect parameter added (kept once if it is already there). */
export function withInspect(href: string): string {
  const url = new URL(href, 'https://placeholder.invalid');
  url.searchParams.set(INSPECT_PARAM, '1');
  // A relative href stays relative.
  return href.startsWith('/') && !href.startsWith('//')
    ? `${url.pathname}${url.search}${url.hash}`
    : url.toString();
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
