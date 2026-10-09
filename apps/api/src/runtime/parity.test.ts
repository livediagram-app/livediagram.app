import { describe, expect, it } from 'vitest';
import type {
  HtmlTransformerFactory,
  ObjectStore,
  RoomHost,
  Scheduler,
  StoredObject,
} from '@livediagram/runtime';
import { contractLimiters, runtimeContract } from '@livediagram/runtime/testing';
import { sqliteD1 } from '../test-sqlite-d1';
import type { Env, Runtime } from '../types';
import { cloudflareRuntime } from './cloudflare';

// The runtime seam, compared (docs/specs/016-platform/blueprints/self-hosted-runtime.md,
// "Testing"): the operations every runtime must answer the same way
// (\`runtimeContract\`), run through two independently built runtimes.
//
//   - the Cloudflare runtime, built by \`cloudflareRuntime(env, ctx)\` over bindings,
//   - a Node-shaped runtime, built here from what a Node process would hand it.
//
// The database is \`node:sqlite\` on both sides on purpose: this suite guards the
// seam's *wiring* — rooms, limiters, the scheduler, the object store, identity —
// not the SQL engine, which apps/server tests against a real file.
//
// The real Node runtime must satisfy the same contract; apps/server/src/runtime/node.test.ts
// asserts exactly that, with the same expectations this comparison produces.

/** An object store that keeps bytes in a Map, the way a Node runtime would. */
function memoryObjects(seen: string[]): ObjectStore {
  const store = new Map<string, { body: Uint8Array; contentType?: string }>();
  const toStored = (key: string): StoredObject | null => {
    const hit = store.get(key);
    if (!hit) return null;
    return {
      body: null,
      size: hit.body.byteLength,
      ...(hit.contentType === undefined ? {} : { httpMetadata: { contentType: hit.contentType } }),
      text: async () => new TextDecoder().decode(hit.body),
      arrayBuffer: async () => hit.body.slice().buffer,
    };
  };
  return {
    put: async (key, value, options) => {
      seen.push(`put:${key}`);
      const bytes =
        typeof value === 'string'
          ? new TextEncoder().encode(value)
          : value instanceof Uint8Array
            ? value
            : new Uint8Array(await new Response(value as BodyInit).arrayBuffer());
      store.set(key, { body: bytes, contentType: options?.httpMetadata?.contentType });
      return {};
    },
    get: async (key) => toStored(key),
    delete: async (key) => {
      for (const k of Array.isArray(key) ? key : [key]) {
        seen.push(`delete:${k}`);
        store.delete(k);
      }
    },
  };
}

/** A room host that answers the way a room does, recording what reached it. */
function recordingRooms(seen: string[]): RoomHost {
  return {
    for: (documentId) => ({
      fetch: async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init);
        seen.push(`room:${documentId}:${new URL(request.url).pathname}`);
        return Response.json({ documentId, path: new URL(request.url).pathname });
      },
    }),
  };
}

function recordingScheduler(waited: unknown[]): Scheduler {
  return {
    waitUntil: (promise) => {
      waited.push(promise);
    },
    cron: () => {},
  };
}

const htmlStub: HtmlTransformerFactory = () => {
  const transformer = {
    on: () => transformer,
    transform: (response: Response) => response,
  };
  return transformer;
};

describe('the runtime seam', () => {
  it('answers identically on the Cloudflare runtime and a Node-shaped one', async () => {
    const cfSeen: string[] = [];
    const cfWaited: Promise<unknown>[] = [];
    const cfRuntime = cloudflareRuntime(
      {
        DB: sqliteD1().env.db,
        IMAGES: memoryObjects(cfSeen),
        DOCUMENT_ROOM: {
          // The name-to-id mapping is the platform's; identity is enough here,
          // and it is how the rest of the suite fakes a namespace.
          idFromName: (name: string) => name,
          get: (id: string) => ({
            fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
              const request = input instanceof Request ? input : new Request(input, init);
              cfSeen.push(`room:${id}:${new URL(request.url).pathname}`);
              return Response.json({ documentId: id, path: new URL(request.url).pathname });
            },
          }),
        },
        ...contractLimiters(),
        CLERK_JWKS_URL: 'https://idp.test/jwks.json',
        CLERK_ISSUER: 'https://idp.test',
      } as unknown as Env,
      {
        waitUntil: (promise: Promise<unknown>) => {
          cfWaited.push(promise);
        },
        passThroughOnException: () => {},
      } as unknown as ExecutionContext,
    );

    const nodeSeen: string[] = [];
    const nodeWaited: Promise<unknown>[] = [];
    const nodeRuntime: Runtime = {
      db: sqliteD1().env.db,
      objects: memoryObjects(nodeSeen),
      rooms: recordingRooms(nodeSeen),
      limiters: contractLimiters(),
      scheduler: recordingScheduler(nodeWaited),
      html: htmlStub,
      identity: { jwksUrl: 'https://idp.test/jwks.json', issuer: 'https://idp.test' },
    };

    const [cf, node] = [await runtimeContract(cfRuntime), await runtimeContract(nodeRuntime)];
    expect(cf).toEqual(node);

    // The scheduler legs differ by construction (bindings vs. timers), so the
    // waitUntil count is asserted on each side rather than compared.
    expect(cfWaited).toHaveLength(1);
    expect(nodeWaited).toHaveLength(1);

    // The wiring itself: both runtimes reached a room and the object store
    // through the same seam calls, with the Cloudflare leg going via a stub.
    expect(cfSeen).toEqual(['put:probe', 'delete:probe', 'room:doc-1:/broadcast']);
    expect(nodeSeen).toEqual(['put:probe', 'delete:probe', 'room:doc-1:/broadcast']);

    // A binding this deployment does not have reads as undefined rather than
    // throwing: that is what makes an unprovisioned limiter mean "allow".
    expect(cfRuntime.limiters.HOME_RATE_LIMITER).toBeUndefined();
  });
});
