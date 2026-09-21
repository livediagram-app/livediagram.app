import { describe, expect, it } from 'vitest';
import { truthFrom } from './truth';

// Turning a corrected review into labels. The review holds boxes in the
// WORKING image's pixels; a label is a fraction of the image, so the same
// labels score a detector run at any working size.
describe('truthFrom', () => {
  const size = { width: 1000, height: 500 };

  it('writes every box as a fraction of the image', () => {
    const truth = truthFrom('20260920_201646.jpg', size, [
      { x: 250, y: 100, w: 50, h: 50, kind: 'domain-event' },
    ]);
    expect(truth.notes).toEqual([{ x: 0.25, y: 0.2, w: 0.05, h: 0.1, kind: 'domain-event' }]);
  });

  it('names the file by its stem, so it sits next to the photo it describes', () => {
    expect(truthFrom('20260920_201646.jpg', size, []).photo).toBe('20260920_201646');
    expect(truthFrom('wall.HEIC', size, []).photo).toBe('wall');
    expect(truthFrom('no-extension', size, []).photo).toBe('no-extension');
  });

  it('records the size it was labelled at, for anyone checking the labels later', () => {
    expect(truthFrom('a.jpg', size, []).labelledOn).toEqual({ width: 1000, height: 500 });
  });

  it('rounds to a sane number of places, because a label is read off by eye', () => {
    const truth = truthFrom('a.jpg', size, [{ x: 333, y: 111, w: 7, h: 9, kind: 'command' }]);
    expect(truth.notes[0]).toEqual({ x: 0.333, y: 0.222, w: 0.007, h: 0.018, kind: 'command' });
  });

  it('orders the notes down the wall and across it, so two labellings compare', () => {
    const truth = truthFrom('a.jpg', size, [
      { x: 500, y: 300, w: 50, h: 50, kind: 'command' },
      { x: 100, y: 300, w: 50, h: 50, kind: 'command' },
      { x: 900, y: 10, w: 50, h: 50, kind: 'command' },
    ]);
    expect(truth.notes.map((n) => [n.x, n.y])).toEqual([
      [0.9, 0.02],
      [0.1, 0.6],
      [0.5, 0.6],
    ]);
  });

  it('refuses an image with no size, rather than writing Infinity into a label', () => {
    expect(() => truthFrom('a.jpg', { width: 0, height: 500 }, [])).toThrow(/size/i);
  });
});
