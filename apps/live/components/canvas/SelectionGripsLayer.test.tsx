// @vitest-environment jsdom

import { useState, type ReactNode } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ArrowElement } from '@livediagram/document';
import { SelectionChromeLayer } from './element-parts';
import { SelectedArrowHandles } from './SelectedArrowHandles';
import {
  ArrowGripsPortal,
  BoxGripsPortal,
  SELECTION_GRIPS_Z_INDEX,
  SelectionGripsContext,
  SelectionGripsLayer,
  type SelectionGripHosts,
} from './SelectionGripsLayer';
import { CanvasZoomProvider } from './CanvasZoomContext';

// The handles are always on top (docs/specs/008-canvas/canvas-and-palette.md "Resize"): every grip
// renders in the one grips layer drawn after the elements, never inside an element's own box, so no
// stacking context on the element (rotation, opacity, animation) can sink it under a later element.

// An element wrapper that forms its own stacking context, as a rotated, faded one does.
function Harness({ children, onElementDown }: { children: ReactNode; onElementDown?: () => void }) {
  const [hosts, setHosts] = useState<SelectionGripHosts | null>(null);
  return (
    <SelectionGripsContext.Provider value={hosts}>
      <div
        data-testid="element"
        style={{ opacity: 0.5, transform: 'rotate(20deg)' }}
        onPointerDown={onElementDown}
      >
        {children}
      </div>
      <div data-testid="later-element" />
      <SelectionGripsLayer onHosts={setHosts} />
    </SelectionGripsContext.Provider>
  );
}

const box = { x: 10, y: 20, width: 100, height: 50 };

function chrome(onBeginDrag = vi.fn()) {
  return (
    <CanvasZoomProvider zoom={2}>
      <SelectionChromeLayer
        elementId="a"
        box={box}
        rotation={20}
        showHandles
        showAnchors
        onBeginDrag={onBeginDrag}
      />
    </CanvasZoomProvider>
  );
}

const layerOf = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-selection-grips]')!;

describe('SelectionGripsLayer', () => {
  it('draws after every element, above them', () => {
    const { container } = render(<Harness>{chrome()}</Harness>);
    const layer = layerOf(container);
    expect(layer).not.toBeNull();
    expect(container.lastElementChild).toBe(layer);
    expect(layer.style.zIndex).toBe(String(SELECTION_GRIPS_Z_INDEX));
    expect(layer.className).toContain('pointer-events-none');
  });

  it("renders a box's corner and edge handles in the layer, not inside the element", () => {
    const { container, getByTestId } = render(<Harness>{chrome()}</Harness>);
    expect(getByTestId('element').querySelectorAll('[data-canvas-handle]')).toHaveLength(0);
    const handles = layerOf(container).querySelectorAll('[data-canvas-handle]');
    expect(handles).toHaveLength(8);
    expect(layerOf(container).querySelectorAll('[aria-label="Resize width"]')).toHaveLength(2);
  });

  it("frames the handles on the element's box, turned with it", () => {
    const { container } = render(<Harness>{chrome()}</Harness>);
    const frame = layerOf(container).querySelector<HTMLElement>('[data-grips-for="a"]')!;
    expect(frame.style.left).toBe('10px');
    expect(frame.style.top).toBe('20px');
    expect(frame.style.width).toBe('100px');
    expect(frame.style.height).toBe('50px');
    expect(frame.style.transform).toBe('rotate(20deg)');
    expect(frame.style.transformOrigin).toBe('center');
    // Pointers fall through the frame to the element body, which stays draggable.
    expect(frame.className).toContain('pointer-events-none');
  });

  it('follows an insert-between shift ahead of the rotation', () => {
    const { container } = render(
      <Harness>
        <SelectionChromeLayer
          elementId="a"
          box={box}
          rotation={0}
          shiftX={12}
          showHandles
          showAnchors={false}
          onBeginDrag={vi.fn()}
        />
      </Harness>,
    );
    const frame = layerOf(container).querySelector<HTMLElement>('[data-grips-for="a"]')!;
    expect(frame.style.transform).toBe('translateX(12px)');
  });

  it('keeps the rotation-aware cursor and the counter-scale on each handle', () => {
    const { container } = render(<Harness>{chrome()}</Harness>);
    const [nw] = layerOf(container).querySelectorAll<HTMLElement>('[data-canvas-handle]');
    expect(nw!.style.transform).toBe('scale(0.5)');
    // nw at 45deg + 20deg rotation rounds to the 45deg bucket.
    expect(nw!.style.cursor).toBe('nwse-resize');
  });

  it("starts the element's resize from a handle without the press reaching the element body", () => {
    const onBeginDrag = vi.fn();
    const onElementDown = vi.fn();
    const { container } = render(
      <Harness onElementDown={onElementDown}>{chrome(onBeginDrag)}</Harness>,
    );
    const se = layerOf(container).querySelectorAll<HTMLElement>('[data-canvas-handle]')[3]!;
    fireEvent.pointerDown(se, { button: 0, pointerId: 1 });
    expect(onBeginDrag).toHaveBeenCalledWith('a', 'resize-se', expect.anything());
    expect(onElementDown).not.toHaveBeenCalled();
  });

  it('renders nothing while there are no handles to show', () => {
    const { container } = render(
      <Harness>
        <SelectionChromeLayer
          elementId="a"
          box={box}
          rotation={0}
          showHandles={false}
          showAnchors={false}
          onBeginDrag={vi.fn()}
        />
      </Harness>,
    );
    expect(layerOf(container).querySelector('[data-grips-for]')).toBeNull();
  });

  it('portals box grips into the layer', () => {
    const { container, getByTestId } = render(
      <Harness>
        <BoxGripsPortal>
          <div data-testid="grip" />
        </BoxGripsPortal>
      </Harness>,
    );
    expect(getByTestId('element').querySelector('[data-testid="grip"]')).toBeNull();
    expect(layerOf(container).querySelector('[data-testid="grip"]')).not.toBeNull();
  });

  it("renders a selected arrow's end grips in the layer's svg", () => {
    const arrow: ArrowElement = {
      id: 'ar',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 100, y: 0 },
    };
    const { container, getByTestId } = render(
      <Harness>
        <svg>
          <ArrowGripsPortal arrowId="ar">
            <SelectedArrowHandles
              arrow={arrow}
              from={{ x: 0, y: 0 }}
              to={{ x: 100, y: 0 }}
              curveControl={null}
              curveAnchors={null}
              elbowPoint={null}
              isLocked={false}
              guardPress={() => false}
              onBeginEndpointDrag={vi.fn()}
            />
          </ArrowGripsPortal>
        </svg>
      </Harness>,
    );
    expect(getByTestId('element').querySelectorAll('circle')).toHaveLength(0);
    const circles = layerOf(container).querySelectorAll('svg circle');
    expect(circles).toHaveLength(2);
    expect(circles[0]!.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('renders no grips outside a grips layer', () => {
    const { container } = render(
      <BoxGripsPortal>
        <div data-testid="grip" />
      </BoxGripsPortal>,
    );
    expect(container.querySelector('[data-testid="grip"]')).toBeNull();
  });
});
