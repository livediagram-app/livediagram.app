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
});

describe('Google pictures on the roster', () => {
  const PICTURE = 'https://lh3.googleusercontent.com/a/ada';
  it('sends a picture only to account sessions; a guest gets the roster without it', () => {
    const ada = { ...entry({ ...person('ada'), picture: PICTURE }), account: true };
    const bea = { ...entry(person('bea')), account: true };
    const guest = entry(person('guest'));
    const [, toBea, toGuest] = [...rosterFrames([ada, bea, guest], [])];
    expect(toBea!.participants.find((p) => p.id === 'ada')?.picture).toBe(PICTURE);
    const seen = toGuest!.participants.find((p) => p.id === 'ada')!;
    expect(seen).toEqual({ id: 'ada', name: 'ada', color: '#000' });
    expect(JSON.stringify(toGuest!.participants)).not.toContain('googleusercontent');
  });
});
