// The DOM a page's tour steps point at (docs/specs/007-editor/illustrate-tour.md "The steps"): the tour page and its
// title-bar controls, held by that page rather than the first page, and its title-bar popovers (Layout, Background),
// opened once by pressing their real button and closed again on leaving the step.
import { waitForSelector } from './tour-dom';

/** The tour page's sheet. */
export const pageSheet = (pageId: string) => `[data-illustrate-page-id="${CSS.escape(pageId)}"]`;

/** A control in the tour page's title bar, by its name. */
export const pageButton = (pageId: string, name: string) =>
  `${pageSheet(pageId)} button[aria-label="${name}"]`;

/** The tour page's cog, which opens its panel. */
export const pageCog = (pageId: string) => `${pageSheet(pageId)} [data-tour-id="page-cog"]`;

/** A title-bar popover by its name: anchored under its button, or a bottom sheet on a phone. */
export const titlePopover = (name: string) =>
  `[role="dialog"][aria-label="${name}"]:is([data-anchored-popover], [data-bottom-sheet])`;

// Whether an element sits wholly in the window.
function inWindow(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return (
    r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight
  );
}

/** The + that adds a page: the one after the last page while it is in the window, else the Toolbar strip's (a long
 *  row of pages runs the first off screen). Neither in the window (a phone has no strip +): none, and the step is
 *  left out. */
export function addPageAnchor(): string | null {
  const row = document.querySelector('[data-tour-id="add-page"]');
  if (row && inWindow(row)) return '[data-tour-id="add-page"]';
  const strip = document.querySelector('[data-tour-id="add-page-strip"]');
  return strip && inWindow(strip) ? '[data-tour-id="add-page-strip"]' : null;
}

// The popovers a step has opened while it is up: opened once on entering, so one closed by a pick stays closed and
// the ring moves to the page instead (pageOrPopover).
const opened = new Set<string>();

/** Opens the tour page's title-bar popover `name` by its button, once per step, and waits for it to show. */
export async function openTitlePopover(pageId: string, name: string): Promise<void> {
  if (opened.has(name)) return;
  opened.add(name);
  const button = document.querySelector<HTMLButtonElement>(pageButton(pageId, name));
  if (!button) return;
  if (button.getAttribute('aria-expanded') !== 'true') button.click();
  await waitForSelector(titlePopover(name), 1000);
}

/** Closes the popover the step opened if it is still open, and forgets it for the next step. */
export function closeTitlePopover(pageId: string, name: string): void {
  if (!opened.delete(name)) return;
  const button = document.querySelector<HTMLButtonElement>(pageButton(pageId, name));
  if (button?.getAttribute('aria-expanded') === 'true') button.click();
}

/** The popover while it is open, else the tour page: after a pick closes it, the ring shows what landed. */
export function pageOrPopover(pageId: string, name: string): string {
  return document.querySelector(titlePopover(name)) ? titlePopover(name) : pageSheet(pageId);
}

// The Slide Deck, opened from the Slides button in the bottom-right cluster.
export const SLIDES_BUTTON = '[data-tour-id="slides"] button[aria-expanded]';
export const SLIDE_DECK = '[data-tour-id="slide-deck"]';
let deckOpened = false;

export async function openSlideDeck(): Promise<void> {
  if (deckOpened) return;
  deckOpened = true;
  const button = document.querySelector<HTMLButtonElement>(SLIDES_BUTTON);
  if (button && button.getAttribute('aria-expanded') !== 'true') button.click();
  await waitForSelector(SLIDE_DECK, 1000);
}

export function closeSlideDeck(): void {
  if (!deckOpened) return;
  deckOpened = false;
  const button = document.querySelector<HTMLButtonElement>(SLIDES_BUTTON);
  if (button?.getAttribute('aria-expanded') === 'true') button.click();
}

/** Closes whatever a page's tour opened, for a tour that stops under a step (its page gone, the mode left). */
export function tidyPageTour(pageId: string): void {
  closeTitlePopover(pageId, 'Layout');
  closeTitlePopover(pageId, 'Background');
  closeSlideDeck();
}

/** Forgets what an earlier tour opened (one that ended with its page unmounted under it): each run starts clean. */
export function resetPageTour(): void {
  opened.clear();
  deckOpened = false;
}
