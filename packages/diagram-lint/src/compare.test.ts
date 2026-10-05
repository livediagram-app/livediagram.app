import { describe, expect, it } from 'vitest';
import type { GraphInput } from '@livediagram/document';
import { compareGraphLayouts, formatCompareTable, parseCompareDimensions } from './compare';
import { quiet } from './fixtures/build';
import { shopArchitecture } from './fixtures/shop-architecture';

describe('parseCompareDimensions', () => {
  it('reads named dimensions in order, and refuses unknown or repeated ones', () => {
    expect(parseCompareDimensions('direction, groups,lines')).toEqual([
      'direction',
      'groups',
      'lines',
    ]);
    expect(parseCompareDimensions('lines')).toEqual(['lines']);
    const refusal = { error: 'unknown dimension "colour"; use direction, groups, lines' };
    expect(parseCompareDimensions('colour')).toEqual(refusal);
    expect(parseCompareDimensions('groups,groups')).toEqual({
      error: 'unknown dimension "groups"; use direction, groups, lines',
    });
  });
});

describe('compareGraphLayouts', () => {
  it("measures the research's architecture: tier groups cross, no groups is clean and best", () => {
    const rows = compareGraphLayouts(shopArchitecture(), ['groups'], { log: quiet });
    expect(
      rows.map((r) => [
        r.label,
        r.measures.crossings,
        r.measures.behind,
        r.measures.extent,
        r.best,
      ]),
    ).toEqual([
      ['groups', 5, 2, { width: 1317, height: 1196 }, false],
      ['no-groups', 0, 0, { width: 1319, height: 789 }, true],
    ]);
  });

  it('nests the dimensions in the order named, values in their fixed order', () => {
    const rows = compareGraphLayouts(shopArchitecture(), ['direction', 'lines'], { log: quiet });
    expect(rows.map((r) => r.label)).toEqual([
      'down straight',
      'down angled',
      'down curved',
      'right straight',
      'right angled',
      'right curved',
    ]);
    expect(rows.filter((r) => r.best)).toHaveLength(1);
  });

  it('collapses groups for a source without them, and logs the compare', () => {
    const plain: GraphInput = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b' }],
    };
    const logged: string[] = [];
    const rows = compareGraphLayouts(plain, ['groups'], { log: (fp) => logged.push(fp) });
    expect(rows.map((r) => r.label)).toEqual(['no-groups']);
    expect(rows[0]!.ratio).toBeCloseTo(
      rows[0]!.measures.extent!.width / rows[0]!.measures.extent!.height,
    );
    expect(logged).toContain('[lint] compare');
    const grouped: GraphInput = { nodes: [{ id: 'a', group: 'g' }, { id: 'b' }], edges: [] };
    expect(compareGraphLayouts(grouped, ['groups'], { log: quiet }).map((r) => r.label)).toEqual([
      'groups',
      'no-groups',
    ]);
  });

  it('prints a padded table, marking the best', () => {
    const text = formatCompareTable(
      compareGraphLayouts(shopArchitecture(), ['groups'], { log: quiet }),
    );
    expect(text.split('\n')).toEqual([
      'variant    crossings  behind  overlaps  extent     ratio  verdict',
      expect.stringMatching(/^groups {5}5 {10}2 {7}0 {9}1317×1196 {2}1\.1 {4}/),
      'no-groups  0          0       0         1319×789   1.7    clean  ← best',
    ]);
  });

  it(
    'reads skipped crossings as none when ranking a source past the arrow cap',
    { timeout: 30_000 },
    () => {
      const nodes = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}` }));
      const edges = Array.from({ length: 301 }, (_, i) => ({
        from: `n${i % 30}`,
        to: `n${(i * 7 + 1) % 30}`,
      }));
      const rows = compareGraphLayouts({ nodes, edges }, ['direction'], { log: quiet });
      expect(rows.map((r) => r.measures.crossings)).toEqual([null, null]);
      expect(rows.filter((r) => r.best)).toHaveLength(1);
    },
  );

  it('prints an empty or skipped row', () => {
    const empty = compareGraphLayouts({ nodes: [], edges: [] }, ['lines'], { log: quiet });
    expect(formatCompareTable(empty).split('\n')[1]).toMatch(
      /^straight\s+0\s+0\s+0\s+empty\s+-\s+clean/,
    );
    const skipped = formatCompareTable([
      { ...empty[0]!, measures: { ...empty[0]!.measures, crossings: null } },
    ]);
    expect(skipped.split('\n')[1]).toMatch(/skipped/);
  });
});
