import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { PageChange } from '@livedesign/api-schema';
import { slotsInWords } from '@liveworkspace/edit-operations/layout-slots';
import type { Tab } from '@livedesign/design';
import { layoutCatalogueFor } from '@livedesign/templates';
import { applyPageChanges } from './page-changes';
import { pageSummaries, pagesTextsLeftOut } from './summary';

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
// A wireframe layout's page: a watch layout on a watch, the rest on a phone.
const addOf = (kind: 'wireframe' | 'logo', layout: string): PageChange =>
  kind === 'logo'
    ? { op: 'add', kind, layout }
    : { op: 'add', kind, layout, device: layout.startsWith('wf-watch-') ? 'watch' : 'iphone' };

describe('the layout slots table', () => {
  // The table assistants read (docs/specs/024-agents/layout-slots.md) against the slots each layout builds: a layout
  // whose texts change shows here. UPDATE_LAYOUT_SLOTS=1 writes the table afresh.
  const file = fileURLToPath(
    new URL('../../../../docs/specs/024-agents/layout-slots.md', import.meta.url),
  );
  const section = (kind: 'wireframe' | 'logo', heading: string) => [
    `## ${heading}`,
    '',
    '| Layout | Name | Slots |',
    '| --- | --- | --- |',
    ...layoutCatalogueFor(kind).layouts.map((layout) => {
      const { laid } = run(fresh(), [addOf(kind, layout.id)]);
      return `| \`${layout.id}\` | ${layout.label} | ${slotsInWords([...laid.values()][0]!)} |`;
    }),
    '',
  ];
  const table = [
    '# Layout text slots',
    '',
    'The text slots of every wireframe and logo layout, as [Pages for agents](pages-for-agents.md) "Text slots"',
    'reads them from the layout as built: `title`, `subtitle`, `bullets` and `body`, with how many items each list',
    'holds. A layout’s figures (a number, a time, a price) are no slot. This table is written by, and checked',
    'against the layouts by, `packages/edit-operations/src/pages/layout-text.test.ts` (`UPDATE_LAYOUT_SLOTS=1`',
    'rewrites it; prettier then lines up its columns). A watch layout is read on a watch, the rest on a phone.',
    '',
    ...section('wireframe', 'Wireframes'),
    ...section('logo', 'Logos'),
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
  it('writes a screen’s headline, subtitle and body in the change that lays it out', () => {
    const out = run(fresh(), [
      {
        ...addOf('wireframe', 'wf-sign-in'),
        text: { title: 'Welcome back', subtitle: 'Sign in to Acme', body: ['Work email'] },
      } as PageChange,
    ]);
    expect(labelOf(out.tab, slotIds(out.laid, 'title')[0]!)).toBe('Welcome back');
    expect(labelOf(out.tab, slotIds(out.laid, 'subtitle')[0]!)).toBe('Sign in to Acme');
    expect(labelOf(out.tab, slotIds(out.laid, 'body')[0]!)).toBe('Work email');
    expect(out.lines.some((l) => l.startsWith('Page 1: 6 body texts keep'))).toBe(true);
  });

  it('writes a logo’s name, and says what a layout without bullets could not hold', () => {
    const tab = run(fresh(), [addOf('logo', layoutCatalogueFor('logo').layouts[0]!.id)]).tab;
    const out = run(tab, [
      {
        op: 'layout',
        page: 1,
        layout: layoutCatalogueFor('logo').layouts[0]!.id,
        text: { title: 'Acme', bullets: ['x'] },
      },
    ]);
    expect(labelOf(out.tab, slotIds(out.laid, 'title')[0]!)).toBe('Acme');
    expect(out.lines).toContain(
      'Page 1: This layout has no bullets, so 1 item given was not placed.',
    );
  });

  it('refuses text with no layout to fill', () => {
    const out = applyPageChanges(
      fresh(),
      [{ op: 'add', kind: 'logo', text: { title: 'Alone' } }],
      ids(),
    );
    expect(out).toMatchObject({ refusal: { code: 'invalid_value' } });
  });

  it('answers each laid-out screen’s texts, within the budget for fifty', () => {
    const out = run(
      fresh(),
      Array.from({ length: 50 }, () => addOf('wireframe', 'wf-settings')),
    );
    const summaries = pageSummaries(out.tab, out.laid);
    expect(summaries[0]!.texts![0]).toMatchObject({ slot: 'title' });
    const leftOut = pagesTextsLeftOut(summaries, out.laid);
    const answer = JSON.stringify({
      lines: leftOut ? [...out.lines, leftOut] : out.lines,
      pages: summaries,
    });
    expect(answer.length).toBeLessThan(150_000);
  });
});
