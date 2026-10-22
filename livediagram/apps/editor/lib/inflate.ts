// Inflating an import's compressed bytes in the browser with DecompressionStream, under a byte budget shared by
// the whole import (a zip-bomb guard): draw.io payloads (docs/specs/020-import-export/blueprints/drawio-import.md
// step 3) and Zip entries (lib/zip-reader.ts).

export class BudgetExceeded extends Error {
  constructor() {
    super('Inflate budget exceeded');
    this.name = 'BudgetExceeded';
  }
}

/** What one import may still inflate, in bytes; `take` throws `BudgetExceeded` past it. */
export class ByteBudget {
  #remaining: number;
  constructor(bytes: number) {
    this.#remaining = bytes;
  }
  take(bytes: number): void {
    this.#remaining -= bytes;
    if (this.#remaining < 0) throw new BudgetExceeded();
  }
}

export async function inflateBytes(
  bytes: Uint8Array,
  format: 'deflate' | 'deflate-raw',
  budget: ByteBudget,
): Promise<Uint8Array<ArrayBuffer>> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes)); // a copy on its own ArrayBuffer, as BufferSource wants
      controller.close();
    },
  });
  const reader = source.pipeThrough(new DecompressionStream(format)).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      budget.take(value.byteLength);
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    // Stop inflating the moment the budget runs out; the rest is never read.
    reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}
