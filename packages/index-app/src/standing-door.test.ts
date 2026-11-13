// The standing door (`POST /api/internal/items/:id/standing`, liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Where an item stands"): the index's key alone, a checked body, the app's handler when it has one, 200 and nothing done
// when it has none, and a 503 the index logs when the handler throws.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleInternalItems, type InternalItemHandlers } from './internal';

afterEach(() => vi.restoreAllMocks());

const STANDING = { archived: true, trashed: false, at: 1_700_000_000_000 };

const send = (
  body: unknown,
  handlers: Partial<InternalItemHandlers>,
  options: { auth?: string; method?: string; id?: string } = {},
) =>
  handleInternalItems(
    new Request(`https://app.test/api/internal/items/${options.id ?? 'plan-1'}/standing`, {
      method: options.method ?? 'POST',
      headers: {
        Authorization: `Bearer ${options.auth ?? 'index-key'}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    {
      key: 'index-key',
      exportKey: 'media-key',
      driveKey: 'drive-key',
      communityKey: 'ck',
      handlers: { purge: async () => {}, ...handlers },
    },
  );

describe('the standing door', () => {
  it("hands the app's handler the item and where it stands", async () => {
    const standing = vi.fn(async () => {});
    const res = await send(STANDING, { standing });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(standing).toHaveBeenCalledWith('plan-1', STANDING);
  });

  it('confirms and does nothing for an app without the handler', async () => {
    const res = await send(STANDING, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('refuses a malformed body before any handler runs', async () => {
    const standing = vi.fn(async () => {});
    for (const body of [undefined, { archived: true }, { ...STANDING, at: 'soon' }]) {
      expect((await send(body, { standing })).status).toBe(400);
    }
    // Without a handler too, so an index sending nonsense hears it.
    expect((await send({ archived: 1 }, {})).status).toBe(400);
    expect(standing).not.toHaveBeenCalled();
  });

  it('answers 503 when the handler throws, for the index to log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await send(STANDING, {
      standing: async () => {
        throw new Error('room down');
      },
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    expect(warn).toHaveBeenCalledWith('[internal] standing failed', { error: 'Error: room down' });
  });

  it("takes the index's key alone, and POST alone", async () => {
    const standing = vi.fn(async () => {});
    for (const auth of ['media-key', 'drive-key', 'ck', 'wrong']) {
      expect((await send(STANDING, { standing }, { auth })).status).toBe(401);
    }
    expect((await send(undefined, { standing }, { method: 'GET' })).status).toBe(404);
    expect((await send(STANDING, { standing }, { id: '' })).status).toBe(404);
    expect(standing).not.toHaveBeenCalled();
  });
});
