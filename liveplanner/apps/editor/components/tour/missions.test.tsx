// @vitest-environment jsdom

// The mission runner and its strip (docs/specs/026-plan/plan-tour.md "The mission strip"): one mission at a time,
// done by its check, its lesson for LESSON_MS, then the next; hints climb one press at a time.

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LESSON_MS, useMissions, type Mission } from './missions';
import { MissionStrip } from './MissionStrip';

type Ctx = { a: boolean; b: boolean };
const M = (id: string, key: keyof Ctx): Mission<Ctx> => ({
  id,
  title: `Do ${id}`,
  why: `Why ${id}`,
  lesson: `Learned ${id}`,
  hints: [{ text: `Hint ${id}` }, { text: `Here ${id}`, ring: () => '#target' }],
  done: (c) => c[key],
});
const MISSIONS = [M('one', 'a'), M('two', 'b')];

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useMissions', () => {
  it('runs each mission once its check passes, its lesson first, then the finish', () => {
    const onView = vi.fn();
    let ctx: Ctx = { a: false, b: false };
    const { result, rerender } = renderHook(() =>
      useMissions({ missions: MISSIONS, ctx, active: true, onView }),
    );
    expect(result.current.mission?.id).toBe('one');
    expect(onView).toHaveBeenCalledTimes(1);
    ctx = { a: true, b: false };
    rerender();
    expect(result.current.phase).toBe('lesson');
    act(() => void vi.advanceTimersByTime(LESSON_MS));
    expect(result.current.mission?.id).toBe('two');
    expect(result.current.index).toBe(1);
    expect(onView).toHaveBeenCalledTimes(2);
    ctx = { a: true, b: true };
    rerender();
    act(() => void vi.advanceTimersByTime(LESSON_MS));
    expect(result.current.phase).toBe('finish');
    expect(result.current.mission).toBeNull();
  });

  it('moves on from a mission already done', () => {
    const { result } = renderHook(() =>
      useMissions({ missions: MISSIONS, ctx: { a: true, b: false }, active: true }),
    );
    expect(result.current.phase).toBe('lesson');
    act(() => void vi.advanceTimersByTime(LESSON_MS));
    expect(result.current.mission?.id).toBe('two');
  });

  it('climbs its hints, and starts the next mission with none', () => {
    let ctx: Ctx = { a: false, b: false };
    const { result, rerender } = renderHook(() =>
      useMissions({ missions: MISSIONS, ctx, active: true }),
    );
    expect(result.current.hint).toBeNull();
    act(() => result.current.showHint());
    expect(result.current.hint?.text).toBe('Hint one');
    act(() => result.current.showHint());
    act(() => result.current.showHint());
    expect(result.current.hint?.text).toBe('Here one');
    expect(result.current.moreHints).toBe(false);
    ctx = { a: true, b: false };
    rerender();
    act(() => void vi.advanceTimersByTime(LESSON_MS));
    expect(result.current.hintLevel).toBe(0);
  });

  it('finishes at once with no missions, and is idle while inactive', () => {
    const none = renderHook(() =>
      useMissions({ missions: [], ctx: { a: false, b: false }, active: true }),
    );
    expect(none.result.current.phase).toBe('finish');
    const off = renderHook(() =>
      useMissions({ missions: MISSIONS, ctx: { a: true, b: false }, active: false }),
    );
    expect(off.result.current.mission).toBeNull();
    expect(off.result.current.phase).toBe('doing');
  });
});

describe('MissionStrip', () => {
  function Strip({ ctx, placement }: { ctx: Ctx; placement?: 'page' | 'dialog' }) {
    const run = useMissions({ missions: MISSIONS, ctx, active: true });
    return (
      <MissionStrip
        name="Practice Sprint"
        run={run}
        onEnd={onEnd}
        finish={<p>All done here</p>}
        note={ctx.b ? 'A note instead' : null}
        placement={placement}
      />
    );
  }
  const onEnd = vi.fn();

  it('shows the mission, its segments, Hint and End, and rings a hint’s place', () => {
    document.body.innerHTML = '<div id="target"></div>';
    document.getElementById('target')!.getBoundingClientRect = () =>
      ({ left: 10, top: 10, width: 40, height: 20 }) as DOMRect;
    render(<Strip ctx={{ a: false, b: false }} />);
    const strip = screen.getByRole('region', { name: 'Practice Sprint' });
    expect(strip.textContent).toContain('Do one');
    expect(strip.textContent).toContain('Why one');
    expect(screen.getByRole('img', { name: 'Mission 1 of 2' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    expect(strip.textContent).toContain('Hint one');
    expect(document.querySelector('[data-hint-ring]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More Help' }));
    expect(document.querySelector('[data-hint-ring]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'End Practice Sprint' }));
    expect(onEnd).toHaveBeenCalled();
  });

  it('shows a lesson once done, a note in place of the why, and the finish', () => {
    const { rerender } = render(<Strip ctx={{ a: true, b: false }} placement="dialog" />);
    expect(screen.getByRole('region', { name: 'Practice Sprint' }).textContent).toContain(
      'Learned one',
    );
    act(() => void vi.advanceTimersByTime(LESSON_MS));
    rerender(<Strip ctx={{ a: true, b: false }} placement="dialog" />);
    expect(screen.getByRole('region').textContent).toContain('Do two');
    rerender(<Strip ctx={{ a: true, b: true }} placement="dialog" />);
    act(() => void vi.advanceTimersByTime(LESSON_MS));
    expect(screen.getByRole('img', { name: 'All 2 done' })).toBeTruthy();
    expect(screen.getByText('All done here')).toBeTruthy();
  });

  it('floats clear of the editor’s footer', () => {
    const bar = document.createElement('div');
    bar.dataset.editorTabbar = '';
    bar.getBoundingClientRect = () => ({ top: window.innerHeight - 40 }) as DOMRect;
    document.body.append(bar);
    render(<Strip ctx={{ a: false, b: false }} />);
    const layer = document.querySelector<HTMLElement>('[data-mission-strip-layer]')!;
    expect(layer.style.bottom).toBe('52px');
  });
});
