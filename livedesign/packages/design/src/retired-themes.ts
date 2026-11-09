// Retired themes (docs/specs/011-theme/retired-schemes.md, docs/specs/011-theme/light-and-dark.md "Retired: Autumn and
// Jewel"): a theme leaves the catalogue by being migrated away on read. A tab saved on one moves to the theme that
// replaced it, and every colour still equal to what the retired theme painted becomes the replacement's colour for the
// same role (canvas, pattern, element paints, root, each palette branch by position); a colour someone picked stays.
// These definitions are data about the past, frozen as they shipped; they never change.
import { themeHalf } from './theme-halves';
import { THEMES } from './themes-data';
import { themeColourFields, type ThemeColourField, type ThemeDefinition } from './themes';
import type { Element, Tab } from './index';

// Retired ids are not ThemeIds any more, hence the cast.
const AUTUMN = {
  id: 'autumn' as ThemeDefinition['id'],
  label: 'Autumn',
  backgroundColor: '#fffaf5',
  backgroundPattern: 'grid',
  patternColor: '#fed7aa',
  elementFill: '#fffaf5',
  elementStroke: '#7c2d12',
  elementText: '#431407',
  rootColor: { fill: '#fffaf5', stroke: '#7c2d12', text: '#431407' },
  palette: [
    { fill: '#fee2e2', stroke: '#dc2626', text: '#7f1d1d' },
    { fill: '#ffedd5', stroke: '#ea580c', text: '#7c2d12' },
    { fill: '#fef3c7', stroke: '#d97706', text: '#78350f' },
    { fill: '#fef9c3', stroke: '#ca8a04', text: '#713f12' },
    { fill: '#f5ede0', stroke: '#92400e', text: '#451a03' },
    { fill: '#ecfccb', stroke: '#65a30d', text: '#365314' },
  ],
} satisfies ThemeDefinition;

const JEWEL = {
  id: 'jewel' as ThemeDefinition['id'],
  label: 'Jewel',
  backgroundColor: '#fbfbfd',
  backgroundPattern: 'grid',
  patternColor: '#e2e8f0',
  elementFill: '#fbfbfd',
  elementStroke: '#334155',
  elementText: '#0f172a',
  rootColor: { fill: '#fbfbfd', stroke: '#334155', text: '#0f172a' },
  palette: [
    { fill: '#d1fae5', stroke: '#059669', text: '#064e3b' },
    { fill: '#dbeafe', stroke: '#1d4ed8', text: '#1e3a8a' },
    { fill: '#f3e8ff', stroke: '#7e22ce', text: '#581c87' },
    { fill: '#ffe4e6', stroke: '#e11d48', text: '#881337' },
    { fill: '#fef9c3', stroke: '#ca8a04', text: '#713f12' },
    { fill: '#cffafe', stroke: '#0e7490', text: '#155e75' },
  ],
} satisfies ThemeDefinition;

/** Each retired theme and the theme that replaced it. */
const RETIRED_THEMES: Readonly<Record<string, { from: ThemeDefinition; to: string }>> = {
  autumn: { from: AUTUMN, to: 'tropical' },
  jewel: { from: JEWEL, to: 'rainbow' },
};

// The roles a colour plays, each mapped on its own: a fill only to a fill, an outline to an outline, text to text, the
// canvas to the canvas and the pattern to the pattern. One map for every role let the first role claiming a colour
// win: Jewel's canvas is also its element fill, so its canvas became Rainbow's element fill, and Autumn's outline is
// also its second branch's text, so that text became Tropical's outline.
type Role = 'fill' | 'stroke' | 'text' | 'canvas' | 'pattern';

// A theme's colours in one role, in a fixed order, so two themes pair up slot by slot.
function slots(t: ThemeDefinition, role: Role): (string | null | undefined)[] {
  if (role === 'canvas') return [t.backgroundColor];
  if (role === 'pattern') return [t.patternColor];
  const own = { fill: t.elementFill, stroke: t.elementStroke, text: t.elementText }[role];
  const out: (string | null | undefined)[] = [own];
  for (let i = 0; i < 6; i++) out.push(t.palette?.[i]?.[role]);
  out.push(t.rootColor?.[role]);
  return out;
}

const MAPS = new Map<string, ReadonlyMap<string, string>>();

// Every colour the retired theme painted in `role` (as written, and in either derived half) mapped to the
// replacement's colour in the same slot, keys lower case.
function colourMap(id: string, role: Role): ReadonlyMap<string, string> {
  const key = `${id}|${role}`;
  const cached = MAPS.get(key);
  if (cached) return cached;
  const { from, to } = RETIRED_THEMES[id]!;
  const target = slots(
    THEMES.find((t) => t.id === to)!,
    role,
  );
  const map = new Map<string, string>();
  for (const source of [from, themeHalf(from, 'light'), themeHalf(from, 'dark')]) {
    slots(source, role).forEach((colour, i) => {
      const next = target[i];
      if (colour && next && !map.has(colour.toLowerCase())) map.set(colour.toLowerCase(), next);
    });
  }
  MAPS.set(key, map);
  return map;
}

const ROLE_OF: Record<ThemeColourField['theme'], Role> = {
  elementFill: 'fill',
  elementStroke: 'stroke',
  elementText: 'text',
};

// The colour fields a theme paints on this element, each with its role: the kind's own (themeColourFields, so a
// sticky, image, link card or video and a locked fill are left alone), and an arrow's head with its line.
function paintedFields(el: Element): { field: string; role: Role }[] {
  const out: { field: string; role: Role }[] = themeColourFields(el).map((f) => ({
    field: f.element,
    role: ROLE_OF[f.theme],
  }));
  if (el.type === 'arrow') out.push({ field: 'arrowheadColor', role: 'stroke' });
  return out;
}

type ThemedTab = Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor' | 'elements'>;

/** Rewrite a stored tab off a retired theme onto its replacement. The same tab when it is on neither. */
export function migrateRetiredTheme<T extends ThemedTab>(tab: T): T {
  const retired = tab.theme ? RETIRED_THEMES[tab.theme] : undefined;
  if (!retired) return tab;
  const id = tab.theme!;
  const swap = (c: string | undefined, role: Role) =>
    c ? (colourMap(id, role).get(c.toLowerCase()) ?? c) : c;
  let recoloured = 0;
  const elements = Array.isArray(tab.elements)
    ? tab.elements.map((el) => {
        if (!el || typeof el !== 'object') return el;
        const record = el as unknown as Record<string, unknown>;
        let patch: Record<string, string> | null = null;
        for (const { field, role } of paintedFields(el)) {
          const value = record[field];
          if (typeof value !== 'string') continue;
          const next = colourMap(id, role).get(value.toLowerCase());
          if (next && next !== value) (patch ??= {})[field] = next;
        }
        if (!patch) return el;
        recoloured++;
        return { ...record, ...patch } as unknown as typeof el;
      })
    : tab.elements;
  console.info('[tab-migrate] retired-theme', { from: tab.theme, to: retired.to, recoloured });
  return {
    ...tab,
    theme: retired.to,
    backgroundColor: swap(tab.backgroundColor, 'canvas'),
    patternColor: swap(tab.patternColor, 'pattern'),
    elements,
  };
}
