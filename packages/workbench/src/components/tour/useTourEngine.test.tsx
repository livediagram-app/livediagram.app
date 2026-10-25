// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TourStepOf } from './tour-step';
import { useTourEngine, type TourOutcome } from './useTourEngine';

// The shared step runner (docs/specs/007-editor/editor-tour.md "Mechanics").

const found = vi.hoisted(() => ({ selectors: new Set<string>() }));
vi.mock('./tour-dom', () => ({
  findTour: () => null,
  waitForSelector: async (selector: string) => {
    if (!found.selectors.has(selector)) return null;
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
  },
}));
const reveal = vi.hoisted(() => vi.fn());
vi.mock('./tour-reveal', () => ({
  revealInScrollers: reveal,
}));

type Api = { log: string[] };

function run(steps: TourStepOf<Api>[]) {
  const api: Api = { log: [] };
  const views: string[] = [];
  const outcomes: TourOutcome[] = [];
  const onStart = vi.fn();
  const apiRef = { current: api };
  const hook = renderHook(() =>
    useTourEngine<Api>({
      steps,
      apiRef,
      onStepView: (s) => views.push(s.id),
      onStart,
      onFinish: (o) => outcomes.push(o),
    }),
  );
  return { hook, api, views, outcomes, onStart };
}

const flush = () => act(async () => {});

afterEach(() => {
  found.selectors.clear();
  reveal.mockClear();
  document.body.innerHTML = '';
});

const STEPS: TourStepOf<Api>[] = [
  {
    id: 'one',
    title: 'One',
    body: '',
    selector: () => '#one',
    prepare: (api) => void api.log.push('prepare one'),
    cleanup: (api) => void api.log.push('cleanup one'),
  },
  { id: 'two', title: 'Two', body: '', target: 'two' },
  {
    id: 'outro',
    card: 'outro',
    title: 'O',
    body: '',
    prepare: (api) => void api.log.push('prepare outro'),
  },
];

describe('useTourEngine', () => {
  it('runs prepare, anchors to the selector, and counts only real steps', async () => {
    found.selectors.add('#one');
    found.selectors.add('[data-tour-id="two"]');
    const t = run(STEPS);
    expect(t.hook.result.current.countableSteps).toBe(2);
    // Started from the footer's button: straight onto the first step, no welcome card.
    act(() => t.hook.result.current.start());
    expect(t.onStart).toHaveBeenCalledTimes(1);
    await flush();
    expect(t.hook.result.current.step?.id).toBe('one');
    expect(t.api.log).toEqual(['prepare one']);
    expect(t.hook.result.current.targetRect).not.toBeNull();
    act(() => t.hook.result.current.next());
    await flush();
    expect(t.api.log).toEqual(['prepare one', 'cleanup one']);
    act(() => t.hook.result.current.back());
    await flush();
    expect(t.hook.result.current.step?.id).toBe('one');
    expect(t.hook.result.current.stepDir).toBe('backward');
    expect(t.views).toEqual(['one', 'two', 'one']);
  });

  // A target below a panel's fold (the Forms tour's Add bar under a long form) is scrolled into view as it lands.
  it("reveals each step's target where the step asks, and never for a card", async () => {
    found.selectors.add('#one');
    found.selectors.add('[data-tour-id="two"]');
    const steps = STEPS.map((s) => (s.id === 'two' ? { ...s, revealAt: 'start' as const } : s));
    const t = run(steps);
    act(() => t.hook.result.current.start());
    await flush();
    expect(reveal).toHaveBeenLastCalledWith(expect.any(HTMLElement), undefined);
    act(() => t.hook.result.current.next());
    await flush();
    expect(reveal).toHaveBeenLastCalledWith(expect.any(HTMLElement), 'start');
    act(() => t.hook.result.current.next());
    await flush();
    expect(reveal).toHaveBeenCalledTimes(2);
  });

  it('runs an anchorless card prepare, and completes from the last step', async () => {
    found.selectors.add('#one');
    found.selectors.add('[data-tour-id="two"]');
    const t = run(STEPS);
    act(() => t.hook.result.current.start());
    await flush();
    for (let i = 0; i < 2; i++) {
      act(() => t.hook.result.current.next());
      await flush();
    }
    expect(t.hook.result.current.step?.id).toBe('outro');
    expect(t.views).toEqual(['one', 'two', 'outro']);
    expect(t.api.log).toContain('prepare outro');
    expect(t.hook.result.current.targetRect).toBeNull();
    act(() => t.hook.result.current.next());
    expect(t.outcomes).toEqual(['completed']);
    expect(t.hook.result.current.active).toBe(false);
  });

  it('skips a step whose target never appears', async () => {
    vi.useFakeTimers();
    found.selectors.add('[data-tour-id="two"]');
    const t = run(STEPS);
    act(() => t.hook.result.current.start());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(t.hook.result.current.step?.id).toBe('two');
    expect(t.api.log).toEqual(['prepare one', 'cleanup one']);
    vi.useRealTimers();
  });

  it('skips from any step, its first included, and can be started again', async () => {
    found.selectors.add('#one');
    found.selectors.add('[data-tour-id="two"]');
    const t = run(STEPS);
    act(() => t.hook.result.current.start());
    await flush();
    act(() => t.hook.result.current.skip());
    expect(t.outcomes).toEqual(['skipped']);
    act(() => t.hook.result.current.start());
    await flush();
    act(() => t.hook.result.current.next());
    await flush();
    act(() => t.hook.result.current.skip());
    expect(t.outcomes).toEqual(['skipped', 'skipped']);
    expect(t.onStart).toHaveBeenCalledTimes(2);
  });

  it('stops without an outcome', () => {
    const t = run(STEPS);
    act(() => t.hook.result.current.start());
    act(() => t.hook.result.current.stop());
    expect(t.hook.result.current.active).toBe(false);
    expect(t.outcomes).toEqual([]);
  });

  it('re-prepares a step whose target is taken away, and follows a target that moves', async () => {
    vi.useFakeTimers();
    found.selectors.add('#one');
    const t = run(STEPS);
    act(() => t.hook.result.current.start());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(t.api.log).toEqual(['prepare one']);
    const el = document.body.lastElementChild as HTMLElement;
    el.getBoundingClientRect = () => ({ left: 5, top: 5, width: 9, height: 9 }) as DOMRect;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
    });
    expect(t.hook.result.current.targetRect).toEqual({ left: 5, top: 5, width: 9, height: 9 });
    el.remove();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
    });
    expect(t.api.log).toEqual(['prepare one', 'prepare one']);
    // The target brought back is revealed again; a move alone (a scroll by the person) never is.
    expect(reveal).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('skips a missing target backwards when going back, never past the first step', async () => {
    vi.useFakeTimers();
    const steps: TourStepOf<Api>[] = [
      { id: 'a', title: 'A', body: '', selector: () => '#a' },
      { id: 'b', title: 'B', body: '', selector: () => '#b' },
      { id: 'c', title: 'C', body: '', selector: () => '#c' },
    ];
    found.selectors.add('#a');
    found.selectors.add('#b');
    found.selectors.add('#c');
    const t = run(steps);
    const settle = () => act(async () => void (await vi.advanceTimersByTimeAsync(10)));
    act(() => t.hook.result.current.start());
    await settle();
    for (let i = 0; i < 2; i++) {
      act(() => t.hook.result.current.next());
      await settle();
    }
    expect(t.hook.result.current.step?.id).toBe('c');
    // b is gone: Back passes over it to a.
    found.selectors.delete('#b');
    act(() => t.hook.result.current.back());
    await settle();
    await settle();
    expect(t.hook.result.current.step?.id).toBe('a');
    // a is gone too: Back from c finds nothing before it to land on, and comes forward to c again.
    found.selectors.delete('#a');
    act(() => t.hook.result.current.next());
    await settle();
    await settle();
    act(() => t.hook.result.current.back());
    for (let i = 0; i < 4; i++) await settle();
    expect(t.hook.result.current.step?.id).toBe('c');
    expect(t.onStart).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('lets the ring go when a taken-away target cannot be brought back', async () => {
    vi.useFakeTimers();
    found.selectors.add('#one');
    const t = run(STEPS);
    act(() => t.hook.result.current.start());
    await act(async () => void (await vi.advanceTimersByTimeAsync(10)));
    expect(t.hook.result.current.targetRect).not.toBeNull();
    found.selectors.delete('#one');
    (document.body.lastElementChild as HTMLElement).remove();
    await act(async () => void (await vi.advanceTimersByTimeAsync(160)));
    expect(t.hook.result.current.step?.id).toBe('one');
    expect(t.hook.result.current.targetRect).toBeNull();
    vi.useRealTimers();
  });
});
