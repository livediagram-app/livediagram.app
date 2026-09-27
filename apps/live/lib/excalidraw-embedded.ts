// Find the Excalidraw scene inside an Excalidraw PNG or SVG export ("Embed
// scene"), or pass plain `.excalidraw` JSON through
// (docs/specs/020-import-export/excalidraw-import-export.md "Embedded-scene PNG and SVG").
// Mirrors Excalidraw's own decoder (packages/excalidraw/data/encode.ts, image.ts).
// Never throws: a bad file is a message for the Import dialog.

export type ExcalidrawContainer = 'json' | 'png' | 'svg';

export type ExtractedScene =
  { ok: true; text: string; container: ExcalidrawContainer } | { ok: false; error: string };

const MIME = 'application/vnd.excalidraw+json';
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const NO_SCENE =
  "This image doesn't contain an Excalidraw scene. In Excalidraw, export it with Embed scene switched on.";
const BAD_SCENE = "The Excalidraw scene inside this image couldn't be read.";

class BadScene extends Error {}

const latin1 = (bytes: Uint8Array) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return out;
};
const byteStringToBytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

export async function extractExcalidrawScene(input: Uint8Array | string): Promise<ExtractedScene> {
  try {
    if (typeof input !== 'string' && isPng(input)) {
      const payload = pngSceneText(input);
      if (payload === null) return fail('NO_SCENE');
      return { ok: true, text: await decodeWrapperText(payload), container: 'png' };
    }
    const text = typeof input === 'string' ? input : new TextDecoder().decode(input);
    if (text.includes(`payload-type:${MIME}`)) {
      return { ok: true, text: await svgSceneText(text), container: 'svg' };
    }
    if (/^\s*<(svg|\?xml)/i.test(text)) return fail('NO_SCENE');
    return { ok: true, text, container: 'json' };
  } catch (error) {
    if (!(error instanceof BadScene)) console.warn('[excalidraw-import] BAD_SCENE', error);
    return fail('BAD_SCENE');
  }
}

function fail(kind: 'NO_SCENE' | 'BAD_SCENE'): ExtractedScene {
  console.warn('[excalidraw-import]', kind);
  return { ok: false, error: kind === 'NO_SCENE' ? NO_SCENE : BAD_SCENE };
}

const isPng = (bytes: Uint8Array) =>
  bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((b, i) => bytes[i] === b);

// The Latin-1 text of the `tEXt` chunk keyed by Excalidraw's MIME type, or null.
function pngSceneText(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = PNG_SIGNATURE.length;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at);
    const type = latin1(bytes.subarray(at + 4, at + 8));
    const start = at + 8;
    const end = start + length;
    if (end + 4 > bytes.length) throw new BadScene('truncated chunk');
    if (type === 'IEND') break;
    if (type === 'tEXt') {
      const data = bytes.subarray(start, end);
      const nul = data.indexOf(0);
      if (nul > 0 && latin1(data.subarray(0, nul)) === MIME) return latin1(data.subarray(nul + 1));
    }
    at = end + 4; // skip the CRC
  }
  return null;
}

async function svgSceneText(svg: string): Promise<string> {
  const match = /<!-- payload-start -->\s*(.+?)\s*<!-- payload-end -->/s.exec(svg);
  if (!match) throw new BadScene('no payload');
  const version = /<!-- payload-version:(\d+) -->/.exec(svg)?.[1] ?? '1';
  let binary: string;
  try {
    binary = atob(match[1]!);
  } catch {
    throw new BadScene('bad base64');
  }
  const json = version !== '1' ? binary : new TextDecoder().decode(byteStringToBytes(binary));
  return decodeWrapperText(json);
}

// The `{ encoding: 'bstring', compressed, encoded }` wrapper, or the legacy
// un-encoded scene JSON.
async function decodeWrapperText(text: string): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BadScene('wrapper is not JSON');
  }
  if (!parsed || typeof parsed !== 'object') throw new BadScene('wrapper is not an object');
  const wrapper = parsed as {
    type?: unknown;
    encoding?: unknown;
    compressed?: unknown;
    encoded?: unknown;
  };
  if (!('encoded' in wrapper)) {
    if (wrapper.type === 'excalidraw') return text;
    throw new BadScene('not a scene');
  }
  if (wrapper.encoding !== 'bstring' || typeof wrapper.encoded !== 'string') {
    throw new BadScene('unknown encoding');
  }
  const bytes = byteStringToBytes(wrapper.encoded);
  if (wrapper.compressed) return new TextDecoder().decode(await inflate(bytes));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // The oldest exports stored the scene text itself, not its UTF-8 bytes.
    return wrapper.encoded;
  }
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
      .stream()
      .pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new BadScene('inflate failed');
  }
}
