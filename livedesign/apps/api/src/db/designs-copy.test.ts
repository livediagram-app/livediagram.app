import { describe, expect, it } from 'vitest';
import { fakeD1 } from '../test-d1';
import { copyDesign, remapTabDataLinks } from './designs';

// copyDesign re-points a copied tab's internal links at the copy's own tabs.
describe('remapTabDataLinks', () => {
  const map = new Map([['t1', 'T1']]);

  it('rewrites tab and element links to the copy tab ids', () => {
    const data = JSON.stringify({
      elements: [
        { id: 'a', type: 'shape', link: { kind: 'tab', tabId: 't1' } },
        { id: 'b', type: 'shape', link: { kind: 'element', tabId: 't1', elementId: 'a' } },
        { id: 'c', type: 'shape', link: { kind: 'design', designId: 'd', name: 'D' } },
      ],
      background: 'dots',
    });
    const out = JSON.parse(remapTabDataLinks(data, map)) as {
      background: string;
      elements: { link: unknown }[];
    };
    expect(out.background).toBe('dots');
    expect(out.elements.map((e) => e.link)).toEqual([
      { kind: 'tab', tabId: 'T1' },
      { kind: 'element', tabId: 'T1', elementId: 'a' },
      { kind: 'design', designId: 'd', name: 'D' },
    ]);
  });

  // docs/specs/009-elements/tab-window.md: a copy's windows show the copy's tabs.
  it("re-points a Tab Window's tab, with no link anywhere on the tab", () => {
    const data = JSON.stringify({
      elements: [{ id: 'w', type: 'shape', shape: 'tab-window', windowTabId: 't1' }],
    });
    expect(JSON.parse(remapTabDataLinks(data, map))).toHaveProperty(
      ['elements', 0, 'windowTabId'],
      'T1',
    );
  });

  it('copies link-free and unparseable data byte for byte', () => {
    const plain = '{"elements":[{"id":"a","type":"shape"}]}';
    expect(remapTabDataLinks(plain, map)).toBe(plain);
    expect(remapTabDataLinks('{"tabId" nope', map)).toBe('{"tabId" nope');
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md: a tab-scoped visitor's copy holds their tab only.
describe('copyDesign tab filter', () => {
  const source = { id: 'd1', owner_id: 'o', name: 'Doc', shareable: 0, saved_at: 1, created_at: 1 };
  const answer = ({ sql }: { sql: string }) =>
    sql.includes('FROM design_tabs dt') ? { all: [] } : { first: source, all: [] };
  it('copies every tab by default and one tab when asked', async () => {
    const all = fakeD1(answer);
    await copyDesign(all.env, 'd1', 'd2', 'me', 'Copy');
    expect(all.one('SELECT t.id, t.name, dt.order_index, t.data').sql).not.toContain(
      'dt.tab_id = ?',
    );

    const one = fakeD1(answer);
    await copyDesign(one.env, 'd1', 'd2', 'me', 'Copy', 't2');
    const query = one.one('SELECT t.id, t.name, dt.order_index, t.data');
    expect(query.sql).toContain('dt.tab_id = ?');
    expect(query.bindings).toEqual(['d1', 't2']);
  });
});
