// The write gate's memory in workerd, the runtime every api Worker runs in (Work Tracker 655): a 32 MB chunked body,
// the largest a product takes (a This Browser migration's local parts, LOCAL_PARTS_MAX_BYTES), read through
// withCappedBody and then parsed as the migration route does, or forwarded to a Durable Object as the room routes do.
// Measured from V8 itself through the Worker's inspector (Runtime.getHeapUsage): the isolate's JS heap plus the
// ArrayBuffers behind it (the body's chunks), sampled while the request runs, against the Worker's 128 MB limit.
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { unstable_dev, type Unstable_DevWorker } from 'wrangler';

const MB = 1024 * 1024;
const BODY_BYTES = 32 * MB;
const CHUNK_BYTES = 64 * 1024;
// The Worker's memory limit.
const WORKER_LIMIT = 128 * MB;

// A migration's body: JSON parts, about 32 MB, sent in 64 KB chunks with no Content-Length (a chunked upload).
const PART = 'x'.repeat(256 * 1024);
const PARTS = Math.floor(BODY_BYTES / (PART.length + 3));
function migrationBody(): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({ parts: Array.from({ length: PARTS }, () => PART) }),
  );
}

function chunked(bytes: Uint8Array): ReadableStream<Uint8Array> {
  let at = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (at >= bytes.byteLength) return controller.close();
      controller.enqueue(bytes.slice(at, at + CHUNK_BYTES));
      at += CHUNK_BYTES;
    },
  });
}

// A port nothing holds now (WORKERD_TEST_PORT pins the first of two instead, for a machine with port blocks).
async function freePort(offset: number): Promise<number> {
  const pinned = Number(process.env.WORKERD_TEST_PORT);
  if (pinned) return pinned + offset;
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

// The Worker's isolate through its inspector: what V8 holds (heap used plus ArrayBuffer backing stores).
async function inspect(inspectorPort: number) {
  const [target] = (await (await fetch(`http://127.0.0.1:${inspectorPort}/json`)).json()) as {
    webSocketDebuggerUrl: string;
  }[];
  // Node's WebSocket sends a User-Agent, so wrangler's inspector proxy asks for a local Origin too.
  const ws = new WebSocket(target!.webSocketDebuggerUrl, {
    headers: { Origin: 'http://localhost' },
  } as unknown as string[]);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  let next = 1;
  const waiting = new Map<number, (result: Record<string, number>) => void>();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as {
      id?: number;
      result?: Record<string, number>;
    };
    if (message.id !== undefined) waiting.get(message.id)?.(message.result ?? {});
  });
  const send = (method: string) =>
    new Promise<Record<string, number>>((resolve) => {
      const id = next++;
      waiting.set(id, resolve);
      ws.send(JSON.stringify({ id, method }));
    });
  return {
    held: async () => {
      const usage = await send('Runtime.getHeapUsage');
      return (usage.usedSize ?? 0) + (usage.backingStorageSize ?? 0);
    },
    close: () => ws.close(),
  };
}

type Inspector = Awaited<ReturnType<typeof inspect>>;

// The most the isolate held while `send` ran, sampled as often as the isolate answers. Each measure runs on a fresh
// Worker (workerd's inspector answers no collectGarbage), so no earlier request's garbage is counted in it.
async function peakHeld(
  inspector: Inspector,
  send: () => Promise<{ status: number; json(): Promise<unknown> }>,
) {
  const before = await inspector.held();
  let peak = before;
  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      peak = Math.max(peak, await inspector.held());
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  })();
  const res = await send();
  const answer = (await res.json()) as Record<string, unknown>;
  sampling = false;
  await sampler;
  // Nothing collected yet: what the request left behind is still counted.
  peak = Math.max(peak, await inspector.held());
  return { status: res.status, answer, before, peak };
}

const entry = fileURLToPath(String(new URL('./worker.ts', import.meta.url)));

describe('withCappedBody in workerd', () => {
  const body = migrationBody();
  let worker: Unstable_DevWorker | undefined;
  let inspector: Inspector | undefined;

  // A fresh Worker, warmed up so the isolate's own start is not counted.
  async function fresh(): Promise<{ worker: Unstable_DevWorker; inspector: Inspector }> {
    inspector?.close();
    await worker?.stop();
    const inspectorPort = await freePort(1);
    worker = await unstable_dev(entry, {
      ip: '127.0.0.1',
      port: await freePort(0),
      inspect: true,
      inspectorPort,
      logLevel: 'none',
      compatibilityDate: '2026-11-01',
      durableObjects: [{ name: 'ROOM', class_name: 'Room' }],
      // Off the machine-wide dev registry, so no other local Worker sees this one or it them.
      experimental: { disableExperimentalWarning: true, disableDevRegistry: true },
    });
    await (await worker.fetch('/')).text();
    inspector = await inspect(inspectorPort);
    return { worker, inspector };
  }
  afterAll(async () => {
    inspector?.close();
    await worker?.stop();
  });

  // Posts the body, chunked, to a fresh Worker and measures it.
  async function measure(path: string) {
    const fresh_ = await fresh();
    return peakHeld(fresh_.inspector, () =>
      fresh_.worker.fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: chunked(body),
        duplex: 'half',
      }),
    );
  }

  it('keeps a 32 MB chunked migration well under the Worker memory limit, and below the joined gate', async () => {
    const parts = PARTS;
    const streamed = await measure('/json');
    const joined = await measure('/json?gate=joined');
    console.info(
      `[withCappedBody] 32 MB chunked body parsed in workerd, isolate peak: ${(streamed.peak / MB).toFixed(1)} MB streamed, ${(joined.peak / MB).toFixed(1)} MB joined (from ${(streamed.before / MB).toFixed(1)} MB at rest; limit ${WORKER_LIMIT / MB} MB)`,
    );
    expect(streamed).toMatchObject({ status: 200, answer: { parts } });
    expect(joined).toMatchObject({ status: 200, answer: { parts } });
    // Under the limit with room to spare, the parse's own 32 MB string and 32 MB of parts counted in (about 97 MB
    // measured, where the joined gate's 137 MB was past the limit).
    expect(streamed.peak).toBeLessThan(0.8 * WORKER_LIMIT);
    // The joined gate held the body a second and third time; the stream lets each chunk go as it is read.
    expect(streamed.peak).toBeLessThan(joined.peak - 24 * MB);
  }, 120_000);

  it('forwards the body to a Durable Object whole, byte for byte, without holding it twice', async () => {
    const forwarded = await measure('/forward');
    console.info(
      `[withCappedBody] 32 MB chunked body forwarded to a Durable Object, isolate peak: ${(forwarded.peak / MB).toFixed(1)} MB`,
    );
    expect(forwarded).toMatchObject({
      status: 200,
      answer: {
        bytes: body.byteLength,
        sha256: createHash('sha256').update(body).digest('hex'),
        method: 'POST',
        contentType: 'application/json',
      },
    });
    expect(forwarded.peak).toBeLessThan(0.75 * WORKER_LIMIT);
  }, 120_000);

  it('still refuses a chunked body over the cap', async () => {
    const { worker: running } = await fresh();
    const res = await running.fetch('/json', {
      method: 'POST',
      body: chunked(new Uint8Array(41 * MB).fill(32)),
      duplex: 'half',
    });
    expect(res.status).toBe(413);
    await res.text();
  }, 60_000);
});
