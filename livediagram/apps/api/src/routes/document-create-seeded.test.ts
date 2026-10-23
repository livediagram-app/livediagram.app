import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { getDocument, getTab } from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { asUser } from './test-route-context';
import { compileSeededTabs, seedIntentOf } from './document-seed';
import { indexIntentOf } from './documents';

// A create's seeded tabs given as a graph, Mermaid or a template (docs/specs/015-api/api.md): compiled by
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
  it('lays out a graph and a Mermaid tab, and records the CLI as the source', async () => {
    const res = await create(
      [
        {
          id: 't1',
          name: 'Arch',
          graph: {
            nodes: [
              { id: 'web', label: 'Web' },
              { id: 'api', label: 'API' },
            ],
            edges: [{ from: 'web', to: 'api' }],
          },
        },
        { id: 't2', name: 'Flow', mermaid: 'flowchart LR\n  a[Cart] --> b[Pay]' },
      ],
      { source: 'cli' },
    );
    expect(res.status).toBe(201);
    const arch = await getTab(db.env, 'd1', 't1');
    expect(arch?.elements.map((e) => e.type).sort()).toEqual(['arrow', 'shape', 'shape']);
    expect((await getTab(db.env, 'd1', 't2'))?.elements.length).toBe(3);
    expect((await getDocument(db.env, 'd1'))?.source).toBe('cli');
  });

  // The intent is the index's (it files the create by it, docs/specs/013-workspace/default-folders.md): what the
  // api owns is working it out from the create.
  it('builds a template tab and derives the intent the index files it by, a retro by its family', async () => {
    expect(
      (await create([{ id: 't1', name: 'Retro', template: 'start-stop-continue' }])).status,
    ).toBe(201);
    expect((await getTab(db.env, 'd1', 't1'))?.elements.length).toBeGreaterThan(0);
    expect(seedIntentOf([{ id: 't1', name: 'Retro', template: 'start-stop-continue' }])).toBe(
      'retrospective',
    );
    expect(
      compileSeededTabs([{ id: 't1', name: 'Retro', template: 'start-stop-continue' }], 'd1'),
    ).toMatchObject({
      intent: { mode: 'workshop', tabKind: 'diagram', templateFamily: 'retrospective' },
    });
  });

  it('keeps an intent the create gives', () => {
    expect(indexIntentOf({ mode: 'draw', tabKind: 'diagram' })).toBe('draw:diagram');
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
  it('passes through what is not a single source: elements, two sources, no id, not a tab', () => {
    const tabs = [
      { id: 'a', name: 'A', elements: [] },
      { id: 'b', name: 'B', graph: { nodes: [] }, mermaid: 'graph TD' },
      { name: 'C', template: 'swot' },
      'not a tab',
    ];
    expect(compileSeededTabs(tabs, 'd1')).toEqual({ tabs, intent: null });
  });

  it('names an unnamed compiled tab, keeps its other fields, and themes it', () => {
    const out = compileSeededTabs(
      [
        {
          id: 't1',
          graph: { nodes: [{ id: 'a', label: 'A' }], edges: [] },
          theme: 'ocean',
          background: 'dots',
        },
      ],
      'd1',
    );
    expect(out).toMatchObject({
      tabs: [{ id: 't1', name: 'Tab', background: 'dots' }],
      intent: { mode: 'diagram' },
    });
  });
});
