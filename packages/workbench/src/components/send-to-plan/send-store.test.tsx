// @vitest-environment jsdom
// The open item's sends (liveworkspace/docs/specs/004-index/send-to-plan.md "The chip"): read once, then only when the
// room says a plan's sent cards changed; each element's chips from them; the indicator and the chip drawn from them.
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { PlanSend } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitSourceChanged } from '../sheet-links/sheet-link-signal';
import {
  addSends,
  currentSends,
  refreshSends,
  sendsOf,
  setSendSource,
  useAllSends,
  useSends,
} from './send-store';
import { useSentCardIndicator, SENT_CARD_GLYPHS } from './sent-card-indicator';
import { SentChip } from './SentChip';

vi.mock('../../lib/index-client', () => ({ indexClient: { planSends: vi.fn() } }));

const send = (
  id: string,
  ref: string,
  over: Partial<PlanSend['card']> = {},
  kind: PlanSend['kind'] = 'element',
): PlanSend => ({
  id,
  ref,
  kind,
  plan: { id: 'P', title: 'Sprint' },
  card: { id: `c_${id}`, title: `Card ${id}`, column: 'To Do', done: false, ...over },
  link: `https://lp/project/P#item=c_${id}`,
  at: 1,
});

const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

afterEach(() => {
  cleanup();
  setSendSource(null);
  vi.restoreAllMocks();
});

describe('the sends store', () => {
  it('reads once, then again only on a plan’s card change, never for a sheet’s', async () => {
    const planSends = vi.fn().mockResolvedValue({ sends: [send('a', 'element:t:e1:')] });
    setSendSource('D', { code: 'x' }, { planSends });
    setSendSource('D', { code: 'x' }, { planSends });
    await settle();
    expect(planSends).toHaveBeenCalledTimes(1);
    expect(planSends.mock.calls[0]![1]).toMatchObject({ share: { code: 'x' } });
    expect(currentSends()).toHaveLength(1);
    emitSourceChanged({ app: 'liveplanner', itemId: 'P', sheetIds: ['s'] });
    emitSourceChanged({ app: 'liveplanner', itemId: 'P', sheetIds: [], cards: [] });
    expect(planSends).toHaveBeenCalledTimes(1);
    emitSourceChanged({ app: 'liveplanner', itemId: 'P', sheetIds: [], cards: ['c_a'] });
    await settle();
    expect(planSends).toHaveBeenCalledTimes(2);
  });

  it('keeps what it had when a read fails, and drops a read for an item since closed', async () => {
    let answer: (v: unknown) => void = () => {};
    const planSends = vi
      .fn()
      .mockResolvedValueOnce({ sends: [send('a', 'element:t:e1:')] })
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(() => new Promise((r) => (answer = r)));
    setSendSource('D', null, { planSends });
    await settle();
    await refreshSends();
    expect(currentSends()).toHaveLength(1);
    const late = refreshSends();
    setSendSource('E', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
    answer({ sends: [send('z', 'element:t:e1:')] });
    await late;
    await settle();
    expect(currentSends()).toEqual([]);
    setSendSource(null);
    await refreshSends();
  });

  it('shows a send made here at once, newest first, and indexes each element’s', async () => {
    setSendSource('D', null, {
      planSends: vi.fn().mockResolvedValue({ sends: [send('a', 'element:t:e1:')] }),
    });
    await settle();
    const { result } = renderHook(() => ({
      el: useSends('e1', 'element'),
      thread: useSends('e1', 'thread'),
      none: useSends(null, 'element'),
      all: useAllSends(),
    }));
    act(() => {
      addSends([]);
      addSends([
        send('b', 'element:t:e1:', { done: true }),
        send('t', 'thread:t:e1:', {}, 'thread'),
        send('x', 'text:::'),
      ]);
    });
    expect(result.current.el.map((s) => s.id)).toEqual(['b', 'a']);
    expect(result.current.thread.map((s) => s.id)).toEqual(['t']);
    expect(result.current.none).toEqual([]);
    expect(result.current.all).toHaveLength(4);
    expect(sendsOf(currentSends(), 'e1', ['thread']).map((s) => s.id)).toEqual(['t']);
  });
});

describe('the chip and the indicator', () => {
  it('draws the newest card, a tick once done, +N for the rest, and opens the card', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<SentChip sends={[send('a', 'r', { done: true, column: 'Done' }), send('b', 'r')]} />);
    const chip = screen.getByRole('button', {
      name: /Open the card “Card a”, done, Done · Sprint/,
    });
    expect(chip.textContent).toContain('+1');
    fireEvent.pointerDown(chip);
    fireEvent.click(chip);
    expect(open).toHaveBeenCalledWith(
      'https://lp/project/P#item=c_a',
      '_blank',
      'noopener,noreferrer',
    );
    cleanup();
    render(<SentChip sends={[send('c', 'r', { column: '', title: '' })]} />);
    expect(screen.getByRole('button').textContent).toBe('Card · Sprint');
    cleanup();
    const { container } = render(<SentChip sends={[]} />);
    expect(container.innerHTML).toBe('');
    render(<SentChip sends={[{ ...send('d', 'r'), plan: { id: 'P', title: '' } }]} />);
    expect(screen.getByRole('button').textContent).toContain('Untitled plan');
  });

  it('gives a sent element its indicator, live', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    setSendSource('D', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
    await settle();
    const { result } = renderHook(() => useSentCardIndicator('e1'));
    expect(result.current).toBeUndefined();
    act(() => addSends([send('b', 'element:t:e1:'), send('a', 'element:t:e1:', { title: '' })]));
    expect(result.current).toMatchObject({
      done: false,
      title: 'Card b',
      where: 'To Do · Sprint, and 1 more',
    });
    act(() => addSends([send('c', 'element:t:e1:', { done: true })]));
    expect(result.current).toMatchObject({ done: true, where: 'To Do · Sprint, and 2 more' });
    result.current!.onOpen();
    expect(open).toHaveBeenCalled();
    act(() => {
      setSendSource('E', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
      addSends([send('z', 'element:t:e1:', { title: '' })]);
    });
    expect(result.current).toMatchObject({ title: 'Card', where: 'To Do · Sprint' });
    expect(Object.keys(SENT_CARD_GLYPHS)).toEqual(['card', 'card-done']);
  });
});

describe('the edges of the store', () => {
  it('skips a send whose ref names no element, lists every send live, and renders none on a server', async () => {
    setSendSource('D', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
    await settle();
    act(() => addSends([send('a', 'element'), send('b', 'thread:t1:e1:', {}, 'thread')]));
    const { result } = renderHook(() => ({
      all: useAllSends(),
      thread: useSends('e1', 'thread'),
      none: useSends(null, 'element'),
    }));
    expect(result.current.all).toHaveLength(2);
    expect(result.current.thread.map((s) => s.id)).toEqual(['b']);
    expect(result.current.none).toEqual([]);
    expect(sendsOf(currentSends(), 'e1', ['element'])).toEqual([]);
    const { renderToString } = await import('react-dom/server');
    function Chips() {
      return <span>{useSends('e1', 'thread').length + useAllSends().length}</span>;
    }
    expect(renderToString(<Chips />)).toContain('0');
  });

  it('counts the cards past the newest in the chip’s words', () => {
    render(<SentChip sends={[send('a', 'r'), send('b', 'r'), send('c', 'r')]} />);
    expect(screen.getByRole('button').textContent).toContain('+2');
  });
});
