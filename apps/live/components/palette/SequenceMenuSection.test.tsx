// @vitest-environment jsdom

// A sequence diagram's section (docs/specs/009-elements/sequence-diagram.md "Editing").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livediagram/document';
import { SequenceMenuSection } from './SequenceMenuSection';
import type { ElementStyleOps } from '@/lib/element-style-ops';

afterEach(cleanup);

const seq = (over: Partial<ShapeElement> = {}) =>
  ({ ...(createShape('sequence', 0, 0) as ShapeElement), ...over }) as ShapeElement;

function show(target: ShapeElement) {
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
    />,
  );
  const last = () =>
    (ops.commit as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as (e: Element) => ShapeElement;
  return { ops, last };
}

describe('SequenceMenuSection', () => {
  it('Enter in a message adds the next one under it, from its receiver, and focuses it', () => {
    const { ops, last } = show(seq());
    const first = screen.getByRole('textbox', { name: 'Message 1 label' });
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(ops.commit).toHaveBeenCalledWith(expect.any(Function), 'SequenceMessages');
    const messages = last()(seq()).sequenceMessages!;
    expect(messages).toHaveLength(6);
    expect(messages[1]).toEqual({ from: 'api', to: 'db', label: '', kind: 'call' });
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Message 2 label' }));
  });

  it('removing a participant drops its messages', () => {
    const { last } = show(seq());
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove participant' })[2]!);
    const next = last()(seq());
    expect(next.sequenceParticipants).toHaveLength(2);
    expect(next.sequenceMessages).toHaveLength(3);
  });

  it('keeps two participants: their Remove is disabled', () => {
    show(
      seq({
        sequenceParticipants: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        sequenceMessages: [],
      }),
    );
    for (const b of screen.getAllByRole('button', { name: 'Remove participant' }))
      expect((b as HTMLButtonElement).disabled).toBe(true);
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

  it('Play is offered, with Speed and Repeat once picked', () => {
    const { ops, last } = show(seq());
    fireEvent.click(screen.getByRole('button', { name: 'Play Animation' }));
    expect(ops.commit).toHaveBeenCalledWith(expect.any(Function), 'SequenceAnim');
    expect(last()(seq()).sequenceAnim).toBe('play');
  });
});
