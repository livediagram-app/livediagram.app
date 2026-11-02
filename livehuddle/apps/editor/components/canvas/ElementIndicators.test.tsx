// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type ShapeKind } from '@livehuddle/document';
import { CanvasZoomProvider } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { ElementIndicatorStyleProvider } from '@/components/canvas/ElementIndicatorStyleContext';
import { ElementIndicators } from '@/components/canvas/ElementIndicators';
import { buildIndicatorItems, type IndicatorItem } from '@/components/canvas/indicator-items';
import { placeCluster, useIndicatorLayout } from '@/components/canvas/useIndicatorLayout';
import type { ElementIndicatorStyle } from '@/lib/element-indicator-style';

// docs/specs/008-canvas/element-indicators.md: the element's link / note / action / comments drawn
// inside it in the person's style, a mind root's commands only when hovered or selected, and the
// pip when the element has no room.

function shape(kind: ShapeKind, width: number, height: number): BoxedElement {
  return { ...createShape(kind, 0, 0), width, height };
}

const items = (over: Partial<Parameters<typeof buildIndicatorItems>[0]> = {}) =>
  buildIndicatorItems({
    note: vi.fn(),
    action: { onOpen: vi.fn(), assigneeName: 'Sam Reed', initials: 'SR', color: '#3e7be0' },
    comments: { count: 2, onOpen: vi.fn() },
    ...over,
  });

function draw(
  el: BoxedElement,
  opts: { style?: ElementIndicatorStyle; selected?: boolean; zoom?: number } = {},
  list = items(),
) {
  const wrap = ({ children }: { children: ReactNode }) => (
    <CanvasZoomProvider zoom={opts.zoom ?? 1}>
      <ElementIndicatorStyleProvider style={opts.style ?? 'top'}>
        {children}
      </ElementIndicatorStyleProvider>
    </CanvasZoomProvider>
  );
  return render(<Placed el={el} list={list} selected={opts.selected ?? false} />, {
    wrapper: wrap,
  });
}

// Lays the cluster out as BoxedElementView does, through the shared hook.
function Placed({
  el,
  list,
  selected,
}: {
  el: BoxedElement;
  list: IndicatorItem[];
  selected: boolean;
}) {
  const placed = useIndicatorLayout(el, 14, list);
  if (!placed) return null;
  return (
    <ElementIndicators
      element={el}
      items={list}
      placed={placed}
      cornerPx={14}
      fill="#141a2a"
      selected={selected}
    />
  );
}

describe('ElementIndicators', () => {
  it('sits inside a circle too', () => {
    const { container } = draw(shape('circle', 200, 200));
    expect(container.querySelector('[data-indicators="top"]')).not.toBeNull();
  });

  it('falls back to the pip on an element with no room', () => {
    const { container } = draw(shape('stadium', 120, 40));
    expect(container.querySelector('[data-indicators="pip"]')).not.toBeNull();
  });

  it('moves an icon and label down out of the way of the icons along the top', () => {
    const cloud = shape('cloud', 290, 190);
    const content = {
      label: 'Cloud',
      textSize: 'md',
      padding: 14,
      alignX: 'center',
      alignY: 'middle',
      fontPx: 22,
      icon: { size: 35, position: 'above', gap: 7 },
    } as const;
    const busy = items({
      link: { onFollow: vi.fn(), destination: 'example.com' },
      comments: { count: 120, onOpen: vi.fn() },
    });
    const layout = placeCluster(cloud, 0, busy, 'top', content);
    expect(layout.form).toBe('top');
    expect(layout.inset.top).toBeGreaterThan(0);
    expect(layout.inset.bottom).toBe(0);
  });

  it('draws a squared pip on a sharp element, on a white chip when there is no fill', () => {
    const el = { ...shape('square', 60, 30), borderRadius: 'none' } as BoxedElement;
    const placed = { form: 'pip', box: null, pip: null, inset: { top: 0, bottom: 0 } } as const;
    const { container } = render(
      <ElementIndicators
        element={el}
        items={items()}
        placed={placed}
        cornerPx={0}
        selected={false}
      />,
    );
    const pip = container.querySelector<HTMLElement>('[data-indicators="pip"]')!;
    expect(pip.className).toContain('rounded-md');
    expect(pip.className).toContain('bg-white');
    // No outline point given: the box-corner rule places it.
    expect(pip.style.right).toBe('0px');
  });

  it('places indicators on an element that is not a shape', () => {
    const text = {
      id: 't',
      type: 'text',
      x: 0,
      y: 0,
      width: 300,
      height: 120,
      label: 'Notes',
      textSize: 'sm',
    } as BoxedElement;
    const layout = placeCluster(text, 0, items({}), 'top');
    expect(layout.form).toBe('top');
  });

  it('draws the pip on an element that is not a shape', () => {
    const text = {
      id: 't',
      type: 'text',
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      label: 'x',
    } as BoxedElement;
    const placed = {
      form: 'pip',
      box: null,
      pip: { x: 2, y: 2 },
      inset: { top: 0, bottom: 0 },
    } as const;
    const { container } = render(
      <ElementIndicators
        element={text}
        items={items()}
        placed={placed}
        cornerPx={0}
        fill="#fff"
        selected={false}
      />,
    );
    expect(container.querySelector('[data-indicators="pip"]')!.className).toContain('rounded-md');
  });
});
