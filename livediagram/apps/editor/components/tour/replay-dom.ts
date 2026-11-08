import { clickTour, findTour } from '@liveworkspace/workbench/components/tour/tour-dom';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';
import type { CursorTarget, Point } from '@/lib/replay/topic';

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
// its name), then words it starts with.
function byWords<T extends Element>(nodes: T[], text: string): T | null {
  const want = text.toLowerCase();
  const some = (n: T, test: (w: string) => boolean) => words(n).some((w) => w !== '' && test(w));
  return (
    nodes.find((n) => some(n, (w) => w === want)) ??
    nodes.find((n) => some(n, (w) => w.endsWith(want))) ??
    nodes.find((n) => some(n, (w) => w.startsWith(want))) ??
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
};

/** Open what `want` names and close what the replay opened that it no longer names. */
export function syncOpen(want: readonly string[], opened: Set<string>) {
  for (const id of opened) {
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

/** The element menu opened as far as `path` goes, each row pressed by its words when not yet expanded. */
export function openMenuPath(path: readonly string[]) {
  for (const name of path) {
    const button = menuButton(name);
    if (button && button.getAttribute('aria-expanded') !== 'true') button.click();
  }
}

/** Types into a field as a person would: the value set through the input's own setter, then an input event. */
export function typeInto(selector: string, text: string) {
  const input = findNode(selector) as HTMLInputElement | null;
  if (!input || input.value === text) return;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  setter?.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
