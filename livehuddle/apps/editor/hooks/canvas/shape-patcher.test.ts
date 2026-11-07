import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeKind } from '@livehuddle/document';

const trackMock = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: Parameters<typeof trackMock>) => trackMock(...args),
}));

const { makeShapePatcher } = await import('./shape-patcher');

// The body several setters used to carry a copy of. Now that it is one function,
// its two quiet rules are worth pinning: they are invisible in a diff and both
// were unguarded while the code was duplicated.

function setup(selected: string[], matches: (kind: ShapeKind) => boolean) {
  const commits: Element[][] = [];
  const els: Element[] = [
    { ...createShape('room', 0, 0), id: 'r1' },
    { ...createShape('screen', 0, 0), id: 's1' },
  ];
  const patch = makeShapePatcher({
    currentSelectionIds: () => new Set(selected),
    commit: (fn) => commits.push(fn(els)),
    matches,
  });
  return { patch, commits, els };
}

describe('makeShapePatcher', () => {
  it('patches only the selected elements of its own kind', () => {
    // Both selected, but this setter is the room's: the screen must be untouched
    // even though it is in the selection.
    const { patch, commits } = setup(['r1', 's1'], (k) => k === 'room');
    patch({ roomDoor: 'n' }, 'Room');
    const out = commits[0]!;
    expect(out.find((e) => e.id === 'r1')).toMatchObject({ roomDoor: 'n' });
    expect(out.find((e) => e.id === 's1')).not.toHaveProperty('roomDoor');
  });

  it('does nothing at all when the selection is empty', () => {
    // No commit AND no telemetry: an interaction that touched nothing should
    // leave no trace, not an undo step and a dashboard row.
    trackMock.mockClear();
    const { patch, commits } = setup([], () => true);
    patch({ roomDoor: 'n' }, 'Room');
    expect(commits).toHaveLength(0);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('reports the change once the patch lands', () => {
    trackMock.mockClear();
    const { patch } = setup(['r1'], (k) => k === 'room');
    patch({ roomDoor: 'e' }, 'Room');
    expect(trackMock).toHaveBeenCalledWith('Element', 'Changed', 'Room');
  });
});
