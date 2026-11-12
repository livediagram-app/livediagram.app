// Retired themes (each product's docs/specs/011-theme/retired-schemes.md): a theme a product stops offering leaves its
// catalogue by being migrated away on read. A tab saved on one moves to the theme that replaced it, and every colour
// still equal to what the retired theme painted becomes the replacement's colour for the same role (canvas, pattern,
// fill, outline, text, each palette branch by position, the root); a colour someone picked stays. A product binds the
// themes it retired, each frozen as it shipped, so a later change to a theme another product still offers never
// changes the migration.
import type { Element } from './element';
import {
  themeColourFields,
  type Appearance,
  type ThemeColourField,
  type ThemeDefinition,
} from './themes';
import { themeHalf } from './theme-halves';
import { THEMES } from './themes-data';

/** The colours a theme paints, by role: all the migration reads of a theme. */
export type ThemeColours = Pick<
  ThemeDefinition,
  | 'backgroundColor'
  | 'patternColor'
  | 'elementFill'
  | 'elementStroke'
  | 'elementText'
  | 'palette'
  | 'rootColor'
>;

/** A retired theme as it shipped, and the id of the shared theme that replaced it. */
export type RetiredTheme<D extends ThemeColours = ThemeDefinition> = { from: D; to: string };

/** What a product's own theme engine supplies when it is not the shared one (livehuddle's own halves and kinds). */
export type RetiredThemeDeps<D extends ThemeColours, E> = {
  /** The theme's light or dark half, as the product draws it. */
  half: (theme: D, appearance: Appearance) => ThemeColours;
  /** The colour fields a theme paints on an element of the product's union. */
  colourFields: (el: E) => readonly ThemeColourField[];
};

type ThemedTab = {
  theme?: string;
  backgroundColor?: string;
  patternColor?: string;
  elements?: unknown;
};

export type RetiredThemes = {
  /** The tab moved off a retired theme onto its replacement; the same tab when it is on none. */
  migrate: <T extends ThemedTab>(tab: T) => T;
};

// UML as livehuddle, liveplanner, livedocuments and livedesign retired it (owner, 2026-11-12, Work Item 696), frozen:
// livediagram still offers UML from ./themes-data, so its live definition may change. Only the colours the migration
// maps are kept; the colour UML gave each shape kind is never mapped (the replacement has none to map it to), so a tab's
// per-kind colours stay as they were.
export const UML_AS_RETIRED = {
  id: 'uml',
  label: 'UML',
  backgroundColor: '#ffffff',
  backgroundPattern: 'blank',
  patternColor: '#e2e8f0',
  elementFill: '#f8fafc',
  elementStroke: '#334155',
  elementText: '#0f172a',
} as const satisfies ThemeDefinition;

// The roles a colour plays, each mapped on its own: a fill only to a fill, an outline to an outline, text to text, the
// canvas to the canvas and the pattern to the pattern. One map for every role let the first role claiming a colour
// win: Jewel's canvas is also its element fill, so its canvas became Rainbow's element fill, and Autumn's outline is
// also its second branch's text, so that text became Tropical's outline.
type Role = 'fill' | 'stroke' | 'text' | 'canvas' | 'pattern';

const ROLE_OF: Record<ThemeColourField['theme'], Role> = {
  elementFill: 'fill',
  elementStroke: 'stroke',
  elementText: 'text',
};

// A theme's colours in one role, in a fixed order, so two themes pair up slot by slot.
function slots(t: ThemeColours, role: Role): (string | null | undefined)[] {
  if (role === 'canvas') return [t.backgroundColor];
  if (role === 'pattern') return [t.patternColor];
  const own = { fill: t.elementFill, stroke: t.elementStroke, text: t.elementText }[role];
  const out: (string | null | undefined)[] = [own];
  for (let i = 0; i < 6; i++) out.push(t.palette?.[i]?.[role]);
  out.push(t.rootColor?.[role]);
  return out;
}

const SHARED_DEPS: RetiredThemeDeps<ThemeDefinition, Element> = {
  half: themeHalf,
  colourFields: themeColourFields,
};

/** Bind the themes a product retired to their read-time migration, over the shared theme engine or the product's. */
export function bindRetiredThemes(retired: Readonly<Record<string, RetiredTheme>>): RetiredThemes;
export function bindRetiredThemes<D extends ThemeColours, E>(
  retired: Readonly<Record<string, RetiredTheme<D>>>,
  deps: RetiredThemeDeps<D, E>,
): RetiredThemes;
export function bindRetiredThemes<D extends ThemeColours, E>(
  retired: Readonly<Record<string, RetiredTheme<D>>>,
  deps?: RetiredThemeDeps<D, E>,
): RetiredThemes {
  const { half, colourFields } = (deps ?? SHARED_DEPS) as RetiredThemeDeps<D, E>;
  const maps = new Map<string, ReadonlyMap<string, string>>();

  // Every colour the retired theme painted in `role` (as written, and in either derived half) mapped to the
  // replacement's colour in the same slot, keys lower case. Built once per theme and role.
  const colourMap = (id: string, role: Role): ReadonlyMap<string, string> => {
    const key = `${id}|${role}`;
    const cached = maps.get(key);
    if (cached) return cached;
    const { from, to } = retired[id]!;
    const replacement = THEMES.find((t) => t.id === to);
    const target = replacement ? slots(replacement, role) : [];
    const map = new Map<string, string>();
    for (const source of [from, half(from, 'light'), half(from, 'dark')]) {
      slots(source, role).forEach((colour, i) => {
        const next = target[i];
        if (colour && next && !map.has(colour.toLowerCase())) map.set(colour.toLowerCase(), next);
      });
    }
    maps.set(key, map);
    return map;
  };

  // The colour fields a theme paints on this element, each with its role: the kind's own (so a sticky, image, link
  // card or video and a locked fill are left alone), and an arrow's head with its line.
  const paintedFields = (el: { type?: unknown }): { field: string; role: Role }[] => {
    const out: { field: string; role: Role }[] = colourFields(el as E).map((f) => ({
      field: f.element,
      role: ROLE_OF[f.theme],
    }));
    if (el.type === 'arrow') out.push({ field: 'arrowheadColor', role: 'stroke' });
    return out;
  };

  return {
    migrate: <T extends ThemedTab>(tab: T): T => {
      const id = tab.theme;
      if (!id || !Object.hasOwn(retired, id)) return tab;
      const { to } = retired[id]!;
      const swap = (c: string | undefined, role: Role) =>
        c ? (colourMap(id, role).get(c.toLowerCase()) ?? c) : c;
      let recoloured = 0;
      const elements = Array.isArray(tab.elements)
        ? tab.elements.map((el: unknown) => {
            if (!el || typeof el !== 'object') return el;
            const record = el as Record<string, unknown>;
            let patch: Record<string, string> | null = null;
            for (const { field, role } of paintedFields(record)) {
              const value = record[field];
              if (typeof value !== 'string') continue;
              const next = colourMap(id, role).get(value.toLowerCase());
              if (next && next !== value) (patch ??= {})[field] = next;
            }
            if (!patch) return el;
            recoloured++;
            return { ...record, ...patch };
          })
        : tab.elements;
      console.info('[tab-migrate] retired-theme', { from: id, to, recoloured });
      return {
        ...tab,
        theme: to,
        backgroundColor: swap(tab.backgroundColor, 'canvas'),
        patternColor: swap(tab.patternColor, 'pattern'),
        elements,
      };
    },
  };
}
