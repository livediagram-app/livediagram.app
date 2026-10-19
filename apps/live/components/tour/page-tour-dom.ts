// The DOM a page's tour steps point at (docs/specs/007-editor/pages-tour.md "The steps"): the tour page and its
// title-bar controls, held by that page rather than the first page, and its title-bar popovers (Layout, Background),
// opened once by pressing their real button and closed again on leaving the step.
import { pinPageToolbar } from '@/components/canvas/article/page-toolbar-presence';
import { waitForSelector } from './tour-dom';

/** The tour page's sheet. */
export const pageSheet = (pageId: string) => `[data-page-id="${CSS.escape(pageId)}"]`;

/** A control in the tour page's title bar, by its name. */
export const pageButton = (pageId: string, name: string) =>
  `${pageSheet(pageId)} button[aria-label="${name}"]`;

/** The tour page's cog, which opens its panel. */
export const pageCog = (pageId: string) => `${pageSheet(pageId)} [data-tour-id="page-cog"]`;

/** A title-bar popover by its name: anchored under its button, or a bottom sheet on a phone. */
const titlePopover = (name: string) =>
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

/** The tour page's own Start From a Layout card (EmptyPageLayouts), shown while the page is empty. */
export const emptyPageLayouts = (pageId: string) =>
  `[data-empty-page-layouts="${CSS.escape(pageId)}"]`;

/** Where a layout step points (docs/specs/007-editor/coach-dock.md "Teach what is on screen"): the page's own Start
 *  From a Layout card while it shows, else the Layout popover or its button. */
export function layoutAnchor(pageId: string): string {
  const card = emptyPageLayouts(pageId);
  return document.querySelector(card) ? card : pageOrPopover(pageId, 'Layout');
}

/** Opens the layouts a step teaches: none while the page shows its own card, which is already open. Layout then
 *  counts as opened for the step, so a pick that takes the card away never opens the popover behind it. */
export async function openLayouts(pageId: string): Promise<void> {
  if (document.querySelector(emptyPageLayouts(pageId))) {
    opened.add('Layout');
    return;
  }
  await openTitlePopover(pageId, 'Layout');
}

/** A layout picked (Try it): a layout tile on the page's card or in the Layout popover. */
export const layoutTiles = (pageId: string) =>
  `${emptyPageLayouts(pageId)} [data-layout-tile], ${titlePopover('Layout')} [data-layout-tile]`;

/** A background picked (Try it): a choice in one of the Background popover's groups. */
export const BACKGROUND_CHOICES = `${titlePopover('Background')} [role="radiogroup"] button`;

/** The + pressed (Try it): the one after the last page, or the Toolbar strip's. */
export const ADD_PAGE_PRESS = '[data-tour-id="add-page"], [data-tour-id="add-page-strip"]';

/** The popover while it is open, else the tour page: after a pick closes it, the ring shows what landed. */
export function pageOrPopover(pageId: string, name: string): string {
  // Before the popover shows (or once a pick closed it), its title-bar button: never the whole page, whose ring
  // would light most of the screen.
  return document.querySelector(titlePopover(name)) ? titlePopover(name) : pageButton(pageId, name);
}

// A slide's speaker notes (PageNotesButton): named Add Notes until the slide has some, Notes after, and shown only
// once the page is in the deck. The popover takes the button's name, so it is found by what it holds.
const NOTES_NAMES = ['Add Notes', 'Notes'] as const;
const NOTES_POPOVER = '[data-page-notes-popover]';

/** The tour page's notes button, by either of its names. */
export const notesButton = (pageId: string) =>
  NOTES_NAMES.map((name) => pageButton(pageId, name)).join(', ');

/** Where the notes step points: the notes popover while it shows, else the button. */
export function notesAnchor(pageId: string): string {
  return document.querySelector(NOTES_POPOVER)
    ? NOTES_NAMES.map((name) => `${titlePopover(name)}:has(${NOTES_POPOVER})`).join(', ')
    : notesButton(pageId);
}

/** Opens the slide's notes popover once per step, and waits for it to show. */
export async function openNotes(pageId: string): Promise<void> {
  if (opened.has('notes')) return;
  opened.add('notes');
  const button = document.querySelector<HTMLButtonElement>(notesButton(pageId));
  if (!button) return;
  if (button.getAttribute('aria-expanded') !== 'true') button.click();
  await waitForSelector(NOTES_POPOVER, 1000);
}

/** Closes the notes popover the step opened, whatever its button is named by now (writing a note renames it). */
export function closeNotes(pageId: string): void {
  if (!opened.delete('notes')) return;
  const button = document.querySelector<HTMLButtonElement>(notesButton(pageId));
  if (button?.getAttribute('aria-expanded') === 'true') button.click();
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
  closeTitlePopover(pageId, 'Style');
  closeTitlePopover(pageId, 'Text');
  closeSlideDeck();
  pinPageToolbar(null);
}

/** Forgets what an earlier tour opened (one that ended with its page unmounted under it): each run starts clean. */
export function resetPageTour(): void {
  opened.clear();
  deckOpened = false;
}
