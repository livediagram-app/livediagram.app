// The index's doors into a design (docs/specs/015-api/api.md "Internal"): where the design stands after a trash.
import { describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { handleInternalItems } from './internal-items';

const { tellTrashed } = vi.hoisted(() => ({
  tellTrashed: vi.fn(async (_env: unknown, _id: string, _kind: string) => true),
}));
vi.mock('../room-access-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../room-access-client')>()),
  tellTrashed,
}));

// docs/specs/013-workspace/trash.md "Open editors": the index pushes where an item stands after every trash (the api,
// MCP or the Explorer alike), and a trashed design's room tells its editors and closes.
describe('POST /api/internal/items/:id/standing', () => {
  it("tells a trashed design's room, and never an archived or restored one's", async () => {
    tellTrashed.mockClear();
    const stand = (id: string, archived: boolean, trashed: boolean) =>
      handleInternalItems(
        new Request(`https://api.test/api/internal/items/${id}/standing`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${'index-key'}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived, trashed, at: 1 }),
        }),
        sqliteD1({ INDEX_KEY: 'index-key' }).env,
      );
    expect((await stand('A', false, true))?.status).toBe(200);
    expect((await stand('B', true, false))?.status).toBe(200);
    expect((await stand('C', false, false))?.status).toBe(200);
    expect(tellTrashed.mock.calls.map(([, id, op]) => [id, op])).toEqual([['A', 'design-trashed']]);
  });
});
