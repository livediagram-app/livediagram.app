// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { anyModalOpen, modalClosed, modalOpened } from '@/lib/modal-guard';
import type { TourStepOf } from './tour-step';
import { useTourEngine } from './useTourEngine';

// Dialogs come first (docs/specs/007-editor/editor-tour.md "Dialogs come first"): a running tour steps aside for a
// dialog that is not its own, and comes back on the same step once it closes.

// Targets resolve from the project as it is, so a test can put one inside a dialog.
vi.mock('./tour-dom', () => ({
  findTour: () => null,
  waitForSelector: async (selector: string) => document.querySelector<HTMLElement>(selector),
}));
vi.mock('./tour-reveal', () => ({ revealInScrollers: () => {} }));

type Api = { log: string[] };

function run(steps: TourStepOf<Api>[]) {
  const api: Api = { log: [] };
  const views: string[] = [];
  const apiRef = { current: api };
  const hook = renderHook(() =>
    useTourEngine<Api>({
      steps,
      apiRef,
      onStepView: (s) => views.push(s.id),
      onFinish: () => {},
    }),
  );
  return { hook, api, views };
}

const flush = () => act(async () => {});
const open = () => act(() => modalOpened());
const close = () => act(() => modalClosed());

function place(id: string, inDialog = false) {
  const host = document.createElement('div');
  if (inDialog) host.setAttribute('aria-modal', 'true');
  const el = document.createElement('div');
  el.id = id;
  host.appendChild(el);
  document.body.appendChild(host);
}

afterEach(() => {
  while (anyModalOpen()) modalClosed();
  document.body.innerHTML = '';
});

const CANVAS_STEPS: TourStepOf<Api>[] = [
  { id: 'one', title: 'One', body: '', selector: () => '#one' },
  { id: 'two', title: 'Two', body: '', selector: () => '#two' },
];

describe('useTourEngine and dialogs', () => {
  it('steps aside while a dialog opens over it and returns on the same step', async () => {
    place('one');
    const t = run(CANVAS_STEPS);
    act(() => t.hook.result.current.start());
    await flush();
    expect(t.hook.result.current.yielded).toBe(false);
    open();
    expect(t.hook.result.current.yielded).toBe(true);
    expect(t.hook.result.current.active).toBe(true);
    close();
    expect(t.hook.result.current.yielded).toBe(false);
    expect(t.hook.result.current.step?.id).toBe('one');
    // Stepping aside is not a new view of the step.
    expect(t.views).toEqual(['one']);
  });

  it('waits for the last of stacked dialogs', async () => {
    place('one');
    const t = run(CANVAS_STEPS);
    act(() => t.hook.result.current.start());
    await flush();
    open();
    open();
    close();
    expect(t.hook.result.current.yielded).toBe(true);
    close();
    expect(t.hook.result.current.yielded).toBe(false);
  });

  it('counts the dialog it was started inside as its own, but not one opened over it', async () => {
    place('one', true);
    open();
    const t = run(CANVAS_STEPS);
    act(() => t.hook.result.current.start());
    await flush();
    expect(t.hook.result.current.yielded).toBe(false);
    open();
    expect(t.hook.result.current.yielded).toBe(true);
    close();
    expect(t.hook.result.current.yielded).toBe(false);
  });

  it('a dialog the tour started inside closing makes a later one in its way', async () => {
    place('one');
    open();
    const t = run(CANVAS_STEPS);
    act(() => t.hook.result.current.start());
    await flush();
    close();
    open();
    expect(t.hook.result.current.yielded).toBe(true);
  });

  it('adopts a dialog a step opens to show its target, and stays up on the card after it', async () => {
    const steps: TourStepOf<Api>[] = [
      {
        id: 'inside',
        title: 'Inside',
        body: '',
        selector: () => '#inside',
        prepare: () => {
          place('inside', true);
          modalOpened();
        },
      },
      { id: 'outro', card: 'outro', title: 'O', body: '' },
    ];
    const t = run(steps);
    act(() => t.hook.result.current.start());
    await flush();
    expect(t.hook.result.current.step?.id).toBe('inside');
    expect(t.hook.result.current.targetRect).not.toBeNull();
    expect(t.hook.result.current.yielded).toBe(false);
    act(() => t.hook.result.current.next());
    await flush();
    expect(t.hook.result.current.step?.id).toBe('outro');
    expect(t.hook.result.current.yielded).toBe(false);
    // A second dialog over the tour's own is in its way.
    open();
    expect(t.hook.result.current.yielded).toBe(true);
  });

  it('adopts the dialog of a step drawn over one (its target portalled out of it)', async () => {
    place('menu');
    const steps: TourStepOf<Api>[] = [
      {
        id: 'menu',
        title: 'Menu',
        body: '',
        selector: () => '#menu',
        layer: 'modal',
        prepare: () => modalOpened(),
      },
    ];
    const t = run(steps);
    act(() => t.hook.result.current.start());
    await flush();
    expect(t.hook.result.current.yielded).toBe(false);
  });

  it('does not step aside while a step is still waiting for its target', async () => {
    let release: () => void = () => {};
    const steps: TourStepOf<Api>[] = [
      {
        id: 'slow',
        title: 'Slow',
        body: '',
        selector: () => '#slow',
        prepare: () => new Promise<void>((r) => (release = r)),
      },
    ];
    place('slow');
    const t = run(steps);
    act(() => t.hook.result.current.start());
    await flush();
    open();
    expect(t.hook.result.current.yielded).toBe(false);
    await act(async () => release());
    await flush();
    // Found outside any dialog, with one open that is not the tour's.
    expect(t.hook.result.current.yielded).toBe(true);
  });

  it('pauses tracking while stepped aside, and heals a target the dialog took away on its return', async () => {
    vi.useFakeTimers();
    try {
      const steps: TourStepOf<Api>[] = [
        {
          id: 'one',
          title: 'One',
          body: '',
          selector: () => '#one',
          prepare: (api) => {
            api.log.push('prepare');
            if (!document.getElementById('one')) place('one');
          },
        },
      ];
      const t = run(steps);
      act(() => t.hook.result.current.start());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(t.api.log).toEqual(['prepare']);
      open();
      document.body.innerHTML = '';
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      // Nothing re-prepared under the dialog.
      expect(t.api.log).toEqual(['prepare']);
      close();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(t.api.log).toEqual(['prepare', 'prepare']);
      expect(t.hook.result.current.targetRect).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
