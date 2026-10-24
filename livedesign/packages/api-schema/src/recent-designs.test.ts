import { describe, expect, it } from 'vitest';
import {
  RECENT_DESIGNS_LIMIT,
  parseRecentDesigns,
  pickRecentDesigns,
  recentThumbPath,
  scalableSnapshotSvg,
  serializeRecentDesigns,
  svgBackgroundColor,
} from './recent-designs';

// docs/specs/019-marketing/returning-visitor.md, "The recent-designs snapshot".
const doc = (id: string, savedAt: number, extra: { empty?: boolean } = {}) => ({
  id,
  name: `Doc ${id}`,
  savedAt,
  empty: extra.empty ?? false,
  opensIn: 'pages' as const,
});

describe('pickRecentDesigns', () => {
  it('keeps the newest saves first, capped at the limit', () => {
    const docs = Array.from({ length: 9 }, (_, i) => doc(`d${i}`, i * 10));
    const picked = pickRecentDesigns(docs);
    expect(picked).toHaveLength(RECENT_DESIGNS_LIMIT);
    expect(picked.map((d) => d.id)).toEqual(['d8', 'd7', 'd6', 'd5', 'd4', 'd3']);
  });

  it('leaves out empty designs and those hidden from Recent', () => {
    const picked = pickRecentDesigns(
      [doc('a', 3), doc('b', 2, { empty: true }), doc('c', 1)],
      ['a'],
    );
    expect(picked.map((d) => d.id)).toEqual(['c']);
  });

  it('carries the mode it opens in', () => {
    expect(pickRecentDesigns([doc('a', 1)])[0]).toEqual({
      id: 'a',
      name: 'Doc a',
      savedAt: 1,
      mode: 'pages',
      teamName: null,
    });
  });

  it('carries the team of a team library design', () => {
    const picked = pickRecentDesigns([doc('own', 1), { ...doc('team', 2), teamName: 'Design' }]);
    expect(picked.map((d) => [d.id, d.teamName])).toEqual([
      ['team', 'Design'],
      ['own', null],
    ]);
  });
});

describe('parseRecentDesigns', () => {
  it('round-trips a serialized note', () => {
    const designs = pickRecentDesigns([doc('a', 2), doc('b', 1)]);
    expect(parseRecentDesigns(serializeRecentDesigns(designs))).toEqual(designs);
  });

  it('reads anything malformed as no designs', () => {
    expect(parseRecentDesigns(null)).toEqual([]);
    expect(parseRecentDesigns('not json')).toEqual([]);
    expect(parseRecentDesigns('{"v":2,"designs":[]}')).toEqual([]);
    expect(parseRecentDesigns('{"v":1,"designs":[{"id":1}]}')).toEqual([]);
  });

  it('reads a note written before teams as your own designs', () => {
    const raw = '{"v":1,"designs":[{"id":"a","name":"A","savedAt":1,"mode":"draw"}]}';
    expect(parseRecentDesigns(raw)[0]?.teamName).toBeNull();
  });

  it('round-trips a team name, and drops a malformed one to null', () => {
    const raw =
      '{"v":1,"designs":[{"id":"a","name":"A","savedAt":2,"teamName":"Design"},' +
      '{"id":"b","name":"B","savedAt":1,"teamName":42},{"id":"c","name":"C","savedAt":0,"teamName":""}]}';
    expect(parseRecentDesigns(raw).map((d) => d.teamName)).toEqual(['Design', null, null]);
  });

  it('reads a mode livediagram stored as Pages', () => {
    const raw = '{"v":1,"designs":[{"id":"a","name":"A","savedAt":1,"mode":"facilitate"}]}';
    expect(parseRecentDesigns(raw)[0]?.mode).toBe('pages');
  });

  it('drops an unknown mode to null', () => {
    const raw = '{"v":1,"designs":[{"id":"a","name":"A","savedAt":1,"mode":"bogus"}]}';
    expect(parseRecentDesigns(raw)[0]?.mode).toBeNull();
  });
});

describe('helpers', () => {
  it('keys a thumbnail by id and save time', () => {
    expect(recentThumbPath('a b', 5)).toBe('/__recent-thumbs/a%20b?v=5');
  });

  it('reads a snapshot background colour', () => {
    expect(svgBackgroundColor('<svg><rect x="0" fill="#fafafa"/></svg>')).toBe('#fafafa');
    expect(svgBackgroundColor('<svg></svg>')).toBeNull();
  });
});

describe('scalableSnapshotSvg', () => {
  it('drops the fixed size and keeps the viewBox', () => {
    expect(scalableSnapshotSvg('<svg viewBox="0 0 4 2" width="400" height="200"><g/></svg>')).toBe(
      '<svg viewBox="0 0 4 2"><g/></svg>',
    );
  });

  it('leaves the size of anything but the root svg alone', () => {
    const svg = '<svg width="4" height="2"><rect width="1" height="1"/></svg>';
    expect(scalableSnapshotSvg(svg)).toBe('<svg><rect width="1" height="1"/></svg>');
  });

  it('stays fast on hostile markup', () => {
    const t = performance.now();
    scalableSnapshotSvg('<svg' + ' '.repeat(100_000));
    svgBackgroundColor('<rect'.repeat(50_000));
    expect(performance.now() - t).toBeLessThan(200);
  });
});
