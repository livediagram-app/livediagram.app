// The draw.io diagram embedded in a `.drawio.png`
// (docs/specs/020-import-export/blueprints/drawio-import.md step 4): a tEXt,
// zTXt or iTXt chunk keyed `mxfile` or `mxGraphModel`, placed before IDAT.

import { BudgetExceeded, inflateBytes, latin1, type ByteBudget } from './inflate';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const KEYWORDS = new Set(['mxfile', 'mxGraphModel']);
const utf8 = (bytes: Uint8Array) => new TextDecoder('utf-8').decode(bytes);

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && SIGNATURE.every((b, i) => bytes[i] === b);
}

async function inflateEither(bytes: Uint8Array, budget: ByteBudget): Promise<Uint8Array> {
  try {
    return await inflateBytes(bytes, 'deflate', budget);
  } catch (error) {
    if (error instanceof BudgetExceeded) throw error;
    // draw.io's own CLI once wrote a raw stream here.
    return inflateBytes(bytes, 'deflate-raw', budget);
  }
}

// The text of one chunk, when it is a diagram chunk.
async function diagramText(
  type: string,
  data: Uint8Array,
  budget: ByteBudget,
): Promise<string | null> {
  const nul = data.indexOf(0);
  if (nul < 0 || !KEYWORDS.has(latin1(data.subarray(0, nul)))) return null;
  if (type === 'tEXt') return latin1(data.subarray(nul + 1));
  if (type === 'zTXt') {
    // keyword \0, one compression-method byte, then the stream.
    const text = utf8(await inflateEither(data.subarray(nul + 2), budget));
    return text.replace(/\+/g, ' '); // Java's URL encoder writes spaces as '+'
  }
  // iTXt: keyword \0, flag, method, language \0, translated keyword \0, text.
  const compressed = data[nul + 1] === 1;
  const langEnd = data.indexOf(0, nul + 3);
  const transEnd = langEnd < 0 ? -1 : data.indexOf(0, langEnd + 1);
  if (transEnd < 0) return null;
  const body = data.subarray(transEnd + 1);
  return utf8(compressed ? await inflateEither(body, budget) : body);
}

export async function extractPngDiagram(
  bytes: Uint8Array,
  budget: ByteBudget,
): Promise<string | null> {
  if (!isPng(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at);
    const type = latin1(bytes.subarray(at + 4, at + 8));
    const start = at + 8;
    const end = start + length;
    if (end + 4 > bytes.length || type === 'IDAT' || type === 'IEND') return null;
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      let text = await diagramText(type, bytes.subarray(start, end), budget);
      if (text !== null) {
        for (let i = 0; i < 2 && text.startsWith('%'); i++) text = decodeURIComponent(text);
        return text;
      }
    }
    at = end + 4; // skip the CRC (D15)
  }
  return null;
}
