import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { remapTabDataLinks } from '../plan-room/plan-content';
import { copyProject } from './projects';
import { upsertTab } from './tabs';

// copyProject re-points a copied tab's internal links at the copy's own tabs.
describe('remapTabDataLinks', () => {
  const map = new Map([['t1', 'T1']]);

  it('rewrites tab and element links to the copy tab ids', () => {
    const data = JSON.stringify({
      elements: [
        { id: 'a', type: 'shape', link: { kind: 'tab', tabId: 't1' } },
        { id: 'b', type: 'shape', link: { kind: 'element', tabId: 't1', elementId: 'a' } },
        { id: 'c', type: 'shape', link: { kind: 'project', projectId: 'd', name: 'D' } },
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
      { kind: 'project', projectId: 'd', name: 'D' },
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
describe('copyProject tab filter', () => {
  async function source() {
    const db = sqliteD1();
    db.sql
      .prepare(
        "INSERT INTO projects (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d1', 'o', 'Doc', 0, 1, 1)",
      )
      .run();
    await upsertTab(db.env, 'd1', { id: 't1', name: 'One', elements: [] }, 0);
    await upsertTab(db.env, 'd1', { id: 't2', name: 'Two', elements: [] }, 1);
    return db;
  }

  it('copies every tab by default and one tab when asked', async () => {
    const all = await source();
    const copy = await copyProject(all.env, 'd1', 'd2', 'me', 'Copy');
    expect(copy?.tabs.map((t) => t.name)).toEqual(['One', 'Two']);
    // Fresh tab ids: the copy's tabs are its own.
    expect(copy?.tabs.some((t) => t.id === 't1' || t.id === 't2')).toBe(false);

    const one = await source();
    const scoped = await copyProject(one.env, 'd1', 'd2', 'me', 'Copy', 't2');
    expect(scoped?.tabs.map((t) => t.name)).toEqual(['Two']);
  });
});
