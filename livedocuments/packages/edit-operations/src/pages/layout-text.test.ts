import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { PageChange } from '@livedocuments/api-schema';
import { slotsInWords } from '@liveworkspace/edit-operations/layout-slots';
import type { PageKind, Tab } from '@livedocuments/document';
import { layoutCatalogueFor } from '@livedocuments/templates';
import { applyPageChanges } from './page-changes';
import { pageSummaries, pagesTextsLeftOut } from './summary';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';

// docs/specs/024-agents/pages-for-agents.md "Text slots" and "A laid-out page's texts".

const counter = (prefix: string) => {
  let n = 0;
  return () => `${prefix}-${++n}`;
};
const ids = () => ({ page: counter('pg'), flow: counter('art') });
const fresh = (): Tab => ({ id: 't', name: 'T', elements: [] });

const run = (tab: Tab, changes: PageChange[]) => {
  const out = applyPageChanges(tab, changes, ids());
  if ('refusal' in out) throw new Error(`${out.refusal.code}: ${out.refusal.message}`);
  return out;
};
const labelOf = (tab: Tab, id: string) =>
  (tab.elements.find((el) => el.id === id) as { label?: string } | undefined)?.label;
const slotIds = (laid: Map<string, { id: string; slot: string | null }[]>, slot: string) =>
  [...laid.values()][0]!
    .filter((s) => s.slot === slot || s.slot?.startsWith(`${slot}[`))
    .map((s) => s.id);

describe('the layout slots table', () => {
  // The table assistants read (docs/specs/024-agents/layout-slots.md) against the slots each layout builds: a layout
  // whose texts change shows here. UPDATE_LAYOUT_SLOTS=1 writes the table afresh.
  const file = fileURLToPath(
    new URL('../../../../docs/specs/024-agents/layout-slots.md', import.meta.url),
  );
  const section = (kind: Exclude<PageKind, 'article' | 'flashcard'>, heading: string) => [
    `## ${heading}`,
    '',
    '| Layout | Name | Slots |',
    '| --- | --- | --- |',
    ...layoutCatalogueFor(kind).layouts.map((layout) => {
      const { laid } = run(fresh(), [{ op: 'add', kind, layout: layout.id }]);
      return `| \`${layout.id}\` | ${layout.label} | ${slotsInWords([...laid.values()][0]!)} |`;
    }),
    '',
  ];
  const table = [
    '# Layout text slots',
    '',
    'The text slots of every slide and infographic layout, as [Pages for agents](pages-for-agents.md) "Text slots"',
    'reads them from the layout as built: `title`, `subtitle`, `bullets` and `body`, with how many items each list',
    'holds. A layout’s figures (a number, a time, a percentage) are no slot. This table is written by, and checked',
    'against the layouts by, `packages/edit-operations/src/pages/layout-text.test.ts` (`UPDATE_LAYOUT_SLOTS=1`',
    'rewrites it; prettier then lines up its columns).',
    '',
    ...section('slide', 'Slides'),
    ...section('infographic', 'Infographics'),
  ].join('\n');

  // A table row as its cells, whatever padding the formatter gives the columns.
  const rows = (md: string) =>
    md
      .split('\n')
      .filter((line) => line.startsWith('| `'))
      .map((line) =>
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim())
          .join(' | '),
      );

  it('lists every layout with the slots it builds', () => {
    if (process.env.UPDATE_LAYOUT_SLOTS) writeFileSync(file, table);
    expect(rows(readFileSync(file, 'utf8'))).toEqual(rows(table));
  });
});

describe('a layout written by slot', () => {
  it('writes the headline and bullets, drops the bullets left over with their dots, and says so', () => {
    const before = run(fresh(), [{ op: 'add', kind: 'slide', layout: 'slide-bullets' }]);
    const out = run(fresh(), [
      {
        op: 'add',
        kind: 'slide',
        layout: 'slide-bullets',
        text: { title: 'Why now', bullets: ['Costs fell', 'Demand rose', 'Rivals left'] },
      },
    ]);
    const [title] = slotIds(out.laid, 'title');
    expect(labelOf(out.tab, title!)).toBe('Why now');
    expect(slotIds(out.laid, 'bullets').map((id) => labelOf(out.tab, id))).toEqual([
      'Costs fell',
      'Demand rose',
      'Rivals left',
    ]);
    // Two lines and their two dots gone.
    expect(out.tab.elements).toHaveLength(before.tab.elements.length - 4);
    expect(out.lines).toContain("Page 1: Removed the layout's 2 unused bullets.");
  });

  it('refits a kit headline to longer words, never past the layout’s own size', () => {
    // A layout's ids are fresh each time it is built: the headline is found by its slot.
    const headline = (text?: { title: string }) => {
      const out = run(fresh(), [
        { op: 'add', kind: 'slide', layout: 'slide-title', ...(text ? { text } : {}) },
      ]);
      const [id] = slotIds(out.laid, 'title');
      return (out.tab.elements.find((el) => el.id === id) as { textScale: number }).textScale;
    };
    const own = headline();
    expect(
      headline({ title: 'A headline a good deal longer than the sample one the layout came with' }),
    ).toBeLessThan(own);
    expect(headline({ title: 'Hi' })).toBe(own);
  });

  it('keeps a body text’s sample when fewer are given, and says which way to change it', () => {
    const out = run(fresh(), [
      { op: 'add', kind: 'slide', layout: 'slide-objectives', text: { body: ['First goal'] } },
    ]);
    const body = slotIds(out.laid, 'body');
    expect(labelOf(out.tab, body[0]!)).toBe('First goal');
    expect(
      out.lines.some((l) => l.startsWith("Page 1: 5 body texts keep the layout's sample")),
    ).toBe(true);
  });

  it('writes a layout change by slot too, the last layout of a page the one answered', () => {
    const tab = run(fresh(), [{ op: 'add', kind: 'slide', layout: 'slide-bullets' }]).tab;
    const out = run(tab, [
      { op: 'layout', page: 1, layout: 'slide-bullets' },
      {
        op: 'layout',
        page: 1,
        layout: 'slide-title-only',
        text: { title: 'Thank you', subtitle: 'Questions?' },
      },
    ]);
    expect(slotsInWords([...out.laid.values()][0]!)).toBe('title, subtitle');
    const [subtitle] = slotIds(out.laid, 'subtitle');
    expect(labelOf(out.tab, subtitle!)).toBe('Questions?');
  });

  it('refuses text with no layout to fill', () => {
    const out = applyPageChanges(
      fresh(),
      [{ op: 'add', kind: 'slide', text: { title: 'Alone' } }],
      ids(),
    );
    expect(out).toMatchObject({ refusal: { code: 'invalid_value' } });
  });

  it('answers no texts for a page the call laid out and then deleted', () => {
    const tab = run(fresh(), [{ op: 'add', kind: 'slide', layout: 'slide-title' }]).tab;
    const out = run(tab, [
      { op: 'add', kind: 'slide', layout: 'slide-bullets' },
      { op: 'delete', page: 2 },
    ]);
    expect(out.laid.size).toBe(0);
  });
});

describe('the answer’s texts', () => {
  it('lists each laid-out page’s texts with the refs the views print', () => {
    const tab = run(fresh(), [{ op: 'add', kind: 'slide', layout: 'slide-title' }]).tab;
    const out = run(tab, [
      { op: 'add', kind: 'slide', layout: 'slide-bullets', text: { title: 'Why now' } },
    ]);
    const [first, second] = pageSummaries(out.tab, out.laid);
    expect(first!.texts).toBeUndefined();
    expect(second!.texts![0]).toMatchObject({ slot: 'title', text: 'Why now' });
    expect(second!.texts!.every((t) => typeof t.ref === 'string' && t.ref.length >= 4)).toBe(true);
    expect(pagesTextsLeftOut([first!, second!], out.laid)).toBe(null);
  });

  it('answers fifty pages of the fullest layout well inside the tool result’s 150,000 characters', () => {
    const fullest = layoutCatalogueFor('infographic')
      .layouts.map((l) => ({
        id: l.id,
        n: (
          run(fresh(), [{ op: 'add', kind: 'infographic', layout: l.id }])
            .laid.values()
            .next().value ?? []
        ).length,
      }))
      .sort((a, b) => b.n - a.n)[0]!;
    expect(fullest.n).toBeGreaterThanOrEqual(30);
    for (const pages of [40, 50]) {
      const started = cpuNowMs();
      const out = run(
        fresh(),
        Array.from({ length: pages }, (): PageChange => ({
          op: 'add',
          kind: 'infographic',
          layout: fullest.id,
        })),
      );
      const summaries = pageSummaries(out.tab, out.laid);
      const leftOut = pagesTextsLeftOut(summaries, out.laid);
      const answer = JSON.stringify({
        lines: leftOut ? [...out.lines, leftOut] : out.lines,
        pages: summaries,
      });
      // Measured 52 ms (40 pages, 69,898 characters) and 57 ms (50 pages, 72,678) at load average 6; held at
      // 3,000 ms for CI under load.
      expect(cpuNowMs() - started, `${pages} pages`).toBeLessThan(cpuBudgetMs(3000));
      expect(answer.length, `${pages} pages`).toBeLessThan(150_000);
      if (pages === 50) expect(leftOut).toMatch(/^Texts of pages \d+-50 are left out/);
    }
  });
});
