// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { useCanvasSurfaceGestures } from './useCanvasSurfaceGestures';

// docs/specs/008-canvas/canvas-and-palette.md (Laser), Work Tracker 1040: with Laser in hand a mouse
// drag pans wherever it starts, on a shape, a table, an arrow or the empty canvas, and never reaches
// an element's own press handler (which selects it and starts the move that would edit the document).
// In a browser the inert layer sends a press on a shape or table body straight to <main>; the
// presses below land ON the element too, as an arrow's hit band or a mode chip does, so the capture
// guard is what keeps them off the element.

const setPan = vi.fn();
const setMarquee = vi.fn();
// The element handlers a press must never reach under Laser: a press selects and starts the drag.
const elementPress = vi.fn();
const elementMenu = vi.fn();
const spotlight = { grow: vi.fn(), shrink: vi.fn() };

function Surface({ tool }: { tool: string }) {
  const mainRef = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const surface = useCanvasSurfaceGestures({
    canvasTool: tool,
    middleMousePan: true,
    pendingDraw: null,
    viewportOffset: { x: 10, y: 20 },
    viewportZoom: 1,
    mainRef,
    wrapperRef,
    spaceHeldRef: { current: false },
    setPan,
    setMarquee,
    spotlight,
    isoCamera: {},
    beginPendingDrawGesture: () => false,
    onDeselect: vi.fn(),
    onCanvasDoubleClick: vi.fn(),
  } as never);
  const element = (id: string, child?: React.ReactNode) => (
    <div
      data-testid={id}
      data-element-id={id}
      onPointerDown={(e) => {
        e.stopPropagation();
        elementPress(id);
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        elementMenu(id);
      }}
    >
      {child}
    </div>
  );
  return (
    <main
      ref={mainRef}
      data-testid="main"
      onPointerDownCapture={surface.onPointerDownCapture}
      onPointerDown={surface.onPointerDown}
      onContextMenuCapture={surface.onContextMenuCapture}
      onContextMenu={surface.onContextMenu}
    >
      <div ref={wrapperRef} data-testid="wrapper" onPointerDown={surface.onWrapperPointerDown}>
        <div data-element-plane="">
          {element('shape')}
          {element('table', <table data-testid="cell" />)}
          {element(
            'arrow',
            <svg>
              <path data-testid="arrow-band" />
            </svg>,
          )}
          {element(
            'mode-button',
            <button type="button" data-testid="chip" data-mode-button-chip="" />,
          )}
        </div>
      </div>
    </main>
  );
}

const press = (el: Element, init: { button?: number; pointerType?: string } = {}) =>
  fireEvent.pointerDown(el, {
    button: 0,
    pointerType: 'mouse',
    clientX: 100,
    clientY: 120,
    ...init,
  });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const panFromPress = { startClientX: 100, startClientY: 120, startOffsetX: 10, startOffsetY: 20 };

describe('a Laser drag', () => {
  it.each([
    ['a shape', 'shape'],
    ['a table', 'cell'],
    ['an arrow', 'arrow-band'],
  ])('that starts on %s pans and never reaches the element', (_, testId) => {
    const { getByTestId } = render(<Surface tool="laser" />);
    press(getByTestId(testId));
    expect(elementPress).not.toHaveBeenCalled();
    expect(setPan).toHaveBeenCalledTimes(1);
    expect(setPan).toHaveBeenCalledWith(expect.objectContaining(panFromPress));
    expect(setMarquee).not.toHaveBeenCalled();
  });

  it('that starts on the empty canvas pans', () => {
    const { getByTestId } = render(<Surface tool="laser" />);
    press(getByTestId('main'));
    expect(setPan).toHaveBeenCalledWith(expect.objectContaining(panFromPress));
    press(getByTestId('wrapper'));
    expect(setPan).toHaveBeenCalledTimes(2);
    expect(setMarquee).not.toHaveBeenCalled();
  });

  it('by a pen pans too', () => {
    const { getByTestId } = render(<Surface tool="laser" />);
    press(getByTestId('shape'), { pointerType: 'pen' });
    expect(elementPress).not.toHaveBeenCalled();
    expect(setPan).toHaveBeenCalledTimes(1);
  });

  it('that starts on a mode chip pans like any other', () => {
    const { getByTestId } = render(<Surface tool="laser" />);
    press(getByTestId('chip'));
    expect(elementPress).not.toHaveBeenCalled();
    expect(setPan).toHaveBeenCalledTimes(1);
  });

  it('by a finger draws the laser: no pan, and no select either', () => {
    const { getByTestId } = render(<Surface tool="laser" />);
    press(getByTestId('shape'), { pointerType: 'touch' });
    expect(elementPress).not.toHaveBeenCalled();
    expect(setPan).not.toHaveBeenCalled();
  });

  it('by the middle button keeps the middle-button pan', () => {
    const { getByTestId } = render(<Surface tool="laser" />);
    press(getByTestId('shape'), { button: 1 });
    expect(elementPress).not.toHaveBeenCalled();
    expect(setPan).toHaveBeenCalledTimes(1);
  });
});

describe('a Laser right-click', () => {
  it('on an element neither selects it nor opens its menu', () => {
    const { getByTestId } = render(<Surface tool="laser" />);
    press(getByTestId('arrow-band'), { button: 2 });
    fireEvent.contextMenu(getByTestId('arrow-band'), { button: 2 });
    expect(elementPress).not.toHaveBeenCalled();
    expect(elementMenu).not.toHaveBeenCalled();
    expect(setPan).not.toHaveBeenCalled();
  });

  it("on a mode chip still opens the button's menu (mode-button.md)", () => {
    const { getByTestId } = render(<Surface tool="laser" />);
    press(getByTestId('chip'), { button: 2 });
    fireEvent.contextMenu(getByTestId('chip'), { button: 2 });
    expect(elementMenu).toHaveBeenCalledWith('mode-button');
  });
});

// mode-button.md: a mode chip keeps its menu in Spotlight too; everywhere else a right-click shrinks the light.
describe('a Spotlight right-click', () => {
  it("on a mode chip opens the button's menu instead of shrinking the light", () => {
    const { getByTestId } = render(<Surface tool="spotlight" />);
    press(getByTestId('chip'), { button: 2 });
    fireEvent.contextMenu(getByTestId('chip'), { button: 2 });
    expect(elementMenu).toHaveBeenCalledWith('mode-button');
    expect(spotlight.shrink).not.toHaveBeenCalled();
  });

  it('on any other element shrinks the light and opens nothing', () => {
    const { getByTestId } = render(<Surface tool="spotlight" />);
    press(getByTestId('shape'), { button: 2 });
    fireEvent.contextMenu(getByTestId('shape'), { button: 2 });
    expect(elementPress).not.toHaveBeenCalled();
    expect(elementMenu).not.toHaveBeenCalled();
    expect(spotlight.shrink).toHaveBeenCalledTimes(1);
  });

  it('a left press on a mode chip still grows the light', () => {
    const { getByTestId } = render(<Surface tool="spotlight" />);
    press(getByTestId('chip'));
    expect(spotlight.grow).toHaveBeenCalledTimes(1);
    expect(elementPress).not.toHaveBeenCalled();
  });
});

describe('outside Laser', () => {
  it.each(['select', 'pan'])('a press on a shape still reaches it under %s', (tool) => {
    const { getByTestId } = render(<Surface tool={tool} />);
    press(getByTestId('shape'));
    fireEvent.contextMenu(getByTestId('shape'), { button: 2 });
    expect(elementPress).toHaveBeenCalledWith('shape');
    expect(elementMenu).toHaveBeenCalledWith('shape');
  });
});
