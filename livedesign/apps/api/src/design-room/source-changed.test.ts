// The `source-changed` door's room frame (liveworkspace/docs/specs/004-index/sheet-sources.md "Keeping in step"):
// through the index's door on this app's key, every open session hears the ids, never a value.
import { describe, expect, it, vi } from 'vitest';

const { calls } = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('../design-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../design-client')>()),
  designRoom: (_env: unknown, id: string) => ({
    sourceChanged: async (change: unknown) => void calls.push([id, change]),
  }),
}));

import { handleInternalItems } from '../routes/internal-items';
import type { Env } from '../types';

const change = { app: 'liveplanner' as const, itemId: 'plan_1', sheetIds: ['sheet0001'] };

describe('POST /api/internal/items/:id/source-changed', () => {
  const send = (key: string, body: unknown) =>
    handleInternalItems(
      new Request('https://api.test/api/internal/items/design_1/source-changed', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { INDEX_KEY: 'index-key' } as Env,
    );

  it("reaches the design's room on the index's key", async () => {
    calls.length = 0;
    const res = await send('index-key', change);
    expect(res.status).toBe(202);
    expect(calls).toEqual([['design_1', change]]);
  });

  it('refuses another key, and a change of another app', async () => {
    calls.length = 0;
    expect((await send('wrong', change)).status).toBe(401);
    expect((await send('index-key', { ...change, app: 'livedocuments' })).status).toBe(400);
    expect(calls).toEqual([]);
  });
});
