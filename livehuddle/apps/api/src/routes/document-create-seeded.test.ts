import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { getDocument, getTab } from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { asUser } from './test-route-context';
import { compileSeededTabs, seedIntentOf } from './document-seed';
import { indexIntentOf } from '@livehuddle/api-schema';

// A create's seeded tabs given as a template (docs/specs/015-api/api.md): compiled by applyReplace before anything
// is written, the intent derived from the first, a refusal naming the tab.

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
  it('records the CLI as the source', async () => {
    const res = await create([{ id: 't1', name: 'Pod', template: 'team-pod' }], {
      source: 'cli',
    });
    expect(res.status).toBe(201);
    expect((await getDocument(db.env, 'd1'))?.source).toBe('cli');
  });

  // The graph input went with the layout containers (docs/specs/002-project-scope/not-in-livehuddle.md "The element
  // engine", part 3): a tab that still gives one refuses the create by its id, rather than landing empty.
  it('refuses a seeded graph tab by its id, writing nothing', async () => {
    const res = await create([
      { id: 't1', name: 'Ok', elements: [] },
      { id: 't2', name: 'Arch', graph: { nodes: [{ id: 'web', label: 'Web' }], edges: [] } },
    ]);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_body', tabId: 't2' });
    expect(await getDocument(db.env, 'd1')).toBeNull();
    expect(compileSeededTabs([{ graph: {} }], 'd1')).toMatchObject({
      refusal: { status: 400, body: { error: 'invalid_body' } },
    });
  });

  // The diagram shapes left livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine",
  // part 5, D31): an API client's seeded tab cannot carry a new one, while the editor's own create (a copy, an Offline
  // Mode re-commit) keeps a stored one exactly as stored.
  it("refuses a token's seeded square by its tab, and keeps a person's stored one", async () => {
    const square = { id: 's', type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 60 };
    const tabs = [{ id: 't1', name: 'Old', elements: [square] }];
    const agent = await handleDocuments(
      makeTestRouteContext('POST', '/api/documents', {
        env: db.env,
        ...asUser('user_alice'),
        token: { id: 'tok_1' },
        body: { id: 'd1', name: 'Shop', tabs },
      }),
    );
    expect(agent.status).toBe(400);
    expect(await agent.json()).toEqual({
      error: 'invalid_body',
      message: 'shape="square": shapes are no longer supported in livehuddle: add a sticky',
      tabId: 't1',
    });
    expect(await getDocument(db.env, 'd1')).toBeNull();
    expect(compileSeededTabs([{ elements: [square] }], 'd1', { agent: true })).toMatchObject({
      refusal: { status: 400, body: { error: 'invalid_body' } },
    });
    expect(
      compileSeededTabs([{ id: 't1', elements: ['x', square] }], 'd1', { agent: true }),
    ).toHaveProperty('refusal');
    expect(
      compileSeededTabs([{ id: 't1', elements: [{ ...square, shape: 'plant' }] }], 'd1', {
        agent: true,
      }),
    ).toEqual({
      tabs: [{ id: 't1', elements: [{ ...square, shape: 'plant' }] }],
      intent: null,
    });

    expect((await create(tabs)).status).toBe(201);
    expect((await getTab(db.env, 'd1', 't1'))?.elements).toEqual([square]);
  });

  // The intent is the index's (it files the create by it, docs/specs/013-workspace/default-folders.md): what the
  // api owns is working it out from the create.
  // No template in the catalogue carries a family since the retro formats left (Work Tracker #423).
  it('builds a template tab and derives the intent the index files it by', async () => {
    expect((await create([{ id: 't1', name: 'Pod', template: 'team-pod' }])).status).toBe(201);
    expect((await getTab(db.env, 'd1', 't1'))?.elements.length).toBeGreaterThan(0);
    expect(seedIntentOf([{ id: 't1', name: 'Pod', template: 'team-pod' }])).toBeNull();
    expect(
      compileSeededTabs([{ id: 't1', name: 'Pod', template: 'team-pod' }], 'd1'),
    ).toMatchObject({
      intent: { mode: 'workshop', tabKind: 'diagram' },
    });
  });

  it('keeps an intent the create gives', () => {
    expect(indexIntentOf({ mode: 'workshop', tabKind: 'diagram' })).toBe('workshop:diagram');
  });

  it('refuses a malformed intent, writing nothing', async () => {
    const res = await create([{ id: 't1', name: 'Plain', elements: [] }], {
      intent: { mode: 'nope' },
    });
    expect(res.status).toBe(400);
    expect(await getDocument(db.env, 'd1')).toBeNull();
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
  it('passes through what is not a single source: elements, a source with elements, no id, not a tab', () => {
    const tabs = [
      { id: 'a', name: 'A', elements: [] },
      { id: 'b', name: 'B', elements: [], template: 'team-pod' },
      { name: 'C', template: 'team-pod' },
      'not a tab',
    ];
    expect(compileSeededTabs(tabs, 'd1')).toEqual({ tabs, intent: null });
  });

  it('names an unnamed compiled tab, keeps its other fields, and themes it', () => {
    const out = compileSeededTabs(
      [
        {
          id: 't1',
          template: 'team-pod',
          theme: 'ocean',
          background: 'dots',
        },
      ],
      'd1',
    );
    expect(out).toMatchObject({
      tabs: [{ id: 't1', name: 'Tab', background: 'dots' }],
      intent: { mode: 'workshop' },
    });
  });
});
