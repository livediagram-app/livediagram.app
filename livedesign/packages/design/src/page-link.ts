// Screen links and back links (docs/specs/007-editor/wireframe-pages.md "Clickable prototypes"): an element's link to
// another page of its own tab, or back to the screen shown before, with how the screen changes. Pure: the stored
// shape, its check at the trust boundary, and how a link resolves against the tab's pages, so a link to a deleted
// page reads as broken everywhere and never throws.
import { isRecord } from '@liveworkspace/model-core/is-record';
import type { Page } from './page';

// How a screen link changes screens: absent reads as instant.
export const PAGE_LINK_TRANSITIONS = ['instant', 'slide', 'dissolve'] as const;
export type PageLinkTransition = (typeof PAGE_LINK_TRANSITIONS)[number];
export const DEFAULT_PAGE_LINK_TRANSITION: PageLinkTransition = 'instant';

// The longest page id a screen link stores. A page id is `page-` and 8 hex characters (nextPageId), or `page-1`;
// a stored or imported one may be longer, never this long.
export const PAGE_LINK_ID_MAX = 64;

export type PageLink = { kind: 'page'; pageId: string; transition?: PageLinkTransition };
export type BackLink = { kind: 'back'; transition?: PageLinkTransition };
export type ScreenLink = PageLink | BackLink;

export function isPageLinkTransition(value: unknown): value is PageLinkTransition {
  return (PAGE_LINK_TRANSITIONS as readonly unknown[]).includes(value);
}

// Whether a link is one of the two screen kinds (anything else is an element link of another kind).
export function isScreenLink(link: { kind: string } | null | undefined): link is ScreenLink {
  return link?.kind === 'page' || link?.kind === 'back';
}

export function pageLinkTransitionOf(link: ScreenLink): PageLinkTransition {
  return link.transition ?? DEFAULT_PAGE_LINK_TRANSITION;
}

export const SCREEN_LINK_RULE =
  `a screen link { kind: "page", pageId (1 to ${PAGE_LINK_ID_MAX} characters), transition? } or ` +
  `a back link { kind: "back", transition? }; transition one of ${PAGE_LINK_TRANSITIONS.join(', ')}`;

// The stored `link` field's check. Only the screen kinds are checked: the other kinds were never checked at the
// boundary, and stored designs carry them in every older form, so they stay as lenient as they were.
export function isWellFormedLinkField(value: unknown): boolean {
  if (!isRecord(value)) return true;
  if (value.kind !== 'page' && value.kind !== 'back') return true;
  if (value.transition !== undefined && !isPageLinkTransition(value.transition)) return false;
  if (value.kind === 'back') return true;
  return (
    typeof value.pageId === 'string' &&
    value.pageId.length > 0 &&
    value.pageId.length <= PAGE_LINK_ID_MAX
  );
}

export type ScreenLinkTarget =
  | { state: 'page'; page: Page; index: number }
  | { state: 'back' }
  // The page is not on the tab (deleted, or never there): the link does nothing.
  | { state: 'broken' };

export function resolveScreenLink(link: ScreenLink, pages: readonly Page[]): ScreenLinkTarget {
  if (link.kind === 'back') return { state: 'back' };
  const index = pages.findIndex((p) => p.id === link.pageId);
  return index < 0 ? { state: 'broken' } : { state: 'page', page: pages[index]!, index };
}

// What a screen is called where a link names it: its name, else its place among the tab's screens.
export function screenName(page: Pick<Page, 'name'>, index: number): string {
  const name = page.name?.trim();
  return name ? name : `Screen ${index + 1}`;
}

// The line a link marker's hover card and the link menu read for a screen link.
export function describeScreenLink(link: ScreenLink, pages: readonly Page[]): string {
  const target = resolveScreenLink(link, pages);
  switch (target.state) {
    case 'back':
      return 'Goes back to the screen before';
    case 'broken':
      return 'Broken link: its screen was deleted';
    case 'page':
      return `Goes to ${screenName(target.page, target.index)}`;
  }
}
