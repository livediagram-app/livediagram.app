import { describe, expect, it } from 'vitest';
import {
  PLAN_GLYPHS,
  PLAN_GLYPH_CATEGORIES,
  PLAN_GLYPH_IDS,
  PLAN_GLYPH_KEYWORDS,
  glyphMatches,
  isPlanGlyphId,
  planGlyphLabel,
} from './glyphs';

// docs/specs/026-plan/item-types.md "An item type": the glyph set in eight categories, ids never changing.
const FIRST_IDS = [
  'task',
  'story',
  'bug',
  'project',
  'note',
  'idea',
  'action',
  'risk',
  'star',
  'flag',
  'heart',
  'bookmark',
  'person',
  'calendar',
  'chat',
  'cube',
];

describe('the glyph set', () => {
  it('keeps every first id, so a stored type always draws', () => {
    for (const id of FIRST_IDS) expect(isPlanGlyphId(id)).toBe(true);
  });

  it('puts every glyph in exactly one category, in the catalogue’s own order', () => {
    const listed = PLAN_GLYPH_CATEGORIES.flatMap((c) => c.glyphs);
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed).toEqual(PLAN_GLYPH_IDS);
    expect(PLAN_GLYPH_CATEGORIES.map((c) => c.label)).toEqual([
      'Work',
      'People',
      'Communication',
      'Planning',
      'Ideas and Notes',
      'Status and Signals',
      'Business',
      'Things',
    ]);
  });

  it('draws every glyph as one path, with keywords to find it by', () => {
    expect(PLAN_GLYPH_IDS.length).toBeGreaterThanOrEqual(60);
    for (const id of PLAN_GLYPH_IDS) {
      expect(PLAN_GLYPHS[id]).toMatch(/^M[\d.\s]/);
      expect(PLAN_GLYPH_KEYWORDS[id].trim().length).toBeGreaterThan(0);
    }
  });

  it('names a glyph from its id, and finds it by name or keyword prefix', () => {
    expect(planGlyphLabel('user-plus')).toBe('User Plus');
    expect(glyphMatches('coin', 'money')).toBe(true);
    expect(glyphMatches('wallet', 'mon')).toBe(true);
    expect(glyphMatches('user-plus', 'user add')).toBe(true);
    expect(glyphMatches('coin', 'rocket')).toBe(false);
    expect(glyphMatches('coin', '  ')).toBe(true);
  });
});
