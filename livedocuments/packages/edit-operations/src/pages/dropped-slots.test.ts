import { describe, expect, it } from 'vitest';
import {
  elementsOnPage,
  layOutPages,
  pagesOf,
  type Element,
  type Tab,
} from '@livedocuments/document';
import { applyPageChanges } from './page-changes';
import { DROPPED_SLOT, markDropped, withoutDroppedSlots } from './dropped-slots';

// docs/specs/007-editor/describe-a-page.md "Every kind": a slot the words leave empty goes from the page, with its
// card, its dot, or its stat, never keeping the layout's sample.
const tabOf = (kind: 'slide' | 'infographic'): Tab =>
  ({
    id: 't',
    name: 'T',
    elements: [],
    pages: [
      kind === 'slide'
        ? { id: 'p1', kind: 'slide', size: 'slide-16x9', orientation: 'landscape' }
        : { id: 'p1', kind: 'infographic', orientation: 'portrait' },
    ],
  }) as unknown as Tab;

const laid = (
  kind: 'slide' | 'infographic',
  layout: string,
  text: Parameters<typeof markDropped>[0],
) => {
  const out = applyPageChanges(tabOf(kind), [
    { op: 'layout', page: 'p1', layout, text: markDropped(text) },
  ]);
  if ('refusal' in out) throw new Error(out.refusal.message);
  return withoutDroppedSlots(out.tab);
};
const on = (tab: Tab) =>
  elementsOnPage(tab.elements, layOutPages(pagesOf(tab)), 'p1') as (Element &
    Record<string, unknown>)[];
const words = (tab: Tab) =>
  on(tab).flatMap((el) => (typeof el.label === 'string' && el.label ? [el.label] : []));

describe('dropped slots', () => {
  it('marks only empty words, and leaves a table as given', () => {
    expect(
      markDropped({ title: ' ', subtitle: 'Sub', body: ['', 'b'], table: [['', 'x']] }),
    ).toEqual({
      title: DROPPED_SLOT,
      subtitle: 'Sub',
      body: [DROPPED_SLOT, 'b'],
      table: [['', 'x']],
    });
    expect(markDropped({})).toEqual({});
  });

  it('takes four figures of six off a stat layout: its last stats go, never "N/A" or a sample', () => {
    const tab = laid('slide', 'key-stats', {
      title: 'Our Year',
      subtitle: '',
      figures: ['1.2M', '99.9%', '40', '4.8', '', ''],
      body: ['Users', 'Uptime', 'Countries', 'Rating', '', '', ''],
    });
    const stats = on(tab)
      .filter((el) => Array.isArray(el.stats))
      .flatMap((el) => el.stats as { value: string; caption: string }[]);
    expect(stats.map((s) => s.value)).toEqual(['1.2M', '99.9%', '40', '4.8']);
    expect(stats.map((s) => s.caption)).toEqual(['Users', 'Uptime', 'Countries', 'Rating']);
    const all = words(tab).join(' ');
    expect(all).toContain('Our Year');
    expect(all).not.toContain('Twelve months');
    expect(all).not.toContain(DROPPED_SLOT);
    // The card of words under the stats was left empty: it goes too.
    expect(all).not.toContain('Say what the numbers mean');
  });

  it('takes a facts grid’s unused cards off with their icons, and keeps the heading', () => {
    const tab = laid('infographic', 'facts-grid', {
      body: ['Honey Bees', 'Small and busy', '', '', '', '', '', ''],
      title: '',
      subtitle: '',
      figures: ['50k', '6 mi', '', '', '', ''],
    });
    const all = words(tab);
    expect(all).toContain('Honey Bees');
    expect(all).not.toContain('Awards won');
    expect(all.join(' ')).not.toContain(DROPPED_SLOT);
    const squares = on(tab).filter((el) => el.type === 'shape' && el.shape === 'square');
    const icons = on(tab).filter((el) => el.type === 'shape' && el.shape === 'icon');
    expect(squares.length).toBe(icons.length);
    expect(squares.length).toBeLessThan(6);
  });

  it('drops a bullet with its dot, and leaves a tab with no marks as it is', () => {
    const bullets = (count: number) =>
      on(
        laid('slide', 'slide-bullets', {
          title: 'Plan',
          bullets: Array.from({ length: count }, (_, i) => (i < 2 ? `Point ${i}` : '')),
        }),
      ).filter((el) => el.type === 'shape' && el.shape === 'circle').length;
    expect(bullets(6)).toBeLessThanOrEqual(2);
    const plain = tabOf('slide');
    expect(withoutDroppedSlots(plain)).toBe(plain);
  });

  it('clears a half-marked row and keeps a compound with rows left', () => {
    const tab = {
      ...tabOf('slide'),
      elements: [
        {
          id: 's',
          type: 'shape',
          shape: 'stat-row',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          stats: [
            { value: '1', caption: DROPPED_SLOT },
            { value: DROPPED_SLOT, caption: DROPPED_SLOT },
            { value: DROPPED_SLOT, caption: '' },
          ],
          processSteps: ['a', DROPPED_SLOT],
          checklistItems: [{ text: DROPPED_SLOT }, { text: 'keep' }, 'odd'],
          conceptRows: [{ label: 'L', note: DROPPED_SLOT }],
        },
        { id: 'img', type: 'shape', shape: 'square', label: DROPPED_SLOT, stats: [{ value: 'x' }] },
      ],
    } as unknown as Tab;
    const [el] = withoutDroppedSlots(tab).elements as unknown as Record<string, unknown>[];
    expect(el!.stats).toEqual([{ value: '1', caption: '' }]);
    expect(el!.processSteps).toEqual(['a']);
    expect(el!.checklistItems).toEqual([{ text: 'keep' }, 'odd']);
    expect(el!.conceptRows).toEqual([{ label: 'L', note: '' }]);
    const allGone = {
      ...tab,
      // Placed, with no size of its own: the box it leaves is a point.
      elements: [
        { id: 'p', type: 'shape', shape: 'process', x: 0, y: 0, processSteps: [DROPPED_SLOT] },
      ],
    } as unknown as Tab;
    expect(withoutDroppedSlots(allGone).elements).toEqual([]);
    // Not yet placed (no box): a marked text first on the tab, with nothing before it, and an emptied compound.
    const unplaced = {
      ...tab,
      elements: [
        { id: 'a', type: 'text', label: DROPPED_SLOT },
        { id: 'c', type: 'shape', shape: 'process', processSteps: [DROPPED_SLOT] },
        { id: 'k', type: 'text', label: 'Kept' },
      ],
    } as unknown as Tab;
    expect(withoutDroppedSlots(unplaced).elements.map((el) => el.id)).toEqual(['k']);
  });
});
