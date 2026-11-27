import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { seedTabs } from '../db/tabs';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { readStoredTab } from './stored-tab';
import { styleChangeOf, writeChangeset } from './write';

// A `style` changeset's tab fields (docs/specs/024-agents/agent-changesets.md "A style restyles an existing tab"):
// written even when no element changed, and relayed to the open editors as a tab-meta op after the changeset op.

const box = {
  id: 'b',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
} as Tab['elements'][number];

async function setUp(): Promise<{ db: SqliteD1; mutations: { kind: string }[] }> {
  const mutations: { kind: string }[] = [];
  const room = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (url: string, init?: RequestInit) => {
        if (url.includes('/mutation'))
          mutations.push((JSON.parse(init?.body as string) as { op: { kind: string } }).op);
        return url.includes('/ledger-entries')
          ? new Response('gone', { status: 503 })
          : new Response(null, { status: 204 });
      },
    }),
  };
  const db = sqliteD1({ DOCUMENT_ROOM: room } as unknown as Partial<Env>);
  db.sql.exec(`INSERT INTO test_documents (id, owner_id, name, saved_at, created_at)
               VALUES ('D', 'user_o', 'Doc', 1, 1)`);
  await seedTabs(db.env, 'D', [{ id: 't1', name: 'T', elements: [box] }]);
  return { db, mutations };
}

afterEach(() => vi.restoreAllMocks());

describe('styleChangeOf', () => {
  const tab: Tab = { id: 't', name: 'T', elements: [], theme: 'forest', font: 'lora' };
  it('patches the style fields that changed and names the ones removed', () => {
    expect(
      styleChangeOf(tab, { ...tab, theme: 'ocean', finish: 'sketch', font: undefined }),
    ).toEqual({
      patch: { theme: 'ocean', finish: 'sketch' },
      clear: ['font'],
    });
    expect(styleChangeOf(tab, { ...tab, name: 'Other' })).toBeNull();
  });
});

describe('writeChangeset: a restyle', () => {
  it('writes a finish that changed no element, and tells the room after the changeset op', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { db, mutations } = await setUp();
    const stored = (await readStoredTab(db.env, 'D', 't1'))!;
    const outcome = await writeChangeset(db.env, {
      documentId: 'D',
      tabId: 't1',
      stored,
      next: { ...stored.tab, finish: 'sketch' },
      orderIndex: stored.orderIndex,
      author: { id: 'user_o', name: 'O', color: '#000' },
      tokenId: null,
      summary: null,
      baseRev: stored.rev,
      rebasedOver: 0,
      prevRev: null,
      results: [],
      textFor: () => '',
      revertOf: null,
    });
    expect(outcome.kind).toBe('written');
    expect((await readStoredTab(db.env, 'D', 't1'))!.tab.finish).toBe('sketch');
    const tabMeta = mutations.findIndex((m) => m.kind === 'tab-meta');
    expect(mutations[tabMeta]).toEqual({
      kind: 'tab-meta',
      tabId: 't1',
      patch: { finish: 'sketch' },
    });
    expect(mutations.findIndex((m) => m.kind !== 'tab-meta')).toBeLessThan(tabMeta);
  });
});
