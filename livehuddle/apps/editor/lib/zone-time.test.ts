import { describe, expect, it } from 'vitest';
import { isClockZone } from '@livehuddle/document';
import { typedClockZone, zoneTime } from './zone-time';

// docs/specs/009-elements/social-pieces.md "World Clock": a zone typed in the menu is stored by the browser's own name
// for it, with the label its city suggests.

describe('typedClockZone', () => {
  it('stores a zone typed in any case by its proper name, and labels it from that', () => {
    // Typed in lower case, the clock was labelled "london" and "new york" on every screen.
    expect(typedClockZone('europe/london')).toEqual({ zone: 'Europe/London', label: 'London' });
    expect(typedClockZone('  america/new york ')).toEqual({
      zone: 'America/New_York',
      label: 'New York',
    });
    expect(typedClockZone('utc')).toEqual({ zone: 'UTC', label: 'UTC' });
  });

  it('keeps a zone already named properly', () => {
    expect(typedClockZone('Asia/Tokyo')).toEqual({ zone: 'Asia/Tokyo', label: 'Tokyo' });
    expect(typedClockZone('Etc/GMT+5')).toEqual({ zone: 'Etc/GMT+5', label: 'GMT+5' });
  });

  it('refuses a zone this browser does not know, and an empty field', () => {
    expect(typedClockZone('Mars/Olympus_Mons')).toBeNull();
    expect(typedClockZone('   ')).toBeNull();
    expect(typedClockZone('<b>')).toBeNull();
  });

  it('answers a zone the stored check takes and the face can read', () => {
    const z = typedClockZone('australia/sydney')!;
    expect(isClockZone(z)).toBe(true);
    expect(zoneTime(z.zone, Date.UTC(2026, 0, 1, 0, 0))?.hour).toBe(11);
  });
});
