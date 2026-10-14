// @vitest-environment jsdom

// A stack's section (docs/specs/009-elements/stack.md "Menu").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livediagram/document';
import { StackMenuSection } from './StackMenuSection';
import type { ElementStyleOps } from '@/lib/element-style-ops';

afterEach(cleanup);

const stack = (over: Partial<ShapeElement> = {}) =>
  ({ ...(createShape('stack', 0, 0) as ShapeElement), ...over }) as ShapeElement;

function show(target: ShapeElement) {
  const ops: ElementStyleOps = {
    preview: vi.fn(),
    end: vi.fn(),
    commit: vi.fn(),
    burst: vi.fn(),
    commitTab: vi.fn(),
  };
  render(
    <StackMenuSection
      target={target}
      ops={ops}
      sectionProps={() => ({ open: true, onToggle: () => {}, flush: true })}
    />,
  );
  const last = () =>
    (ops.commit as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as (e: Element) => ShapeElement;
  return { ops, last };
}

describe('StackMenuSection', () => {
  it('switches the arrangement to a grid and then offers Columns', () => {
    const { ops, last } = show(stack());
    expect(screen.queryByText('Columns')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Grid Stack' }));
    expect(ops.commit).toHaveBeenCalledWith(expect.any(Function), 'StackDirection');
    expect(last()(stack()).stackDirection).toBe('grid');
    cleanup();
    show(stack({ stackDirection: 'grid' }));
    expect(screen.getByText('Columns')).toBeTruthy();
  });

  it('aligns to the end, and stores the default centre as absent', () => {
    const { last } = show(stack({ stackAlign: 'end' }));
    fireEvent.click(screen.getByRole('button', { name: 'Align Centre' }));
    expect('stackAlign' in last()(stack({ stackAlign: 'end' }))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Align End' }));
    expect(last()(stack()).stackAlign).toBe('end');
  });
});
