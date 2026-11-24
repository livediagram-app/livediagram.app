// @vitest-environment jsdom
// View As Diagram's dialog (docs/specs/026-plan/view-as-diagram.md "The dialog"): the board, whole or filtered, a
// preview counted from the cards held (cards, lanes, arrows, the critical path), the name, Make Diagram; an Editor's
// diagram a connected tab, anyone else's opened in a new browser tab; refusals said plainly.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  ITEM_TYPES,
  PLAN_MAKE_BLOCKS_FIELD_ID,
  presetSetup,
  withBlocksField,
  type Item,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { IndexError, PLAN_VIEW_CARDS_MAX } from '@liveworkspace/index-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn() }));
const track = vi.hoisted(() => vi.fn());
const connectFile = vi.hoisted(() => vi.fn());
vi.mock('@liveworkspace/workbench/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: {} }));
vi.mock('@liveworkspace/workbench/components/connect/connect-file', () => ({ connectFile }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { ViewAsDiagramDialog, type ViewAsDiagramConnect } from './ViewAsDiagramDialog';

const TYPES = ITEM_TYPES.map((t) => (t.id === 'task' ? withBlocksField(t) : t));
let n = 0;
const card = (title: string, status: string, blockers: Item[] = []): Item => {
  n += 1;
  return {
    id: `i${n}`,
    type: 'task',
    key: n,
    rank: 'i',
    fields: {
      title,
      status,
      ...(blockers.length ? { [PLAN_MAKE_BLOCKS_FIELD_ID]: blockers.map((b) => b.id) } : {}),
    },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: { id: 'p', name: 'P', color: '#000' },
    updatedBy: { id: 'p', name: 'P', color: '#000' },
  };
};
const design = card('Design', 'todo');
const build = card('Build', 'doing', [design]);
const ship = card('Ship it', 'todo', [build]);
const ITEMS = new Map([design, build, ship].map((i) => [i.id, i]));
const board = (title: string, over: Partial<PlanBoardSetup> = {}) => ({
  elementId: title,
  setup: { ...presetSetup('kanban'), title, ...over },
});
const answer = {
  diagram: { id: 'D', title: 'Sprint diagram', tabId: 't', link: 'https://ld/d/D#t=t' },
  cards: 3,
  links: 2,
  critical: 3,
};

function client(over: Record<string, unknown> = {}) {
  return {
    viewPlanAsDiagram: vi.fn().mockResolvedValue(answer),
    makeConnection: vi.fn(),
    takeBackConnection: vi.fn(),
    ...over,
  };
}

const open = (
  c = client(),
  {
    connect = null as ViewAsDiagramConnect | null,
    boards = [board('Sprint', { filter: { text: 'design' } }), board('Later')],
    items = ITEMS,
    onClose = vi.fn(),
  } = {},
) =>
  render(
    <ViewAsDiagramDialog
      planId="P"
      planTitle="Launch"
      boards={boards}
      items={items}
      types={TYPES}
      me="me"
      connect={connect}
      onClose={onClose}
      client={c as never}
      now={Date.UTC(2026, 10, 24)}
    />,
  );

const preview = () =>
  within(document.querySelector<HTMLElement>('[data-view-as-diagram-preview]')!);
let opened: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  opened = vi.spyOn(window, 'open').mockImplementation(() => null);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('ViewAsDiagramDialog', () => {
  it('previews the board and its critical path, then opens the diagram in a new tab for a non-Editor', async () => {
    const c = client();
    const onClose = vi.fn();
    open(c, { onClose });
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'ViewAsDiagram');
    expect(
      preview().getByText(/3 cards in 2 lanes, 2 Blocked By arrows, a critical path of 3 cards\./),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('list', { name: 'Critical path' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent?.replace('→', '').trim()),
    ).toEqual([
      expect.stringMatching(/Design$/),
      expect.stringMatching(/Build$/),
      expect.stringMatching(/Ship it$/),
    ]);
    expect(screen.getByText('Made as you, drawn live from Launch.')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Sprint diagram');
    fireEvent.click(screen.getByRole('button', { name: 'Make Diagram' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(c.viewPlanAsDiagram).toHaveBeenCalledWith('P', {
      board: 'Sprint',
      name: 'Sprint diagram',
    });
    expect(opened).toHaveBeenCalledWith('https://ld/d/D#t=t', '_blank', 'noopener,noreferrer');
    expect(track).toHaveBeenCalledWith('UI', 'Created', 'ViewAsDiagram');
    expect(toast.success).toHaveBeenCalledWith('Diagram made', expect.anything());
  });

  it("draws only the cards the board's filter shows, and resets on another board", async () => {
    const c = client();
    open(c);
    fireEvent.click(screen.getByRole('button', { name: /^Cards the Filter Shows/ }));
    expect(preview().getByText(/1 card in 1 lane, 0 Blocked By arrows\./)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Mine  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make Diagram' }));
    await waitFor(() =>
      expect(c.viewPlanAsDiagram).toHaveBeenCalledWith('P', {
        board: 'Sprint',
        name: 'Mine',
        filtered: true,
      }),
    );
    cleanup();
    open(client());
    fireEvent.change(screen.getByLabelText('Board'), { target: { value: 'Later' } });
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Later diagram');
    expect(screen.queryByRole('button', { name: /^Cards the Filter Shows/ })).toBeNull();
  });

  it("connects an Editor's diagram as a tab beside the plan", async () => {
    const add = vi.fn();
    const connect = { grant: vi.fn().mockResolvedValue('grant'), add };
    connectFile.mockImplementation(async (a: { addTab: (m: unknown) => Promise<void> }) =>
      a.addTab({ id: 'm' }),
    );
    open(client(), { connect, boards: [board('Sprint')] });
    expect(screen.queryByLabelText('Board')).toBeNull();
    expect(screen.getByText('Made as you, beside this plan as a connected tab.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Make Diagram' }));
    await waitFor(() => expect(add).toHaveBeenCalled());
    expect(connectFile).toHaveBeenCalledWith(
      expect.objectContaining({
        hostId: 'P',
        grant: 'grant',
        targetId: 'D',
        level: 'edit',
        both: false,
      }),
    );
    expect(opened).not.toHaveBeenCalled();
    (toast.success.mock.calls[0]![1] as { action: { onSelect: () => void } }).action.onSelect();
    expect(opened).toHaveBeenCalled();
  });

  it('still opens the diagram when the connected tab cannot go in', async () => {
    const onClose = vi.fn();
    open(client(), { connect: { grant: vi.fn().mockResolvedValue(null), add: vi.fn() }, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Make Diagram' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(opened).toHaveBeenCalled();
  });

  it('says when there is nothing to draw, and needs a name', () => {
    open(client(), { items: new Map() });
    expect(screen.getByText('This board has no cards to draw yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Make Diagram' }).hasAttribute('disabled')).toBe(
      true,
    );
    cleanup();
    open(client(), { items: new Map([[ship.id, ship]]) });
    fireEvent.click(screen.getByRole('button', { name: /^Cards the Filter Shows/ }));
    expect(screen.getByText('The filter shows no cards.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Whole Board/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' ' } });
    expect(screen.getByRole('button', { name: 'Make Diagram' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it(`says when only the first ${PLAN_VIEW_CARDS_MAX} cards will be drawn`, () => {
    const many = Array.from({ length: PLAN_VIEW_CARDS_MAX + 2 }, (_, i) => card(`C${i}`, 'todo'));
    open(client(), {
      items: new Map(many.map((i) => [i.id, i])),
      boards: [board('Big', { title: '' })],
    });
    expect(
      screen.getByText(
        `The first ${PLAN_VIEW_CARDS_MAX} of ${PLAN_VIEW_CARDS_MAX + 2} cards will be drawn.`,
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Board diagram');
  });

  it.each([
    [
      new IndexError(429, 'rate_limited'),
      'That is a lot of diagrams at once. Try again in a minute.',
    ],
    [new IndexError(403, 'forbidden'), "You can't read this board any more."],
    [new Error('offline'), "livediagram couldn't be reached just now. Try again."],
  ])('says why a draw was refused: %s', async (err, words) => {
    open(client({ viewPlanAsDiagram: vi.fn().mockRejectedValue(err) }));
    fireEvent.click(screen.getByRole('button', { name: 'Make Diagram' }));
    expect(await screen.findByText(words)).toBeTruthy();
    expect(track).toHaveBeenCalledWith('UI', 'Refused', 'ViewAsDiagram');
  });
});
