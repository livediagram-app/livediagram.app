// A server-sent event stream read as its `data:` payloads, for both providers' streamed answers (claude-client.ts,
// openai-client.ts). Other lines (`event:`, comments, blanks) carry nothing a payload's own `type` does not.

/** The `data:` payloads of a stream, as they complete. */
export async function* eventData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = done ? '' : lines.pop()!;
      for (const line of lines) {
        if (line.startsWith('data:')) yield line.slice(5).trim();
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}

/** A payload as an object, or undefined when it is not JSON or not an object (`[DONE]`, a ping's text). */
export function parseEvent<T extends object>(data: string): T | undefined {
  try {
    const event: unknown = JSON.parse(data);
    return event && typeof event === 'object' ? (event as T) : undefined;
  } catch {
    return undefined;
  }
}
