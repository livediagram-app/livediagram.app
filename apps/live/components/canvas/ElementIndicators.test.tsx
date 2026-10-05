// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type ShapeKind } from '@livediagram/document';
import { CanvasZoomProvider } from '@/components/canvas/CanvasZoomContext';
import { ElementIndicatorStyleProvider } from '@/components/canvas/ElementIndicatorStyleContext';
import { ElementIndicators } from '@/components/canvas/ElementIndicators';
import { buildIndicatorItems, type IndicatorItem } from '@/components/canvas/indicator-items';
import { labelReserveY, useIndicatorLayout } from '@/components/canvas/useIndicatorLayout';
import type { ElementIndicatorStyle } from '@/lib/element-indicator-style';

// docs/specs/008-canvas/element-indicators.md: the element's link / note / action / comments drawn
// inside it in the person's style, a mind root's commands only when hovered or selected, and the
// pip when the element has no room.

function shape(kind: ShapeKind, width: number, height: number): BoxedElement {
  return { ...createShape(kind, 0, 0), width, height } as BoxedElement;
}

const items = (over: Partial<Parameters<typeof buildIndicatorItems>[0]> = {}) =>
  buildIndicatorItems({
    outline: vi.fn(),
    tidy: vi.fn(),
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
      <ElementIndicatorStyleProvider style={opts.style ?? 'corner'}>
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
  it('prints the glyphs inside a roomy element’s corner, commands hidden at rest', () => {
    const { container } = draw(shape('mind-node', 260, 116));
    expect(container.querySelector('[data-indicators="corner"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Open 2 comments' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open note' })).toBeTruthy();
    const outline = screen.getByRole('button', { name: 'Edit Outline', hidden: true });
    expect(outline.className).toContain('invisible');
    expect(outline.className).toContain('group-hover/el:visible');
  });

  it('shows the commands while the element is selected', () => {
    draw(shape('mind-node', 260, 116), { selected: true });
    expect(screen.getByRole('button', { name: 'Edit Outline' }).className).not.toContain(
      'invisible',
    );
    expect(screen.getByRole('button', { name: 'Tidy Map' })).toBeTruthy();
  });

  it('opens what a glyph stands for', () => {
    const onOpen = vi.fn();
    draw(shape('mind-node', 260, 116), {}, items({ comments: { count: 3, onOpen } }));
    fireEvent.click(screen.getByRole('button', { name: 'Open 3 comments' }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('sits inside a circle too', () => {
    const { container } = draw(shape('circle', 200, 200));
    expect(container.querySelector('[data-indicators="corner"]')).not.toBeNull();
  });

  it('falls back to the pip on an element with no room', () => {
    const { container } = draw(shape('stadium', 120, 40));
    expect(container.querySelector('[data-indicators="pip"]')).not.toBeNull();
  });

  it('writes the words in the footer, and drops them when they do not fit', () => {
    const roomy = draw(shape('mind-node', 300, 140), { style: 'footer' });
    expect(roomy.container.querySelector('[data-indicators="footer"]')).not.toBeNull();
    expect(screen.getByText('Note')).toBeTruthy();
    expect(screen.getByText('Action')).toBeTruthy();
    expect(screen.getByText('SR')).toBeTruthy();
    roomy.unmount();

    const narrow = draw(shape('mind-node', 175, 100), { style: 'footer' });
    expect(narrow.container.querySelector('[data-indicators="footer-compact"]')).not.toBeNull();
    expect(screen.queryByText('Note')).toBeNull();
  });

  it('draws nothing below the adornment zoom', () => {
    const { container } = draw(shape('mind-node', 260, 116), { zoom: 0.3 });
    expect(container.innerHTML).toBe('');
  });

  it('reserves room for a scaled label, nothing for the pip', () => {
    const box = { x: 180, y: 9, width: 70, height: 24 };
    expect(labelReserveY({ form: 'corner', box, pip: null }, 116, 8)).toBe(25);
    const foot = { x: 9, y: 85, width: 120, height: 22 };
    expect(labelReserveY({ form: 'footer', box: foot, pip: null }, 116, 8)).toBe(23);
    expect(labelReserveY({ form: 'pip', box: null, pip: { x: 4, y: 4 } }, 116, 8)).toBe(0);
    expect(labelReserveY(null, 116, 8)).toBe(0);
  });
});
