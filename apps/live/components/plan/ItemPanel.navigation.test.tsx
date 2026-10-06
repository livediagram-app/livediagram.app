// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { ItemPanel } from './ItemPanel';

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => viewport.mobile }));

// docs/specs/026-plan/plan-board.md "Open an item": a parent's Child Cards sit on its first tab before
// Comments, and the header's breadcrumb steps back; each says how it opened the next card.

afterEach(() => {
  cleanup();
  viewport.mobile = false;
});

const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const item = (id: string, key: number, type: string, fields: Item['fields'] = {}): Item => ({
  id,
  type,
  key,
  rank: 'i',
  fields: { title: `Card ${key}`, ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

function panel(open: Item, trail: Item[], childCards: Item[]) {
  const noop = vi.fn();
  const onOpenItem = vi.fn();
  render(
    <ItemPanel
      item={open}
      types={ITEM_TYPES}
      statuses={[]}
      projects={[]}
      people={[]}
      labels={[]}
      canEdit
      onSave={noop}
      onPatch={noop}
      onType={noop}
      onOpenItem={onOpenItem}
      onTrash={noop}
      onDuplicate={noop}
      onFlag={noop}
      onArchive={noop}
      onClose={noop}
      comments={{ canComment: true, selfId: 'me', onComment: noop }}
      trail={trail}
      childCards={childCards}
      statusNames={new Map()}
    />,
  );
  return onOpenItem;
}

describe('the item panel’s navigation', () => {
  it('lists a parent’s children before Comments and opens one as a ChildCard', () => {
    const project = item('p', 1, 'project');
    const onOpenItem = panel(project, [project], [item('c', 2, 'task')]);
    const children = screen.getByRole('heading', { name: /Child Cards/ });
    const comments = screen.getByText('Comments');
    expect(
      children.compareDocumentPosition(comments) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Open #2 Card 2/ }));
    expect(onOpenItem).toHaveBeenCalledWith('c', 'ChildCard');
  });

  it('steps back through the breadcrumb', () => {
    const project = item('p', 1, 'project');
    const task = item('t', 2, 'task', { parent: 'p' });
    const onOpenItem = panel(task, [project, task], []);
    fireEvent.click(screen.getByRole('button', { name: 'Back to #1 Card 1' }));
    expect(onOpenItem).toHaveBeenCalledWith('p', 'Breadcrumb');
  });

  it('has no breadcrumb for a card opened on its own', () => {
    const task = item('t', 2, 'task');
    panel(task, [task], []);
    expect(screen.queryByRole('navigation', { name: 'Card trail' })).toBeNull();
  });

  it('gives the breadcrumb a row of its own on a phone, above the header', () => {
    viewport.mobile = true;
    const project = item('p', 1, 'project');
    const task = item('t', 2, 'task', { parent: 'p' });
    const onOpenItem = panel(task, [project, task], []);
    const back = screen.getByRole('button', { name: 'Back to #1 Card 1' });
    const typePicker = screen.getByRole('combobox', { name: 'Item type' });
    expect(
      back.compareDocumentPosition(typePicker) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(typePicker.closest('nav')).toBeNull();
    fireEvent.click(back);
    expect(onOpenItem).toHaveBeenCalledWith('p', 'Breadcrumb');
  });
});
