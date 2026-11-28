// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTemplate } from '@livehuddle/templates';
import { createShape } from '@livehuddle/document';
import { setSpace3DTiltNow, space3DTiltNow } from '@/lib/space-3d/space-3d-preference';
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
import { Space3DTurnButtons } from './Space3DTurnButtons';
import { space3DTurn } from '@/lib/space-3d/space-3d-turn';
import { Space3DWalls } from './Space3DWalls';
import {
  InSpace3DOverlay,
  Space3DOverlayProvider,
  Space3DOverlayStage,
  useInSpace3D,
} from './Space3DOverlay';
import { loadSpace3DWalls } from '@/lib/editor-deferred-code';
import { arrivalIntroPlaying } from '@/lib/space-3d/arrival-intro';

beforeEach(() => {
  vi.useFakeTimers();
  setSpace3DTiltNow(0);
  reduced.on = false;
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useSpace3DView (docs/specs/008-canvas/3d-view.md: always 3D)', () => {
  it('is 3D from the first frame, in Edit and Walk alike, with its tilt for a press', () => {
    const { rerender } = renderHook(({ walking }) => useSpace3DView(walking), {
      initialProps: { walking: false },
    });
    expect(space3DTiltNow()).toBe(52);
    expect(loadSpace3DWalls).toHaveBeenCalled();
    rerender({ walking: true });
    expect(space3DTiltNow()).toBe(52);
  });

  it('has no Shift+3 switch', () => {
    space3DTurn.set(0);
    renderHook(() => useSpace3DView(true));
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Digit3', key: '#', shiftKey: true, bubbles: true }),
      );
    });
    expect(space3DTiltNow()).toBe(52);
    expect(space3DTurn.get()).toBe(0);
  });

  it('turns the camera with [ and ], not while typing', () => {
    space3DTurn.set(0);
    renderHook(() => useSpace3DView(true));
    const press = (target: EventTarget = window) =>
      act(() => {
        target.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketRight', bubbles: true }));
      });
    // Turning the camera right turns the floor the other way (space-3d-turn.ts).
    press();
    expect(space3DTurn.get()).toBe(-1);
    const input = document.body.appendChild(document.createElement('input'));
    press(input);
    expect(space3DTurn.get()).toBe(-1);
    input.remove();
    space3DTurn.set(0);
  });

  it('styles the stage with the camera tilt and turn', () => {
    expect(space3DStageStyle(1)).toEqual({
      '--space-tilt': '52deg',
      '--space-stand': '-90deg',
      '--space-turn': '90deg',
    });
  });
});

describe('Space3DTurnButtons', () => {
  it('turns the camera a quarter each way', () => {
    space3DTurn.set(0);
    render(<Space3DTurnButtons />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn Right' }));
    expect(space3DTurn.get()).toBe(-1);
    fireEvent.click(screen.getByRole('button', { name: 'Turn Left' }));
    expect(space3DTurn.get()).toBe(0);
  });
});

describe('Space3DWalls (docs/specs/008-canvas/3d-view.md "Performance")', () => {
  const office = buildTemplate('virtual-office', 0, 0);
  const size = { width: 1400, height: 900 };

  it('builds no wall or roof of its own: the 3D scene draws them (3d-engine.md)', () => {
    const { container } = render(<Space3DWalls elements={office} size={size} />);
    expect(container.querySelector('[data-space-walls]')).not.toBeNull();
    expect(container.querySelectorAll('[data-space-wall], [data-space-roof]')).toHaveLength(0);
  });

  it("paints the walls in the tab's colour, in evening light on a dark canvas, and leaves the plaster unset", () => {
    const layer = (wallColor?: string, darkCanvas?: boolean) =>
      render(
        <Space3DWalls
          elements={office}
          size={size}
          wallColor={wallColor}
          darkCanvas={darkCanvas}
        />,
      ).container.querySelector<HTMLElement>('[data-space-walls]')!;
    expect(layer().style.getPropertyValue('--space-wall')).toBe('');
    cleanup();
    expect(layer('#d5e6d3').style.getPropertyValue('--space-wall')).toBe('#d5e6d3');
    cleanup();
    expect(layer('#d5e6d3', true).style.getPropertyValue('--space-wall')).not.toBe('#d5e6d3');
  });

  it('lays the floor round the view, and again when the view has moved far, not during an arrival', () => {
    const floor = { backgroundColor: 'rgb(1, 2, 3)' };
    const { container } = render(<Space3DWalls elements={office} size={size} floor={floor} />);
    const left = () =>
      parseFloat(container.querySelector<HTMLElement>('[data-space-floor]')!.style.left);
    const near = left();
    act(() => {
      arrivalIntroPlaying.set(true);
      view.value = { zoom: 1, offset: { x: -40000, y: 0 } };
      for (const fn of view.subs) fn();
    });
    expect(left()).toBe(near);
    act(() => arrivalIntroPlaying.set(false));
    expect(left()).toBeGreaterThan(30000);
    view.value = { zoom: 1, offset: { x: 0, y: 0 } };
  });
});

describe('the overlay (docs/specs/008-canvas/3d-view.md "What it shows")', () => {
  function Bubble() {
    return <span data-testid="bubble">{useInSpace3D() ? '3d' : 'none'}</span>;
  }

  it('draws a bubble in place until the overlay mounts, then in the overlay over every wall', () => {
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
    expect(screen.getByTestId('bubble').textContent).toBe('none');
    rerender(at(true, overlay));
    expect(overlay.contains(screen.getByTestId('bubble'))).toBe(true);
    expect(world.contains(screen.getByTestId('bubble'))).toBe(false);
    expect(screen.getByTestId('bubble').textContent).toBe('3d');
  });

  it('is a second stage with the camera, its world moved with the view without a render', () => {
    const onNode = vi.fn();
    view.value = { zoom: 1.5, offset: { x: 10, y: -20 } };
    const { container } = render(
      <Space3DOverlayStage style={space3DStageStyle()} zoom={1.5} onNode={onNode} />,
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
  // Two Office Pods in view: the only pieces whose boxes still stand anything up (the rest are the scene's models).
  const pods = [createShape('office-pod', 200, 200), createShape('office-pod', 600, 200)];
  const office = [...buildTemplate('virtual-office', 0, 0), ...pods];
  const far = [...buildTemplate('virtual-office', 40000, 0), createShape('office-pod', 40200, 200)];
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
      {walls ? <Space3DWalls elements={elements} size={size} /> : null}
    </div>
  );

  it('stands the Office Pods near the view, not the far ones nor any modelled piece, and lays them down when it goes', () => {
    const board = [...office, ...far];
    const { container, rerender } = render(<World elements={board} walls />);
    const near = [...container.querySelectorAll<HTMLElement>('[data-space-near]')];
    const nearIds = new Set(near.map((n) => n.dataset.elementId));
    expect(nearIds).toEqual(new Set(pods.map((p) => p.id)));
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
