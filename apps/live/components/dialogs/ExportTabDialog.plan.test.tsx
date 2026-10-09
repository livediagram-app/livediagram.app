// @vitest-environment jsdom

// Plan boards export with their cards (docs/specs/026-plan/items.md "Copies and exports"): the image preview,
// the JSON file and the Markdown outline all read the document's items from the Plan context.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type Tab } from '@livediagram/document';
import { ITEM_TYPES, presetSetup, type Item } from '@livediagram/items';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import { ExportTabDialog } from './ExportTabDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/icon-registry', async (orig) => ({
  ...(await orig<typeof import('@/lib/icon-registry')>()),
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
const tab: Tab = { id: 't', name: 'Plan', elements: [board] };
// Only what the export reads from the context.
const plan = {
  items: new Map([[item.id, item]]),
  types: ITEM_TYPES,
  itemTypes: { catalogue: null },
} as unknown as PlanContextValue;

const open = () =>
  render(
    <PlanProvider value={plan}>
      <ExportTabDialog tab={tab} documentName="Doc" onClose={vi.fn()} />
    </PlanProvider>,
  );

afterEach(cleanup);

describe('ExportTabDialog, Plan', () => {
  it('previews the board with its cards', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /PNG/ }));
    // The dialog renders in a portal, so the preview is read from the page.
    await waitFor(() => expect(document.body.innerHTML).toContain('Write the spec'));
  });

  it('puts the cards in the JSON file', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /JSON/ }));
    const text = (screen.getByRole('textbox') as HTMLTextAreaElement).value;
    expect(JSON.parse(text).items).toEqual([item]);
  });

  it('lists the cards in the Markdown outline', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /Markdown/ }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain(
      '- #7 Write the spec (Task)',
    );
  });
});
