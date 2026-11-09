import { describe, expect, it } from 'vitest';
import { AVATAR_STATUS_IDS } from './wire';
import {
  AVATAR_CALL_STATUSES,
  AVATAR_STATUS_GROUPS,
  AVATAR_STATUSES,
  avatarStatusColour,
  avatarStatusLabel,
  avatarStatusLine,
  parseAvatarStatus,
} from './status';

// docs/specs/008-canvas/avatar-mode.md "Status"
describe('avatar status', () => {
  it('has the four statuses, in order', () => {
    expect(AVATAR_STATUSES.map((s) => s.label)).toEqual([
      'Available',
      'Focusing',
      'In a Meeting',
      'Away',
    ]);
    expect(avatarStatusLabel('focus')).toBe('Focusing');
  });

  it('reads a known status off the wire and nothing else', () => {
    expect(parseAvatarStatus('away')).toBe('away');
    for (const bad of ['sleeping', '', null, undefined, 3])
      expect(parseAvatarStatus(bad)).toBeNull();
  });
});

describe('avatar statuses and the wire', () => {
  it('names every status the wire names, and no other, with calls', () => {
    expect(AVATAR_CALL_STATUSES.map((s) => s.id).sort()).toEqual([...AVATAR_STATUS_IDS].sort());
  });

  it('reads every new status off the wire, and an unknown one as none (an older client, a newer token)', () => {
    for (const id of ['help', 'lunch', 'angry', 'celebrating', 'thinking', 'sick']) {
      expect(parseAvatarStatus(id)).toBe(id);
    }
    expect(parseAvatarStatus('grumpy')).toBeNull();
  });

  // docs/specs/012-collaboration/meeting-rooms-and-stage.md "Do Not Disturb": the calls' status, offered
  // only where there are calls, but read and drawn everywhere.
  it('keeps Do Not Disturb to the call list, and reads it everywhere', () => {
    expect(AVATAR_STATUSES.some((s) => s.id === 'dnd')).toBe(false);
    expect(AVATAR_CALL_STATUSES.some((s) => s.id === 'dnd')).toBe(true);
    expect(parseAvatarStatus('dnd')).toBe('dnd');
    expect(avatarStatusLabel('dnd')).toBe('Do Not Disturb');
    expect(avatarStatusColour('dnd')).toBe('#e11d48');
  });

  // docs/specs/009-elements/workday-pieces.md "Statuses a piece sets": On a Break and Busy, set by its seat
  // pieces and offered with calls, read and drawn everywhere.
  it('offers Busy after Away and On a Break after Out to Lunch with calls, and reads them everywhere', () => {
    const ids = AVATAR_CALL_STATUSES.map((s) => s.id);
    expect(ids.slice(ids.indexOf('away'), ids.indexOf('away') + 3)).toEqual([
      'away',
      'busy',
      'dnd',
    ]);
    expect(ids[ids.indexOf('lunch') + 1]).toBe('break');
    expect(AVATAR_STATUSES.some((s) => s.id === 'break' || s.id === 'busy')).toBe(false);
    expect(parseAvatarStatus('break')).toBe('break');
    expect(parseAvatarStatus('busy')).toBe('busy');
    expect(avatarStatusLabel('break')).toBe('On a Break');
    expect(avatarStatusLabel('busy')).toBe('Busy');
    expect(avatarStatusColour('break')).toBe('#3b82f6');
    expect(avatarStatusColour('busy')).toBe('#a16207');
  });
});

// Owner, 2026-11-06: more statuses like Angry, each with a signature on the character, in named groups.
describe('livehuddle status groups', () => {
  it('groups them as Availability, Activity and Mood, in the picker order', () => {
    expect(AVATAR_STATUS_GROUPS.map((g) => [g.name, g.statuses.map((s) => s.label)])).toEqual([
      ['Availability', ['Available', 'Need Help', 'Away', 'Busy', 'Do Not Disturb']],
      ['Activity', ['Focusing', 'In a Meeting', 'Out to Lunch', 'On a Break']],
      ['Mood', ['Angry', 'Celebrating', 'Thinking', 'Feeling Sick']],
    ]);
  });

  it('gives every status a Title Case name, a distinct dot and a short line', () => {
    const colours = AVATAR_CALL_STATUSES.map((s) => s.colour);
    expect(new Set(colours).size).toBe(colours.length);
    for (const s of AVATAR_CALL_STATUSES) {
      expect(s.label).toMatch(/^[A-Z]/);
      expect(avatarStatusLine(s.id)).toBe(s.line);
      // Two lines on a card two to a row: the card clamps at two.
      expect(s.line.length).toBeLessThanOrEqual(40);
      expect(s.line).not.toContain('\u2014');
    }
    expect(avatarStatusLabel('angry')).toBe('Angry');
    expect(avatarStatusColour('angry')).toBe('#f97316');
  });
});
