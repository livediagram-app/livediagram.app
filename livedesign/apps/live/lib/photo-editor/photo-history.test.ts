import { describe, expect, it } from 'vitest';
import { PHOTO_HISTORY_STEPS } from '@livedesign/photo-engine';
import { PhotoHistory } from './photo-history';

describe('PhotoHistory', () => {
  it('lists the edits and finds the steps to any of them', () => {
    const h = new PhotoHistory();
    let heard = 0;
    h.subscribe(() => heard++);
    h.record('Brush', 'p', 1);
    h.record('Levels', 'p', 2);
    h.record('New Layer', 'p', 3);
    expect(h.entries.map((e) => e.label)).toEqual(['Brush', 'Levels', 'New Layer']);
    expect(heard).toBe(3);
    const [brush, , layer] = h.entries;
    expect(PhotoHistory.stepsTo(brush!, 3)).toBe(-2);
    expect(PhotoHistory.undone(layer!, 1)).toBe(true);
    expect(PhotoHistory.stepsTo(layer!, 1)).toBe(2);
  });

  it('drops the undone steps when a new edit is made there', () => {
    const h = new PhotoHistory();
    h.record('A', 'p', 1);
    h.record('B', 'p', 2);
    h.record('C', 'p', 3);
    // Undone back to A (depth 1), then a new edit.
    h.record('D', 'p', 2);
    expect(h.entries.map((e) => e.label)).toEqual(['A', 'D']);
  });

  it('keeps the last fifty', () => {
    const h = new PhotoHistory();
    for (let i = 1; i <= PHOTO_HISTORY_STEPS + 5; i++) h.record(`E${i}`, 'p', i);
    expect(h.entries).toHaveLength(PHOTO_HISTORY_STEPS);
    expect(h.entries[0]!.label).toBe('E6');
    h.drop(PHOTO_HISTORY_STEPS + 5);
    expect(h.entries.at(-1)!.label).toBe(`E${PHOTO_HISTORY_STEPS + 4}`);
    h.drop(999);
    h.clear();
    expect(h.entries).toEqual([]);
  });
});
