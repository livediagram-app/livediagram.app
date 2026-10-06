// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TourStepOf } from './tour-step';
import { useTourEngine, type TourOutcome } from './useTourEngine';

// The shared step runner (docs/specs/026-plan/blueprints/plan-tour.md "Engine").

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
  document.body.innerHTML = '';
});

const STEPS: TourStepOf<Api>[] = [
  { id: 'welcome', card: 'welcome', title: 'W', body: '' },
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
    act(() => t.hook.result.current.start());
    await flush();
    expect(t.hook.result.current.step?.id).toBe('welcome');
    expect(t.views).toEqual([]);
    act(() => t.hook.result.current.next());
    expect(t.onStart).toHaveBeenCalledTimes(1);
    await flush();
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

  it('runs an anchorless card prepare, and completes from the last step', async () => {
    found.selectors.add('#one');
    found.selectors.add('[data-tour-id="two"]');
    const t = run(STEPS);
    act(() => t.hook.result.current.start());
    for (let i = 0; i < 3; i++) {
      act(() => t.hook.result.current.next());
      await flush();
    }
    expect(t.hook.result.current.step?.id).toBe('outro');
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
    act(() => t.hook.result.current.next());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(t.hook.result.current.step?.id).toBe('two');
    expect(t.api.log).toEqual(['prepare one', 'cleanup one']);
    vi.useRealTimers();
  });

  it('declines from the welcome card and skips from a step', async () => {
    found.selectors.add('#one');
    const t = run(STEPS);
    act(() => t.hook.result.current.start());
    act(() => t.hook.result.current.skip());
    expect(t.outcomes).toEqual(['declined']);
    act(() => t.hook.result.current.start());
    act(() => t.hook.result.current.next());
    await flush();
    act(() => t.hook.result.current.skip());
    expect(t.outcomes).toEqual(['declined', 'skipped']);
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
    act(() => t.hook.result.current.next());
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
    vi.useRealTimers();
  });
});
