import { afterEach, describe, expect, it } from 'vitest';
import { getPaletteDragSnap, setPaletteDragSnap } from './palette-drag-preview';

afterEach(() => {
  setPaletteDragSnap(null);
});

describe('the alignment-snap channel', () => {
  it('publishes the offset the ghost draws at and the drop lands at', () => {
    setPaletteDragSnap({ dx: 4, dy: 2 });
    expect(getPaletteDragSnap()).toEqual({ dx: 4, dy: 2 });
  });

  it('ignores a re-resolved but identical offset, so the ghost stays still', () => {
    setPaletteDragSnap({ dx: 4, dy: 2 });
    const published = getPaletteDragSnap();
    setPaletteDragSnap({ dx: 4, dy: 2 });
    expect(getPaletteDragSnap()).toBe(published);
  });

  it('clears on the drag-end / escape / leave path', () => {
    setPaletteDragSnap({ dx: 4, dy: 2 });
    setPaletteDragSnap(null);
    expect(getPaletteDragSnap()).toBeNull();
  });
});
