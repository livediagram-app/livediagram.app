// contentHints.thumbnail as Drive checks it: URL-safe base64, PNG / GIF /
// JPEG, at least 220 px wide, at most 2 MB (research A7). An invalid
// thumbnail fails the request, so a mirror bug shows up in the fake.

const MAX_BYTES = 2 * 1024 * 1024;
const MIN_WIDTH = 220;
const ALLOWED = new Set(['image/png', 'image/gif', 'image/jpeg']);

function decodeBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(text)) throw new Error('thumbnail: not URL-safe base64');
  return Uint8Array.from(Buffer.from(text, 'base64url'));
}

export function validateThumbnail(
  image: string,
  mimeType: string,
): { mimeType: string; bytes: number } {
  if (!ALLOWED.has(mimeType)) throw new Error(`thumbnail: unsupported type ${mimeType}`);
  const bytes = decodeBase64Url(image);
  if (bytes.length === 0 || bytes.length > MAX_BYTES)
    throw new Error('thumbnail: size out of range');
  if (mimeType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (!signature.every((b, i) => bytes[i] === b)) throw new Error('thumbnail: not a PNG');
    const width = new DataView(bytes.buffer, bytes.byteOffset).getUint32(16);
    if (width < MIN_WIDTH) throw new Error(`thumbnail: ${width}px is under ${MIN_WIDTH}px`);
  }
  return { mimeType, bytes: bytes.length };
}

// A PNG header (signature + IHDR) of the given width, URL-safe base64: enough
// for the checks above, for tests that need a thumbnail without a canvas.
export function fakePngBase64Url(width: number, height = Math.round(width * 0.6)): string {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes.set([8, 6, 0, 0, 0], 24);
  return Buffer.from(bytes).toString('base64url');
}
