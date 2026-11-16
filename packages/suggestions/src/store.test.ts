import { describe, expect, it } from 'vitest';
import { CANVAS_SUGGESTIONS_SCHEMA, suggestionStore } from './store';
import { mintSuggestionId } from './suggestion';
import { fakeSuggestionDb } from './test/fake-db';
import { el, suggestion, type El } from './test/fixtures';

describe('suggestionStore', () => {
  it('makes its table and index safely again', () => {
    expect(CANVAS_SUGGESTIONS_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS canvas_suggestions');
    expect(CANVAS_SUGGESTIONS_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS');
  });

  it('puts, lists a tab in order, updates in place and removes', async () => {
    const { db, rows } = fakeSuggestionDb();
    const store = suggestionStore<El>(db);
    const one = suggestion(
      'sg_bbbbbbbbbb',
      [{ kind: 'remove', id: 'a' }],
      { a: 'x' },
      { createdAt: 2 },
    );
    const two = suggestion('sg_aaaaaaaaaa', [{ kind: 'add', element: el('n'), at: 0 }], {
      n: null,
    });
    const other = { ...two, id: 'sg_cccccccccc', tabId: 't2' };
    await store.put(one);
    await store.put(two);
    await store.put(other);
    expect((await store.list('t1')).map((s) => s.id)).toEqual(['sg_aaaaaaaaaa', 'sg_bbbbbbbbbb']);
    await store.put({ ...one, conflict: ['a'] });
    expect((await store.list('t1'))[1]!.conflict).toEqual(['a']);
    await store.remove(['sg_aaaaaaaaaa', 'sg_cccccccccc']);
    expect([...rows.keys()]).toEqual(['sg_bbbbbbbbbb']);
  });

  it('skips a row it cannot read', async () => {
    const { db, rows } = fakeSuggestionDb();
    rows.set('x', { id: 'x', tab_id: 't1', created_at: 0, body: '{' });
    expect(await suggestionStore<El>(db).list('t1')).toEqual([]);
  });

  it('removes in chunks under the bound-parameter cap', async () => {
    const { db, statements } = fakeSuggestionDb();
    const ids = Array.from({ length: 120 }, () => mintSuggestionId());
    await suggestionStore<El>(db).remove(ids);
    expect(statements.map((s) => s.values.length)).toEqual([50, 50, 20]);
    await suggestionStore<El>(db).remove([]);
    expect(statements).toHaveLength(3);
  });
});
