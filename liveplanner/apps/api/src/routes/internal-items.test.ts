import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { handleInternalItems } from './internal-items';

// A guest merged into an account (accounts → index → apps): liveplanner keeps nothing per guest beside their plans
// (internal-items.ts), so the merge door confirms at once and the index stops asking.

const KEY = 'index-key';
const merge = (guest: string, into: unknown) =>
  handleInternalItems(
    new Request(`https://api.test/api/internal/people/${guest}/merge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ into }),
    }),
    { INDEX_KEY: KEY } as Env,
  );

describe('a guest merged into an account', () => {
  it('is confirmed, with nothing to move', async () => {
    const res = await merge('guest_abc', 'user_def');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('refuses a merge into anything but an account', async () => {
    expect((await merge('guest_abc', 'guest_xyz')).status).toBe(400);
  });
});
