import { rememberSend } from '@liveworkspace/workbench/components/send-to-plan/send-memory';
// @vitest-environment jsdom
// Make Plan Cards' preview (docs/specs/013-workspace/make-plan-cards.md "The preview"): pick a plan, board and column;
// every shape a ticked row saying where it lands; Lanes Become; a shape made before updates its card; removed shapes'
// cards offered unticked for the Trash; nothing written until Make Cards; refusals said plainly.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  IndexError,
  planSendRef,
  type PlanMakeAsk,
  type PlanSend,
} from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn() }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@liveworkspace/workbench/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: {} }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { MakePlanCardsDialog } from './MakePlanCardsDialog';
import type { MakeShape } from '@/lib/plan-cards/make-plan-rows';

const plan = (id: string, title: string) =>
  ({ id, title, access: 'edit', app: 'liveplanner' }) as never;
const sent = (element: string, card = `card-${element}`, title = 'Old card'): PlanSend => ({
  id: `s-${element}`,
  ref: planSendRef({ kind: 'element', tabId: 't1', elementId: element, part: null }),
  kind: 'element',
  plan: { id: 'P', title: 'Launch' },
  card: { id: card, title, column: 'To Do', done: false },
  link: `https://lp/project/P#item=${card}`,
  at: 1,
});
const shape = (element: string, over: Partial<MakeShape> = {}): MakeShape => ({
  element,
  title: `Shape ${element}`,
  text: `Shape ${element}`,
  blockedBy: [],
  ...over,
});

function client(over: Record<string, unknown> = {}) {
  return {
    listItems: vi.fn().mockResolvedValue({ items: [plan('P', 'Launch')] }),
    automationTarget: vi.fn().mockResolvedValue({
      app: 'liveplanner',
      title: 'Launch',
      boards: [
        { id: 'b1', name: 'Board', columns: ['To Do', 'Doing'] },
        { id: 'b2', name: 'Later', columns: ['Someday'] },
      ],
    }),
    makePlanCards: vi
      .fn()
      .mockResolvedValue({ sends: [sent('a')], made: 2, updated: 0, trashed: 1, skipped: 0 }),
    newPlanForSend: vi.fn().mockResolvedValue({ item: plan('N', 'Plan from Roadmap') }),
    ...over,
  };
}

const open = (
  c: ReturnType<typeof client>,
  {
    shapes = [
      shape('a', { lane: 'Doing', due: '2026-12-05' }),
      shape('b', { lane: 'Design', blockedBy: ['a'] }),
    ],
    sends = [] as PlanSend[],
    removed = [] as { send: PlanSend }[],
    onClose = vi.fn(),
  } = {},
) =>
  render(
    <MakePlanCardsDialog
      shapes={shapes}
      removed={removed}
      sends={sends}
      source={{ itemId: 'D', tabId: 't1', label: 'Roadmap tab' }}
      sourceTitle="Roadmap"
      onClose={onClose}
      client={c as never}
    />,
  );

const makeButton = () => screen.getByRole('button', { name: /Make Cards|Update Cards|Making/ });

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('MakePlanCardsDialog', () => {
  it('previews each shape, makes the ticked ones in the plan picked, and says so', async () => {
    const c = client();
    const onClose = vi.fn();
    open(c, { onClose, removed: [{ send: sent('gone', 'card-gone', 'Removed card') }] });
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'MakePlanCards');
    expect(screen.getByText(/Turn 2 shapes from Roadmap tab/)).toBeTruthy();
    expect(makeButton().hasAttribute('disabled')).toBe(true);
    fireEvent.click(await screen.findByRole('button', { name: /Launch/ }));
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>('Column').value).toBe('To Do'),
    );
    // A lane named after a column lands there; another lane says it has no column.
    const rows = () => within(document.querySelector<HTMLElement>('[data-plan-cards-rows]')!);
    expect(rows().getByText('Doing')).toBeTruthy();
    expect(rows().getByText('No column called Design')).toBeTruthy();
    // The day follows the reader's locale (CI runs en-US: "Dec 5").
    expect(screen.getByText(/^Due (5 Dec|Dec 5)$/)).toBeTruthy();
    expect(screen.getByText('Waits on 1')).toBeTruthy();
    expect(screen.getByText(/Make 2 cards, 1 Blocked By link\./)).toBeTruthy();
    // The removed shape's card is offered, unticked; ticking it moves it to the Trash.
    expect(screen.getByText('Removed card')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Removed card/ }));
    expect(screen.getByText(/1 to the Trash/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Board'), { target: { value: 'b2' } });
    expect(screen.getByLabelText<HTMLSelectElement>('Column').value).toBe('Someday');
    fireEvent.change(screen.getByLabelText('Board'), { target: { value: 'b1' } });
    fireEvent.change(screen.getByLabelText('Column'), { target: { value: 'Doing' } });
    fireEvent.click(makeButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(c.makePlanCards).toHaveBeenCalledWith('P', {
      board: 'b1',
      column: 'Doing',
      source: { itemId: 'D', tabId: 't1', label: 'Roadmap tab' },
      cards: [
        expect.objectContaining({ element: 'a', column: 'Doing', due: '2026-12-05' }),
        expect.objectContaining({ element: 'b', blockedBy: ['a'] }),
      ],
      trash: ['card-gone'],
    });
    expect(track).toHaveBeenCalledWith('UI', 'Created', 'MakePlanCards');
    expect(toast.success).toHaveBeenCalledWith(
      '2 cards in Launch, 1 moved to the Trash',
      expect.anything(),
    );
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    (toast.success.mock.calls[0]![1] as { action: { onSelect: () => void } }).action.onSelect();
    expect(opened).toHaveBeenCalledWith(
      'https://lp/project/P#item=card-a',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('turns lanes into labels, or leaves them out', async () => {
    const c = client();
    open(c);
    fireEvent.click(await screen.findByRole('button', { name: /Launch/ }));
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>('Column').value).toBe('To Do'),
    );
    const rows = () => within(document.querySelector<HTMLElement>('[data-plan-cards-rows]')!);
    fireEvent.click(screen.getByRole('button', { name: /^Labels/ }));
    expect(rows().getByText('Design')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Nothing/ }));
    expect(rows().queryByText('Design')).toBeNull();
    fireEvent.click(makeButton());
    await waitFor(() => expect(c.makePlanCards).toHaveBeenCalled());
    expect(
      (c.makePlanCards.mock.calls[0] as [string, PlanMakeAsk])[1].cards[0]!.column,
    ).toBeUndefined();
  });

  it('says Update Cards when every ticked shape made a card before, and ticks and unticks all', async () => {
    const c = client({
      makePlanCards: vi
        .fn()
        .mockResolvedValue({ sends: [], made: 0, updated: 1, trashed: 0, skipped: 0 }),
    });
    const onClose = vi.fn();
    open(c, { shapes: [shape('a')], sends: [sent('a')], onClose });
    fireEvent.click(await screen.findByRole('button', { name: /Launch/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update Cards' })).toBeTruthy());
    expect(screen.getByText('Updates Card')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Untick All' }));
    expect(screen.getByText('Tick the shapes to make into cards.')).toBeTruthy();
    expect(makeButton().hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Tick All' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Shape a/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Shape a/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Update Cards' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('1 card in Launch', {});
  });

  it('keeps the remembered plan listed when Recent has not got it, and counts the updates', async () => {
    rememberSend('D', { planId: 'P', planTitle: 'Launch', board: 'b1', column: 'To Do', at: 1 });
    open(client({ listItems: vi.fn().mockResolvedValue({ items: [] }) }), {
      shapes: [shape('a'), shape('b')],
      sends: [sent('a')],
    });
    const held = await screen.findByRole('button', { name: /Launch/ });
    expect(held.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('No plans yet')).toBeNull();
    await waitFor(() => expect(screen.getByText(/^Make 1 card, update 1 card\./)).toBeTruthy());
  });

  it('searches past 8 shapes, lists the first 200, and says how many more', async () => {
    const many = Array.from({ length: 205 }, (_, i) =>
      shape(`s${i}`, { title: `Card number ${i}` }),
    );
    open(client(), { shapes: many });
    expect(screen.getByText('5 more cards: search to find one.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search the cards' }), {
      target: { value: 'number 204' },
    });
    expect(screen.getByText('Card number 204')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search the cards' }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('No card matches.')).toBeTruthy();
  });

  it('says when nothing has words, and when the plan has no board or cannot be edited', async () => {
    const empty = client({
      automationTarget: vi.fn().mockResolvedValue({ app: 'liveplanner', title: 'x', boards: [] }),
    });
    open(empty, { shapes: [] });
    expect(screen.getByText('Nothing here has words to make a card from.')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: /Launch/ }));
    expect(await screen.findByText(/This plan has no board yet/)).toBeTruthy();
    cleanup();
    open(client({ automationTarget: vi.fn().mockRejectedValue(new IndexError(403, 'forbidden')) }));
    fireEvent.click(await screen.findByRole('button', { name: /Launch/ }));
    expect(await screen.findByText(/You can't add cards to this plan/)).toBeTruthy();
  });

  it('makes a new plan to send to', async () => {
    const c = client();
    open(c);
    fireEvent.click(await screen.findByRole('button', { name: 'New Plan' }));
    fireEvent.keyDown(screen.getByLabelText("New plan's name"), { key: 'Enter' });
    await waitFor(() => expect(c.newPlanForSend).toHaveBeenCalledWith('Plan from Roadmap'));
    await waitFor(() => expect(c.automationTarget).toHaveBeenCalledWith('N', expect.anything()));
    cleanup();
    const failing = client({ newPlanForSend: vi.fn().mockRejectedValue(new Error('down')) });
    open(failing);
    fireEvent.click(await screen.findByRole('button', { name: 'New Plan' }));
    fireEvent.keyDown(screen.getByLabelText("New plan's name"), { key: 'Enter' });
    expect(await screen.findByText("Couldn't make the plan. Try again in a moment.")).toBeTruthy();
  });

  it.each([
    [new IndexError(429, 'rate_limited'), 'That is a lot of cards at once. Try again in a minute.'],
    [new IndexError(409, 'source_full'), 'This diagram has made as many cards as it may.'],
    [
      new IndexError(409, 'plan_refused', null, null, null, { reason: 'The board is gone' }),
      'The plan refused: The board is gone.',
    ],
    [new IndexError(409, 'plan_refused'), 'That plan is full.'],
    [new IndexError(403, 'forbidden'), "You can't add cards to this plan."],
    [new Error('offline'), "The plan couldn't be reached just now. Try again."],
  ])('says why a make was refused: %s', async (err, words) => {
    const c = client({ makePlanCards: vi.fn().mockRejectedValue(err) });
    open(c);
    fireEvent.click(await screen.findByRole('button', { name: /Launch/ }));
    await waitFor(() => expect(makeButton().hasAttribute('disabled')).toBe(false));
    fireEvent.click(makeButton());
    expect(await screen.findByText(words)).toBeTruthy();
    expect(track).toHaveBeenCalledWith('UI', 'Refused', 'MakePlanCards');
  });

  it('shows the plan list failing', async () => {
    open(client({ listItems: vi.fn().mockRejectedValue(new Error('down')) }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Launch/ })).toBeNull());
  });
});
