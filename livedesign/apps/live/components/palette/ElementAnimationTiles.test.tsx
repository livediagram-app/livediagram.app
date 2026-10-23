// @vitest-environment jsdom

// The Concept category of the menu's Animation row (docs/specs/009-elements/concept-graphics.md "Animation").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  type ConceptShape,
  type Element,
  type ShapeElement,
} from '@livedesign/design';
import { ConceptAnimTiles } from './ElementAnimationTiles';
import type { ElementStyleOps } from '@/lib/element-style-ops';

afterEach(cleanup);

const ops = (): ElementStyleOps => ({
  preview: vi.fn(),
  end: vi.fn(),
  commit: vi.fn(),
  burst: vi.fn(),
  commitTab: vi.fn(),
});
const lastMap = (o: ElementStyleOps) =>
  (o.commit as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as (e: Element) => ShapeElement;
const concept = (kind: ConceptShape) =>
  createShape(kind, 0, 0) as ShapeElement & { shape: ConceptShape };

describe('ConceptAnimTiles', () => {
  it('offers Flow on a cycle only, and shows Speed and Repeat once one is picked', () => {
    render(<ConceptAnimTiles target={concept('layer-stack')} ops={ops()} />);
    expect(screen.queryByRole('button', { name: 'Flow Animation' })).toBeNull();
    cleanup();
    const o = ops();
    render(<ConceptAnimTiles target={concept('cycle')} ops={o} />);
    fireEvent.click(screen.getByRole('button', { name: 'Flow Animation' }));
    expect(o.commit).toHaveBeenCalledWith(expect.any(Function), 'ConceptAnim');
    expect(lastMap(o)(concept('cycle')).conceptAnim).toBe('flow');
    expect(screen.getByText('Repeat')).toBeTruthy();
  });

  it('leaves another kind in the selection untouched', () => {
    const o = ops();
    render(<ConceptAnimTiles target={concept('chevrons')} ops={o} />);
    fireEvent.click(screen.getByRole('button', { name: 'Build Animation' }));
    const square = createShape('square', 0, 0);
    expect(lastMap(o)(square)).toBe(square);
  });
});
