import { describe, expect, it } from 'vitest';
import { rosterFrames, type RosterEntry } from './room-roster';
import type { ParticipantPresence } from './types';

const person = (id: string): ParticipantPresence => ({ id, name: id, color: '#000' });
const entry = (presence: ParticipantPresence | null): RosterEntry => ({
  ws: {} as WebSocket,
  presence,
  personTag: null,
});

describe('rosterFrames', () => {
  it('sends each socket everyone but itself, and nobody who has not said hello', () => {
    const a = entry(person('a'));
    const b = entry(person('b'));
    const quiet = entry(null);
    const frames = [...rosterFrames([a, b, quiet], [])];
    expect(frames.map((f) => f.participants.map((p) => p.id))).toEqual([['b'], ['a'], ['a', 'b']]);
  });

  // docs/specs/014-identity/profile-picture.md §2: pictures go to account sessions alone.
  it('sends Google pictures only to account sessions', () => {
    const picture = 'https://lh3.googleusercontent.com/a/ann';
    const ann = { ...entry({ ...person('ann'), picture }), account: true };
    const bea = { ...entry(person('bea')), account: true };
    const guest = entry(person('guest'));
    const frames = [...rosterFrames([ann, bea, guest], [])];
    const annSeenBy = (i: number) => frames[i]!.participants.find((p) => p.id === 'ann');
    expect(annSeenBy(1)?.picture).toBe(picture);
    expect(annSeenBy(2)).toEqual(person('ann'));
    expect(annSeenBy(2)).not.toHaveProperty('picture');
  });
});
