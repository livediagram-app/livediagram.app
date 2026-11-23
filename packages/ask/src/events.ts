// A server-sent-events body, read (liveworkspace/docs/specs/019-ask/ask.md "The route"): the events of one answer,
// in order. Shared by liveknowledge's Ask and every other app's Ask AI, each with its own event shape.

/** The events of one server-sent-events body, in order. Reads `data:` lines (an event may span several), ends an
 *  event at a blank line, ignores comments and every other field, and skips data `isEvent` does not know. */
export async function* readEvents<E>(
  body: ReadableStream<Uint8Array>,
  isEvent: (value: unknown) => value is E,
): AsyncGenerator<E> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];
  const flush = (): E | null => {
    if (data.length === 0) return null;
    const text = data.join('\n');
    data = [];
    try {
      const event: unknown = JSON.parse(text);
      return isEvent(event) ? event : null;
    } catch {
      return null;
    }
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, end).replace(/\r$/, '');
        buffer = buffer.slice(end + 1);
        if (line === '') {
          const event = flush();
          if (event) yield event;
        } else if (line.startsWith('data:')) {
          data.push(line.slice(5).replace(/^ /, ''));
        }
      }
      if (done) break;
    }
    // A last event the stream closed on without its blank line.
    if (buffer.startsWith('data:')) data.push(buffer.slice(5).replace(/^ /, ''));
    const last = flush();
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}
