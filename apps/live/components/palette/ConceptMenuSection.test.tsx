// @vitest-environment jsdom

// A concept graphic's menu section (docs/specs/009-elements/concept-graphics.md "Rows" and "Animation").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  type ConceptShape,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { ConceptMenuSection } from './ConceptMenuSection';
import type { ElementStyleOps } from '@/lib/element-style-ops';

afterEach(cleanup);

const make = (kind: ConceptShape) =>
  createShape(kind, 0, 0) as ShapeElement & { shape: ConceptShape };

function show(target: ShapeElement & { shape: ConceptShape }) {
  const ops: ElementStyleOps = {
    preview: vi.fn(),
    end: vi.fn(),
    commit: vi.fn(),
    burst: vi.fn(),
    commitTab: vi.fn(),
  };
  render(
    <ConceptMenuSection
      target={target}
      ops={ops}
      sectionProps={() => ({ open: true, onToggle: () => {}, flush: true })}
    />,
  );
  const lastMap = () =>
    (ops.commit as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as (e: Element) => ShapeElement;
  return { ops, lastMap };
}

describe('ConceptMenuSection', () => {
  it("switches a hub's spokes off, and names each new kind", () => {
    const { ops, lastMap } = show(make('hub'));
    expect(screen.getByText('Hub and Spoke')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Spokes/ }));
    expect(ops.commit).toHaveBeenCalledWith(expect.any(Function), 'HubSpokes');
    expect(lastMap()(make('hub')).hubSpokes).toBe(false);
    cleanup();
    show(make('chevrons'));
    expect(screen.queryByRole('button', { name: /Spokes/ })).toBeNull();
    expect(screen.getByText('Chevrons')).toBeTruthy();
  });

  it('switches a pyramid to a funnel', () => {
    const { lastMap } = show(make('pyramid'));
    fireEvent.click(screen.getByRole('button', { name: 'Funnel' }));
    expect(lastMap()(make('pyramid')).pyramidVariant).toBe('funnel');
  });

  it('offers Flow on a cycle only, and shows Speed and Repeat once one is picked', () => {
    show(make('layer-stack'));
    expect(screen.queryByRole('button', { name: 'Flow Animation' })).toBeNull();
    cleanup();
    const { lastMap } = show(make('cycle'));
    fireEvent.click(screen.getByRole('button', { name: 'Flow Animation' }));
    expect(lastMap()(make('cycle')).conceptAnim).toBe('flow');
    expect(screen.getByText('Repeat')).toBeTruthy();
  });
});
