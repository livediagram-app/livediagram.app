// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ES_LANES, laneCentre, type Element } from '@livediagram/diagram';
import { getLanePreview, setLanePreview } from '@/lib/lane-preview';
import type { PendingDraw } from '@/lib/draw-mode';
import { useStampGhost } from './useStampGhost';

// An armed workshop-note tile (docs/specs/021-event-storming/event-storming.md Phase 4): a ghost of the note follows
// the pointer over the canvas, on the lanes, and says where a click will put
// it. The canvas sits at the viewport origin at zoom 1 here, so client coords
// are canvas coords.

function harness(pendingDraw: PendingDraw | null, over: { tabKind?: 'event-storming' } = {}) {
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 2000, bottom: 2000, width: 2000, height: 2000 }) as DOMRect;
  document.body.appendChild(wrapper);
  // Stable, as the canvas's own useRef is.
  const wrapperRef = { current: wrapper };
  const elements: Element[] = [];
  const view = renderHook(() =>
    useStampGhost({
      pendingDraw,
      elements,
      tabKind: over.tabKind ?? 'event-storming',
      tabLayers: undefined,
      viewportZoom: 1,
      wrapperRef,
    }),
  );
  return { view, wrapper };
}

function moveTo(target: EventTarget, x: number, y: number) {
  act(() => {
    const e = new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true });
    target.dispatchEvent(e);
  });
}

afterEach(() => {
  cleanup();
  setLanePreview(null);
  document.body.innerHTML = '';
});

describe('useStampGhost', () => {
  const command: PendingDraw = { type: 'sticky', esKind: 'command' };

  it('shows nothing until the pointer is over the canvas', () => {
    const { view } = harness(command);
    expect(view.result.current.stamp).toBeNull();
  });

  it('follows the pointer, centred on it and on the nearest lane', () => {
    const { view, wrapper } = harness(command);
    moveTo(wrapper, 900, laneCentre(2, ES_LANES) + 9);
    const stamp = view.result.current.stamp!;
    expect(stamp.bounds.x).toBe(800);
    expect(stamp.bounds.y + stamp.bounds.height / 2).toBe(laneCentre(2, ES_LANES));
    // The lane lights, the same overlay a dragged note lights.
    expect(getLanePreview()).toMatchObject({ laneIndex: 2 });
  });

  it('hides over a floating panel', () => {
    const { view, wrapper } = harness(command);
    const panel = document.createElement('div');
    panel.setAttribute('data-floating-panel', '');
    wrapper.appendChild(panel);
    moveTo(wrapper, 900, 400);
    moveTo(panel, 900, 400);
    expect(view.result.current.stamp).toBeNull();
    expect(getLanePreview()).toBeNull();
  });

  it('is off for a tile that draws to size', () => {
    const { view, wrapper } = harness({ type: 'shape', kind: 'square' });
    moveTo(wrapper, 900, 400);
    expect(view.result.current.stamp).toBeNull();
    expect(view.result.current.stampAt).toBeNull();
  });

  it('places by the same rule it previews', () => {
    const { view } = harness(command);
    const placed = view.result.current.stampAt!(900, laneCentre(2, ES_LANES) + 9);
    expect(placed.bounds.y + placed.bounds.height / 2).toBe(laneCentre(2, ES_LANES));
  });
});
