import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StartedServer } from './main';
import { startServer } from './main';

// The app process, over real HTTP (docs/specs/016-platform/blueprints/self-hosted-runtime.md,
// "Testing"): a real server on a real port, real requests, real JSON back. A
// stubbed handler would prove the wiring compiles, not that a self-hosted
// deployment answers.

let server: StartedServer;
let dir: string;

const OWNER = 'guest-self-host-smoke';
const headers = { 'X-Owner-Id': OWNER, 'Content-Type': 'application/json' };

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'livediagram-server-http-'));
  server = await startServer({
    port: 0,
    databasePath: join(dir, 'livediagram.sqlite'),
    objectsDir: join(dir, 'objects'),
    vars: {},
  });
});

afterAll(async () => {
  await server?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('the self-hosted app process', () => {
  it('answers /api/capabilities with no AI configured', async () => {
    const res = await fetch(`${server.url}/api/capabilities`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ aiEnabled: false });
  });

  it('creates a document and lists it back for the same owner', async () => {
    const id = crypto.randomUUID();
    const created = await fetch(`${server.url}/api/documents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id, name: 'Self-hosted smoke' }),
    });
    // The api answers 201 for a create, which is the behaviour a self-host must
    // keep: the editor tells the two apart.
    expect(created.status).toBe(201);

    const listed = await fetch(`${server.url}/api/documents`, { headers });
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as { documents?: { id: string; name: string }[] };
    const found = body.documents?.find((doc) => doc.id === id);
    expect(found?.name).toBe('Self-hosted smoke');
  });

  it('keeps one owner out of another owner\u2019s document', async () => {
    const id = crypto.randomUUID();
    await fetch(`${server.url}/api/documents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id, name: 'Private' }),
    });
    const other = await fetch(`${server.url}/api/documents/${id}`, {
      headers: { 'X-Owner-Id': 'guest-someone-else' },
    });
    expect([403, 404]).toContain(other.status);
  });

  it('stores an uploaded image and serves the same bytes back', async () => {
    // A 1x1 PNG, the smallest thing the sniffer accepts.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const uploaded = await fetch(`${server.url}/api/images`, {
      method: 'POST',
      headers: {
        'X-Owner-Id': OWNER,
        'Content-Type': 'image/png',
        'X-Image-Sha256': createHash('sha256').update(png).digest('hex'),
        'X-Image-Width': '1',
        'X-Image-Height': '1',
        'X-Image-Original-Name': 'pixel.png',
      },
      body: png,
    });
    expect([200, 201]).toContain(uploaded.status);
    const created = (await uploaded.json()) as { image?: { id?: string } };
    const id = created.image?.id;
    expect(typeof id).toBe('string');

    // The bytes came back out of the object store, which is the whole point of
    // the disk store replacing R2.
    const fetched = await fetch(`${server.url}/api/images/${id}`, {
      headers: { 'X-Owner-Id': OWNER },
    });
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get('content-type')).toBe('image/png');
    const bytes = Buffer.from(await fetched.arrayBuffer());
    expect(bytes.equals(png)).toBe(true);
  });

  it('deletes a document and drops it from the list', async () => {
    const id = crypto.randomUUID();
    await fetch(`${server.url}/api/documents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id, name: 'Short-lived' }),
    });
    const removed = await fetch(`${server.url}/api/documents/${id}`, {
      method: 'DELETE',
      headers,
    });
    expect([200, 204]).toContain(removed.status);

    const listed = await fetch(`${server.url}/api/documents`, { headers });
    const body = (await listed.json()) as { documents?: { id: string }[] };
    expect(body.documents?.some((doc) => doc.id === id) ?? false).toBe(false);
  });

  it('answers 404 for a path the api does not serve', async () => {
    const res = await fetch(`${server.url}/api/nothing-here`, { headers });
    expect(res.status).toBe(404);
  });
});
