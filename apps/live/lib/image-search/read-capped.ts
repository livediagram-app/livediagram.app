// Read a response body into a Blob without holding more than `maxBytes` of it
// (docs/specs/009-elements/blueprints/image-search.md "storeSearchResult"). A
// declared Content-Length over the cap refuses before any byte is read; a body
// that streams past the cap (no length, or a lying one) is cancelled the moment
// it does, so a hostile or huge host costs at most `maxBytes` plus one chunk.

export type CappedRead = { ok: true; blob: Blob } | { ok: false; reason: 'too-large' };

const TOO_LARGE: CappedRead = { ok: false, reason: 'too-large' };

export async function readCapped(
  res: Response,
  maxBytes: number,
  type: string,
): Promise<CappedRead> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => {});
    return TOO_LARGE;
  }
  if (!res.body) {
    const blob = await res.blob();
    return blob.size > maxBytes ? TOO_LARGE : { ok: true, blob };
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return TOO_LARGE;
    }
    chunks.push(value);
  }
  return { ok: true, blob: new Blob(chunks as BlobPart[], { type }) };
}
