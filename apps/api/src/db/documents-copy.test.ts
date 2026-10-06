import { describe, expect, it } from 'vitest';
import { fakeD1 } from '../test-d1';
import { copyDocument, remapTabDataLinks } from './documents';

// copyDocument re-points a copied tab's internal links at the copy's own tabs.
describe('remapTabDataLinks', () => {
  const map = new Map([['t1', 'T1']]);

  it('rewrites tab and element links to the copy tab ids', () => {
    const data = JSON.stringify({
      elements: [
        { id: 'a', type: 'shape', link: { kind: 'tab', tabId: 't1' } },
        { id: 'b', type: 'shape', link: { kind: 'element', tabId: 't1', elementId: 'a' } },
        { id: 'c', type: 'shape', link: { kind: 'document', documentId: 'd', name: 'D' } },
      ],
      background: 'dots',
    });
    const out = JSON.parse(remapTabDataLinks(data, map));
    expect(out.background).toBe('dots');
    expect(out.elements.map((e: { link: unknown }) => e.link)).toEqual([
      { kind: 'tab', tabId: 'T1' },
      { kind: 'element', tabId: 'T1', elementId: 'a' },
      { kind: 'document', documentId: 'd', name: 'D' },
    ]);
  });

  it('copies link-free and unparseable data byte for byte', () => {
    const plain = '{"elements":[{"id":"a","type":"shape"}]}';
    expect(remapTabDataLinks(plain, map)).toBe(plain);
    expect(remapTabDataLinks('{"tabId" nope', map)).toBe('{"tabId" nope');
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md: a tab-scoped visitor's copy holds their tab only.
describe('copyDocument tab filter', () => {
  const source = { id: 'd1', owner_id: 'o', name: 'Doc', shareable: 0, saved_at: 1, created_at: 1 };
  const answer = ({ sql }: { sql: string }) =>
    sql.includes('FROM document_tabs dt') ? { all: [] } : { first: source, all: [] };
  it('copies every tab by default and one tab when asked', async () => {
    const all = fakeD1(answer);
    await copyDocument(all.env, 'd1', 'd2', 'me', 'Copy');
    expect(all.one('SELECT t.id, t.name, dt.order_index, t.data').sql).not.toContain(
      'dt.tab_id = ?',
    );

    const one = fakeD1(answer);
    await copyDocument(one.env, 'd1', 'd2', 'me', 'Copy', 't2');
    const query = one.one('SELECT t.id, t.name, dt.order_index, t.data');
    expect(query.sql).toContain('dt.tab_id = ?');
    expect(query.bindings).toEqual(['d1', 't2']);
  });
});

// A Community copy hands the redaction on to the item store (docs/specs/025-community/community.md).
describe('copyDocument items', () => {
  const source = { id: 'd1', owner_id: 'o', name: 'Doc', shareable: 0, saved_at: 1, created_at: 1 };
  const answer = ({ sql }: { sql: string }) =>
    sql.includes('FROM document_tabs dt') ? { all: [] } : { first: source, all: [] };

  it('copies items without their people only for a Community copy', async () => {
    const community = fakeD1(answer);
    await copyDocument(community.env, 'd1', 'd2', 'me', 'Copy', null, true);
    expect(community.one('INSERT INTO items').sql).toContain('json_remove');

    const plain = fakeD1(answer);
    await copyDocument(plain.env, 'd1', 'd2', 'me', 'Copy');
    expect(plain.one('INSERT INTO items').sql).not.toContain('json_remove');
  });
});
