import { planTemplateSeedItems } from '@livediagram/templates';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { getDocument, getTab, listDocumentsByOwner, listItems } from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { asUser } from './placement-test-support';
import { compileSeededTabs } from './document-seed';

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

  it('builds a template tab and derives the intent from it when none is given', async () => {
    expect(
      (await create([{ id: 't1', name: 'Retro', template: 'start-stop-continue' }])).status,
    ).toBe(201);
    expect((await getTab(db.env, 'd1', 't1'))?.elements.length).toBeGreaterThan(0);
    const summary = (await listDocumentsByOwner(db.env, 'user_alice')).find((d) => d.id === 'd1');
    expect(summary).toMatchObject({
      opensIn: 'diagram',
      tabKind: 'diagram',
      templateFamily: 'retrospective',
    });
  });

  it('makes a Plan template tab with its seed items, opening in Plan', async () => {
    expect((await create([{ id: 't1', name: 'Board', template: 'kanban' }])).status).toBe(201);
    const items = await listItems(db.env, 'd1');
    expect(items.length).toBe(planTemplateSeedItems('kanban').length);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
    const summary = (await listDocumentsByOwner(db.env, 'user_alice')).find((d) => d.id === 'd1');
    expect(summary).toMatchObject({ opensIn: 'plan', templateFamily: 'kanban' });
  });

  it('keeps an intent the create gives', async () => {
    await create([{ id: 't1', name: 'Retro', template: 'start-stop-continue' }], {
      intent: { mode: 'draw' },
    });
    const summary = (await listDocumentsByOwner(db.env, 'user_alice')).find((d) => d.id === 'd1');
    expect(summary).toMatchObject({ opensIn: 'draw', templateFamily: null });
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
      { name: 'C', template: 'kanban' },
      'not a tab',
    ];
    expect(compileSeededTabs(tabs, 'd1')).toEqual({ tabs, intent: null, items: [] });
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
