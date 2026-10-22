import { describe, expect, it } from 'vitest';
import type { DashboardLayout, Element, Tab } from '@liveplanner/project';
import { dashboardExportTab } from './dashboard-export';
import { NOW, shape } from './test-fixtures';

// docs/specs/026-plan/plan-tabs.md "Export": a Dashboard's image is its page, each slot a card holding its picture.
const row = (id: string, slots: DashboardLayout['rows'][number]['slots'], extra = {}) => ({
  id,
  height: 320,
  slots,
  ...extra,
});

const board = shape('b1', 'plan-board', { planBoard: { title: 'Roadmap' }, layerId: 'L1' });
const view = shape('v1', 'plan-view', { planView: { view: 'workload' } });
const boardTab: Tab = { id: 'bt', name: 'Backlog', kind: 'board', elements: [board] };
// A tab on Start Planning: no kind, but something on it.
const generalTab: Tab = {
  id: 'dt',
  name: 'Flow',
  elements: [shape('s1', 'square', { width: 100, height: 60 })],
};

function exportOf(layout: DashboardLayout, elements: Element[] = [view]) {
  const tab: Tab = {
    id: 'dash',
    name: 'Overview',
    kind: 'dashboard',
    elements,
    dashboard: layout,
    backgroundColor: '#ffffff',
  };
  return dashboardExportTab({
    tab,
    tabs: [boardTab, generalTab, tab],
    now: NOW,
  });
}

describe('a Dashboard’s page', () => {
  it('lays the slots out by their twelfths across 1376 px, 12 px apart, row by row', () => {
    const out = exportOf({
      rows: [
        row('r1', [
          { id: 'a', span: 6 },
          { id: 'b', span: 6 },
        ]),
        // A row that fills the page is 720 px tall in the image.
        row('r2', [{ id: 'c', span: 12 }], { fill: true }),
      ],
    });
    const rect = (id: string) => {
      const el = out.tab.elements.find((e) => e.id === `export-slot-${id}`) as Element & {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      return { x: el.x, y: el.y, width: el.width, height: el.height };
    };
    expect(['a', 'b', 'c'].map(rect)).toEqual([
      { x: 0, y: 0, width: 682, height: 320 },
      { x: 694, y: 0, width: 682, height: 320 },
      { x: 0, y: 332, width: 1376, height: 720 },
    ]);
  });

  it('draws its own board and views at their slots, and a tab’s board under a new id', () => {
    const out = exportOf(
      {
        rows: [
          row('r1', [
            { id: 'a', span: 6, content: { type: 'element', elementId: 'v1' } },
            { id: 'b', span: 6, content: { type: 'tab', tabId: 'bt', of: 'board' } },
          ]),
        ],
      },
      [view],
    );
    const placed = out.tab.elements.filter((e) => !e.id.startsWith('export-slot-'));
    expect(placed.map((e) => e.id)).toEqual(['export-el-a', 'export-tab-b']);
    expect(placed[1]).toMatchObject({ x: 694, y: 0, width: 682, height: 320 });
    // Its layer stays behind with the canvas.
    expect('layerId' in placed[1]!).toBe(false);
    expect(out.tab.dashboard).toBeUndefined();
    expect(out.tab.kind).toBe('dashboard');
  });

  it('writes the quiet line of an empty, deleted, removed or loading slot', () => {
    const out = exportOf({
      rows: [
        row('r1', [
          { id: 'a', span: 3 },
          { id: 'b', span: 3, content: { type: 'tab', tabId: 'gone', of: 'sheet' } },
          { id: 'c', span: 3, content: { type: 'element', elementId: 'missing' } },
          { id: 'd', span: 3, content: { type: 'tab', tabId: 'dt' } },
        ]),
      ],
    });
    const art = [...out.art.values()].join('');
    expect(art).toContain('Empty Slot');
    expect(art).toContain('This Sheet was deleted.');
    expect(art).toContain('This item was removed.');
    // Only a Board or Sheet tab goes in a slot.
    expect(out.art.get('export-slot-d')).toContain('This tab is not a Board or Sheet.');
  });

  it('says Loading for a Board tab whose board has not arrived', () => {
    const out = dashboardExportTab({
      tab: {
        id: 'dash',
        name: 'O',
        kind: 'dashboard',
        elements: [],
        dashboard: {
          rows: [row('r', [{ id: 'a', span: 12, content: { type: 'tab', tabId: 'bt' } }])],
        },
      },
      tabs: [{ ...boardTab, elements: [] }],
      now: NOW,
    });
    expect(out.art.get('export-slot-a')).toContain('Loading Backlog…');
  });

  it('draws a Title bare, with no card, and a note on its card', () => {
    const out = exportOf({
      rows: [
        row('r1', [
          { id: 't', span: 6, content: { type: 'title', title: 'Q4 Plan', text: 'Where we are' } },
          { id: 'n', span: 6, content: { type: 'note', title: 'Heads Up', text: 'One\nTwo' } },
        ]),
      ],
    });
    expect(out.art.get('export-slot-t')).toContain('Q4 Plan');
    expect(out.art.get('export-slot-t')).not.toContain('rx="16"');
    expect(out.art.get('export-slot-n')).toContain('rx="16"');
    expect(out.art.get('export-slot-n')).toContain('>Two<');
  });

  it('gives each slot’s element an id of its own, two slots showing one view included', () => {
    const out = exportOf({
      rows: [
        row('r1', [
          { id: 'a', span: 6, content: { type: 'element', elementId: 'v1' } },
          { id: 'b', span: 6, content: { type: 'element', elementId: 'v1' } },
        ]),
      ],
    });
    const ids = out.tab.elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('export-el-a');
    expect(ids).toContain('export-el-b');
  });

  it('draws both of two slots that a file gave one id', () => {
    const out = exportOf({
      rows: [
        row('r', [{ id: 'a', span: 12, content: { type: 'note', title: 'One', text: '' } }]),
        row('r2', [{ id: 'a', span: 12, content: { type: 'note', title: 'Two', text: '' } }]),
      ],
    });
    const art = [...out.art.values()].join('');
    expect(out.art.size).toBe(2);
    expect(art).toContain('One');
    expect(art).toContain('Two');
  });

  it('is an empty page for a Dashboard with no layout', () => {
    expect(exportOf({ rows: [] }).tab.elements).toEqual([]);
  });
});

describe('a styled card in the image (plan-tabs.md "Card style")', () => {
  it('draws its fill, border and ink', () => {
    const { art } = exportOf({
      rows: [
        row('r1', [
          {
            id: 'n',
            span: 12,
            content: {
              type: 'note',
              title: 'Heads Up',
              text: 'Soon',
              style: { fill: '#0f172a', stroke: '#ff0000', borderWidth: 'thick' },
            },
          },
        ]),
      ],
    });
    const svg = art.get('export-slot-n')!;
    expect(svg).toContain('fill="#0f172a"');
    expect(svg).toContain('stroke="#ff0000" stroke-width="4"');
    // The ink that reads on the dark fill writes the heading.
    expect(svg).toContain('#ffffff');
  });
});
