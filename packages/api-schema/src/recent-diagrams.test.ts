import { describe, expect, it } from 'vitest';
import {
  RECENT_DIAGRAMS_KEY,
  RECENT_DIAGRAMS_LIMIT,
  RETURNING_BOOT_SCRIPT,
  parseRecentDiagrams,
  pickRecentDiagrams,
  recentThumbPath,
  scalableSnapshotSvg,
  serializeRecentDiagrams,
  svgBackgroundColor,
} from './recent-diagrams';

// docs/specs/019-marketing/returning-visitor.md, "The recent-diagrams snapshot".
const doc = (id: string, savedAt: number, extra: { empty?: boolean } = {}) => ({
  id,
  name: `Doc ${id}`,
  savedAt,
  empty: extra.empty ?? false,
  opensIn: 'diagram' as const,
});

describe('pickRecentDiagrams', () => {
  it('keeps the newest saves first, capped at the limit', () => {
    const docs = Array.from({ length: 9 }, (_, i) => doc(`d${i}`, i * 10));
    const picked = pickRecentDiagrams(docs);
    expect(picked).toHaveLength(RECENT_DIAGRAMS_LIMIT);
    expect(picked.map((d) => d.id)).toEqual(['d8', 'd7', 'd6', 'd5', 'd4', 'd3']);
  });

  it('leaves out empty documents and those hidden from Recent', () => {
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
      mode: 'diagram',
    });
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

  it('drops an unknown mode to null', () => {
    const raw = '{"v":1,"diagrams":[{"id":"a","name":"A","savedAt":1,"mode":"bogus"}]}';
    expect(parseRecentDiagrams(raw)[0]?.mode).toBeNull();
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

  it('boot script marks <html> only when the note holds a diagram', () => {
    const run = (value: string | null) => {
      const attrs: Record<string, string> = {};
      const localStorage = { getItem: (k: string) => (k === RECENT_DIAGRAMS_KEY ? value : null) };
      const document = {
        documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
      };
      new Function('localStorage', 'document', RETURNING_BOOT_SCRIPT)(localStorage, document);
      return 'data-returning' in attrs;
    };
    expect(run(serializeRecentDiagrams(pickRecentDiagrams([doc('a', 1)])))).toBe(true);
    expect(run(serializeRecentDiagrams([]))).toBe(false);
    expect(run(null)).toBe(false);
  });
});

describe('scalableSnapshotSvg', () => {
  it('drops the fixed size and keeps the viewBox', () => {
    expect(scalableSnapshotSvg('<svg viewBox="0 0 4 2" width="400" height="200"><g/></svg>')).toBe(
      '<svg viewBox="0 0 4 2"><g/></svg>',
    );
  });
});
