import { describe, expect, it } from 'vitest';
import { TIMELINE_EVENT_TYPES } from '@livediagram/api-schema';
import { EVENT_GLYPH_PATHS } from './icons';

// A card shows its glyph twice, small in the reason line and large in
// the preview box when there is no snapshot, so two event types sharing
// a mark read as the same event at a glance (spec/138 §2). The compiler
// keeps the map exhaustive; this keeps it distinct.
describe('timeline event glyphs', () => {
  it('gives every event type its own mark', () => {
    const seen = new Map<string, string>();
    for (const type of TIMELINE_EVENT_TYPES) {
      const path = EVENT_GLYPH_PATHS[type] ?? `component:${type}`;
      const other = seen.get(path);
      expect(other, `${type} shares its glyph with ${other}`).toBeUndefined();
      seen.set(path, type);
    }
  });
});
