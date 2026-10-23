// @vitest-environment jsdom

// A pointer note's section (docs/specs/009-elements/pointer-note.md "Menu").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livedocuments/document';
import { PointerNoteMenuSection } from './PointerNoteMenuSection';
import type { ElementStyleOps } from '@/lib/element-style-ops';

afterEach(cleanup);

const note = (over: Partial<ShapeElement> = {}) =>
  ({ ...createShape('pointer-note', 0, 0), ...over }) as ShapeElement;

function show(target: ShapeElement) {
  const ops: ElementStyleOps = {
    preview: vi.fn(),
    end: vi.fn(),
    commit: vi.fn(),
    burst: vi.fn(),
    commitTab: vi.fn(),
  };
  render(
    <PointerNoteMenuSection
      target={target}
      ops={ops}
      sectionProps={() => ({ open: true, onToggle: () => {}, flush: true })}
    />,
  );
  return ops;
}

describe('PointerNoteMenuSection', () => {
  it('detaches an attached note', () => {
    const attached = note({ attachedTo: 'h', attachAt: 'top' });
    const ops = show(attached);
    fireEvent.click(screen.getByRole('button', { name: /Detach/ }));
    expect(ops.commit).toHaveBeenCalledWith(expect.any(Function), 'PointerDetach');
    const map = (ops.commit as ReturnType<typeof vi.fn>).mock.calls[0]![0] as (
      e: Element,
    ) => ShapeElement;
    expect(map(attached).attachedTo).toBeUndefined();
  });

  it('says how to point a free note, with nothing to detach', () => {
    show(note());
    expect(screen.queryByRole('button', { name: /Detach/ })).toBeNull();
    expect(screen.getByText(/Drag the dot/)).toBeTruthy();
  });
});
