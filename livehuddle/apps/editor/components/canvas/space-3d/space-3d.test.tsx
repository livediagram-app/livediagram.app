// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import { NO_POSE, type AvatarPose } from '@livehuddle/avatar/pose';
import { buildTemplate } from '@livehuddle/templates';
import {
  setSpace3DTiltNow,
  space3DPreference,
  space3DTiltNow,
  SPACE_3D_STORAGE_KEY,
} from '@/lib/space-3d/space-3d-preference';
import { SPACE_3D_TILT_MS } from '@/lib/space-3d/space-3d-camera';
import { space3DEase } from '@/lib/space-3d/space-3d-zoom';
import { standAttr } from '@/lib/space-3d/space-3d-pieces';
import { standingPiecesOnScreen } from '@/lib/space-3d/standing-pieces-on-screen';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const reduced = vi.hoisted(() => ({ on: false }));
vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: () => reduced.on,
}));
vi.mock('@/lib/editor-deferred-code', () => ({ loadSpace3DWalls: vi.fn(() => Promise.resolve()) }));
const view = vi.hoisted(() => ({
  value: { zoom: 1, offset: { x: 0, y: 0 } },
  subs: new Set<() => void>(),
}));
vi.mock('@liveworkspace/workbench/hooks/canvas/useViewportStore', () => ({
  useViewportStore: () => ({
    get: () => view.value,
    subscribe: (fn: () => void) => {
      view.subs.add(fn);
      return () => view.subs.delete(fn);
    },
  }),
}));

import { space3DStageStyle, useSpace3DView } from './useSpace3DView';
import { Space3DButton } from './Space3DButton';
import { Space3DWalls } from './Space3DWalls';
import { useSpace3DZoom } from './useSpace3DZoom';
import {
  InSpace3DOverlay,
  Space3DOverlayProvider,
  Space3DOverlayStage,
  useInSpace3D,
} from './Space3DOverlay';
import { loadSpace3DWalls } from '@/lib/editor-deferred-code';

beforeEach(() => {
  vi.useFakeTimers();
  space3DPreference.set(false);
  setSpace3DTiltNow(0);
  reduced.on = false;
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const frames = () =>
  act(() => {
    vi.advanceTimersByTime(40);
  });

describe('useSpace3DView (docs/specs/008-canvas/3d-view.md "Turning it on and off")', () => {
  it('stays flat until it is on and you walk', () => {
    const { result, rerender } = renderHook(({ walking }) => useSpace3DView(walking), {
      initialProps: { walking: false },
    });
    act(() => space3DPreference.set(true));
    expect(result.current).toBe('flat');
    rerender({ walking: true });
    expect(result.current).toBe('rising');
    expect(loadSpace3DWalls).toHaveBeenCalled();
  });

  it('tilts after two frames, then falls and flattens after the tilt time when you leave Walk', () => {
    space3DPreference.set(true);
    const { result, rerender } = renderHook(({ walking }) => useSpace3DView(walking), {
      initialProps: { walking: true },
    });
    frames();
    expect(result.current).toBe('tilted');
    expect(space3DTiltNow()).toBe(52);
    rerender({ walking: false });
    expect(result.current).toBe('falling');
    expect(space3DTiltNow()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(SPACE_3D_TILT_MS);
    });
    expect(result.current).toBe('flat');
  });

  it('skips the tilt animation under reduced motion', () => {
    reduced.on = true;
    const { result } = renderHook(() => useSpace3DView(true));
    act(() => space3DPreference.set(true));
    expect(result.current).toBe('tilted');
    act(() => space3DPreference.set(false));
    expect(result.current).toBe('flat');
  });

  it('turns on and off with Shift+3 while walking, not while typing or not walking', () => {
    const { rerender } = renderHook(({ walking }) => useSpace3DView(walking), {
      initialProps: { walking: true },
    });
    const press = (target: EventTarget = window) =>
      act(() => {
        target.dispatchEvent(
          new KeyboardEvent('keydown', { code: 'Digit3', key: '#', shiftKey: true, bubbles: true }),
        );
      });
    press();
    expect(space3DPreference.get()).toBe(true);
    expect(localStorage.getItem(SPACE_3D_STORAGE_KEY)).toBe('1');
    const input = document.body.appendChild(document.createElement('input'));
    press(input);
    expect(space3DPreference.get()).toBe(true);
    input.remove();
    rerender({ walking: false });
    press();
    expect(space3DPreference.get()).toBe(true);
  });

  it('styles the stage only while it shows', () => {
    expect(space3DStageStyle('flat')).toBeUndefined();
    expect(space3DStageStyle('rising')).toEqual({
      '--space-tilt': '0deg',
      '--space-stand': '0deg',
      '--space-turn': '0deg',
    });
    expect(space3DStageStyle('tilted')).toEqual({
      '--space-tilt': '52deg',
      '--space-stand': '-90deg',
      '--space-turn': '0deg',
    });
    expect(space3DStageStyle('falling')).toEqual({
      '--space-tilt': '0deg',
      '--space-stand': '0deg',
      '--space-turn': '0deg',
    });
  });
});

describe('Space3DButton', () => {
  it('is a 3D View toggle that says its key, lit while on', () => {
    render(<Space3DButton />);
    const button = screen.getByRole('button', { name: '3D View' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(space3DPreference.get()).toBe(true);
    expect(screen.getByRole('button', { name: '3D View' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});

describe('Space3DWalls (docs/specs/008-canvas/3d-view.md "Walls in front of you are cut away")', () => {
  const office = buildTemplate('virtual-office', 0, 0);
  const size = { width: 1400, height: 900 };

  it('stands up the walls near the view and fades those in front of your feet as you move', () => {
    const pose = createStateStore<AvatarPose>(NO_POSE);
    const { container } = render(<Space3DWalls elements={office} poseStore={pose} size={size} />);
    const walls = container.querySelectorAll('[data-space-wall]');
    expect(walls.length).toBeGreaterThan(10);
    expect(container.querySelectorAll('[data-cut]')).toHaveLength(0);
    const first = walls[0] as HTMLElement;
    // Stand just behind the first wall's middle: it is in front of your feet.
    const box = first.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)!;
    const width = parseFloat(first.style.width);
    const angle = Number(first.style.transform.match(/rotate\(([-\d.e]+)deg\)/)![1]);
    const mid = {
      x: Number(box[1]) + (Math.cos((angle * Math.PI) / 180) * width) / 2,
      y: Number(box[2]) + (Math.sin((angle * Math.PI) / 180) * width) / 2 - 10,
    };
    act(() => pose.set({ ...NO_POSE, pos: mid }));
    expect(first.hasAttribute('data-cut')).toBe(true);
    act(() => pose.set({ ...NO_POSE, pos: { x: -99999, y: -99999 } }));
    expect(container.querySelectorAll('[data-cut]')).toHaveLength(0);
    expect(container.querySelector('[data-space-wall-label]')?.textContent).toBeTruthy();
  });

  it('draws only the walls near the view, and chooses them again when the view has moved far', () => {
    const pose = createStateStore<AvatarPose>(NO_POSE);
    const board = [...office, ...buildTemplate('virtual-office', 40000, 0)];
    const { container } = render(<Space3DWalls elements={board} poseStore={pose} size={size} />);
    const near = container.querySelectorAll('[data-space-wall]').length;
    act(() => {
      view.value = { zoom: 1, offset: { x: -40000, y: 0 } };
      for (const fn of view.subs) fn();
    });
    const far = container.querySelectorAll('[data-space-wall]');
    expect(far.length).toBe(near);
    expect(
      [...far].every(
        (w) =>
          Number((w as HTMLElement).style.transform.match(/translate\(([-\d.]+)px/)![1]) > 30000,
      ),
    ).toBe(true);
    view.value = { zoom: 1, offset: { x: 0, y: 0 } };
  });
});

describe('the overlay (docs/specs/008-canvas/3d-view.md "What it shows")', () => {
  function Bubble() {
    return <span data-testid="bubble">{useInSpace3D() ? '3d' : 'flat'}</span>;
  }

  it('draws a bubble in place while flat, and in the overlay over every wall while 3D', () => {
    const world = document.createElement('div');
    const overlay = document.createElement('div');
    document.body.append(world, overlay);
    const at = (on: boolean, node: HTMLElement | null) => (
      <Space3DOverlayProvider value={{ on, node }}>
        <InSpace3DOverlay>
          <Bubble />
        </InSpace3DOverlay>
      </Space3DOverlayProvider>
    );
    const { rerender } = render(at(false, null), { container: world });
    expect(world.contains(screen.getByTestId('bubble'))).toBe(true);
    expect(screen.getByTestId('bubble').textContent).toBe('flat');
    rerender(at(true, overlay));
    expect(overlay.contains(screen.getByTestId('bubble'))).toBe(true);
    expect(world.contains(screen.getByTestId('bubble'))).toBe(false);
    expect(screen.getByTestId('bubble').textContent).toBe('3d');
  });

  it('is a second stage with the camera, its world moved with the view without a render', () => {
    const onNode = vi.fn();
    view.value = { zoom: 1.5, offset: { x: 10, y: -20 } };
    const { container } = render(
      <Space3DOverlayStage style={space3DStageStyle('tilted')} zoom={1.5} onNode={onNode} />,
    );
    const stage = container.querySelector<HTMLElement>('[data-space-overlay]')!;
    expect(stage.hasAttribute('data-space-stage')).toBe(true);
    expect(stage.style.getPropertyValue('--space-tilt')).toBe('52deg');
    const world = container.querySelector<HTMLElement>('[data-space-overlay-world]')!;
    expect(onNode).toHaveBeenLastCalledWith(world);
    expect(world.style.transform).toBe('scale(1.5) translate(10px, -20px)');
    act(() => {
      view.value = { zoom: 1.5, offset: { x: 40, y: -20 } };
      for (const fn of view.subs) fn();
    });
    expect(world.style.transform).toBe('scale(1.5) translate(40px, -20px)');
    view.value = { zoom: 1, offset: { x: 0, y: 0 } };
  });

  it('keeps a half-typed message, its caret and focus as the view turns 3D and back', () => {
    function Draft() {
      const [text, setText] = useState('');
      return <textarea aria-label="Say" value={text} onChange={(e) => setText(e.target.value)} />;
    }
    const world = document.createElement('div');
    const overlay = document.createElement('div');
    document.body.append(world, overlay);
    const at = (node: HTMLElement | null) => (
      <Space3DOverlayProvider value={{ on: node !== null, node }}>
        <InSpace3DOverlay>
          <Draft />
        </InSpace3DOverlay>
      </Space3DOverlayProvider>
    );
    const { rerender } = render(at(null), { container: world });
    const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Say' });
    fireEvent.change(field, { target: { value: 'Hello there' } });
    field.focus();
    field.setSelectionRange(5, 5);
    rerender(at(overlay));
    // The same field, moved, not made again.
    expect(screen.getByRole('textbox', { name: 'Say' })).toBe(field);
    expect(overlay.contains(field)).toBe(true);
    expect(field.value).toBe('Hello there');
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([5, 5]);
    rerender(at(null));
    expect(world.contains(field)).toBe(true);
    expect(field.value).toBe('Hello there');
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([5, 5]);
  });
});

describe('standing pieces (docs/specs/008-canvas/3d-view.md "Pieces stand up")', () => {
  const office = buildTemplate('virtual-office', 0, 0);
  const far = buildTemplate('virtual-office', 40000, 0);
  const size = { width: 1400, height: 900 };
  // The world layer: each element's box as the element plane draws it, beside the walls layer.
  const World = ({
    elements,
    walls,
    boxes = elements,
  }: {
    elements: typeof office;
    walls: boolean;
    boxes?: typeof office;
  }) => (
    <div data-testid="world">
      {boxes.map((el) => (
        <div key={el.id} data-element-id={el.id} data-space-stands={standAttr(el)} />
      ))}
      {walls ? (
        <Space3DWalls
          elements={elements}
          poseStore={createStateStore<AvatarPose>(NO_POSE)}
          size={size}
        />
      ) : null}
    </div>
  );

  it('stands the pieces near the view, not the far ones or what lies flat, and lays them down when it flattens', () => {
    const board = [...office, ...far];
    const { container, rerender } = render(<World elements={board} walls />);
    const near = [...container.querySelectorAll<HTMLElement>('[data-space-near]')];
    expect(near.length).toBeGreaterThan(5);
    const nearIds = new Set(near.map((n) => n.dataset.elementId));
    expect(far.some((el) => nearIds.has(el.id))).toBe(false);
    for (const n of near) expect(n.hasAttribute('data-space-stands')).toBe(true);
    rerender(<World elements={board} walls={false} />);
    expect(container.querySelectorAll('[data-space-near]')).toHaveLength(0);
  });

  it('chooses again when the board changes: a removed piece is no longer near', () => {
    const { container, rerender } = render(<World elements={office} walls />);
    const first = container.querySelector<HTMLElement>('[data-space-near]')!;
    const id = first.dataset.elementId;
    const without = office.filter((el) => el.id !== id);
    // The box is still drawn for a moment while the board no longer has it.
    rerender(<World elements={without} boxes={office} walls />);
    expect(first.hasAttribute('data-space-near')).toBe(false);
    expect(container.querySelectorAll('[data-space-near]').length).toBeGreaterThan(0);
  });

  it('reads the near pieces on the screen for a press, skipping boxes the board no longer has', () => {
    const root = document.createElement('div');
    const chair = office.find((el) => el.type === 'shape' && el.shape === 'chair')!;
    root.innerHTML = `<div data-element-id="${chair.id}" data-space-stands="base" data-space-near=""></div><div data-element-id="gone" data-space-stands="centre" data-space-near=""></div>`;
    (root.firstElementChild as HTMLElement).getBoundingClientRect = () =>
      ({ left: 10, top: 20, width: 30, height: 40 }) as DOMRect;
    const read = standingPiecesOnScreen(root, office);
    expect(read).toHaveLength(1);
    expect(read[0]!.rect).toEqual({ left: 10, top: 20, width: 30, height: 40 });
    expect(read[0]!.rotated).toBe(false);
    expect(standingPiecesOnScreen(document.createElement('div'), office)).toEqual([]);
  });
});

describe('useSpace3DZoom (docs/specs/008-canvas/3d-view.md "It brings the camera closer")', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  // The zoom eases over the tilt's length; this runs it to the end.
  const settle = () => {
    act(() => {
      vi.advanceTimersByTime(SPACE_3D_TILT_MS + 50);
    });
  };
  const harness = (walking: boolean) =>
    renderHook(
      ({ walking: w }) => {
        const [zoom, setZoom] = useState(1);
        useSpace3DZoom(w, zoom, setZoom);
        return { zoom, setZoom };
      },
      { initialProps: { walking } },
    );

  it('zooms in when the switch turns it on while walking, and back to the same zoom when it turns off', () => {
    const { result } = harness(true);
    act(() => space3DPreference.set(true));
    // Eased, on the tilt's curve: part of the way there mid-tilt, all the way at its end.
    act(() => {
      vi.advanceTimersByTime(SPACE_3D_TILT_MS / 4);
    });
    expect(result.current.zoom).toBeGreaterThan(1);
    expect(result.current.zoom).toBeLessThan(1.4);
    settle();
    expect(result.current.zoom).toBeCloseTo(1.4);
    act(() => space3DPreference.set(false));
    settle();
    expect(result.current.zoom).toBe(1);
  });

  it('eases on the same curve as the tilt', () => {
    expect(space3DEase(0)).toBe(0);
    expect(space3DEase(1)).toBe(1);
    // cubic-bezier(0.22, 1, 0.36, 1) is well past half way a quarter of the way in.
    expect(space3DEase(0.25)).toBeGreaterThan(0.6);
    expect(space3DEase(0.5)).toBeGreaterThan(space3DEase(0.25));
  });

  it('zooms back out by the step when you zoomed while in 3D', () => {
    const { result } = harness(true);
    act(() => space3DPreference.set(true));
    settle();
    act(() => result.current.setZoom(2.8));
    act(() => space3DPreference.set(false));
    settle();
    expect(result.current.zoom).toBeCloseTo(2);
  });

  it('leaves the zoom alone when the switch turns while not walking', () => {
    const { result } = harness(false);
    act(() => space3DPreference.set(true));
    act(() => space3DPreference.set(false));
    expect(result.current.zoom).toBe(1);
  });
});
