import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_ACCEPT_ATTR,
  IMAGE_TYPES_LABEL,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
} from './image-limits';

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

describe('ACCEPTED_IMAGE_TYPES', () => {
  it('never admits SVG', () => {
    // SVG is XML and can carry an inline <script>. The api sniffs magic
    // numbers to stop a declared content-type smuggling one past this list;
    // adding it here would open the hole from the other side.
    expect(ACCEPTED_IMAGE_TYPES).not.toContain('image/svg+xml');
  });

  it('lists only image MIME types', () => {
    for (const t of ACCEPTED_IMAGE_TYPES) expect(t.startsWith('image/')).toBe(true);
  });

  it('derives the accept attribute and the prose list from the one tuple', () => {
    // The point of deriving both: three hand-typed copies of "PNG, JPEG,
    // WebP, or GIF" is what this replaced, and they'd have drifted the first
    // time a format was added.
    expect(IMAGE_ACCEPT_ATTR.split(',')).toEqual([...ACCEPTED_IMAGE_TYPES]);
    expect(IMAGE_TYPES_LABEL).toBe('PNG, JPEG, WebP, or GIF');
    // One entry per accepted type: N-1 separators, so N-1 commas.
    expect(IMAGE_TYPES_LABEL.split(',').length).toBe(ACCEPTED_IMAGE_TYPES.length);
  });
});
