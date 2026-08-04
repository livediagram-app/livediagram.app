import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeKind } from '@livediagram/diagram';

const trackMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...args: unknown[]) => trackMock(...args) }));

const { makeShapePatcher } = await import('./shape-patcher');

// The body three setters used to carry a copy of. Now that it is one function,
// its two quiet rules are worth pinning: they are invisible in a diff and both
// were unguarded while the code was duplicated.

function setup(selected: string[], matches: (kind: ShapeKind) => boolean) {
  const commits: Element[][] = [];
  const els: Element[] = [
    { ...createShape('rating', 0, 0), id: 'r1' },
    { ...createShape('pie-chart', 0, 0), id: 'p1' },
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
    // Both selected, but this setter is the rating's: the pie must be untouched
    // even though it is in the selection.
    const { patch, commits } = setup(['r1', 'p1'], (k) => k === 'rating');
    patch({ rating: 4 }, 'Rating');
    const out = commits[0]!;
    expect(out.find((e) => e.id === 'r1')).toMatchObject({ rating: 4 });
    expect(out.find((e) => e.id === 'p1')).not.toHaveProperty('rating');
  });

  it('does nothing at all when the selection is empty', () => {
    // No commit AND no telemetry: an interaction that touched nothing should
    // leave no trace, not an undo step and a dashboard row.
    trackMock.mockClear();
    const { patch, commits } = setup([], () => true);
    patch({ rating: 4 }, 'Rating');
    expect(commits).toHaveLength(0);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('reports the change once the patch lands', () => {
    trackMock.mockClear();
    const { patch } = setup(['r1'], (k) => k === 'rating');
    patch({ rating: 2 }, 'Rating');
    expect(trackMock).toHaveBeenCalledWith('Element', 'Changed', 'Rating');
  });
});
