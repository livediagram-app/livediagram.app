// A Worker for request-body.workerd.test.ts: the write gate (withCappedBody) in front of what the products' apis do with
// a big body behind it. `/json` parses it, as a migration's local-parts route does; `/forward` hands it to a Durable
// Object, as the document room routes do; `?gate=joined` runs the gate as it was before (one joined buffer), so the
// test can measure both in workerd.
import { readCappedBody, withCappedBody } from '../../src/request-body';

type Env = { ROOM: DurableObjectNamespace };

// The products' migration cap (LOCAL_PARTS_MAX_BYTES), plus room for the JSON around the parts.
const CAP = 40 * 1024 * 1024;

// The gate before Work Tracker 655: every chunk joined into one buffer, then that buffer copied into the Request.
async function joinedGate(request: Request): Promise<Request | null> {
  if (request.body === null) return request;
  const bytes = await readCappedBody(request.body as ReadableStream<Uint8Array>, CAP);
  return bytes && new Request(request, { body: bytes });
}

const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

export class Room {
  async fetch(request: Request): Promise<Response> {
    const body = await request.arrayBuffer();
    return Response.json({
      bytes: body.byteLength,
      sha256: hex(await crypto.subtle.digest('SHA-256', body)),
      method: request.method,
      contentType: request.headers.get('content-type'),
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET') return new Response('ok');
    const gated =
      url.searchParams.get('gate') === 'joined'
        ? await joinedGate(request)
        : await withCappedBody(request, CAP);
    if (!gated) return new Response('too large', { status: 413 });
    if (url.pathname === '/forward') {
      const stub = env.ROOM.get(env.ROOM.idFromName('room'));
      return stub.fetch(new Request(gated));
    }
    const value = (await gated.json()) as { parts: string[] };
    return Response.json({ parts: value.parts.length });
  },
};
