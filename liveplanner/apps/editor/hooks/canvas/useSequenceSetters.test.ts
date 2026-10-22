// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createShape, type Element, type ShapeElement } from '@liveplanner/project';

const trackMock = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: Parameters<typeof trackMock>) => trackMock(...args),
}));

const { useSequenceSetters } = await import('./useSequenceSetters');

// The Sequence dialog's writes (docs/specs/009-elements/sequence-diagram.md "The Sequence dialog"): one commit each,
// on the diagram named, never another element.
function setup() {
  const commits: Element[][] = [];
  const els: Element[] = [
    { ...createShape('sequence', 0, 0), id: 'q' },
    { ...createShape('square', 0, 0), id: 'b' },
  ];
  const { result } = renderHook(() =>
    useSequenceSetters({ commit: (fn) => commits.push(fn(els)) }),
  );
  const seq = (i = 0) => commits[i]!.find((e) => e.id === 'q') as ShapeElement;
  return { s: result.current, commits, seq, els };
}

describe('useSequenceSetters', () => {
  it('stores the rows on the diagram it names, bounded, as one commit', () => {
    trackMock.mockClear();
    const { s, seq, commits, els } = setup();
    s.setSequenceRows(
      'q',
      {
        participants: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        messages: [
          { from: 'a', to: 'b', label: 'hi', kind: 'call' },
          { from: 'a', to: 'gone', label: 'lost', kind: 'call' },
        ],
      },
      'SequenceText',
    );
    expect(commits).toHaveLength(1);
    expect(seq().sequenceMessages).toEqual([{ from: 'a', to: 'b', label: 'hi', kind: 'call' }]);
    expect(commits[0]!.find((e) => e.id === 'b')).toBe(els[1]);
    expect(trackMock).toHaveBeenCalledWith('Element', 'Changed', 'SequenceText');
  });

  it('turns Numbered on and off', () => {
    trackMock.mockClear();
    const { s, seq } = setup();
    s.setSequenceNumbered('q', true);
    expect(seq().sequenceNumbered).toBe(true);
    s.setSequenceNumbered('q', false);
    expect('sequenceNumbered' in seq(1)).toBe(false);
    expect(trackMock).toHaveBeenCalledWith('Element', 'Changed', 'SequenceNumbered');
  });
});
