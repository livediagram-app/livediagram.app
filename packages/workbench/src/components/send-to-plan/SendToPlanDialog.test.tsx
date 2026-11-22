// @vitest-environment jsdom
// Send to Plan's picker (liveworkspace/docs/specs/004-index/send-to-plan.md "The picker"): a plan, its board and
// column, the card read from the words and editable, Send; one card each or a checklist; an already sent place
// offered first; New Plan; a plan the person cannot edit locked; refusals said plainly. The clock is pinned.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IndexError, type PlanSend, type PlanSendPlace } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock('../../hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import { SendToPlanDialog } from './SendToPlanDialog';
import { addSends, setSendSource } from './send-store';
import { sendPlace } from './send-to-plan-entry';
import { SEND_MEMORY_KEY } from './send-memory';

const TODAY = new Date(2026, 10, 18);
const place = (text: string, elementId = 'e1'): PlanSendPlace =>
  sendPlace({ app: 'livediagram', itemId: 'D', kind: 'element', tabId: 't1', elementId, text });
const plan = (id: string, title: string, access: 'edit' | 'view' = 'edit') =>
  ({ id, title, access, app: 'liveplanner' }) as never;
const made = (over: Partial<PlanSend> = {}): PlanSend => ({
  id: 'ps_1',
  ref: 'element:t1:e1:',
  kind: 'element',
  plan: { id: 'P', title: 'Sprint' },
  card: { id: 'c1', title: 'Fix login', column: 'To Do', done: false },
  link: 'https://lp/project/P#item=c1',
  at: 1,
  ...over,
});

function client(over: Record<string, unknown> = {}) {
  return {
    listItems: vi
      .fn()
      .mockResolvedValue({ items: [plan('P', 'Sprint'), plan('V', 'Viewed', 'view')] }),
    automationTarget: vi.fn().mockResolvedValue({
      app: 'liveplanner',
      title: 'Sprint',
      boards: [
        { id: 'b1', name: 'Board', columns: ['To Do', 'Doing'] },
        { id: 'b2', name: 'Later', columns: ['Someday'] },
      ],
      people: [{ name: 'Ben Ito' }],
    }),
    sendToPlan: vi.fn().mockResolvedValue({ sends: [made()] }),
    newPlanForSend: vi.fn().mockResolvedValue({ item: plan('N', 'Plans from Retro') }),
    ...over,
  };
}

const open = (
  c: ReturnType<typeof client>,
  places = [place('Fix login @ben by Friday')],
  onClose = vi.fn(),
) =>
  render(
    <SendToPlanDialog
      request={{ places, noun: places.length > 1 ? 'stickies' : 'sticky' }}
      sourceId="D"
      sourceTitle="Retro"
      onClose={onClose}
      client={c as never}
      today={TODAY}
    />,
  );

afterEach(() => {
  cleanup();
  setSendSource(null);
  localStorage.clear();
  vi.clearAllMocks();
});

describe('SendToPlanDialog', () => {
  it('sends one card read from the words, to the board and column picked, and remembers where', async () => {
    const c = client();
    const onClose = vi.fn();
    open(c, undefined, onClose);
    expect(screen.getByText(/from this sticky/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Send to Plan/ }).hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Sprint/ }));
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>('Assignee').value).toBe('Ben Ito'),
    );
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe('Fix login');
    expect(screen.getByLabelText<HTMLInputElement>('Due').value).toBe('2026-11-20');
    fireEvent.change(screen.getByLabelText('Board'), { target: { value: 'b2' } });
    expect(screen.getByLabelText<HTMLSelectElement>('Column').value).toBe('Someday');
    fireEvent.change(screen.getByLabelText('Board'), { target: { value: 'b1' } });
    fireEvent.change(screen.getByLabelText('Column'), { target: { value: 'Doing' } });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fix the login' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to Plan' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(c.sendToPlan).toHaveBeenCalledWith('P', {
      board: 'b1',
      column: 'Doing',
      cards: [
        expect.objectContaining({ title: 'Fix the login', assignee: 'Ben Ito', due: '2026-11-20' }),
      ],
    });
    expect(toast.success).toHaveBeenCalledWith('Sent a card to Sprint', expect.anything());
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    (toast.success.mock.calls[0]![1] as { action: { onSelect: () => void } }).action.onSelect();
    expect(opened).toHaveBeenCalled();
    expect(localStorage.getItem(SEND_MEMORY_KEY)).toContain('"planId":"P"');
  });

  it('opens on the plan last sent to, and says when nobody in it has the name mentioned', async () => {
    localStorage.setItem(
      SEND_MEMORY_KEY,
      JSON.stringify({
        D: { planId: 'P', planTitle: 'Sprint', board: 'b2', column: 'Someday', at: 1 },
      }),
    );
    const c = client({
      automationTarget: vi.fn().mockResolvedValue({
        app: 'liveplanner',
        title: 'S',
        boards: [{ id: 'b2', name: 'L', columns: ['Someday'] }],
      }),
    });
    open(c, [place('Ship it @zed')]);
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>('Column').value).toBe('Someday'),
    );
    expect(screen.getByText('Nobody in this plan is called zed.')).toBeTruthy();
    expect(c.automationTarget).toHaveBeenCalledWith('P', expect.anything());
  });

  it('makes one card each, or one with a checklist, from several places', async () => {
    const c = client({
      sendToPlan: vi.fn().mockResolvedValue({
        sends: [
          made(),
          made({ id: 'ps_2', card: { id: 'c2', title: 'B', column: 'To Do', done: false } }),
        ],
      }),
    });
    open(c, [place('One', 'a'), place('Two', 'b')]);
    expect(screen.getByText(/from these stickies/)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: /Sprint/ }));
    await screen.findByRole('button', { name: '2 Cards' });
    expect(screen.queryByLabelText('Title')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'One Card with a Checklist' }));
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe('Retro actions');
    fireEvent.click(screen.getByRole('button', { name: '2 Cards' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send to Plan' }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send to Plan' }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Sent 2 cards to Sprint', expect.anything()),
    );
    expect((c.sendToPlan.mock.calls[0]![1] as { cards: unknown[] }).cards).toHaveLength(2);
  });

  it('offers the card a place was already sent to, and sends again only when asked', async () => {
    setSendSource('D', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
    act(() => addSends([made()]));
    const c = client();
    open(c, [place('Fix login')]);
    expect(screen.getByText(/Already sent:/)).toBeTruthy();
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    fireEvent.click(screen.getByRole('button', { name: 'Open Card' }));
    expect(opened).toHaveBeenCalledWith(
      'https://lp/project/P#item=c1',
      '_blank',
      'noopener,noreferrer',
    );
    fireEvent.click(await screen.findByRole('button', { name: /Sprint/ }));
    const again = await screen.findByRole('button', { name: 'Send Again' });
    await waitFor(() => expect(again.hasAttribute('disabled')).toBe(false));
    fireEvent.click(again);
    await waitFor(() =>
      expect(c.sendToPlan).toHaveBeenCalledWith('P', expect.objectContaining({ again: true })),
    );
  });

  it('shows the card the index says was already sent, when the list had not caught up', async () => {
    const c = client({
      sendToPlan: vi
        .fn()
        .mockRejectedValue(new IndexError(409, 'already_sent', null, null, null, { send: made() })),
    });
    open(c, [place('Fix login')]);
    fireEvent.click(await screen.findByRole('button', { name: /Sprint/ }));
    const send = await screen.findByRole('button', { name: 'Send to Plan' });
    await waitFor(() => expect(send.hasAttribute('disabled')).toBe(false));
    fireEvent.click(send);
    expect(await screen.findByText(/Already sent:/)).toBeTruthy();
  });

  it.each([
    [new IndexError(429, 'rate_limited'), /a lot of cards/],
    [new IndexError(409, 'source_full'), /as many cards as it may/],
    [
      new IndexError(422, 'plan_refused', null, null, null, { reason: 'the board is full' }),
      /The plan refused: the board is full\./,
    ],
    [new IndexError(422, 'plan_refused'), /The plan refused the card\./],
    [new IndexError(403, 'forbidden'), /can't add cards to this plan/],
    [new IndexError(409, 'already_sent'), null],
    [new Error('offline'), /Check your connection/],
  ])('says why a send was refused (%s)', async (err, words) => {
    const c = client({ sendToPlan: vi.fn().mockRejectedValue(err) });
    open(c, [place('Fix login')]);
    fireEvent.click(await screen.findByRole('button', { name: /Sprint/ }));
    const send = await screen.findByRole('button', { name: 'Send to Plan' });
    await waitFor(() => expect(send.hasAttribute('disabled')).toBe(false));
    fireEvent.click(send);
    if (words) expect((await screen.findByRole('alert')).textContent).toMatch(words);
    else await waitFor(() => expect(send.hasAttribute('disabled')).toBe(false));
  });

  it('makes a New Plan and picks it; says when that fails', async () => {
    const c = client();
    open(c);
    fireEvent.click(await screen.findByRole('button', { name: 'New Plan' }));
    const name = screen.getByLabelText<HTMLInputElement>("New plan's name");
    expect(name.value).toBe('Plans from Retro');
    fireEvent.keyDown(name, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'New Plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make' }));
    await waitFor(() => expect(c.newPlanForSend).toHaveBeenCalledWith('Plans from Retro'));
    expect(
      await screen.findByRole('button', { name: /Plans from Retro/, pressed: true }),
    ).toBeTruthy();
    cleanup();
    const failing = client({ newPlanForSend: vi.fn().mockRejectedValue(new Error('x')) });
    open(failing);
    fireEvent.click(await screen.findByRole('button', { name: 'New Plan' }));
    fireEvent.change(screen.getByLabelText("New plan's name"), { target: { value: '  ' } });
    fireEvent.submit(screen.getByLabelText("New plan's name").closest('form')!);
    expect(failing.newPlanForSend).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("New plan's name"), { target: { value: 'Q4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Couldn't make the plan/);
  });

  it('locks a plan the person can only view, and says when a plan refuses or has no board', async () => {
    const c = client({ automationTarget: vi.fn().mockRejectedValue(new Error('403')) });
    open(c);
    const viewed = await screen.findByRole('button', { name: /Viewed/ });
    expect(viewed.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(viewed);
    expect(c.automationTarget).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Sprint/ }));
    expect(await screen.findByText(/You can't add cards to this plan/)).toBeTruthy();
    cleanup();
    open(
      client({ automationTarget: vi.fn().mockResolvedValue({ app: 'liveplanner', title: 'S' }) }),
    );
    fireEvent.click(await screen.findByRole('button', { name: /Sprint/ }));
    expect(await screen.findByText(/no board yet/)).toBeTruthy();
  });

  it('searches the plans, says when none match or none load, and moves along them by keys', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const c = client();
    c.listItems
      .mockResolvedValueOnce({ items: [plan('P', 'Sprint'), plan('Q', 'Quarter')] })
      .mockResolvedValueOnce({ items: [] });
    open(c);
    const first = await screen.findByRole('button', { name: /Sprint/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toContain('Quarter');
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    fireEvent.keyDown(first, { key: 'Tab' });
    fireEvent.change(screen.getByLabelText('Search your plans'), {
      target: { value: 'zzz' },
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect((await screen.findAllByText(/zzz/)).length).toBeGreaterThan(0);
    expect(c.listItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'zzz' }),
      expect.anything(),
    );
    vi.useRealTimers();
    cleanup();
    open(client({ listItems: vi.fn().mockRejectedValue(new Error('x')) }));
    expect(await screen.findByText("Couldn't load your plans")).toBeTruthy();
    cleanup();
    open(client({ listItems: vi.fn().mockResolvedValue({ items: [] }) }));
    expect(await screen.findByText('No plans yet')).toBeTruthy();
  });

  it('closes from its close button and Cancel', () => {
    const onClose = vi.fn();
    open(client(), undefined, onClose);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
