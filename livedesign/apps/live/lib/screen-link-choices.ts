// Setting a screen link in the editor (docs/specs/007-editor/wireframe-pages.md "Setting a link"): which screens Link
// Element's Screen mode offers, the screen an element sits on, the link a handle's drop writes, and when the link
// handle shows. Pure, so the dialog, the handle and their role rules are tested without a canvas.
import {
  elementAnchorPoint,
  isBoxed,
  isScreenLink,
  layOutPages,
  pageAt,
  pageKindOf,
  screenName,
  tabPageKind,
  type Element,
  type ElementLink,
  type LaidOutPage,
  type Page,
  type PageLink,
} from '@livedesign/design';

// One row of the Screen mode: a page of the tab, by its name or its place.
export type ScreenChoice = {
  id: string;
  name: string;
  // The screen the element sits on: shown, never pressable (a link to the screen already shown goes nowhere).
  here: boolean;
};

/** Whether a tab's pages are wireframe pages: the tab whose elements take screen links in the editor. */
export function wireframeTabPages(pages: readonly Pick<Page, 'kind'>[]): boolean {
  return tabPageKind(pages) === 'wireframe';
}

/** The laid-out page an element sits on (its anchor point's), if any. */
export function screenOfElement(
  laid: readonly LaidOutPage[],
  element: Element,
  elements: readonly Element[],
): LaidOutPage | undefined {
  return pageAt(laid, elementAnchorPoint(element, elements));
}

/** The Screen mode's rows: every page of the tab in order, the element's own marked `here`. */
export function screenLinkChoices(
  pages: readonly Page[],
  element: Element,
  elements: readonly Element[],
): ScreenChoice[] {
  const laid = layOutPages(pages);
  const hereId = screenOfElement(laid, element, elements)?.id;
  return laid.map((page, index) => ({
    id: page.id,
    name: screenName(page, index),
    here: page.id === hereId,
  }));
}

/** The link a drop on `pageId` writes: the element's transition kept when it already had a screen link. */
export function relinkToScreen(current: ElementLink | undefined, pageId: string): PageLink {
  const transition = isScreenLink(current) ? current.transition : undefined;
  return transition ? { kind: 'page', pageId, transition } : { kind: 'page', pageId };
}

/** Whether the selection shows the link handle (docs/specs/007-editor/wireframe-pages.md "Setting a link"). */
export function showsScreenLinkHandle(input: {
  element: Element | undefined;
  multiSelected: boolean;
  editing: boolean;
  menuOpen: boolean;
  paintMode: boolean;
  tabLocked: boolean;
  // Who may link the element (`can.linkScreens`; Inspect hands the canvas a never). Not `readOnly`: a Participant's
  // canvas is read-only and still links its own elements.
  canLink: ((el: Element) => boolean) | undefined;
  pages: readonly LaidOutPage[] | null | undefined;
  elements: readonly Element[];
}): boolean {
  const { element, pages } = input;
  if (!element || !isBoxed(element) || !pages || pages.length < 2) return false;
  if (input.multiSelected || input.editing || input.menuOpen || input.paintMode) return false;
  if (input.tabLocked || !input.canLink?.(element)) return false;
  const page = screenOfElement(pages, element, input.elements);
  return !!page && pageKindOf(page) === 'wireframe';
}
