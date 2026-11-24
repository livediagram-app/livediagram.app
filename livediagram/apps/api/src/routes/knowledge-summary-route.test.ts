import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { handleDocuments } from './documents';
import { makeTestRouteContext } from './test-route-context';

// Send to Knowledge Base's summary in this app (docs/specs/013-workspace/send-to-knowledge.md "The summary"): who may
// have selected items summarised, on this app's built-in AI and Ask's daily count. The summariser itself is tested
// where it lives (packages/ask serve-summary.test.ts). No network.

const keyFor = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null));
vi.mock('@liveworkspace/auth-client/ai-key', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/auth-client/ai-key')>()),
  personAiKey: keyFor,
}));

// Ask's day, counted per account (its room's count is tested in packages/ask daily-count.test.ts).
const counted = vi.hoisted(() => ({ accounts: [] as string[] }));
vi.mock('@liveworkspace/ask/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/ask/server')>()),
  spendAsk: vi.fn(async (_rooms: unknown, accountId: string) => {
    counted.accounts.push(accountId);
    return true;
  }),
}));

let sql: SqliteD1;
let env: Env;
let asked: unknown[];

const selection = {
  items: [
    { id: 'a', kind: 'shape', label: 'Cart' },
    { id: 'b', kind: 'shape', label: 'Payment' },
  ],
  links: [{ from: 'a', to: 'b' }],
};

beforeEach(() => {
  keyFor.mockReset();
  keyFor.mockResolvedValue(null);
  counted.accounts = [];
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  sql = sqliteD1();
  sql.sql.exec(`
    INSERT INTO test_documents (id, owner_id, name, saved_at, created_at) VALUES ('d1', 'owner', 'Shop', 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Main', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
  `);
  asked = [];
  // The harness's env keeps its hidden bindings (the document store, the grant hook): added to, not spread.
  env = Object.assign(sql.env as unknown as Env, {
    AI: {
      run: async (_model: string, input: unknown) => {
        asked.push(input);
        return { response: 'The cart hands the order to payment.' };
      },
    },
  });
});
afterEach(() => vi.restoreAllMocks());

const summarise = (owner: string | null = 'owner', method = 'POST', account = true) =>
  handleDocuments(
    makeTestRouteContext(method, '/api/documents/d1/knowledge-summary', {
      env,
      ...(owner ? { owner, ...(account ? { accountUserId: owner } : {}) } : {}),
      ...(method === 'POST' ? { body: { tabId: 't1', selection, focus: 'checkout' } } : {}),
    }),
  );

describe('POST /api/documents/:id/knowledge-summary', () => {
  it('summarises the selection for someone who can read the canvas, on built-in AI', async () => {
    const res = await summarise();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      markdown: 'The cart hands the order to payment.',
      provider: 'built-in',
    });
    expect(JSON.stringify(asked)).toContain('Cart');
    expect(JSON.stringify(asked)).toContain('checkout');
    expect(counted.accounts).toEqual(['owner']);
  });

  it('refuses a stranger before any AI is asked, and a guest', async () => {
    expect((await summarise('stranger')).status).toBe(403);
    expect(asked).toHaveLength(0);
    const guest = await summarise('owner', 'POST', false);
    expect([guest.status, (await guest.json<{ error: string }>()).error]).toEqual([
      403,
      'summary_needs_account',
    ]);
    expect(counted.accounts).toEqual([]);
  });

  it('takes a POST alone', async () => {
    expect((await summarise('owner', 'GET')).status).toBe(405);
  });
});
