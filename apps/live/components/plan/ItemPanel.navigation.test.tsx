// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { ItemPanel } from './ItemPanel';

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => viewport.mobile }));

// docs/specs/026-plan/plan-board.md "Open an item": a project's Linked as Parent sits on its first tab before
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

function panel(open: Item, trail: Item[], linked: Item[], fresh = false) {
  const noop = vi.fn();
  const onOpenItem = vi.fn();
  render(
    <ItemPanel
      item={open}
      types={ITEM_TYPES}
      statuses={[]}
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
      linkedGroups={
        linked.length > 0
          ? [{ fieldId: 'parent', label: 'Parent', fromTypes: ['task'], cards: linked }]
          : []
      }
      statusNames={new Map()}
      fresh={fresh}
    />,
  );
  return onOpenItem;
}

// docs/specs/026-plan/plan-board.md "Open an item": on a desktop the title takes focus as a card opens (a card
// just made has it selected); on a phone focus stays on the panel, so no keyboard rises. Never the type picker.
describe('the item panel’s first focus', () => {
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  it('puts the caret at the end of the title on a desktop', async () => {
    panel(item('t', 2, 'task'), [], []);
    await nextFrame();
    const title = screen.getByLabelText('Title') as HTMLInputElement;
    expect(document.activeElement).toBe(title);
    expect(title.selectionStart).toBe(title.value.length);
    expect(title.selectionEnd).toBe(title.value.length);
  });

  it('selects the whole title of a card just made', async () => {
    panel(item('t', 2, 'task', { title: 'New task' }), [], [], true);
    await nextFrame();
    const title = screen.getByLabelText('Title') as HTMLInputElement;
    expect(document.activeElement).toBe(title);
    expect(title.selectionStart).toBe(0);
    expect(title.selectionEnd).toBe('New task'.length);
  });

  it('leaves focus on the panel on a phone', async () => {
    viewport.mobile = true;
    panel(item('t', 2, 'task'), [], [], true);
    await nextFrame();
    expect(document.activeElement).not.toBe(screen.getByLabelText('Title'));
    expect(screen.queryByRole('combobox', { name: 'Card Type' })).not.toBe(document.activeElement);
  });
});

describe('the item panel’s navigation', () => {
  it('lists a Project’s Linked as Parent before Comments and opens one as a ChildCard', () => {
    const project = item('p', 1, 'project');
    const onOpenItem = panel(project, [project], [item('c', 2, 'task')]);
    const children = screen.getByRole('heading', { name: /Linked as Parent/ });
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
    const typePicker = screen.getByRole('combobox', { name: 'Card Type' });
    expect(
      back.compareDocumentPosition(typePicker) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(typePicker.closest('nav')).toBeNull();
    fireEvent.click(back);
    expect(onOpenItem).toHaveBeenCalledWith('p', 'Breadcrumb');
  });
});

// docs/specs/026-plan/plan-board.md "The header reads part by part": the type is a control, the number a tag.
describe('the item panel header', () => {
  it('makes the card type a labelled picker and the number a tag that copies it', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const task = item('t', 7, 'task');
    panel(task, [task], []);
    const picker = screen.getByRole('combobox', { name: 'Card Type' });
    expect((picker as HTMLSelectElement).value).toBe('task');
    fireEvent.click(screen.getByRole('button', { name: 'Copy card number #7' }));
    expect(writeText).toHaveBeenCalledWith('#7');
    expect(await screen.findByRole('button', { name: 'Copied #7' })).toBeTruthy();
  });
});

// docs/specs/026-plan/plan-board.md "Open an item": the Details panel ends with who made and last edited it.
describe('the item panel’s authorship', () => {
  it('says Created by and Edited by, each with the person’s disc', () => {
    const task = {
      ...item('t', 1, 'task'),
      updatedBy: { id: 'q', name: 'Robin Lee', color: '#16a34a' },
    };
    panel(task, [task], []);
    const created = screen.getByText(/^Created by/).closest('div')!;
    expect(created.textContent).toBe('Created by SASam');
    const edited = screen.getByText(/^Edited by/).closest('div')!;
    expect(edited.textContent).toMatch(/^Edited by RLRobin Lee, /);
  });
});
