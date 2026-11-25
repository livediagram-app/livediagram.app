import { describe, expect, it } from 'vitest';
import { corridorDoorsNotice } from './corridor-doors-notice';

// docs/specs/009-elements/office.md "A Corridor's Doors move to its new walls" (Work Tracker 1453).
describe('corridorDoorsNotice', () => {
  it('says nothing when nothing was removed', () => {
    expect(corridorDoorsNotice({ doors: 0, windows: 0 })).toBeNull();
  });

  it('names what was removed, one or many, Doors and Windows', () => {
    expect(corridorDoorsNotice({ doors: 1, windows: 0 })).toBe(
      "1 Door didn't fit the new corridor's walls and was removed.",
    );
    expect(corridorDoorsNotice({ doors: 2, windows: 0 })).toBe(
      "2 Doors didn't fit the new corridor's walls and were removed.",
    );
    expect(corridorDoorsNotice({ doors: 0, windows: 1 })).toBe(
      "1 Window didn't fit the new corridor's walls and was removed.",
    );
    expect(corridorDoorsNotice({ doors: 1, windows: 1 })).toBe(
      "1 Door and 1 Window didn't fit the new corridor's walls and were removed.",
    );
  });
});
