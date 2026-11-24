// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuLeastMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { DEFAULT_MAGNIFIER_CONFIG, type MagnifierConfig } from '@/lib/magnifier-config';
import { cloneCanvasLayer } from '@/lib/magnifier-clone';
import { createMagnifierStore } from '@/lib/magnifier-store';
import { MAGNIFIER_RECOPY_MS, useMagnifierLens } from './useMagnifierLens';

// docs/specs/008-canvas/magnifier.md "The lens", "Moving around in it" and "Performance"; blueprint invariant I1.

let frames: FrameRequestCallback[] = [];
const runFrames = () => {
  const due = frames;
  frames = [];
  for (const f of due) f(0);
};

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function Harness({
  store,
  clone,
  contentKey,
  layerNodes = 3,
  onRender,
}: {
  store: ReturnType<typeof createMagnifierStore>;
  clone: (layer: HTMLElement) => HTMLElement;
  contentKey: unknown;
  layerNodes?: number;
  onRender?: () => void;
}) {
  onRender?.();
  const mainRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  useMagnifierLens({ mainRef, layerRef, lensRef, stageRef, badgeRef, store, contentKey, clone });
  return (
    <main ref={mainRef} data-testid="main">
      <div ref={layerRef} data-canvas-content="" style={{ transform: 'scale(1)' }}>
        {Array.from({ length: layerNodes }, (_, i) => (
          <div key={i} data-element-id={`e${i}`}>
            <span>Element {i}</span>
          </div>
        ))}
      </div>
      <div data-floating-panel="" data-testid="panel">
        Palette
      </div>
      <div ref={lensRef} data-testid="lens" style={{ visibility: 'hidden' }}>
        <div ref={stageRef} data-testid="stage" />
        <span ref={badgeRef} data-testid="badge" />
      </div>
    </main>
  );
}

const memoryStore = (config: MagnifierConfig = DEFAULT_MAGNIFIER_CONFIG) =>
  createMagnifierStore({ load: () => config, save: () => {}, report: () => {} });

const pointer = (type: string, target: Element, init: PointerEventInit) => {
  // jsdom has no PointerEvent constructor of its own: a MouseEvent carrying the pointer fields stands in.
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, ...init }) as MouseEvent & {
    pointerType: string;
    pointerId: number;
  };
  Object.defineProperty(e, 'pointerType', { value: init.pointerType ?? 'mouse' });
  Object.defineProperty(e, 'pointerId', { value: init.pointerId ?? 1 });
  target.dispatchEvent(e);
};

function setup(opts: { layerNodes?: number; config?: MagnifierConfig } = {}) {
  const store = memoryStore(opts.config);
  const clone = vi.fn(cloneCanvasLayer);
  const renders = { count: 0 };
  const onRender = () => void renders.count++;
  const view = render(
    <Harness
      store={store}
      clone={clone}
      contentKey={1}
      layerNodes={opts.layerNodes}
      onRender={onRender}
    />,
  );
  const main = view.getByTestId('main');
  const layer = main.querySelector('[data-canvas-content]')!;
  return { view, store, clone, renders, main, layer, lens: view.getByTestId('lens') };
}

describe('useMagnifierLens', () => {
  it('shows the lens over the canvas, enlarged around the pointer, and copies the layer once', () => {
    const { main, layer, lens, clone, view } = setup();
    pointer('pointermove', layer.firstElementChild!, { clientX: 200, clientY: 150 });
    runFrames();
    expect(lens.style.visibility).toBe('visible');
    // Default 240px lens at 2x: centred on the pointer, the point under it at the lens's centre.
    expect(lens.style.transform).toBe('translate3d(80px, 30px, 0px)');
    expect(view.getByTestId('stage').style.transform).toBe(
      'translate3d(-280px, -180px, 0px) scale(2)',
    );
    expect(view.getByTestId('stage').querySelector('[data-magnifier-copy]')).not.toBeNull();
    expect(clone).toHaveBeenCalledTimes(1);
    // The cursor gives way to the lens's crosshair.
    expect(main.style.cursor).toBe('none');
  });

  it('hides over the chrome and off the canvas, and gives the cursor back', () => {
    const { main, layer, lens, view } = setup();
    pointer('pointermove', main, { clientX: 10, clientY: 10 });
    runFrames();
    expect(lens.style.visibility).toBe('visible');
    pointer('pointermove', view.getByTestId('panel'), { clientX: 10, clientY: 10 });
    runFrames();
    expect(lens.style.visibility).toBe('hidden');
    expect(main.style.cursor).toBe('');
    pointer('pointermove', layer, { clientX: 10, clientY: 10 });
    runFrames();
    expect(lens.style.visibility).toBe('visible');
    main.dispatchEvent(new MouseEvent('pointerleave'));
    runFrames();
    expect(lens.style.visibility).toBe('hidden');
  });

  it('follows a finger above it, and hides when the finger lifts or a second one lands', () => {
    const { main, lens } = setup();
    pointer('pointerdown', main, {
      clientX: 300,
      clientY: 500,
      pointerType: 'touch',
      pointerId: 7,
    });
    runFrames();
    expect(lens.style.visibility).toBe('visible');
    // Above the finger: 500 - 240 - 24.
    expect(lens.style.transform).toBe('translate3d(180px, 236px, 0px)');
    pointer('pointermove', main, {
      clientX: 320,
      clientY: 520,
      pointerType: 'touch',
      pointerId: 7,
    });
    runFrames();
    expect(lens.style.transform).toBe('translate3d(200px, 256px, 0px)');
    // Another finger's move is not this lens's.
    pointer('pointermove', main, { clientX: 10, clientY: 10, pointerType: 'touch', pointerId: 8 });
    runFrames();
    expect(lens.style.transform).toBe('translate3d(200px, 256px, 0px)');
    pointer('pointerup', main, { pointerType: 'touch', pointerId: 7 });
    runFrames();
    expect(lens.style.visibility).toBe('hidden');
    // Two fingers: a pinch, not a look.
    pointer('pointerdown', main, {
      clientX: 300,
      clientY: 500,
      pointerType: 'touch',
      pointerId: 9,
    });
    pointer('pointerdown', main, {
      clientX: 340,
      clientY: 500,
      pointerType: 'touch',
      pointerId: 10,
    });
    runFrames();
    expect(lens.style.visibility).toBe('hidden');
  });

  it('turns the wheel into magnification, and Shift+wheel into size, only while the lens shows', () => {
    const { main, store, view } = setup();
    const wheel = (target: Element, init: WheelEventInit) => {
      const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(e);
      return e;
    };
    // No lens yet: the canvas keeps its wheel.
    expect(wheel(main, { deltaY: -100 }).defaultPrevented).toBe(false);
    pointer('pointermove', main, { clientX: 50, clientY: 50 });
    runFrames();
    expect(wheel(main, { deltaY: -100 }).defaultPrevented).toBe(true);
    expect(store.get().zoom).toBeGreaterThan(2);
    expect(view.getByTestId('badge').textContent).toBe(`${store.get().zoom}x`);
    wheel(main, { deltaY: -40, shiftKey: true });
    expect(store.get().size).toBe(260);
    expect(view.getByTestId('badge').textContent).toBe('260px');
    // Ctrl / Cmd (and a trackpad pinch) still zoom the canvas.
    expect(wheel(main, { deltaY: -100, ctrlKey: true }).defaultPrevented).toBe(false);
    expect(wheel(main, { deltaY: -100, metaKey: true }).defaultPrevented).toBe(false);
    // Over a panel the wheel is the panel's.
    expect(wheel(view.getByTestId('panel'), { deltaY: -100 }).defaultPrevented).toBe(false);
  });

  it('copies the layer again when the elements change, at most every quarter second', () => {
    // Timers only: the frames stay this file's own (above).
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const store = memoryStore();
    const clone = vi.fn(cloneCanvasLayer);
    const view = render(<Harness store={store} clone={clone} contentKey={1} />);
    const main = view.getByTestId('main');
    // Hidden: a change only marks the copy stale.
    view.rerender(<Harness store={store} clone={clone} contentKey={2} />);
    expect(clone).not.toHaveBeenCalled();
    pointer('pointermove', main, { clientX: 50, clientY: 50 });
    runFrames();
    expect(clone).toHaveBeenCalledTimes(1);
    // Shown: changes in quick succession make one more copy, after the window.
    view.rerender(<Harness store={store} clone={clone} contentKey={3} />);
    view.rerender(<Harness store={store} clone={clone} contentKey={4} />);
    runFrames();
    expect(clone).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(MAGNIFIER_RECOPY_MS);
    });
    runFrames();
    expect(clone).toHaveBeenCalledTimes(2);
  });

  it('follows a pan of the live layer without copying it again', () => {
    const { main, layer, clone, view } = setup();
    pointer('pointermove', main, { clientX: 50, clientY: 50 });
    runFrames();
    (layer as HTMLElement).style.transform = 'scale(1.25) translate(40px, -10px)';
    pointer('pointermove', main, { clientX: 60, clientY: 50 });
    runFrames();
    const copy = view.getByTestId('stage').querySelector<HTMLElement>('[data-magnifier-copy]')!;
    expect(copy.style.transform).toBe('scale(1.25) translate(40px, -10px)');
    expect(clone).toHaveBeenCalledTimes(1);
  });

  it('cleans up after itself when the mode ends', () => {
    const { main, view } = setup();
    pointer('pointermove', main, { clientX: 50, clientY: 50 });
    runFrames();
    view.unmount();
    expect(main.style.cursor).toBe('');
  });

  // Invariant I1 and the CPU-time budget (blueprint "Performance and limits"): a pointer sweep over a large layer
  // renders nothing and copies nothing again; each move costs a stored point and, per frame, a few style writes.
  it('moves over a 3,000-node layer with no render and no copy per move, inside the budget', () => {
    const { main, layer, clone, renders } = setup({ layerNodes: 1000 });
    expect(layer.querySelectorAll('*').length).toBeGreaterThanOrEqual(2000);
    pointer('pointermove', main, { clientX: 1, clientY: 1 });
    runFrames();
    const rendersBefore = renders.count;
    const sweep = () => {
      for (let i = 0; i < 2000; i++) {
        pointer('pointermove', i % 2 ? main : layer, { clientX: i % 800, clientY: i % 600 });
        if (i % 4 === 0) runFrames();
      }
      runFrames();
    };
    const ms = cpuLeastMsOf(sweep, 3);
    expect(renders.count).toBe(rendersBefore);
    expect(clone).toHaveBeenCalledTimes(1);
    expect(ms).toBeLessThan(cpuBudgetMs(250));
  });
});
