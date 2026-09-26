import { describe, expect, it } from 'vitest';
import { READ_MIN_EDGE_PX, tooSmallToRead } from './floor';

// A note too small in the photo to read is not asked about (spec/139 Phase
// 9): below the floor the model invents far more than it reads. The note is
// left unread, which the unread tip rightly blames on the photo.
describe('tooSmallToRead', () => {
  it('asks about a crop at the floor or above', () => {
    expect(tooSmallToRead(READ_MIN_EDGE_PX, READ_MIN_EDGE_PX)).toBe(false);
    expect(tooSmallToRead(400, 300)).toBe(false);
  });

  it('skips a crop whose SHORT edge is under the floor', () => {
    expect(tooSmallToRead(READ_MIN_EDGE_PX - 1, 400)).toBe(true);
    expect(tooSmallToRead(400, READ_MIN_EDGE_PX - 1)).toBe(true);
    expect(tooSmallToRead(25, 25)).toBe(true);
  });
});
