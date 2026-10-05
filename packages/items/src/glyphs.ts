// The Plan glyph set (docs/specs/025-plan/item-types.md "An item type"): a type's glyph on its cards,
// drawn inline on a 16-unit grid as one stroked path, so a card never waits for an icon catalogue.
// The first eight are the built-in types' (keyed by their type id); the rest are for types people add.

export const PLAN_GLYPHS = {
  task: 'M5.2 8.2 7 10l3.8-4M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z',
  story: 'M2.5 3.5h4a2 2 0 0 1 2 2v8a1.5 1.5 0 0 0-1.5-1.5h-4.5ZM13.5 3.5h-4a2 2 0 0 0-1 2',
  bug: 'M5.5 6.5h5v5a2.5 2.5 0 0 1-5 0ZM6 6.5a2 2 0 0 1 4 0M3 8.5h2.5M10.5 8.5H13M3.5 12l2-1M12.5 12l-2-1M8 6.5v7',
  epic: 'M8 2 14 5 8 8 2 5ZM2 8l6 3 6-3M2 11l6 3 6-3',
  note: 'M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2Z',
  idea: 'M9 1.5 4 9h4l-1 5.5L12 7H8Z',
  action: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  risk: 'M8 2 14.5 13.5h-13ZM8 6.5v3.2M8 11.6v.1',
  star: 'M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6Z',
  flag: 'M3.5 14.5v-12M3.5 2.5h8l-1.8 3 1.8 3h-8',
  heart: 'M8 13.5S2 10 2 6a3 3 0 0 1 6-.8A3 3 0 0 1 14 6c0 4-6 7.5-6 7.5Z',
  bookmark: 'M4 2h8v12l-4-3-4 3Z',
  person: 'M8 7.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM2.5 14a5.5 5.5 0 0 1 11 0',
  calendar: 'M2.5 3.5h11v10h-11ZM2.5 6.5h11M5.5 2v3M10.5 2v3',
  chat: 'M2 3h12v8H6l-3 2.5V11H2Z M5 6h6M5 8.5h4',
  cube: 'M8 1.5 14 4.5v7L8 14.5 2 11.5v-7ZM2 4.5l6 3 6-3M8 7.5v7',
} as const;

export type PlanGlyphId = keyof typeof PLAN_GLYPHS;

export const PLAN_GLYPH_IDS = Object.keys(PLAN_GLYPHS) as PlanGlyphId[];

// An unknown glyph id draws a plain square.
export const PLAN_GLYPH_FALLBACK = 'M3 3h10v10H3Z';

export function planGlyphPath(id: string | undefined): string {
  return (id && (PLAN_GLYPHS as Record<string, string>)[id]) || PLAN_GLYPH_FALLBACK;
}

export function isPlanGlyphId(id: unknown): id is PlanGlyphId {
  return typeof id === 'string' && Object.hasOwn(PLAN_GLYPHS, id);
}
