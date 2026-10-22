// @vitest-environment jsdom

// A sequence diagram's section (docs/specs/009-elements/sequence-diagram.md "The menu").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livepages/document';
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
  render(
    <SequenceMenuSection
      target={target}
      ops={ops}
      sectionProps={() => ({ open: true, onToggle: () => {}, flush: true })}
      onEdit={onEdit}
    />,
  );
  const last = () =>
    (ops.commit as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as (e: Element) => ShapeElement;
  return { ops, last };
}

describe('SequenceMenuSection', () => {
  it('summarises the diagram and opens the dialog from Edit Sequence', () => {
    const onEdit = vi.fn();
    show(seq(), onEdit);
    expect(screen.getByText('3 participants · 5 messages')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Sequence' }));
    expect(onEdit).toHaveBeenCalledWith('q');
    // The rows are the dialog's now, not the menu's.
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('offers no Edit Sequence to someone who may not edit it', () => {
    show(seq());
    expect(screen.queryByRole('button', { name: 'Edit Sequence' })).toBeNull();
  });

  it('turns Numbered on and off, absent when off', () => {
    const { last } = show(seq());
    fireEvent.click(screen.getByRole('button', { name: 'Numbered' }));
    expect(last()(seq()).sequenceNumbered).toBe(true);
    cleanup();
    const again = show(seq({ sequenceNumbered: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Numbered' }));
    expect('sequenceNumbered' in again.last()(seq({ sequenceNumbered: true }))).toBe(false);
  });

  it('leaves Play to the Animation row', () => {
    show(seq());
    expect(screen.queryByRole('button', { name: 'Play Animation' })).toBeNull();
  });
});
