// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { CardFinderPanel } from './CardFinderPanel';

// docs/specs/026-plan/items.md "Finding a card": cards of every type, custom ones included, and the card type chips.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/components/primitives/MovablePanel', () => ({
  MovablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

afterEach(cleanup);

const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
let key = 0;
const card = (title: string, type: string, updatedAt: number): Item => ({
  id: `i-${title}`,
  type,
  key: ++key,
  rank: 'i',
  fields: { title },
  rev: 1,
  createdAt: 0,
  updatedAt,
  createdBy: SAM,
  updatedBy: SAM,
});
const PERSON = { ...ITEM_TYPES[1]!, id: 'person', label: 'Person', glyph: 'person' };

function open(statusTypes?: ReadonlyMap<string, 'all' | ReadonlySet<string>>) {
  for (const k of Object.keys(plan)) delete plan[k];
  const items = [
    card('Sam Reed', 'person', 3),
    { ...card('Write copy', 'task', 2), fields: { title: 'Write copy', status: 'todo' } },
    { ...card('Launch', 'project', 1), fields: { title: 'Launch', status: 'todo' } },
  ];
  Object.assign(plan, {
    types: [...ITEM_TYPES, PERSON],
    items: new Map(items.map((i) => [i.id, i])),
    statusNames: new Map(),
    ...(statusTypes ? { statusTypes } : {}),
    canEdit: true,
    openItem: vi.fn(),
  });
  render(<CardFinderPanel onPopoverClose={() => {}} />);
}

const rows = () =>
  within(screen.getByRole('list', { name: 'Cards' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent ?? '');

describe('the Card Finder', () => {
  it('lists cards of custom types and finds them by the type’s name', () => {
    open();
    expect(rows().some((r) => r.includes('Sam Reed') && r.includes('Person'))).toBe(true);
    fireEvent.change(screen.getByLabelText('Search cards'), {
      target: { value: 'person' },
    });
    expect(rows()).toHaveLength(1);
  });

  it('narrows by Card Type from Add Filter, and counts what is left', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Add Filter' }));
    const picker = () => within(screen.getByRole('dialog', { name: 'Add Filter' }));
    fireEvent.click(picker().getByRole('button', { name: 'Card Type' }));
    fireEvent.click(picker().getByRole('button', { name: /Person/ }));
    expect(rows()).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /All Cards/ }).textContent).toContain('1');
    expect(screen.queryByRole('group', { name: 'Card types' })).toBeNull();
  });

  it('counts a card as not on a board when the boards naming its status hide its type', () => {
    // Only a board showing Tasks names "todo": the Project there is shown by no board.
    open(new Map([['todo', new Set(['task'])]]));
    expect(screen.getByRole('radio', { name: /Not on a Board/ }).textContent).toContain('2');
    fireEvent.click(screen.getByRole('radio', { name: /Not on a Board/ }));
    expect(rows().some((r) => r.includes('Launch'))).toBe(true);
    expect(rows().some((r) => r.includes('Write copy'))).toBe(false);
  });
});

describe('the Card Finder’s filters', () => {
  it('narrows by a field and value, and Clear Filters shows them all again', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Add Filter' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Add Filter' })).getByRole('button', {
        name: 'State',
      }),
    );
    const picker = within(screen.getByRole('dialog', { name: 'Add Filter' }));
    fireEvent.click(picker.getByRole('button', { name: /No status/ }));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain('Sam Reed');
    expect(screen.getByText('State:')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(rows()).toHaveLength(3);
  });
});
