import { describe, expect, it } from 'vitest';
import { createRoomReview, type ReviewSession } from './room-review';
import type { StoredReview } from './review';

type Ws = { id: string };

function room(stored: Partial<StoredReview> | null) {
  let text: string | null = stored
    ? JSON.stringify({ links: [], people: [], agents: false, seen: [], pins: [], ...stored })
    : null;
  const sessions = new Map<Ws, ReviewSession | null>();
  const told: [string, boolean][] = [];
  let writes = 0;
  const review = createRoomReview<Ws>({
    read: () => text,
    write: (t) => {
      writes += 1;
      text = t;
    },
    sockets: () => sessions.keys(),
    sessionOf: (ws) => sessions.get(ws) ?? null,
    tell: (ws, on) => told.push([ws.id, on]),
  });
  return {
    review,
    sessions,
    told,
    writes: () => writes,
    stored: () => JSON.parse(text ?? 'null') as StoredReview | null,
    setText: (t: string) => {
      text = t;
    },
  };
}

const participant = (over: Partial<ReviewSession> = {}): ReviewSession => ({
  role: 'participate',
  collabKey: 'k1',
  presenceKey: 'k1',
  shareCode: 'code1',
  name: 'Ana',
  ...over,
});

describe('createRoomReview', () => {
  it('puts a Participant through a Suggest Only link on Suggest Only, by its key', () => {
    const r = room({ links: ['code1'] });
    expect(r.review.suggestByOf(participant())).toBe('k1');
    expect(
      r.review.suggestByOf(participant({ shareCode: 'other', collabKey: null, presenceKey: null })),
    ).toBeNull();
    expect(r.review.suggestByOf(participant({ collabKey: null, presenceKey: null }))).toBe(
      '\u0000',
    );
    expect(r.review.suggestByOf(participant({ collabKey: null, presenceKey: 'p9' }))).toBe('p9');
    expect(r.review.suggestByOf(participant({ role: 'edit' }))).toBeNull();
  });

  it('notes who joins, pins a verified key to its link, and tells the socket', () => {
    const r = room({ links: ['code1'] });
    const ws = { id: 'w1' };
    r.review.joined(ws, participant());
    expect(r.stored()!.seen.map((s) => s.key)).toEqual(['k1']);
    expect(r.stored()!.pins.map((p) => [p.key, p.code])).toEqual([['k1', 'code1']]);
    expect(r.told).toEqual([['w1', true]]);
    // Joining again changes nothing stored but the time, and still tells.
    const before = r.writes();
    r.review.joined(ws, participant());
    r.review.joined(ws, participant({ collabKey: null, presenceKey: null }));
    expect(r.writes()).toBe(before);
    r.told.splice(1, 1);
    expect(r.told[1]).toEqual(['w1', true]);
  });

  it('pins nothing for a key the client named, and skips an Editor', () => {
    const r = room(null);
    r.review.joined({ id: 'w' }, participant({ collabKey: null, presenceKey: 'p2' }));
    expect(r.stored()!.pins).toEqual([]);
    expect(r.told).toEqual([['w', false]]);
    r.review.joined({ id: 'v' }, participant({ collabKey: 'k3', shareCode: null }));
    expect(r.stored()!.pins).toEqual([]);
    r.told.length = 1;
    r.review.joined({ id: 'e' }, participant({ role: 'edit' }));
    expect(r.told).toHaveLength(1);
  });

  it('reads again on a change and tells every Participant', () => {
    const r = room(null);
    const a = { id: 'a' };
    const e = { id: 'e' };
    const gone = { id: 'gone' };
    r.sessions.set(a, participant());
    r.sessions.set(e, participant({ role: 'edit' }));
    r.sessions.set(gone, null);
    expect(r.review.review().links).toEqual([]);
    r.setText(JSON.stringify({ links: ['code1'], people: [], agents: false, seen: [], pins: [] }));
    expect(r.review.review().links).toEqual([]);
    r.review.changed();
    expect(r.review.review().links).toEqual(['code1']);
    expect(r.told).toEqual([['a', true]]);
  });
});
