// @vitest-environment jsdom

// The Border category's Accent Edge row (docs/specs/008-canvas/accent-edge.md).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livedocuments/document';
import { AccentEdgeRow } from './AccentEdgeRow';
import type { ElementStyleOps } from '@/lib/element-style-ops';

afterEach(cleanup);

const ops = (): ElementStyleOps => ({
  preview: vi.fn(),
  end: vi.fn(),
  commit: vi.fn(),
  burst: vi.fn(),
  commitTab: vi.fn(),
});

const show = (target: Element, o = ops()) => {
  render(
    <AccentEdgeRow
      target={target}
      ops={o}
      borderColour="#336699"
      colourOpen={false}
      onToggleColour={() => {}}
      colourPalette={{ presets: [] }}
    />,
  );
  return o;
};

const square = (over: Partial<ShapeElement> = {}) =>
  ({ ...createShape('square', 0, 0), ...over }) as ShapeElement;

describe('AccentEdgeRow', () => {
  it('renders nothing on a kind without an edge', () => {
    show(createShape('circle', 0, 0));
    expect(screen.queryByText('Accent Edge')).toBeNull();
  });

  it('commits the picked edge through the style ops, mapped by withAccentEdge', () => {
    const o = show(square());
    fireEvent.click(screen.getByRole('button', { name: 'Top Accent Edge' }));
    expect(o.commit).toHaveBeenCalledWith(expect.any(Function), 'AccentEdge');
    const map = (o.commit as ReturnType<typeof vi.fn>).mock.calls[0]![0] as (e: Element) => Element;
    expect((map(square()) as ShapeElement).accentEdge).toBe('top');
  });

  it('shows the colour row and Match Border only once an edge and its own colour are set', () => {
    show(square({ accentEdge: 'left' }));
    expect(screen.getByText('Edge Colour')).toBeTruthy();
    expect(screen.queryByText('Match Border')).toBeNull();
    cleanup();
    const o = show(square({ accentEdge: 'left', accentEdgeColor: '#ff0000' }));
    fireEvent.click(screen.getByText('Match Border'));
    const map = (o.commit as ReturnType<typeof vi.fn>).mock.calls[0]![0] as (e: Element) => Element;
    expect('accentEdgeColor' in map(square({ accentEdge: 'left', accentEdgeColor: '#f00' }))).toBe(
      false,
    );
  });
});
