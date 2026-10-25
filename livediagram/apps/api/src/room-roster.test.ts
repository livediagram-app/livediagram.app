import { describe, expect, it } from 'vitest';
import { rosterFrames, type RosterEntry } from './room-roster';
import type { ParticipantPresence } from './types';

const person = (id: string): ParticipantPresence => ({ id, name: id, color: '#000' });
const entry = (presence: ParticipantPresence | null): RosterEntry => ({
  ws: {} as WebSocket,
  presence,
  personTag: null,
});

describe('rosterFrames pictures', () => {
  // liveworkspace/docs/accounts.md "Profile pictures": only an account session is sent others' pictures.
  it('strips pictures from the roster a guest or link visitor is sent, and keeps them for an account', () => {
    const ada = {
      ...entry({ ...person('ada'), picture: 'https://lh3.googleusercontent.com/a/ada=s96-c' }),
      account: true,
    };
    const bob = { ...entry(person('bob')), account: true };
    const guest = entry(person('guest'));
    const frames = [...rosterFrames([ada, bob, guest], [])];
    const sent = (i: number) => frames[i]!.participants.find((p) => p.id === 'ada');
    expect(sent(1)?.picture).toBe('https://lh3.googleusercontent.com/a/ada=s96-c');
    expect(sent(2)).toBeDefined();
    expect(sent(2)).not.toHaveProperty('picture');
  });
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
