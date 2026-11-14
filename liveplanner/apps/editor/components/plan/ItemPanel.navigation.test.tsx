// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, dayLabel, type Item } from '@liveplanner/items';
import { ItemPanel } from './ItemPanel';
import { ItemMeta } from './ItemPanelLayout';

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => viewport.mobile,
}));

// docs/specs/026-plan/plan-board.md "Open an item": a project's Linked as Parent sits on its Linked Cards tab
// (item-types.md "The Linked Cards tab"), and the header's breadcrumb steps back; each says how it opened the next
// card.

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
  it('lists a Project’s Linked as Parent on Linked Cards and opens one as a ChildCard', () => {
    const project = item('p', 1, 'project');
    const onOpenItem = panel(project, [project], [item('c', 2, 'task')]);
    expect(screen.queryByRole('heading', { name: /Linked as Parent/ })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Linked Cards, 1 card' }));
    expect(screen.getByRole('heading', { name: /Linked as Parent/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Open #2 Card 2/ }));
    expect(onOpenItem).toHaveBeenCalledWith('c', 'ChildCard');
  });

  it('steps back through the breadcrumb', () => {
    const project = item('p', 1, 'project');
    const task = item('t', 2, 'task', { parent: 'p' });
    const onOpenItem = panel(task, [project, task], []);
    fireEvent.click(screen.getByRole('button', { name: /^#1 Card 1/ }));
    expect(onOpenItem).toHaveBeenCalledWith('p', 'Breadcrumb');
  });

  it('has no breadcrumb for a card opened on its own', () => {
    const task = item('t', 2, 'task');
    panel(task, [task], []);
    expect(screen.queryByRole('navigation', { name: 'Card trail' })).toBeNull();
  });

  it('gives the breadcrumb a row of its own on a phone too, above the header', () => {
    viewport.mobile = true;
    const project = item('p', 1, 'project');
    const task = item('t', 2, 'task', { parent: 'p' });
    const onOpenItem = panel(task, [project, task], []);
    const back = screen.getByRole('button', { name: /^#1 Card 1/ });
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

// docs/specs/026-plan/plan-board.md "Open an item": the Details panel ends with who made and last edited it, and when
// (docs/specs/026-plan/items.md "Created and Last Edited").
describe('the item panel’s authorship', () => {
  it('says Created by and Edited by, each with the person’s disc, in a footer at the foot of Details', () => {
    const task = {
      ...item('t', 1, 'task'),
      updatedBy: { id: 'q', name: 'Robin Lee', color: '#16a34a' },
    };
    panel(task, [task], []);
    const created = screen.getByText(/^Created by/).closest('[data-item-meta-row]')!;
    expect(created.textContent).toMatch(/^SACreated by Sam/);
    const edited = screen.getByText(/^Edited by/).closest('[data-item-meta-row]')!;
    expect(edited.textContent).toMatch(/^RLEdited by Robin Lee/);
    const footer = created.closest('footer')!;
    expect(footer.hasAttribute('data-item-meta')).toBe(true);
    expect(footer.closest('aside')!.lastElementChild).toBe(footer);
  });

  // Work Tracker 768, Work Tracker 822 (docs/specs/026-plan/automations.md "On cards"): a GitHub-triggered rule's stamp
  // names GitHub and the rule, on GitHub's mark, from the first draw; any other rule's (or an older stamp without its
  // source) keeps the bolt and the rule's name.
  it('names GitHub and the rule, on GitHub’s mark, after a GitHub-triggered run', () => {
    const rule = { id: 'automation', name: 'Done on Merge', color: '#7c3aed' };
    const task = { ...item('t', 1, 'task'), updatedBy: { ...rule, via: 'github' as const } };
    const { rerender } = render(<ItemMeta item={task} now={Date.now()} />);
    const row = () => screen.getByText(/^Edited by/).closest('[data-item-meta-row]')!;
    expect(row().textContent).toMatch(/^Edited by GitHub · Done on Merge/);
    expect(row().querySelector('[data-github-disc] svg')).toBeTruthy();
    expect(row().querySelector('[data-automation-disc]')).toBeNull();
    rerender(<ItemMeta item={{ ...task, updatedBy: rule }} now={Date.now()} />);
    expect(row().textContent).toMatch(/^Edited by Done on Merge/);
    expect(row().querySelector('[data-automation-disc]')).toBeTruthy();
    // A person's stamp never reads as GitHub's, whatever it carries.
    const person = {
      ...task,
      updatedBy: { id: 'q', name: 'Robin Lee', color: '#16a34a', via: 'github' as const },
    };
    rerender(<ItemMeta item={person} now={Date.now()} />);
    expect(row().textContent).toMatch(/^RLEdited by Robin Lee/);
  });

  it('says Created by GitHub and the rule for a card a GitHub rule made', async () => {
    const rule = { id: 'automation', name: 'Card for Each Pull Request', color: '#7c3aed' };
    const task = { ...item('t', 1, 'task'), createdBy: { ...rule, via: 'github' as const } };
    const { rerender } = render(<ItemMeta item={task} now={Date.now()} />);
    const row = () => screen.getByText(/^Created by/).closest('[data-item-meta-row]')!;
    expect(row().textContent).toMatch(/^Created by GitHub · Card for Each Pull Request/);
    expect(row().querySelector('[data-github-disc] svg')).toBeTruthy();
    expect(row().querySelector('[data-automation-disc]')).toBeNull();
    // An older card, stamped before the stamp carried its source, keeps the bolt.
    rerender(<ItemMeta item={{ ...task, createdBy: rule }} now={Date.now()} />);
    expect(row().textContent).toMatch(/^Created by Card for Each Pull Request/);
    expect(row().querySelector('[data-automation-disc]')).toBeTruthy();
    rerender(<ItemMeta item={task} now={Date.now()} />);
    fireEvent.pointerEnter(screen.getByText(/^Created by/), { pointerType: 'mouse' });
    expect((await screen.findByRole('tooltip')).textContent).toBe(
      'Created by GitHub · Card for Each Pull Request',
    );
  });

  it('shows a rule’s whole name on hover, where the footer cuts it', async () => {
    const task = {
      ...item('t', 1, 'task'),
      updatedBy: {
        id: 'automation',
        name: 'Done When the Pull Request Merges',
        color: '#7c3aed',
        via: 'github' as const,
      },
    };
    render(<ItemMeta item={task} now={Date.now()} />);
    const words = screen.getByText(/^Edited by/);
    fireEvent.pointerEnter(words, { pointerType: 'mouse' });
    expect((await screen.findByRole('tooltip')).textContent).toBe(
      'Edited by GitHub · Done When the Pull Request Merges',
    );
  });

  it('says the day it was made and how long since its last edit', () => {
    const made = new Date(2026, 9, 3, 14, 2).getTime();
    const task = {
      ...item('t', 1, 'task'),
      createdAt: made,
      updatedAt: Date.now() - 2 * 3_600_000,
    };
    panel(task, [task], []);
    const created = screen.getByText(/^Created by/).closest('[data-item-meta-row]')!;
    expect(created.textContent).toBe(`SACreated by Sam${dayLabel('2026-10-03', 'medium')}`);
    const edited = screen.getByText(/^Edited by/).closest('[data-item-meta-row]')!;
    expect(edited.textContent).toBe('SAEdited by Sam2 hours ago');
    expect(edited.querySelector('time')?.getAttribute('datetime')).toBe(
      new Date(task.updatedAt).toISOString(),
    );
  });

  // Details is a flex column of a fixed height that scrolls: a row or the footer allowed to shrink was squeezed to its
  // floor when the fields outgrew it (a Time Spent field, Labels on two lines), spilling over the rows below.
  it('never squeezes a Details row or the footer: Details scrolls instead', () => {
    const task = item('t', 1, 'task');
    panel(task, [task], []);
    const aside = document.querySelector('aside')!;
    expect(aside.className).toMatch(/\bflex-col\b/);
    expect(aside.className).toMatch(/\boverflow-y-auto\b/);
    const rows = [...aside.children].filter((el) => el.tagName !== 'H3');
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) expect(row.className).toMatch(/\bshrink-0\b/);
  });

  it('leaves out a person the card does not hold, never a guess', () => {
    const lost = { id: '', name: 'Someone', color: '#94a3b8' };
    const task = { ...item('t', 1, 'task'), createdBy: lost, updatedBy: lost };
    panel(task, [task], []);
    expect(screen.queryByText(/^Created by/)).toBeNull();
    expect(screen.queryByText(/^Edited by/)).toBeNull();
  });
});
