import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { getDocument, getTab } from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { asUser } from './test-route-context';
import { compileSeededTabs } from './document-seed';

// A create's seeded tabs given as a template (docs/specs/015-api/api.md): compiled by
// applyReplace before anything is written, the intent derived from the first, a refusal naming the tab.

let db: SqliteD1;

function create(tabs: unknown[], extra: Record<string, unknown> = {}) {
  return handleDocuments(
    makeTestRouteContext('POST', '/api/documents', {
      env: db.env,
      ...asUser('user_alice'),
      body: { id: 'd1', name: 'Shop', tabs, ...extra },
    }),
  );
}

beforeEach(() => {
  db = sqliteD1();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('seeded tabs compiled on create', () => {
  it('records the CLI as the source of a seeded create', async () => {
    const res = await create([{ id: 't1', name: 'Deck', template: 'blank-slide-deck' }], {
      source: 'cli',
    });
    expect(res.status).toBe(201);
    expect((await getDocument(db.env, 'd1'))?.source).toBe('cli');
  });

  it('stores a graph or Mermaid tab as given, compiling nothing', async () => {
    // The graph and Mermaid builders went with the diagram kinds: such a tab is no seed source now.
    const tabs = [{ id: 'b', name: 'B', graph: { nodes: [] }, mermaid: 'graph TD' }];
    expect(compileSeededTabs(tabs, 'd1')).toEqual({ tabs, intent: null });
  });

  it('builds a template tab and derives the intent from it when none is given', async () => {
    expect((await create([{ id: 't1', name: 'Deck', template: 'blank-slide-deck' }])).status).toBe(
      201,
    );
    expect((await getTab(db.env, 'd1', 't1'))?.pages?.length).toBeGreaterThan(0);
    expect(
      compileSeededTabs([{ id: 't1', name: 'Deck', template: 'blank-slide-deck' }], 'd1'),
    ).toMatchObject({ intent: { mode: 'pages' } });
  });

  it('refuses the whole create by the tab the engine refused, writing nothing', async () => {
    const res = await create([
      { id: 't1', name: 'Ok', elements: [] },
      { id: 't2', name: 'Bad', template: 'no-such-template' },
    ]);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ tabId: 't2', text: expect.any(String) });
    expect(await getDocument(db.env, 'd1')).toBeNull();
  });

  it('leaves an elements tab, and an unknown source, as they were', async () => {
    expect(
      (await create([{ id: 't1', name: 'Plain', elements: [] }], { source: 'web' })).status,
    ).toBe(201);
    expect((await getDocument(db.env, 'd1'))?.source).toBeNull();
  });
});

describe('compileSeededTabs', () => {
  it('passes through what is not a template seed: elements, a template beside elements, no id, not a tab', () => {
    const tabs = [
      { id: 'a', name: 'A', elements: [] },
      { id: 'b', name: 'B', elements: [], template: 'blank-slide-deck' },
      { name: 'C', template: 'blank-slide-deck' },
      'not a tab',
    ];
    expect(compileSeededTabs(tabs, 'd1')).toEqual({ tabs, intent: null });
  });

  it('names an unnamed compiled tab, keeps its other fields, and themes it', () => {
    const out = compileSeededTabs(
      [
        {
          id: 't1',
          template: 'blank-slide-deck',
          theme: 'ocean',
          background: 'dots',
        },
      ],
      'd1',
    );
    expect(out).toMatchObject({
      tabs: [{ id: 't1', name: 'Tab', background: 'dots' }],
      intent: { mode: 'pages' },
    });
  });
});
