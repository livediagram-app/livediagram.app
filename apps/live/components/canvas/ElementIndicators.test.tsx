// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type ShapeKind } from '@livediagram/document';
import { CanvasZoomProvider } from '@/components/canvas/CanvasZoomContext';
import { ElementIndicatorStyleProvider } from '@/components/canvas/ElementIndicatorStyleContext';
import { ElementIndicators } from '@/components/canvas/ElementIndicators';
import { buildIndicatorItems, type IndicatorItem } from '@/components/canvas/indicator-items';
import { placeCluster, useIndicatorLayout } from '@/components/canvas/useIndicatorLayout';
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
  it('prints the glyphs inside a roomy element’s corner, commands hidden until hover', () => {
    const { container } = draw(shape('mind-node', 260, 116));
    expect(container.querySelector('[data-indicators="top"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Open 2 comments' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open note' })).toBeTruthy();
    const outline = screen.getByRole('button', { name: 'Edit Outline', hidden: true });
    expect(outline.className).toContain('invisible');
    expect(outline.className).toContain('group-hover/el:visible');
  });

  it('fades the whole cluster out while the element is selected, and back on deselect', () => {
    const el = shape('mind-node', 260, 116);
    const { container, rerender } = render(<Placed el={el} list={items()} selected />, {
      wrapper: ({ children }) => (
        <ElementIndicatorStyleProvider style="top">{children}</ElementIndicatorStyleProvider>
      ),
    });
    const cluster = container.querySelector<HTMLElement>('[data-indicators="top"]')!;
    expect(cluster.className).toContain('opacity-0');
    expect(cluster.hasAttribute('inert')).toBe(true);
    rerender(<Placed el={el} list={items()} selected={false} />);
    expect(cluster.className).not.toContain('opacity-0');
    expect(cluster.hasAttribute('inert')).toBe(false);
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
    expect(container.querySelector('[data-indicators="top"]')).not.toBeNull();
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

  it('draws nothing when the person turned indicators off', () => {
    const { container } = draw(shape('mind-node', 260, 116), { style: 'off' });
    expect(container.innerHTML).toBe('');
  });

  it('draws nothing below the adornment zoom', () => {
    const { container } = draw(shape('mind-node', 260, 116), { zoom: 0.3 });
    expect(container.innerHTML).toBe('');
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
    const layout = placeCluster(cloud, 0, items(), 'top', content);
    expect(layout.form).toBe('top');
    expect(layout.inset.top).toBeGreaterThan(0);
    expect(layout.inset.bottom).toBe(0);
  });

  it('leaves content that is already clear where it is', () => {
    const content = {
      label: 'HTML',
      textSize: 'md',
      padding: 14,
      alignX: 'center',
      alignY: 'middle',
    } as const;
    const layout = placeCluster(
      shape('mind-node', 220, 76),
      12,
      items({ comments: undefined, action: undefined, outline: undefined, tidy: undefined }),
      'top',
      content,
    );
    expect(layout.form).toBe('top');
    expect(layout.inset).toEqual({ top: 0, bottom: 0 });
  });

  it('shrinks a scale-to-fit label evenly, and moves nothing for the pip', () => {
    const scaled = {
      label: 'Big',
      textSize: 'scale',
      padding: 8,
      alignX: 'center',
      alignY: 'middle',
    } as const;
    const layout = placeCluster(shape('mind-node', 260, 116), 14, items(), 'top', scaled);
    expect(layout.inset.top).toBeGreaterThan(0);
    expect(layout.inset.top).toBe(layout.inset.bottom);
    const pip = placeCluster(shape('stadium', 120, 40), 0, items(), 'top', scaled);
    expect(pip.form).toBe('pip');
    expect(pip.inset).toEqual({ top: 0, bottom: 0 });
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

  it('hides a cluster of commands alone until hover, chip and all', () => {
    const placed = { form: 'pip', box: null, pip: null, inset: { top: 0, bottom: 0 } } as const;
    const only = items({ note: undefined, action: undefined, comments: undefined });
    const { container } = render(
      <ElementIndicators
        element={shape('square', 60, 30)}
        items={only}
        placed={placed}
        cornerPx={0}
        selected={false}
      />,
    );
    const pip = container.querySelector<HTMLElement>('[data-indicators="pip"]')!;
    expect(pip.className).toContain('invisible');
    expect(pip.className).toContain('group-hover/el:visible');
    cleanup();
    // With status beside the commands, the chip stays shown for it.
    const { container: mixed } = render(
      <ElementIndicators
        element={shape('square', 60, 30)}
        items={items()}
        placed={placed}
        cornerPx={0}
        selected={false}
      />,
    );
    expect(mixed.querySelector('[data-indicators="pip"]')!.className).not.toContain('invisible');
  });

  it('keeps a press on the cluster from reaching the element', () => {
    const onDown = vi.fn();
    const { container } = render(
      <div onPointerDown={onDown}>
        <Placed el={shape('mind-node', 260, 116)} list={items()} selected={false} />
      </div>,
      {
        wrapper: ({ children }) => (
          <ElementIndicatorStyleProvider style="top">{children}</ElementIndicatorStyleProvider>
        ),
      },
    );
    fireEvent.pointerDown(container.querySelector('[data-indicators]')!);
    expect(onDown).not.toHaveBeenCalled();
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
    const layout = placeCluster(text, 0, items({ outline: undefined, tidy: undefined }), 'top');
    expect(layout.form).toBe('top');
  });

  it('falls back to the pip when the content cannot move against its alignment', () => {
    const content = {
      label: 'Bottom heavy label',
      textSize: 'lg',
      padding: 14,
      alignX: 'center',
      alignY: 'bottom',
    } as const;
    const layout = placeCluster(shape('mind-node', 200, 90), 12, items(), 'top', content);
    expect(layout.form).toBe('pip');
  });

  it('falls back to the pip when the content is too tall to move', () => {
    const content = {
      label: 'A long label that wraps across several lines and fills the node',
      textSize: 'md',
      padding: 14,
      alignX: 'center',
      alignY: 'middle',
    } as const;
    expect(placeCluster(shape('mind-node', 200, 116), 12, items(), 'top', content).form).toBe(
      'pip',
    );
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
