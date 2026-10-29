// A D1 outage (liveworkspace/docs/specs/002-architecture/architecture.md "When a request fails"): the index answers
// it itself, retryable, and names the route by its words only.
import { unavailableD1 } from '@liveworkspace/api-kit/testing/unavailable-d1';
import { describe, expect, it, vi } from 'vitest';
import { call, h, person, useHarness } from './test-support';

useHarness();

describe('the index when D1 is unavailable', () => {
  it("answers a person's list 503 storage_unavailable", async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ada = await person('user_a');

    const res = await call('/items', {
      auth: ada.auth,
      env: { ...h.db.env, INDEX_DB: unavailableD1() },
    });

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('5');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ error: 'storage_unavailable' });
    expect(error).toHaveBeenCalledWith('[d1] unavailable route=Get.Index.Items', expect.any(Error));
    error.mockRestore();
  });

  it('never names an item id in the route', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ada = await person('user_a');

    const res = await call('/items/item_secret_42/share', {
      auth: ada.auth,
      env: { ...h.db.env, INDEX_DB: unavailableD1() },
    });

    expect(res.status).toBe(503);
    expect(error).toHaveBeenCalledWith(
      '[d1] unavailable route=Get.Index.Items.Share',
      expect.any(Error),
    );
    expect(JSON.stringify(error.mock.calls.map(([line]) => line))).not.toContain('item_secret_42');
    error.mockRestore();
  });
});
