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
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      // A source whose cancel throws has nothing left to say: the refusal stands either way.
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
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

// The request with its body read through `readCappedBody` and put back as fixed bytes, so every route behind the
// gate reads at most `maxBytes` (its headers, method and URL as they came); null when the body is over the cap.
// A request without a body is handed back as it is.
export async function withCappedBody(request: Request, maxBytes: number): Promise<Request | null> {
  if (request.body === null) return request;
  // A request body streams bytes; the Workers types leave its chunks untyped.
  const bytes = await readCappedBody(request.body as ReadableStream<Uint8Array>, maxBytes);
  // The DOM types take only an ArrayBuffer-backed view as a body; a stream's chunks are never shared memory.
  return bytes && new Request(request, { body: bytes as Uint8Array<ArrayBuffer> });
}
