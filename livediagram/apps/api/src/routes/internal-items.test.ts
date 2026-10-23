// The index's doors about a person (docs/specs/015-api/api.md "Internal"): an account closed anywhere, and a guest
// who became an account. What livediagram keeps for a person beside their canvases is in their own stores.
import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { personStore } from '../person-client';
import { workbenchStore } from '../workbench-store';
import { handleInternalItems } from './internal-items';

const KEY = 'index-key';
const GUEST = 'guest_abc';
const USER = 'user_ada';
const OTHER = 'user_bob';

function arrange() {
  const { env } = sqliteD1({ INDEX_KEY: KEY });
  const call = (path: string, body: unknown) =>
    handleInternalItems(
      new Request(`https://api.test/api/internal/people/${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env,
    );
  const library = (owner: string, id: string, name: string) =>
    personStore(env, owner).createShapeLibrary({ id, name, source: 'drawio', items: [] }, 50);
  return { env, call, library };
}

describe('POST /api/internal/people/:id/purge', () => {
  it("closes the person's workbench and empties their store, and no one else's", async () => {
    const { env, call, library } = arrange();
    await library(USER, 'lib-1', 'Mine');
    await library(OTHER, 'lib-2', 'Theirs');
    const token = { id: 'tok-1', name: null, readOnly: false, expiresAt: Date.now() + 60_000 };
    const ask = (personId: string) =>
      workbenchStore(env, personId).openPairingRequest({
        personId,
        token,
        origin: 'https://w.example',
        scope: 'document',
        name: null,
        now: Date.now(),
      });
    const mine = await ask(USER);
    const theirs = await ask(OTHER);

    const res = await call(`${USER}/purge`, { items: [] });

    expect(res.status).toBe(200);
    expect(await personStore(env, USER).shapeLibraries()).toEqual([]);
    expect((await personStore(env, OTHER).shapeLibraries()).map((l) => l.id)).toEqual(['lib-2']);
    const status = (personId: string, code: string) =>
      workbenchStore(env, personId).pairingRequestStatus(code, 'tok-1', Date.now());
    expect(await status(USER, mine.code)).toBeNull();
    expect(await status(OTHER, theirs.code)).toMatchObject({ status: 'pending' });
  });
});

describe('POST /api/internal/people/:guest/merge', () => {
  it("moves the guest's shape libraries to the account, once however often it is asked", async () => {
    const { env, call, library } = arrange();
    await library(GUEST, 'lib-g', 'Sketches');
    await library(USER, 'lib-u', 'Sketches');

    expect((await call(`${GUEST}/merge`, { into: USER })).status).toBe(200);
    expect((await call(`${GUEST}/merge`, { into: USER })).status).toBe(200);

    const names = (await personStore(env, USER).shapeLibraries()).map((l) => l.name).sort();
    expect(names).toEqual(['Sketches', 'Sketches (2)']);
    expect(await personStore(env, GUEST).shapeLibraries()).toEqual([]);
  });

  it('refuses anything but a guest into an account', async () => {
    const { call } = arrange();
    expect((await call(`${USER}/merge`, { into: OTHER })).status).toBe(404);
    expect((await call(`${GUEST}/merge`, { into: GUEST })).status).toBe(400);
  });
});
