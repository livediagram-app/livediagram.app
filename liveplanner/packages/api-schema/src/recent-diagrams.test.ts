import { describe, expect, it } from 'vitest';
import {
  RECENT_DIAGRAMS_LIMIT,
  parseRecentDiagrams,
  pickRecentDiagrams,
  recentThumbPath,
  serializeRecentDiagrams,
} from './recent-diagrams';

// docs/specs/019-marketing/returning-visitor.md, "The recent-diagrams snapshot".
const doc = (id: string, savedAt: number, extra: { empty?: boolean } = {}) => ({
  id,
  name: `Doc ${id}`,
  savedAt,
  empty: extra.empty ?? false,
  opensIn: 'plan' as const,
});

describe('pickRecentDiagrams', () => {
  it('keeps the newest saves first, capped at the limit', () => {
    const docs = Array.from({ length: 9 }, (_, i) => doc(`d${i}`, i * 10));
    const picked = pickRecentDiagrams(docs);
    expect(picked).toHaveLength(RECENT_DIAGRAMS_LIMIT);
    expect(picked.map((d) => d.id)).toEqual(['d8', 'd7', 'd6', 'd5', 'd4', 'd3']);
  });

  it('leaves out empty projects and those hidden from Recent', () => {
    const picked = pickRecentDiagrams(
      [doc('a', 3), doc('b', 2, { empty: true }), doc('c', 1)],
      ['a'],
    );
    expect(picked.map((d) => d.id)).toEqual(['c']);
  });

  it('carries the mode it opens in', () => {
    expect(pickRecentDiagrams([doc('a', 1)])[0]).toEqual({
      id: 'a',
      name: 'Doc a',
      savedAt: 1,
      mode: 'plan',
      teamName: null,
    });
  });

  it('carries the team of a team library project', () => {
    const picked = pickRecentDiagrams([doc('own', 1), { ...doc('team', 2), teamName: 'Design' }]);
    expect(picked.map((d) => [d.id, d.teamName])).toEqual([
      ['team', 'Design'],
      ['own', null],
    ]);
  });
});

describe('parseRecentDiagrams', () => {
  it('round-trips a serialized note', () => {
    const diagrams = pickRecentDiagrams([doc('a', 2), doc('b', 1)]);
    expect(parseRecentDiagrams(serializeRecentDiagrams(diagrams))).toEqual(diagrams);
  });

  it('reads anything malformed as no diagrams', () => {
    expect(parseRecentDiagrams(null)).toEqual([]);
    expect(parseRecentDiagrams('not json')).toEqual([]);
    expect(parseRecentDiagrams('{"v":2,"diagrams":[]}')).toEqual([]);
    expect(parseRecentDiagrams('{"v":1,"diagrams":[{"id":1}]}')).toEqual([]);
  });

  it('reads a note written before teams as your own diagrams', () => {
    const raw = '{"v":1,"diagrams":[{"id":"a","name":"A","savedAt":1,"mode":"draw"}]}';
    expect(parseRecentDiagrams(raw)[0]?.teamName).toBeNull();
  });

  it('round-trips a team name, and drops a malformed one to null', () => {
    const raw =
      '{"v":1,"diagrams":[{"id":"a","name":"A","savedAt":2,"teamName":"Design"},' +
      '{"id":"b","name":"B","savedAt":1,"teamName":42},{"id":"c","name":"C","savedAt":0,"teamName":""}]}';
    expect(parseRecentDiagrams(raw).map((d) => d.teamName)).toEqual(['Design', null, null]);
  });

  it('drops an unknown mode to null', () => {
    const raw = '{"v":1,"diagrams":[{"id":"a","name":"A","savedAt":1,"mode":"bogus"}]}';
    expect(parseRecentDiagrams(raw)[0]?.mode).toBeNull();
  });
});

describe('helpers', () => {
  it('keys a thumbnail by id and save time', () => {
    expect(recentThumbPath('a b', 5)).toBe('/__recent-thumbs/a%20b?v=5');
  });
});
