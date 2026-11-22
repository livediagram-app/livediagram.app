// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  noteSlashPick,
  readSlashPicks,
  recentIds,
  SLASH_RECENT_KEY,
  withPick,
  type SlashPicks,
} from './slash-recent';

// docs/specs/030-knowledgebase/page-surface.md "The slash menu", "Recent": the entries this person picks most, a
// pick weighing half a day later, kept in this browser only.
const DAY = 24 * 60 * 60 * 1000;
const known = () => true;

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('Recent', () => {
  it('ranks the entries picked most, the more recent first among equals, three at most', () => {
    let picks: SlashPicks = {};
    picks = withPick(picks, 'table', 0);
    picks = withPick(picks, 'table', 10);
    picks = withPick(picks, 'h2', 20);
    picks = withPick(picks, 'quote', 30);
    picks = withPick(picks, 'code', 40);
    expect(recentIds(picks, 50, known)).toEqual(['table', 'code', 'quote']);
    expect(recentIds(picks, 50, known, 5)).toEqual(['table', 'code', 'quote', 'h2']);
  });

  it('weighs a pick half a day later, so a fresh pick overtakes old habits', () => {
    let picks: SlashPicks = {};
    picks = withPick(picks, 'table', 0);
    picks = withPick(picks, 'table', 0);
    picks = withPick(picks, 'h2', 3 * DAY);
    // Two picks three days ago weigh 0.25: one fresh pick outweighs them.
    expect(recentIds(picks, 3 * DAY, known)[0]).toBe('h2');
    // A day on, the two picks weigh one: one more makes two.
    expect(withPick(picks, 'table', DAY).table!.weight).toBeCloseTo(2, 5);
  });

  it('shows only entries the menu still has', () => {
    const picks = withPick(withPick({}, 'sticky', 0), 'table', 0);
    expect(recentIds(picks, 0, (id) => id !== 'sticky')).toEqual(['table']);
    expect(recentIds({ odd: { weight: Number.NaN, at: 0 } }, 0, known)).toEqual([]);
  });

  it('keeps at most twelve entries', () => {
    let picks: SlashPicks = {};
    for (let i = 0; i < 20; i++) picks = withPick(picks, `e${i}`, i);
    expect(Object.keys(picks)).toHaveLength(12);
    expect(picks.e19).toBeDefined();
  });

  it('is kept in this browser and read back', () => {
    noteSlashPick('table', 5);
    noteSlashPick('table', 6);
    const picks = readSlashPicks();
    expect(Object.keys(picks)).toEqual(['table']);
    expect(picks.table!.at).toBe(6);
    const kept = JSON.parse(window.localStorage.getItem(SLASH_RECENT_KEY)!) as SlashPicks;
    expect(kept.table!.weight).toBeGreaterThan(1.9);
  });

  it('reads anything else kept there, or storage refused, as no picks', () => {
    window.localStorage.setItem(SLASH_RECENT_KEY, '[1,2]');
    expect(readSlashPicks()).toEqual({});
    window.localStorage.setItem(
      SLASH_RECENT_KEY,
      '{"a":{"weight":"x","at":1},"b":{"weight":1,"at":2},"c":null}',
    );
    expect(readSlashPicks()).toEqual({ b: { weight: 1, at: 2 } });
    window.localStorage.setItem(SLASH_RECENT_KEY, '{oops');
    expect(readSlashPicks()).toEqual({});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readSlashPicks()).toEqual({});
    expect(() => noteSlashPick('table')).not.toThrow();
  });
});
