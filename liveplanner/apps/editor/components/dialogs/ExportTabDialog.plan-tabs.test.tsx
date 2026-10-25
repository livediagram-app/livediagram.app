// @vitest-environment jsdom

// A Plan tab's Export (docs/specs/026-plan/plan-tabs.md "Export"): only the formats that carry its kind, no canvas
// options, and an image drawn as the tab is laid out (a Board tab's board alone, a Dashboard's page, a plan view as
// its chart).

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type Tab } from '@liveplanner/project';
import { ITEM_TYPES, presetSetup, type Item } from '@liveplanner/items';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import { ExportTabDialog } from './ExportTabDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/icon-registry', async (orig) => ({
  ...(await orig<typeof import('@liveworkspace/workbench/lib/icon-registry')>()),
  ensureIconCatalogs: vi.fn(async () => {}),
}));

const person = { id: 'p', name: 'Sam', color: '#2563eb' };
const item: Item = {
  id: 'item-1',
  type: 'task',
  key: 7,
  rank: 'i',
  fields: { title: 'Write the spec', status: 'todo' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: person,
  updatedBy: person,
};
const board = {
  ...createShape('plan-board', 0, 0),
  id: 'board',
  planBoard: presetSetup('kanban'),
} as BoxedElement;
const view = {
  ...createShape('plan-view', 0, 0),
  id: 'view',
  planView: { view: 'priority-matrix' },
} as BoxedElement;
const plan = {
  items: new Map([[item.id, item]]),
  types: ITEM_TYPES,
  itemTypes: { catalogue: null },
  statusPhases: new Map([['todo', 'todo']]),
  statusNames: new Map([['todo', 'To Do']]),
} as unknown as PlanContextValue;

const open = (tab: Tab, projectTabs?: Tab[]) =>
  render(
    <PlanProvider value={plan}>
      <ExportTabDialog
        tab={tab}
        projectName="Doc"
        onClose={vi.fn()}
        {...(projectTabs ? { projectTabs } : {})}
      />
    </PlanProvider>,
  );

const cardTitles = () =>
  screen
    .getAllByRole('button')
    .map((b) => b.querySelector('h3, .font-semibold')?.textContent ?? b.textContent ?? '')
    .filter((t) => /^(JSON|Markdown|CSV|PNG|SVG|PDF)/.test(t.trim()))
    .map((t) => t.trim().split(/\s/)[0]);

afterEach(cleanup);

describe('ExportTabDialog on a Plan tab', () => {
  it('offers a Board tab PNG, SVG, PDF, Markdown and CSV, and draws its board alone', async () => {
    const stray = {
      ...createShape('square', 0, 0),
      id: 'stray',
      label: 'Hidden Under',
    } as BoxedElement;
    open({ id: 'b', name: 'Roadmap', kind: 'board', elements: [stray, board] });
    expect(cardTitles()).toEqual(['Markdown', 'CSV', 'PNG', 'SVG', 'PDF']);
    fireEvent.click(screen.getByRole('button', { name: /PNG/ }));
    await waitFor(() => expect(document.body.innerHTML).toContain('Write the spec'));
    expect(document.body.innerHTML).not.toContain('Hidden Under');
    // No canvas pattern.
    expect(screen.queryByText(/Background pattern/)).toBeNull();
  });

  it('offers a Sheet tab its picture alone', () => {
    open({ id: 's', name: 'Budget', kind: 'sheet', elements: [] });
    expect(cardTitles()).toEqual(['CSV', 'PNG', 'SVG', 'PDF']);
  });

  it('offers a Dashboard JSON and its picture, drawing its page', async () => {
    const dashboard: Tab = {
      id: 'd',
      name: 'Overview',
      kind: 'dashboard',
      elements: [view],
      dashboard: {
        rows: [
          {
            id: 'r',
            height: 320,
            slots: [
              { id: 'a', span: 6, content: { type: 'element', elementId: 'view' } },
              { id: 'b', span: 6, content: { type: 'note', title: 'Heads Up', text: 'Soon' } },
            ],
          },
        ],
      },
    };
    open(dashboard, [dashboard]);
    expect(cardTitles()).toEqual(['JSON', 'PNG', 'SVG', 'PDF']);
    fireEvent.click(screen.getByRole('button', { name: /SVG/ }));
    await waitFor(() => expect(document.body.innerHTML).toContain('Heads Up'));
    // The plan view as its chart, not its labelled box.
    expect(document.body.innerHTML).toContain('Not Started');
  });

  // CSV carries a Board's cards or a Sheet's cells (docs/specs/026-plan/plan-tabs.md "Export"); any other tab has
  // neither, so it is not offered there: it was, and downloaded an empty file.
  it('draws a plan view on any other tab as its chart, with every format but CSV offered', async () => {
    open({ id: 'c', name: 'Canvas', elements: [view] });
    expect(cardTitles()).toEqual(['JSON', 'Markdown', 'PNG', 'SVG', 'PDF']);
    fireEvent.click(screen.getByRole('button', { name: /PNG/ }));
    await waitFor(() => expect(document.body.innerHTML).toContain('Not Started'));
    expect(screen.queryByText(/Background pattern/)).not.toBeNull();
    // The isometric export went (docs/specs/008-canvas/canvas-and-palette.md "Retired features").
    expect(screen.queryByText(/Isometric view/)).toBeNull();
  });
});
