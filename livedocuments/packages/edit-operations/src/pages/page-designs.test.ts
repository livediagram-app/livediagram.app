import { describe, expect, it } from 'vitest';
import type { PageChange } from '@livedocuments/api-schema';
import {
  pagesOf,
  tabPageDesignOf,
  type Element,
  type Page,
  type Tab,
} from '@livedocuments/document';
import { applyPageChanges } from './page-changes';
import { parsePagesRequest } from './parse';
import { pageSummaries } from './summary';

// docs/specs/024-agents/pages-for-agents.md "Page designs".

const slide = (id: string, extra: Partial<Page> = {}): Page => ({
  id,
  orientation: 'landscape',
  size: 'slide',
  kind: 'slide',
  ...extra,
});
const tabOf = (pages: Page[], elements: Element[] = []): Tab => ({
  id: 't',
  name: 'Quarterly pitch',
  elements,
  pages,
});
const parsed = (changes: unknown[]) => {
  const out = parsePagesRequest({ pages: changes });
  if ('refusal' in out) throw new Error(`${out.refusal.code}: ${out.refusal.message}`);
  return (out as { pages: PageChange[] }).pages;
};
const refusedParse = (changes: unknown[]) => {
  const out = parsePagesRequest({ pages: changes });
  if (!('refusal' in out)) throw new Error('expected a refusal');
  return out.refusal;
};
const run = (tab: Tab, changes: PageChange[]) => {
  const out = applyPageChanges(tab, changes);
  if ('refusal' in out) throw new Error(`${out.refusal.code}: ${out.refusal.message}`);
  return out;
};

describe('reading a design', () => {
  it('takes an id, a name, or an object of tuning, stored small', () => {
    expect(parsed([{ op: 'tab_design', design: 'aurora' }])[0]).toEqual({
      op: 'tab_design',
      design: { id: 'aurora' },
    });
    expect(parsed([{ op: 'tab_design', design: 'Soft Mesh' }])[0]).toMatchObject({
      design: { id: 'soft-mesh' },
    });
    expect(
      parsed([
        {
          op: 'set',
          page: 1,
          design: {
            id: 'waves',
            intensity: 0.4,
            colors: ['#112233', '#445566', '#778899'],
            guard: 'scrim',
          },
        },
      ])[0],
    ).toEqual({
      op: 'set',
      page: 1,
      design: { id: 'waves', intensity: 0.4, colors: ['#112233', '#445566', '#778899'] },
    });
    expect(parsed([{ op: 'set', page: 1, design: 'none' }])[0]).toMatchObject({ design: 'none' });
    expect(parsed([{ op: 'set', page: 1, design: 'tab' }])[0]).toMatchObject({ design: 'tab' });
    expect(parsed([{ op: 'tab_design', design: null }])[0]).toEqual({
      op: 'tab_design',
      design: null,
    });
    expect(parsed([{ op: 'tab_design', design: 'auto' }])[0]).toEqual({
      op: 'tab_design',
      design: 'auto',
    });
  });

  it('refuses an unknown design naming the closest, and values out of range by name', () => {
    const unknown = refusedParse([{ op: 'tab_design', design: 'auroa' }]);
    expect(unknown.code).toBe('design_unknown');
    expect(unknown.message).toContain('Closest: aurora');
    expect(unknown.message).toContain('Gradients:');
    expect(
      refusedParse([{ op: 'tab_design', design: { id: 'aurora', intensity: 4 } }]).message,
    ).toContain('"design.intensity" is a number from 0.1 to 1');
    expect(
      refusedParse([{ op: 'tab_design', design: { id: 'grid', animate: true } }]).message,
    ).toContain('does not move');
    expect(
      refusedParse([{ op: 'tab_design', design: { id: 'grid', flow: true } }]).message,
    ).toContain('cannot flow');
    expect(
      refusedParse([{ op: 'tab_design', design: { id: 'grid', variant: 'zigzag' } }]).code,
    ).toBe('invalid_value');
    // Rhythm and flow are the tab design's.
    expect(
      refusedParse([{ op: 'set', page: 1, design: { id: 'waves', rhythm: true } }]).message,
    ).toContain('set by tab_design');
    expect(refusedParse([{ op: 'tab_design' }]).code).toBe('invalid_value');
    expect(refusedParse([{ op: 'set', page: 1, design: 7 }]).code).toBe('invalid_value');
  });
});

describe('applying designs', () => {
  it('sets the tab design and a page override, and the answer names them', () => {
    const tab = tabOf([slide('s1'), slide('s2')]);
    const out = run(
      tab,
      parsed([
        { op: 'tab_design', design: { id: 'aurora', rhythm: true } },
        { op: 'set', page: 2, design: 'none' },
      ]),
    );
    expect(tabPageDesignOf(out.tab)).toEqual({ id: 'aurora', rhythm: true });
    expect(out.lines[0]).toBe("Set the tab's page design: Aurora (aurora), rhythm set.");
    expect(out.lines[1]).toBe('Set page 2: no design.');
    const summaries = pageSummaries(out.tab);
    expect(summaries[0]!.design).toBeUndefined();
    expect(summaries[1]!.design).toBe('none');
    const back = run(
      out.tab,
      parsed([
        { op: 'set', page: 2, design: 'tab' },
        { op: 'tab_design', design: null },
      ]),
    );
    expect(pagesOf(back.tab)[1]!.design).toBeUndefined();
    expect(tabPageDesignOf(back.tab)).toBeUndefined();
  });

  it('adds a page wearing a design, and picks one for the tab’s words on "auto"', () => {
    const out = run(
      tabOf([slide('s1', { name: 'Cover' })]),
      parsed([
        { op: 'add', kind: 'slide', design: 'starfield' },
        { op: 'tab_design', design: 'auto' },
      ]),
    );
    expect(pagesOf(out.tab)[1]!.design).toEqual({ id: 'starfield' });
    // "pitch" in the tab's name suits a startup design.
    expect(tabPageDesignOf(out.tab)?.id).toBe('soft-mesh');
    expect(out.lines[1]).toContain('picked for the tab');
  });

  it('refuses a locked page’s override', () => {
    const out = applyPageChanges(
      tabOf([slide('s1', { locked: true })]),
      parsed([{ op: 'set', page: 1, design: 'aurora' }]),
    );
    expect('refusal' in out && out.refusal.code).toBe('page_locked');
  });
});
