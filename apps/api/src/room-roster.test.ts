import { describe, expect, it } from 'vitest';
import { rosterFrames, type RosterEntry } from './room-roster';
import type { ParticipantPresence } from './types';

const person = (id: string, picture?: string): ParticipantPresence => ({
  id,
  name: id,
  color: '#000',
  ...(picture ? { picture } : {}),
});
const entry = (presence: ParticipantPresence | null, account = false): RosterEntry => ({
  ws: {} as WebSocket,
  presence,
  account,
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

  it('shows pictures to account sessions only', () => {
    const withPicture = entry(person('a', 'https://img/a.png'));
    const account = entry(person('b'), true);
    const guest = entry(person('c'));
    const [, toAccount, toGuest] = [...rosterFrames([withPicture, account, guest], [])];
    expect(toAccount!.participants[0]!.picture).toBe('https://img/a.png');
    expect(toGuest!.participants[0]!.picture).toBeUndefined();
  });
});
