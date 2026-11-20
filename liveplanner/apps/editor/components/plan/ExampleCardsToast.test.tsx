// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isExampleItem, type Item } from '@liveplanner/items';
import type { ToastActionSpec } from '@/hooks/ui/useToast';
import {
  EXAMPLE_CARDS_MESSAGE,
  EXAMPLE_CARDS_TOAST_KEY,
  ExampleCardsToast,
  exampleCardIds,
  resetExampleCardsToastForTests,
} from './ExampleCardsToast';

// docs/specs/026-plan/plan-templates.md "Example cards", items.md "Example cards".
const track = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({ track: (...a: Parameters<typeof track>) => track(...a) }));
const toast = vi.hoisted(() => ({
  action: vi.fn<(spec: import('@/hooks/ui/useToast').ToastActionSpec) => void>(),
  dismissAction: vi.fn<(key: string) => void>(),
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

beforeEach(resetExampleCardsToastForTests);
afterEach(() => {
  cleanup();
  track.mockReset();
  toast.action.mockReset();
  toast.dismissAction.mockReset();
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
    announce: vi.fn(),
  };
}

const lastSpec = (): ToastActionSpec => toast.action.mock.calls.at(-1)![0];

describe('ExampleCardsToast', () => {
  it('reads only the flag set to true as an example', () => {
    expect(isExampleItem(example)).toBe(true);
    expect(isExampleItem(item('x00001', { example: 'yes' }))).toBe(false);
    expect(isExampleItem(own)).toBe(false);
  });

  it('finds every example card of the project, leaving out the Trash', () => {
    expect(exampleCardIds(all.values())).toEqual(['example1', 'example2']);
  });

  it('raises one standing toast with Clear for an Editor, and no Keep', () => {
    render(<ExampleCardsToast shown={[example, own]} plan={planOf(true)} />);
    const spec = lastSpec();
    expect(spec).toMatchObject({
      key: EXAMPLE_CARDS_TOAST_KEY,
      message: EXAMPLE_CARDS_MESSAGE,
      sticky: true,
    });
    expect(spec.actions.map((a) => a.label)).toEqual(['Clear']);
  });

  it('raises nothing for a Participant or a Viewer, or on a board with no example card', () => {
    render(<ExampleCardsToast shown={[example]} plan={planOf(false)} />);
    render(<ExampleCardsToast shown={[own]} plan={planOf(true)} />);
    expect(toast.action).not.toHaveBeenCalled();
  });

  it('Clear trashes every example card of the project, once, and says so', () => {
    const plan = planOf(true);
    render(<ExampleCardsToast shown={[example]} plan={plan} />);
    lastSpec().actions[0]!.onSelect();
    expect(plan.trashItems).toHaveBeenCalledWith(['example1', 'example2']);
    expect(plan.announce).toHaveBeenCalledWith('2 example cards moved to the Trash');
    expect(track).toHaveBeenCalledWith('Plan', 'Deleted', 'ExampleCards');
  });

  it('stays while any board asks for it, and leaves with the last', async () => {
    const tick = () => new Promise((done) => setTimeout(done, 0));
    const plan = planOf(true);
    const a = render(<ExampleCardsToast shown={[example]} plan={plan} />);
    const b = render(<ExampleCardsToast shown={[example]} plan={plan} />);
    a.unmount();
    await tick();
    expect(toast.dismissAction).not.toHaveBeenCalled();
    b.unmount();
    // A board mounting straight after keeps it.
    const c = render(<ExampleCardsToast shown={[example]} plan={plan} />);
    await tick();
    expect(toast.dismissAction).not.toHaveBeenCalled();
    c.unmount();
    await tick();
    expect(toast.dismissAction).toHaveBeenCalledWith(EXAMPLE_CARDS_TOAST_KEY);
  });

  it('closed, it does not come back on this page', () => {
    const plan = planOf(true);
    const first = render(<ExampleCardsToast shown={[example]} plan={plan} />);
    lastSpec().onDismiss!();
    first.unmount();
    toast.action.mockClear();
    render(<ExampleCardsToast shown={[example]} plan={plan} />);
    expect(toast.action).not.toHaveBeenCalled();
  });
});
