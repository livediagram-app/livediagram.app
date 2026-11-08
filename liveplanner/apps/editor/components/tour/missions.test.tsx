// @vitest-environment jsdom

// The mission runner and its strip (docs/specs/026-plan/plan-tour.md "The mission strip"): one mission at a time,
// done by its check, its lesson until Next, then the next; hints climb one press at a time.

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { modalClosed, modalOpened, openModalCount } from '@liveworkspace/workbench/lib/modal-guard';
import { useMissions, type Mission } from './missions';
import { HintRing } from './HintRing';
import { Emphasis, MissionStrip } from './MissionStrip';

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

afterEach(() => {
  cleanup();
  while (openModalCount() > 0) modalClosed();
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
    // The lesson stays until Next: re-rendering never moves it on.
    rerender();
    expect(result.current.phase).toBe('lesson');
    expect(onView).toHaveBeenCalledTimes(1);
    act(() => result.current.next());
    expect(result.current.mission?.id).toBe('two');
    expect(result.current.index).toBe(1);
    expect(onView).toHaveBeenCalledTimes(2);
    ctx = { a: true, b: true };
    rerender();
    act(() => result.current.next());
    expect(result.current.phase).toBe('finish');
    expect(result.current.mission).toBeNull();
  });

  it('moves on from a mission already done', () => {
    const { result } = renderHook(() =>
      useMissions({ missions: MISSIONS, ctx: { a: true, b: false }, active: true }),
    );
    expect(result.current.phase).toBe('lesson');
    act(() => result.current.next());
    expect(result.current.mission?.id).toBe('two');
  });

  it('ignores Next while a mission is still being done', () => {
    const { result } = renderHook(() =>
      useMissions({ missions: MISSIONS, ctx: { a: false, b: false }, active: true }),
    );
    act(() => result.current.next());
    expect(result.current.mission?.id).toBe('one');
    expect(result.current.phase).toBe('doing');
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
    act(() => result.current.next());
    expect(result.current.hintLevel).toBe(0);
  });

  it('starts again at the first mission when turned off and on, or given new missions', () => {
    let active = true;
    let missions = MISSIONS;
    const { result, rerender } = renderHook(() =>
      useMissions({ missions, ctx: { a: true, b: false }, active }),
    );
    act(() => result.current.next());
    expect(result.current.mission?.id).toBe('two');
    active = false;
    rerender();
    active = true;
    rerender();
    expect(result.current.index).toBe(0);
    expect(result.current.phase).toBe('lesson');
    act(() => result.current.next());
    missions = [];
    rerender();
    expect(result.current.phase).toBe('finish');
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

  it('shows a lesson once done until Next, a note in place of the why, and Finish after the last', () => {
    const { rerender } = render(<Strip ctx={{ a: true, b: false }} placement="dialog" />);
    expect(screen.getByRole('region', { name: 'Practice Sprint' }).textContent).toContain(
      'Learned one',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    rerender(<Strip ctx={{ a: true, b: false }} placement="dialog" />);
    expect(screen.getByRole('region').textContent).toContain('Do two');
    rerender(<Strip ctx={{ a: true, b: true }} placement="dialog" />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByRole('img', { name: 'All 2 done' })).toBeTruthy();
    expect(screen.getByText('All done here')).toBeTruthy();
  });

  it('shows a note in place of the why', () => {
    render(<Strip ctx={{ a: false, b: true }} />);
    const strip = screen.getByRole('region', { name: 'Practice Sprint' });
    expect(strip.textContent).toContain('A note instead');
    expect(strip.textContent).not.toContain('Why one');
  });

  it('moves to the corner while a dialog is open on a computer, saying all it said, and back after', () => {
    render(<Strip ctx={{ a: false, b: false }} />);
    const layer = () => document.querySelector<HTMLElement>('[data-mission-strip-layer]')!;
    expect(layer().hasAttribute('data-mission-corner')).toBe(false);
    act(() => modalOpened());
    expect(layer().hasAttribute('data-mission-corner')).toBe(true);
    const strip = screen.getByRole('region', { name: 'Practice Sprint' });
    expect(strip.textContent).toContain('Do one');
    expect(strip.textContent).toContain('Why one');
    // A mission not done on the page needs no word about the window.
    expect(document.querySelector('[data-close-first]')).toBeNull();
    act(() => modalClosed());
    expect(layer().hasAttribute('data-mission-corner')).toBe(false);
  });

  it('says to close the window first for a mission done on the page, only while it is the mission', () => {
    const onPage: Mission<Ctx>[] = [{ ...M('one', 'a'), onPage: true }, M('two', 'b')];
    function PageStrip({ ctx }: { ctx: Ctx }) {
      const run = useMissions({ missions: onPage, ctx, active: true });
      return <MissionStrip name="Practice Sprint" run={run} onEnd={() => {}} finish={null} />;
    }
    const { rerender } = render(<PageStrip ctx={{ a: false, b: false }} />);
    expect(document.querySelector('[data-close-first]')).toBeNull();
    act(() => modalOpened());
    expect(document.querySelector('[data-close-first]')).not.toBeNull();
    rerender(<PageStrip ctx={{ a: true, b: false }} />);
    expect(document.querySelector('[data-close-first]')).toBeNull();
  });

  it('stays in full inside a dialog’s flow while a dialog is open', () => {
    render(<Strip ctx={{ a: false, b: false }} placement="dialog" />);
    act(() => modalOpened());
    expect(document.querySelector('[data-mission-pill]')).toBeNull();
    expect(screen.getByRole('region', { name: 'Practice Sprint' }).textContent).toContain(
      'Why one',
    );
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

// Draws `id` with a box at `left`, so a ring can be told by where it sits.
const drawn = (id: string, left: number) => {
  const el = document.createElement('div');
  el.id = id;
  el.getBoundingClientRect = () => ({ left, top: 10, width: 40, height: 20 }) as DOMRect;
  document.body.append(el);
};
const ringLeft = () => document.querySelector<HTMLElement>('[data-hint-ring]')?.style.left ?? null;

describe('MissionStrip points', () => {
  const POINTED: Mission<Ctx>[] = [
    { ...M('one', 'a'), points: ['#point'] },
    { ...M('two', 'b'), points: ['#point'] },
  ];
  function Strip({ ctx }: { ctx: Ctx }) {
    const run = useMissions({ missions: POINTED, ctx, active: true });
    return <MissionStrip name="Practice Sprint" run={run} onEnd={() => {}} finish={null} />;
  }

  it('rings the control a mission names while it is being done, and not over its lesson', () => {
    drawn('point', 100);
    const { rerender } = render(<Strip ctx={{ a: false, b: false }} />);
    expect(ringLeft()).toBe('96px');
    rerender(<Strip ctx={{ a: true, b: false }} />);
    expect(document.querySelector('[data-hint-ring]')).toBeNull();
  });

  it('rings a hint’s place over the mission’s own points', () => {
    drawn('point', 100);
    drawn('target', 300);
    render(<Strip ctx={{ a: false, b: false }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    // A hint without a place leaves the points ringed.
    expect(ringLeft()).toBe('96px');
    fireEvent.click(screen.getByRole('button', { name: 'More Help' }));
    expect(document.querySelectorAll('[data-hint-ring]')).toHaveLength(1);
    expect(ringLeft()).toBe('296px');
  });
});

describe('HintRing', () => {
  it('rings the first of several selectors drawn on screen, moving on as the page changes', () => {
    vi.useFakeTimers();
    try {
      drawn('hidden', 50);
      document.getElementById('hidden')!.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect;
      drawn('second', 200);
      render(<HintRing selector={['#missing', '#hidden', '#second', '#third']} />);
      expect(ringLeft()).toBe('196px');
      drawn('third', 400);
      document.getElementById('second')!.remove();
      act(() => void vi.advanceTimersByTime(150));
      expect(ringLeft()).toBe('396px');
      document.getElementById('third')!.remove();
      act(() => void vi.advanceTimersByTime(150));
      expect(document.querySelector('[data-hint-ring]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('takes one selector too', () => {
    drawn('only', 20);
    render(<HintRing selector="#only" />);
    expect(ringLeft()).toBe('16px');
  });
});

describe('Emphasis', () => {
  it('draws plain text as it is', () => {
    const { container } = render(<Emphasis text="Nothing bold here." />);
    expect(container.textContent).toBe('Nothing bold here.');
    expect(container.querySelector('strong')).toBeNull();
  });

  it('draws the marked parts in bold, without the asterisks', () => {
    const { container } = render(<Emphasis text="Open **Types** and press **Add Field**." />);
    expect(container.textContent).toBe('Open Types and press Add Field.');
    expect([...container.querySelectorAll('strong')].map((b) => b.textContent)).toEqual([
      'Types',
      'Add Field',
    ]);
  });

  it('draws a mission’s why with its bold parts in the strip', () => {
    const bold: Mission<Ctx>[] = [{ ...M('one', 'a'), why: 'Press **Add card** now.' }];
    function Strip() {
      const run = useMissions({ missions: bold, ctx: { a: false, b: false }, active: true });
      return <MissionStrip name="Practice Sprint" run={run} onEnd={() => {}} finish={null} />;
    }
    render(<Strip />);
    const strip = screen.getByRole('region', { name: 'Practice Sprint' });
    expect(strip.textContent).toContain('Press Add card now.');
    expect(strip.querySelector('strong')?.textContent).toBe('Add card');
  });
});
