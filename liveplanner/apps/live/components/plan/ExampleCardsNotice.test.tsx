// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isExampleItem, readItemPatch, type Item } from '@liveplanner/items';
import { planPalette } from './plan-palette';
import { ExampleCardsNotice, exampleCardIds } from './ExampleCardsNotice';

// docs/specs/026-plan/plan-templates.md "Example cards", items.md "Example cards".
const track = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({ track: (...a: Parameters<typeof track>) => track(...a) }));

afterEach(() => {
  cleanup();
  track.mockReset();
});

const item = (id: string, fields: Item['fields']): Item => ({
  id,
  type: 'task',
  key: 1,
  rank: 'i',
  fields: { title: id, status: 'todo', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'Sam', color: '#2563eb' },
  updatedBy: { id: 'p', name: 'Sam', color: '#2563eb' },
});

const example = item('example1', { example: true });
const exampleElsewhere = item('example2', { example: true, status: 'done' });
const trashedExample = item('example3', { example: true, status: 'trash' });
const own = item('ownCard01', {});
const all = new Map([example, exampleElsewhere, trashedExample, own].map((i) => [i.id, i]));

function planOf(canEdit: boolean) {
  return {
    items: all,
    canEdit,
    trashItems: vi.fn((ids: readonly string[]) => ids.length),
    patchItems: vi.fn(),
    announce: vi.fn(),
  };
}

const palette = planPalette('light');

describe('ExampleCardsNotice', () => {
  it('reads only the flag set to true as an example', () => {
    expect(isExampleItem(example)).toBe(true);
    expect(isExampleItem(item('x00001', { example: 'yes' }))).toBe(false);
    expect(isExampleItem(own)).toBe(false);
  });

  it('finds every example card of the document, leaving out the Trash', () => {
    expect(exampleCardIds(all.values())).toEqual(['example1', 'example2']);
  });

  it('shows an Editor the strip on a board that shows an example card', () => {
    render(<ExampleCardsNotice shown={[example, own]} plan={planOf(true)} palette={palette} />);
    expect(screen.getByText('Example cards show how this board runs.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear Example Cards' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep Them' })).toBeTruthy();
  });

  it('shows nothing on a board of no example cards', () => {
    const { container } = render(
      <ExampleCardsNotice shown={[own]} plan={planOf(true)} palette={palette} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows nothing to someone who may not edit the board (a Participant, a Viewer)', () => {
    const { container } = render(
      <ExampleCardsNotice shown={[example]} plan={planOf(false)} palette={palette} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('Clear Example Cards trashes every example card of the document, in one write', () => {
    const plan = planOf(true);
    render(<ExampleCardsNotice shown={[example]} plan={plan} palette={palette} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Example Cards' }));
    expect(plan.trashItems).toHaveBeenCalledTimes(1);
    expect(plan.trashItems).toHaveBeenCalledWith(['example1', 'example2']);
    expect(plan.announce).toHaveBeenCalledWith('2 example cards moved to the Trash');
    expect(track).toHaveBeenCalledWith('Plan', 'Deleted', 'ExampleCards');
    expect(plan.patchItems).not.toHaveBeenCalled();
  });

  it('Keep Them takes the flag off every example card, in one write the store accepts', () => {
    const plan = planOf(true);
    render(<ExampleCardsNotice shown={[example]} plan={plan} palette={palette} />);
    fireEvent.click(screen.getByRole('button', { name: 'Keep Them' }));
    expect(plan.patchItems).toHaveBeenCalledTimes(1);
    const patches = plan.patchItems.mock.calls[0]![0] as {
      id: string;
      patch: Record<string, unknown>;
    }[];
    expect(patches.map((p) => p.id)).toEqual(['example1', 'example2']);
    for (const { patch } of patches) expect(readItemPatch(patch)).toEqual({ clear: ['example'] });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'ExampleCardsKept');
    expect(plan.trashItems).not.toHaveBeenCalled();
  });
});
