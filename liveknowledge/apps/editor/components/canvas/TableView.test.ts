import { describe, expect, it } from 'vitest';
import { gridTrackTemplate } from '@/components/canvas/TableView';

// Column/row track sizing for the table element: pinned widths/heights
// (set by dragging a divider) render as explicit px; the rest stay
// `minmax(0, 1fr)` so they share the remaining space evenly.
describe('gridTrackTemplate', () => {
  it('makes every track flexible when no sizes are pinned', () => {
    expect(gridTrackTemplate(3)).toBe('minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)');
    expect(gridTrackTemplate(2, undefined)).toBe('minmax(0, 1fr) minmax(0, 1fr)');
  });

  it('pins explicit px tracks and leaves nulls flexible', () => {
    expect(gridTrackTemplate(3, [120, null, 80])).toBe('120px minmax(0, 1fr) 80px');
  });

  it('treats a short sizes array as flexible past its end', () => {
    expect(gridTrackTemplate(3, [120])).toBe('120px minmax(0, 1fr) minmax(0, 1fr)');
  });

  it('ignores sizes beyond the track count', () => {
    expect(gridTrackTemplate(1, [50, 60, 70])).toBe('50px');
  });

  it('returns an empty string for zero tracks', () => {
    expect(gridTrackTemplate(0)).toBe('');
  });
});
