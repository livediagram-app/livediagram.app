// A PDF file's objects, written by hand (liveworkspace/docs/specs/013-export/vector-pdf.md "The file"): numbered indirect objects, streams
// FlateDecode-compressed with the browser's own CompressionStream, the cross-reference table and the trailer. No PDF
// library: the writer is a few hundred lines, loaded only when a PDF is exported.

const enc = new TextEncoder();

// Streams shorter than this go uncompressed: the zlib header and the dictionary entry outweigh the saving.
const MIN_DEFLATE = 64;

/** zlib (FlateDecode) bytes of `data`. */
export async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  const copy = new Uint8Array(data.length);
  copy.set(data);
  void writer.write(copy);
  void writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

type Body = { kind: 'plain'; text: string } | { kind: 'stream'; dict: string; data: Uint8Array };

export class PdfFile {
  private readonly bodies = new Map<number, Body | Promise<Body>>();
  private next = 1;

  /** Reserves an object number, to be written later (so objects can point at each other in any order). */
  alloc(): number {
    return this.next++;
  }

  /** Writes object `n` as `body` (a dictionary, an array, a number...). */
  put(n: number, body: string): number {
    this.bodies.set(n, { kind: 'plain', text: body });
    return n;
  }

  /** Writes object `n` as a stream: `dict` holds its dictionary's entries (no `<<`), besides /Length and /Filter. `filter` names the data's
   *  own encoding (DCTDecode for a JPEG), and stops it being compressed again. */
  putStream(n: number, dict: string, data: string | Uint8Array, filter?: string): number {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    if (filter || bytes.length < MIN_DEFLATE) {
      const f = filter ? ` /Filter /${filter}` : '';
      this.bodies.set(n, { kind: 'stream', dict: `${dict}${f}`, data: bytes });
    } else {
      this.bodies.set(
        n,
        deflate(bytes).then((z) => ({
          kind: 'stream',
          dict: `${dict} /Filter /FlateDecode`,
          data: z,
        })),
      );
    }
    return n;
  }

  /** The finished file: `root` the catalog's object number, `info` the document information dictionary's. */
  async toBytes(root: number, info?: number): Promise<Uint8Array> {
    const parts: Uint8Array[] = [];
    let cursor = 0;
    const push = (s: string | Uint8Array) => {
      const b = typeof s === 'string' ? enc.encode(s) : s;
      parts.push(b);
      cursor += b.length;
    };
    // The binary comment marks the file as binary for anything that sniffs it.
    push('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n');
    const count = this.next;
    const offsets: number[] = [];
    for (let n = 1; n < count; n++) {
      const body = await this.bodies.get(n);
      offsets[n] = cursor;
      push(`${n} 0 obj\n`);
      if (!body) push('null');
      else if (body.kind === 'plain') push(body.text);
      else {
        push(`<< ${body.dict} /Length ${body.data.length} >>\nstream\n`);
        push(body.data);
        push('\nendstream');
      }
      push('\nendobj\n');
    }
    const xref = cursor;
    push(`xref\n0 ${count}\n0000000000 65535 f \n`);
    for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
    push(
      `trailer\n<< /Size ${count} /Root ${root} 0 R${info ? ` /Info ${info} 0 R` : ''} >>\nstartxref\n${xref}\n%%EOF\n`,
    );
    const out = new Uint8Array(cursor);
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  }
}

/** A PDF literal string of printable ASCII: backslash and parentheses escaped. */
export function pdfLiteral(s: string): string {
  return `(${s.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

/** Text as a PDF text string: UTF-16BE with its byte-order mark, in hex, so any character survives. */
export function pdfTextString(s: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++)
    hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}
