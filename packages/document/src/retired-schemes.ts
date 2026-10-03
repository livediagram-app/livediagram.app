// Retired colour schemes (docs/specs/011-theme/retired-schemes.md). A scheme leaves the catalogue by
// being migrated away on read: a tab saved against it is rewritten into the
// scheme that replaced it, and the next save persists the rewrite. These
// colours are data about the past, frozen as they shipped; they never change.
import {
  DEFAULT_SCHEME_DARK,
  DEFAULT_SCHEME_ID,
  DEFAULT_SCHEME_LIGHT,
  themeColourFields,
} from './themes';
import type { Element, Tab } from './index';

export type RetiredScheme = 'charcoal' | 'previous-default-dark' | 'previous-default-light';

// Charcoal, merged into Default as its dark half: the id and every colour it wrote.
const CHARCOAL = {
  id: 'charcoal',
  backgroundColor: '#2b2b33',
  patternColor: '#636373',
  elementFill: '#2c2c33',
  elementStroke: '#a1a1aa',
  elementText: '#e4e4e7',
} as const;

// Default's dark half before the dark palette (docs/specs/008-canvas/canvas-and-palette.md), which a
// dark-mode reader's Default tabs stored as their backdrop.
const PREVIOUS_DEFAULT_DARK = { backgroundColor: '#2b2b33', patternColor: '#636373' } as const;

// Default's light half before the off-white canvas (docs/specs/007-editor/editor-modes.md "One
// look"): white, with the same slate grid. An unset grid read as that slate.
const PREVIOUS_DEFAULT_LIGHT = { backgroundColor: '#ffffff', patternColor: '#cbd5e1' } as const;

type SchemeFields = Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor'>;
type MigratableTab = SchemeFields & { elements: Tab['elements'] };

const onDefault = (tab: SchemeFields): boolean =>
  tab.theme === undefined || tab.theme === DEFAULT_SCHEME_ID;

const onPreviousDefaultDark = (tab: SchemeFields): boolean =>
  tab.backgroundColor === PREVIOUS_DEFAULT_DARK.backgroundColor &&
  tab.patternColor === PREVIOUS_DEFAULT_DARK.patternColor;

const onPreviousDefaultLight = (tab: SchemeFields): boolean =>
  tab.backgroundColor === PREVIOUS_DEFAULT_LIGHT.backgroundColor &&
  (tab.patternColor ?? PREVIOUS_DEFAULT_LIGHT.patternColor) === PREVIOUS_DEFAULT_LIGHT.patternColor;

/** Which retired scheme a stored tab is on, or null when it needs nothing. */
export function retiredSchemeOf(tab: SchemeFields): RetiredScheme | null {
  if (tab.theme === CHARCOAL.id) return 'charcoal';
  if (onDefault(tab) && onPreviousDefaultDark(tab)) return 'previous-default-dark';
  if (onDefault(tab) && onPreviousDefaultLight(tab)) return 'previous-default-light';
  return null;
}

// Remove every colour field that still holds what Charcoal wrote into it, so
// the element takes the canvas's ink. Any other value was the user's choice
// and stays. Returns the same element when nothing matched.
function stripCharcoalColours(el: Element): { el: Element; stripped: number } {
  if (!el || typeof el !== 'object') return { el, stripped: 0 };
  const record = el as unknown as Record<string, unknown>;
  const drop = new Set<string>();
  for (const { element, theme } of themeColourFields(el)) {
    if (record[element] === CHARCOAL[theme]) drop.add(element);
  }
  // New tables baked the canvas into their cells and the scheme's ink into their text.
  if (el.type === 'table') {
    if (record.fillColor === CHARCOAL.backgroundColor) drop.add('fillColor');
    if (record.textColor === CHARCOAL.elementText) drop.add('textColor');
  }
  if (drop.size === 0) return { el, stripped: 0 };
  const next = { ...record };
  for (const field of drop) delete next[field];
  return { el: next as unknown as Element, stripped: drop.size };
}

/** Rewrite a stored tab off a retired scheme. The same tab when there is nothing to do. */
export function migrateRetiredScheme<T extends MigratableTab>(tab: T): T {
  const from = retiredSchemeOf(tab);
  if (!from) return tab;
  let next: T = tab;
  let stripped = 0;
  if (from === 'charcoal') {
    next = { ...next, theme: DEFAULT_SCHEME_ID };
    if (Array.isArray(tab.elements)) {
      const elements = tab.elements.map((el) => {
        const out = stripCharcoalColours(el);
        stripped += out.stripped;
        return out.el;
      });
      if (stripped > 0) next = { ...next, elements };
    }
  }
  if (onPreviousDefaultDark(next)) {
    next = {
      ...next,
      backgroundColor: DEFAULT_SCHEME_DARK.backgroundColor,
      patternColor: DEFAULT_SCHEME_DARK.patternColor,
    };
  }
  if (from === 'previous-default-light') {
    next = {
      ...next,
      backgroundColor: DEFAULT_SCHEME_LIGHT.backgroundColor,
      patternColor: DEFAULT_SCHEME_LIGHT.patternColor,
    };
  }
  console.info('[tab-migrate] retired-scheme', { from, stripped });
  return next;
}
