import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, MAX_IMAGE_MB } from './image-limits';

// This number is written down in four places that a reader will believe: the
// api's enforcement, the editor's pre-upload gate, spec/19, and the help
// article. The first two now import it. The other two are prose, so they get
// checked in apps/help, which already owns documentation correctness and has
// the Node types to read them; this package is runtime-agnostic and keeps to
// the number itself.
//
// The direction that hurts is the client being LOOSER than the server: the
// picker approves a file, the user waits out the upload, and it ends in a 413.
// Sharing the constant removes that failure mode entirely.

describe('MAX_IMAGE_BYTES', () => {
  it('is a whole number of MB, since every message about it says "MB"', () => {
    expect(Number.isInteger(MAX_IMAGE_MB)).toBe(true);
    expect(MAX_IMAGE_MB * 1024 * 1024).toBe(MAX_IMAGE_BYTES);
  });

  it('stays under the Workers request-body ceiling spec/19 relies on', () => {
    // spec/19 justifies the cap partly by sitting "well below the Workers
    // request-body limit (100 MB)". Raising it past that would make the
    // documented limit unreachable at the edge, before any of our code runs.
    expect(MAX_IMAGE_BYTES).toBeLessThan(100 * 1024 * 1024);
  });
});
