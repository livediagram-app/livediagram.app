// A request body whose every field is optional, as the api and MCP workers read one: the parsed JSON when it is a
// plain object, otherwise `{}`. `null`, a string or an array parse as JSON too, and reading a field off them threw
// (a 500, where an absent body is the documented default).
export function objectOrEmpty(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

// A write's body, read through a byte counter that gives up the moment it passes `maxBytes`: the bytes, or null
// when the body is over the cap (the caller answers 413). A Content-Length gate alone lets a chunked body, which
// declares no length, through to a route's `request.json()` at any size; this bounds what is ever held to the
// cap plus one chunk, whatever the headers say. The stream is cancelled on refusal so the rest is never read.
export async function readCappedBody(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const read = await readCappedChunks(body, maxBytes);
  if (!read) return null;
  const { chunks, total } = read;
  // One chunk (the usual small body) is handed on as it came, without a copy.
  if (chunks.length === 1) return chunks[0]!;
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

// The body's chunks as they came, and their total, or null past `maxBytes` (the stream then cancelled).
async function readCappedChunks(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<{ chunks: Uint8Array[]; total: number } | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return { chunks, total };
    total += value.byteLength;
    if (total > maxBytes) {
      // A source whose cancel throws has nothing left to say: the refusal stands either way.
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
}

// A stream over chunks already read that lets go of each one as it hands it on, so a body is never held twice: the
// reader (a route's `request.json()`, or a Durable Object a request is forwarded to) gathers its own copy while the
// chunks behind it are released, where one joined buffer kept every chunk alive until the copy was done.
export function releasingStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let next = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (next === chunks.length) return controller.close();
      const chunk = chunks[next]!;
      chunks[next++] = RELEASED;
      controller.enqueue(chunk);
    },
    // A reader that stops early (a route that refuses the body half read) lets go of every chunk left.
    cancel() {
      chunks.length = next = 0;
    },
  });
}

const RELEASED = new Uint8Array(0);

// The request with its body read through the byte counter and put back, so every route behind the gate reads at most
// `maxBytes` (its headers, method and URL as they came); null when the body is over the cap. A body that came in one
// chunk (the usual small write) goes on as fixed bytes, as before; one that came in many goes on as a stream over its
// chunks (releasingStream), so a 32 MB migration is never joined into a second copy. A request without a body is
// handed back as it is.
export async function withCappedBody(request: Request, maxBytes: number): Promise<Request | null> {
  if (request.body === null) return request;
  // A request body streams bytes; the Workers types leave its chunks untyped.
  const read = await readCappedChunks(request.body as ReadableStream<Uint8Array>, maxBytes);
  if (!read) return null;
  const { chunks } = read;
  // The DOM types take only an ArrayBuffer-backed view as a body; a stream's chunks are never shared memory.
  const body =
    chunks.length > 1
      ? releasingStream(chunks)
      : ((chunks[0] ?? RELEASED) as Uint8Array<ArrayBuffer>);
  // `duplex` is what Node's Request asks of a stream body; workerd streams either way.
  return new Request(request, { body, duplex: 'half' } as RequestInit);
}
