// The DOM a page's tour steps point at (docs/specs/007-editor/pages-tour.md "The steps"): the tour page and its
// title-bar controls, held by that page rather than the first page, and its title-bar popovers (Layout, Background),
// opened once by pressing their real button and closed again on leaving the step. On a phone the looks gather under
// Appearance, and Contents is a bottom sheet behind its cluster button (pages-tour.md "On a phone"): a step opens
// them as a person would.
import { pinPageToolbar } from '@/components/canvas/article/page-toolbar-presence';
import { isOnScreen, waitForSelector } from '@liveworkspace/workbench/components/tour/tour-dom';

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

/** A phone's Appearance on the tour page: one button for its looks (pages-mode.md "On a phone, three buttons at
 *  most"), whose sheet lists a row per look control (PageAppearanceButton). */
export const pageAppearance = (pageId: string) => pageButton(pageId, 'Appearance');
const APPEARANCE_SHEET = titlePopover('Appearance');
// Each look control's row in Appearance's sheet, by the control's name.
const APPEARANCE_ROW: Readonly<Record<string, string>> = {
  Layout: 'layout',
  Background: 'background',
  Style: 'style',
  Text: 'text',
};

/** What a look step needs on screen: the control's own title-bar button, or on a phone the Appearance that holds
 *  it. */
export const pageLook = (pageId: string, name: string) =>
  `${pageButton(pageId, name)}, ${pageAppearance(pageId)}`;

// Whether an element sits wholly in the window.
function inWindow(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return (
    r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight
  );
}

/** The + that adds a page: the one after the last page while it is in the window, else the Toolbar strip's (a long
 *  row of pages runs the first off screen). Neither in the window (a phone has no strip +): none. */
export function addPageAnchor(): string | null {
  const row = document.querySelector('[data-tour-id="add-page"]');
  if (row && inWindow(row)) return '[data-tour-id="add-page"]';
  const strip = document.querySelector('[data-tour-id="add-page-strip"]');
  return strip && inWindow(strip) ? '[data-tour-id="add-page-strip"]' : null;
}

/** Contents' own Add Page, at its foot (ContentsAddPage): in the docked sidebar, or in Contents opened from its button. */
export const CONTENTS_ADD = '[data-contents-add]';
/** Contents' button in the bottom-right cluster: Contents minimised, and always on a phone. */
export const CONTENTS_BUTTON = '[data-tour-id="contents"]';

/** Where the Add step points: a + in the window, else Contents' Add Page (opened by the step's prepare). */
export function addPageTarget(): string | null {
  return addPageAnchor() ?? (document.querySelector(CONTENTS_ADD) ? CONTENTS_ADD : null);
}

/** What the Add step needs on screen as the tour starts: a + in the window, else Contents' Add Page, else the button
 *  that opens Contents. With none (zen mode, the + panned away), the step is left out. */
export function addPageRequires(): string {
  return addPageAnchor() ?? `${CONTENTS_ADD}, ${CONTENTS_BUTTON}`;
}

/** The Add step's way in: with no + in the window, Contents opened to its Add Page. */
export async function prepareAddPage(pageId: string): Promise<void> {
  if (addPageAnchor()) return;
  await openContents(pageId);
}

// The popovers a step has opened while it is up: opened once on entering, so one closed by a pick stays closed and
// the ring moves to the page instead (pageOrPopover).
const opened = new Set<string>();

/** Opens the tour page's title-bar popover `name` by its button, once per step, and waits for it to show. On a phone,
 *  with no button of its own, it presses Appearance and then the control's row in Appearance's sheet. */
export async function openTitlePopover(pageId: string, name: string): Promise<void> {
  if (opened.has(name)) return;
  opened.add(name);
  const button = document.querySelector<HTMLButtonElement>(pageButton(pageId, name));
  if (button) {
    if (button.getAttribute('aria-expanded') !== 'true') button.click();
    await waitForSelector(titlePopover(name), 1000);
    return;
  }
  const appearance = document.querySelector<HTMLButtonElement>(pageAppearance(pageId));
  const row = APPEARANCE_ROW[name];
  if (!appearance || !row) return;
  if (appearance.getAttribute('aria-expanded') !== 'true') appearance.click();
  const choice = await waitForSelector(`${APPEARANCE_SHEET} [data-appearance-row="${row}"]`, 1000);
  if (!choice) return;
  choice.click();
  await waitForSelector(titlePopover(name), 1000);
}

// A press outside every open sheet and popover, as a person's tap on the canvas would be: how a phone's headless
// control (opened from Appearance, with no button of its own to press again) is closed. Their outside-press listeners
// sit on the window, in the capture phase (useClickOutside).
function pressOutside(): void {
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
}

/** Closes the popover the step opened if it is still open, and forgets it for the next step. */
export function closeTitlePopover(pageId: string, name: string): void {
  if (!opened.delete(name)) return;
  const button = document.querySelector<HTMLButtonElement>(pageButton(pageId, name));
  if (button) {
    if (button.getAttribute('aria-expanded') === 'true') button.click();
    return;
  }
  // A phone: the control's sheet, or Appearance's where its row never opened.
  if (document.querySelector(titlePopover(name)) || document.querySelector(APPEARANCE_SHEET))
    pressOutside();
}

/** The popover while it is open, else the tour page: after a pick closes it, the ring shows what landed. */
export function pageOrPopover(pageId: string, name: string): string {
  // Before the popover shows (or once a pick closed it), its title-bar button: never the whole page, whose ring
  // would light most of the screen. On a phone, the Appearance it opens from.
  if (document.querySelector(titlePopover(name))) return titlePopover(name);
  const own = pageButton(pageId, name);
  return document.querySelector(own) ? own : pageAppearance(pageId);
}

// The tour page's row in the Contents sidebar (docs/specs/007-editor/pages-tour.md "Slides track"), its ⋯ (the
// page's menu, where its place in the show lives) and the header's Present. Absent while Contents is minimised or
// on a phone, or while the deck has nothing to show: the step is then left out.
export const contentsRow = (pageId: string) =>
  `[data-contents-slot]:has([data-page-row="${CSS.escape(pageId)}"])`;
export const contentsRowMenu = (pageId: string) =>
  `${contentsRow(pageId)} button[aria-label^="More Actions for"]`;
export const HEADER_PRESENT = '[data-presentation-start="header"]';

/** What a Contents step needs on screen as the tour starts: the row (the docked sidebar), else Contents' button. */
export const contentsRequires = (pageId: string) => `${contentsRow(pageId)}, ${CONTENTS_BUTTON}`;

// Whether the tour opened Contents from its button, so it closes only what it opened.
let contentsOpened = false;

/** Opens Contents from its button when the tour page's row is not on screen (minimised, or a phone's sheet), and waits
 *  for the row. The docked sidebar is open already. */
export async function openContents(pageId: string): Promise<void> {
  if (isOnScreen(contentsRow(pageId))) return;
  const button = document.querySelector<HTMLElement>(CONTENTS_BUTTON);
  if (!button) return;
  if (button.getAttribute('aria-expanded') !== 'true') {
    contentsOpened = true;
    button.click();
  }
  await waitForSelector(contentsRow(pageId), 1000);
}

/** Closes Contents if the tour opened it and it is still open, by the button that opened it. */
export function closeContents(): void {
  if (!contentsOpened) return;
  contentsOpened = false;
  const button = document.querySelector<HTMLElement>(CONTENTS_BUTTON);
  if (button?.getAttribute('aria-expanded') === 'true') button.click();
}

/** Closes whatever a page's tour opened, for a tour that stops under a step (its page gone, the mode left). */
export function tidyPageTour(pageId: string): void {
  closeTitlePopover(pageId, 'Layout');
  closeTitlePopover(pageId, 'Background');
  closeTitlePopover(pageId, 'Style');
  closeTitlePopover(pageId, 'Text');
  closeContents();
  pinPageToolbar(null);
}

/** Forgets what an earlier tour opened (one that ended with its page unmounted under it): each run starts clean. */
export function resetPageTour(): void {
  opened.clear();
  contentsOpened = false;
}

/** The first block of the article's writing on the tour page (its title on a new article): where a phone's Write
 *  step points, so its card sits clear of the text it asks the person to tap (pages-tour.md "On a phone"). The
 *  writing is one editable across the article's pages, so a block is the tour page's when its middle lies on that
 *  page's sheet. Null with no writing on it. */
export function firstBlockOnPage(pageId: string): string | null {
  const sheet = document.querySelector(pageSheet(pageId));
  if (!sheet) return null;
  const page = sheet.getBoundingClientRect();
  // Blocks run in reading order, page after page: the first one on the sheet ends the walk.
  for (const block of document.querySelectorAll('[data-article-flow] [data-block-id]')) {
    const r = block.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x >= page.left && x <= page.right && y >= page.top && y <= page.bottom) {
      return `[data-article-flow] [data-block-id="${CSS.escape(block.getAttribute('data-block-id') ?? '')}"]`;
    }
  }
  return null;
}
