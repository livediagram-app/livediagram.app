import { describe, expect, it } from 'vitest';
import { CATALOGUE as LIVEDESIGN } from './catalogues/livedesign';
import { CATALOGUE as LIVEDIAGRAM } from './catalogues/livediagram';
import { CATALOGUE as LIVEDOCUMENTS } from './catalogues/livedocuments';
import { CATALOGUE as LIVEHUDDLE } from './catalogues/livehuddle';
import { CATALOGUE as LIVEPLANNER } from './catalogues/liveplanner';
import { SECTION_ORDER, sectionRank } from './sections';

const CATALOGUES = { LIVEDIAGRAM, LIVEPLANNER, LIVEDOCUMENTS, LIVEDESIGN, LIVEHUDDLE };

describe('SECTION_ORDER', () => {
  it('ranks each listed section once, and nothing else', () => {
    expect(new Set(SECTION_ORDER).size).toBe(SECTION_ORDER.length);
    expect(sectionRank('Canvas')).toBe(0);
    expect(sectionRank('Danger Zone')).toBe(-1);
    expect(sectionRank(undefined)).toBe(-1);
  });

  it('reads Editor as Canvas, Mouse, then each mode', () => {
    const editor = ['Canvas', 'Mouse', 'Draw', 'Pages', 'Logo Pages'].map(sectionRank);
    expect(editor).toEqual([...editor].sort((a, b) => a - b));
  });

  it("is the order every app's catalogue lists its sections in", () => {
    for (const [app, catalogue] of Object.entries(CATALOGUES)) {
      for (const category of catalogue.categories) {
        const ranks = [...new Set(category.rows.map((row) => row.section))]
          .map(sectionRank)
          .filter((rank) => rank >= 0);
        expect([app, category.id, ranks]).toEqual([
          app,
          category.id,
          [...ranks].sort((a, b) => a - b),
        ]);
      }
    }
  });

  it('leaves no sub-category: a panel or mode is a section of its category', () => {
    for (const catalogue of Object.values(CATALOGUES)) {
      const nested = catalogue.categories.filter(
        (c) => c.parent !== undefined || /^(Panels|Editor) › /.test(c.label),
      );
      expect(nested).toEqual([]);
    }
  });
});
