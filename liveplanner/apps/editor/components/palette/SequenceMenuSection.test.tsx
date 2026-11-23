// @vitest-environment jsdom

// A sequence diagram's section (docs/specs/009-elements/sequence-diagram.md "The menu").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@liveplanner/project';
import { SequenceMenuSection } from './SequenceMenuSection';
import type { ElementStyleOps } from '@/lib/element-style-ops';

afterEach(cleanup);

const seq = (over: Partial<ShapeElement> = {}) =>
  ({ ...createShape('sequence', 0, 0), id: 'q', ...over }) as ShapeElement;

function show(target: ShapeElement, onEdit?: (id: string) => void) {
  const ops: ElementStyleOps = {
    preview: vi.fn(),
    end: vi.fn(),
    commit: vi.fn(),
    burst: vi.fn(),
    commitTab: vi.fn(),
  };
  render(<SequenceMenuSection target={target} onEdit={onEdit} />);
  const last = () =>
    (ops.commit as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as (e: Element) => ShapeElement;
  return { ops, last };
}

describe('SequenceMenuSection', () => {
  it('opens the dialog from the Sequence row', () => {
    const onEdit = vi.fn();
    show(seq(), onEdit);
    fireEvent.click(screen.getByRole('button', { name: 'Sequence' }));
    expect(onEdit).toHaveBeenCalledWith('q');
    // The rows are the dialog's now, not the menu's.
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('offers no Sequence row to someone who may not edit it', () => {
    show(seq());
    expect(screen.queryByRole('button', { name: 'Sequence' })).toBeNull();
  });

  it('leaves Play to the Animation row', () => {
    show(seq());
    expect(screen.queryByRole('button', { name: 'Play Animation' })).toBeNull();
  });
});
