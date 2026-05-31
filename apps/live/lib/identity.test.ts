import { describe, expect, it } from 'vitest';
import {
  AWAY_AFTER_MS,
  OFFLINE_AFTER_MS,
  initialsOf,
  nextFreeColor,
  randomColor,
  randomName,
  statusFromIdleMs,
  statusLabel,
  statusRingColor,
  type ParticipantStatus,
} from './identity';

describe('statusFromIdleMs', () => {
  it('is online below the away threshold', () => {
    expect(statusFromIdleMs(0)).toBe('online');
    expect(statusFromIdleMs(AWAY_AFTER_MS - 1)).toBe('online');
  });

  it('flips to away exactly at the away threshold', () => {
    expect(statusFromIdleMs(AWAY_AFTER_MS)).toBe('away');
    expect(statusFromIdleMs(OFFLINE_AFTER_MS - 1)).toBe('away');
  });

  it('flips to offline exactly at the offline threshold', () => {
    expect(statusFromIdleMs(OFFLINE_AFTER_MS)).toBe('offline');
    expect(statusFromIdleMs(OFFLINE_AFTER_MS * 2)).toBe('offline');
  });
});

describe('initialsOf', () => {
  it('returns "?" for empty or whitespace-only names', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
  });

  it('takes the first two letters of a single-word name, uppercased', () => {
    expect(initialsOf('curious')).toBe('CU');
    expect(initialsOf('Fox')).toBe('FO');
  });

  it('takes first + last initials of a multi-word name', () => {
    expect(initialsOf('Curious Falcon')).toBe('CF');
    expect(initialsOf('one two three')).toBe('OT');
  });

  it('collapses extra whitespace between words', () => {
    expect(initialsOf('  Curious   Falcon  ')).toBe('CF');
  });

  it('handles a one-letter single word without overrunning', () => {
    expect(initialsOf('x')).toBe('X');
  });
});

describe('nextFreeColor', () => {
  it('returns the preferred colour when it is still free', () => {
    expect(nextFreeColor(new Set(), '#0ea5e9')).toBe('#0ea5e9');
  });

  it('skips the preferred colour when already taken and picks the first free palette slot', () => {
    // '#0ea5e9' is the first palette colour; taking it forces the next free one.
    const result = nextFreeColor(new Set(['#0ea5e9']), '#0ea5e9');
    expect(result).not.toBe('#0ea5e9');
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('walks the palette in order when no preference is given', () => {
    // First palette colour free → returned first.
    expect(nextFreeColor(new Set())).toBe('#0ea5e9');
  });

  it('falls back to the preferred colour when the whole palette is taken', () => {
    // Ten palette colours; take all but feed an off-palette preferred.
    const all = new Set([
      '#0ea5e9',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
      '#14b8a6',
      '#f97316',
      '#6366f1',
      '#84cc16',
    ]);
    expect(nextFreeColor(all, '#123456')).toBe('#123456');
  });

  it('falls back to the first palette colour when palette is full and no preference', () => {
    const all = new Set([
      '#0ea5e9',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
      '#14b8a6',
      '#f97316',
      '#6366f1',
      '#84cc16',
    ]);
    expect(nextFreeColor(all)).toBe('#0ea5e9');
  });
});

describe('statusRingColor / statusLabel', () => {
  const cases: ParticipantStatus[] = ['online', 'away', 'offline'];

  it('returns a distinct hex ring colour for each status', () => {
    const colors = cases.map(statusRingColor);
    expect(new Set(colors).size).toBe(cases.length);
    colors.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
  });

  it('returns a human label per status', () => {
    expect(statusLabel('online')).toBe('Online');
    expect(statusLabel('away')).toBe('Away');
    expect(statusLabel('offline')).toBe('Offline');
  });
});

describe('randomName / randomColor', () => {
  it('randomName is two capitalised words', () => {
    for (let i = 0; i < 20; i++) {
      expect(randomName()).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    }
  });

  it('randomColor always returns a palette hex', () => {
    for (let i = 0; i < 20; i++) {
      expect(randomColor()).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
