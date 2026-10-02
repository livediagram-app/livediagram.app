// Inflating draw.io payloads in the browser with DecompressionStream, under a
// byte budget shared by the whole import (a zip-bomb guard)
// (docs/specs/020-import-export/blueprints/drawio-import.md step 3).

export class BudgetExceeded extends Error {
  constructor() {
    super('draw.io payload inflates beyond the import limit');
    this.name = 'BudgetExceeded';
  }
}

/** Remaining inflate allowance, in bytes. */
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
): Promise<Uint8Array> {
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
      budget.take(value.length);
      chunks.push(value);
      total += value.length;
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export const latin1 = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes);

export function base64Bytes(text: string): Uint8Array {
  const binary = atob(text.replace(/\s+/g, ''));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// draw.io's Graph.zapGremlins: C0 controls other than tab, LF, CR.
// eslint-disable-next-line no-control-regex -- the control range IS the point
const GREMLINS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

/** A compressed `<diagram>` body back to its `mxGraphModel` XML (draw.io's
 *  Graph.decompress: base64, raw inflate, URI-decode). */
export async function decompressDiagram(text: string, budget: ByteBudget): Promise<string> {
  const inflated = latin1(await inflateBytes(base64Bytes(text), 'deflate-raw', budget));
  let decoded: string;
  try {
    decoded = decodeURIComponent(inflated);
  } catch {
    decoded = inflated; // not URI-encoded (D14)
  }
  return decoded.replace(GREMLINS, '');
}
