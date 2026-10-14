// @vitest-environment jsdom

// A badge's or step number's menu section (docs/specs/009-elements/badge.md "The menu").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livediagram/document';
import { ChipMenuSection } from './ChipMenuSection';
import type { ElementStyleOps } from '@/lib/element-style-ops';

afterEach(cleanup);

function show(target: ShapeElement, stepsInOrder = false) {
  const ops: ElementStyleOps = {
    preview: vi.fn(),
    end: vi.fn(),
    commit: vi.fn(),
    burst: vi.fn(),
    commitTab: vi.fn(),
  };
  render(
    <ChipMenuSection
      target={target}
      ops={ops}
      stepsInOrder={stepsInOrder}
      sectionProps={() => ({ open: true, onToggle: () => {}, flush: true })}
    />,
  );
  return ops;
}

const badge = (over: Partial<ShapeElement> = {}) =>
  ({ ...(createShape('badge', 0, 0) as ShapeElement), ...over }) as ShapeElement;
const step = (over: Partial<ShapeElement> = {}) =>
  ({ ...(createShape('step', 0, 0) as ShapeElement), ...over }) as ShapeElement;

describe('ChipMenuSection', () => {
  it('picks a look', () => {
    const ops = show(badge());
    fireEvent.click(screen.getByRole('button', { name: 'Quiet Look' }));
    const map = (ops.commit as ReturnType<typeof vi.fn>).mock.calls[0]![0] as (
      e: Element,
    ) => ShapeElement;
    expect(map(badge()).chipLook).toBe('quiet');
  });

  it('offers Detach only while attached', () => {
    show(badge());
    expect(screen.queryByText('Detach')).toBeNull();
    cleanup();
    const ops = show(badge({ attachedTo: 'h', attachAt: 'top' }));
    fireEvent.click(screen.getByText('Detach'));
    expect(ops.commit).toHaveBeenCalledWith(expect.any(Function), 'ChipDetach');
  });

  it('renumbers and plays a step set in order across the tab', () => {
    const ops = show(step({ label: '3' }));
    fireEvent.click(screen.getByText('Renumber Steps'));
    expect(ops.commitTab).toHaveBeenCalledWith(expect.any(Function), 'RenumberSteps');
    fireEvent.click(screen.getByRole('button', { name: /Play in Order/ }));
    const map = (ops.commitTab as ReturnType<typeof vi.fn>).mock.calls[1]![0] as (
      els: Element[],
    ) => ShapeElement[];
    expect(map([step({ id: 'a' }), step({ id: 'b' })]).every((s) => s.stepSequence)).toBe(true);
  });

  it('shows no step controls on a badge', () => {
    show(badge());
    expect(screen.queryByText('Renumber Steps')).toBeNull();
    expect(screen.queryByText('Play in Order')).toBeNull();
  });
});
