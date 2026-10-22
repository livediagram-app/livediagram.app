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
