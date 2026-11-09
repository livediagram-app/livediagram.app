import { clickTour, findTour } from '@liveworkspace/workbench/components/tour/tour-dom';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';
import type { CursorTarget, Point } from '@/lib/replay/topic';
import { dockItemSelector } from '@/lib/replay/topics/draw-shared';

// Watch It Built's hands on the real chrome (docs/specs/007-editor/blueprints/watch-it-built.md "Driving the chrome"):
// finding what Example points at, and opening or closing the editor's own panels by pressing their own buttons, so
// what people see is exactly what they will use. Nothing here writes the document: a press that would (a look in the
// Theme & canvas dialog) is never made; the topic's frame draws its result instead.

export function centreOfNode(el: Element | null | undefined): Point | null {
  const r = el?.getBoundingClientRect();
  return r && r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

// What a control says: its own words, and its accessible name (an icon tile has only that).
const words = (el: Element) =>
  [el.textContent ?? '', el.getAttribute('aria-label') ?? ''].map((w) => w.trim().toLowerCase());

// The first match by its words: the exact words first, then words it ends with (a preset's swatch draws an "A" before
// its name), then words it starts with, then words it holds (a look card's preview draws its own sample words first).
function byWords<T extends Element>(nodes: T[], text: string): T | null {
  const want = text.toLowerCase();
  const some = (n: T, test: (w: string) => boolean) => words(n).some((w) => w !== '' && test(w));
  return (
    nodes.find((n) => some(n, (w) => w === want)) ??
    nodes.find((n) => some(n, (w) => w.endsWith(want))) ??
    nodes.find((n) => some(n, (w) => w.startsWith(want))) ??
    nodes.find((n) => some(n, (w) => w.includes(want))) ??
    null
  );
}

/** A visible match of `selector`, by its words when given. */
export function findNode(selector: string, text?: string): HTMLElement | null {
  const nodes = [...document.querySelectorAll<HTMLElement>(selector)].filter(
    (n) => n.getBoundingClientRect().width > 0,
  );
  return text === undefined ? (nodes[0] ?? null) : byWords(nodes, text);
}

/** A button in the element menu or its flyout, by the words on it. */
export function menuButton(name: string): HTMLElement | null {
  return findNode('[data-context-menu] button, [data-menu-flyout] button', name);
}

/** Where a target is on screen now, or null while it is not there. `toScreen` maps a canvas point. */
export function resolveTarget(to: CursorTarget, toScreen: (p: Point) => Point): Point | null {
  switch (to.kind) {
    case 'tour':
      return centreOfNode(findTour(to.id));
    case 'find':
      return centreOfNode(findNode(to.selector, to.text));
    case 'menu':
      return centreOfNode(menuButton(to.name));
    case 'canvas':
      return toScreen(to);
    case 'element': {
      const r = document.querySelector(elementSelector(to.id))?.getBoundingClientRect();
      if (!r || r.width === 0) return null;
      const x = r.left + r.width / 2;
      if (to.at === 'bottom') return { x, y: r.bottom + 14 };
      if (to.at === 'top') return { x, y: r.top };
      return { x, y: r.top + r.height / 2 };
    }
  }
}

/** A part of the real chrome the replay can hold open: whether it is open, and the press that opens or closes it. */
export type Openable = { isOpen(): boolean; toggle(): void };

const byTour = (trigger: string, open: () => Element | null): Openable => ({
  isOpen: () => !!open(),
  toggle: () => {
    clickTour(trigger);
  },
});

const TAB_STYLE = '[role="dialog"][aria-label="Tab style"]';
const press = (selector: string) => findNode(selector)?.click();

// A category on the palette's category bar, by its own anchor (`bar-<category id>`, CategoryBar.tsx
// CategoryBarButtons): open while its button says so. A press with no pointer (detail 0) toggles it, as a keyboard
// press does.
const byBar = (tourId: string): Openable => ({
  isOpen: () => findTour(tourId)?.getAttribute('aria-expanded') === 'true',
  toggle: () => {
    clickTour(tourId);
  },
});

// A group on the open flyout's rail (PaletteCategoryRail.tsx, its `<nav aria-label="<things> groups">`), by its place
// down the rail (a group's row holds its glyph and count, so its words are no handle). Opening presses its row;
// closing presses the first row, which is where the rail starts when nothing is remembered, so the browse memory
// (PaletteCategoryBrowser.tsx BrowseMemory) is put back as the replay leaves.
const railRow = (things: string, n: number) =>
  findNode(`nav[aria-label="${things} groups"] > button:nth-child(${n})`);
const byRailGroup = (things: string, n: number): Openable => ({
  isOpen: () => railRow(things, n)?.getAttribute('aria-current') === 'true',
  toggle: () => {
    const open = railRow(things, n)?.getAttribute('aria-current') === 'true';
    railRow(things, open ? 1 : n)?.click();
  },
});

// A dock flyout, opened and closed by its own button (WhiteboardDock.tsx DockFlyoutHost: `whiteboard-flyout-<kind>`
// is in the page only while that flyout is open). `inHand`: a marker's button opens its flyout only while it is the
// tool in hand; otherwise a press would pick the pen up and store it (DrawingToolsGroup.tsx onPress), so the press is
// made only while the button reads as in hand (`aria-pressed`, drawn in from the frame's `dock`), and is tried again
// on the next frame until it does.
const byDock = (key: string, kind: string, inHand = false): Openable => ({
  isOpen: () => !!document.getElementById(`whiteboard-flyout-${kind}`),
  toggle: () => {
    const button = document.querySelector<HTMLElement>(dockItemSelector(key));
    if (!button || (inHand && button.getAttribute('aria-pressed') !== 'true')) return;
    button.click();
  },
});

// Every part of the chrome a topic may hold open, by the ids its frames name.
export const OPENABLES: Record<string, Openable> = {
  // The palette's first category (Shapes; in Workshop also the first), its flyout.
  palette: byTour('palette-category', () => findTour('palette-category-menu')),
  // The Tab Style dialog (components/dialogs/CanvasThemeDialog.tsx), opened by the footer's Style
  // (LayersThemeStrip.tsx `canvas-theme`) and closed by its own Close.
  'tab-style': {
    isOpen: () => !!document.querySelector(TAB_STYLE),
    toggle: () => {
      if (document.querySelector(TAB_STYLE)) press(`${TAB_STYLE} button[aria-label="Close"]`);
      else clickTour('canvas-theme');
    },
  },
  // The footer's Tidy Up popover (components/canvas/TidyUpPopover.tsx), by its own button (LayersThemeStrip.tsx).
  'tidy-up': {
    isOpen: () => !!document.querySelector('[data-tidy-kind]'),
    toggle: () => {
      clickTour('tidy-up');
    },
  },
  // The palette strip's Search panel (components/palette/ToolbarSearch.tsx), by its own button.
  search: {
    isOpen: () => !!document.querySelector('[data-toolbar-search]'),
    toggle: () => press('[data-toolbar-search-button]'),
  },
  // The Tab Style dialog's Canvas panel (LooksHome.tsx's Fine-tune row), back home by the panel's Back bar.
  'tab-style-canvas': {
    isOpen: () => !!document.querySelector('[data-tab-style-view="canvas"]'),
    toggle: () => {
      if (document.querySelector('[data-tab-style-view="canvas"]'))
        press('[data-tab-style-view="canvas"] button');
      else press('[data-tour-id="tab-style-fine-tune"] button[aria-label^="Canvas"]');
    },
  },
  // Workshop's category bar (palette-layouts.ts WORKSHOP, session-category.tsx): Write, Ask, Session, Stickers.
  'bar-write': byBar('bar-write'),
  'bar-collab-ask': byBar('bar-collab-ask'),
  'bar-session': byBar('bar-session'),
  'bar-stickers': byBar('bar-stickers'),
  // Session's groups (session-category.tsx SESSION_GROUP_IDS: Tools, Record, React, ...) and Stickers' (stickers.ts
  // STICKER_CATEGORIES: Badges, Reactions, ...), on the open flyout's rail.
  'session-tools': byRailGroup('session tools', 1),
  'session-react': byRailGroup('session tools', 3),
  'stickers-reactions': byRailGroup('stickers', 2),
  // Draw's dock (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows"): Shapes, the Settings cog, and
  // Marker 2's flyout.
  'dock-shapes': byDock('shapes', 'shapes'),
  'dock-settings': byDock('settings', 'settings'),
  'dock-pen-second': byDock('second', 'second', true),
};

/** Open what `want` names and close what the replay opened that it no longer names: the last opened first, so a panel
 *  inside a dialog closes before the dialog does (closing the dialog first, the panel's Back would reopen its home). */
export function syncOpen(want: readonly string[], opened: Set<string>) {
  for (const id of [...opened].reverse()) {
    if (want.includes(id)) continue;
    const o = OPENABLES[id];
    if (o?.isOpen()) o.toggle();
    opened.delete(id);
  }
  for (const id of want) {
    const o = OPENABLES[id];
    if (!o) continue;
    if (!o.isOpen()) o.toggle();
    opened.add(id);
  }
}

/** How many animation frames `holdOpen` tries again for, at most (about half a second). */
export const HOLD_OPEN_FRAMES = 30;

/**
 * `syncOpen` now, then again on each animation frame while something `want` names is not open yet, `frames` times at
 * most. A part may not open on the first press: a marker's flyout opens only once the dock draws the pen in hand, a
 * render after the frame that put it there (byDock). While the clock runs its next frame would press again anyway, but
 * paused, or under reduced motion (a chapter's end state, with no clock), nothing else would, and the flyout never
 * opened (Work Tracker #668). Returns the stop: the next frame's hold, or the end, cancels this one.
 */
export function holdOpen(
  want: readonly string[],
  opened: Set<string>,
  frames = HOLD_OPEN_FRAMES,
): () => void {
  let raf = 0;
  let left = frames;
  const settled = () => want.every((id) => OPENABLES[id]?.isOpen() ?? true);
  const step = () => {
    syncOpen(want, opened);
    if (left-- > 0 && !settled()) raf = requestAnimationFrame(step);
  };
  step();
  return () => cancelAnimationFrame(raf);
}

// A section row of the element menu or its flyouts (a flyout, an accordion: data-menu-section, the workbench's
// MenuFlyoutSection and MenuAccordionSection), so a control with the same words inside a section (Colours' "Border"
// colour, which opens its own picker) is never taken for the Border section's row.
export const MENU_ROWS =
  '[data-context-menu] button[data-menu-section], [data-menu-flyout] button[data-menu-section]';

/** The element menu opened as far as `path` goes, each row pressed by its words when not yet expanded. */
export function openMenuPath(path: readonly string[]) {
  for (const name of path) {
    const button = findNode(MENU_ROWS, name);
    if (button && button.getAttribute('aria-expanded') !== 'true') button.click();
  }
}

/** Types into a field as a person would: the value set through the input's own setter, then an input event. */
export function typeInto(selector: string, text: string) {
  const input = findNode(selector) as HTMLInputElement | null;
  if (!input || input.value === text) return;
  // The prototype's setter, so React's value tracker sees a change, called through Reflect on the input itself.
  const proto = Object.getPrototypeOf(input) as object;
  Reflect.set(proto, 'value', text, input);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
