// Test helper: reads back a PDF this package wrote (its objects, streams inflated) and checks its cross-reference
// table points at every object. Not shipped.
import { inflateSync } from 'node:zlib';

export type ReadPdf = {
  text: string;
  objects: Map<number, { dict: string; stream: string | null; bytes: Uint8Array | null }>;
  /** Every object whose dictionary contains `needle`. */
  find(needle: string): { n: number; dict: string; stream: string | null }[];
};

export function readPdf(bytes: Uint8Array): ReadPdf {
  const latin = Buffer.from(bytes).toString('latin1');
  const objects: ReadPdf['objects'] = new Map();
  const re = /(\d+) 0 obj\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin))) {
    const n = Number(m[1]);
    const start = m.index + m[0].length;
    const end = latin.indexOf('\nendobj\n', start);
    const body = latin.slice(start, end);
    const s = body.indexOf('>>\nstream\n');
    if (s === -1) {
      objects.set(n, { dict: body, stream: null, bytes: null });
    } else {
      const dict = body.slice(0, s + 2);
      const len = Number(/\/Length (\d+)/.exec(dict)![1]);
      const from = start + s + '>>\nstream\n'.length;
      const raw = bytes.slice(from, from + len);
      const data = dict.includes('/FlateDecode') ? new Uint8Array(inflateSync(raw)) : raw;
      const isText = !dict.includes('/Subtype /Image');
      objects.set(n, {
        dict,
        stream: isText ? Buffer.from(data).toString('latin1') : null,
        bytes: data,
      });
    }
    re.lastIndex = end;
  }
  // The cross-reference table: each entry's offset starts that object.
  const xref = Number(/startxref\n(\d+)/.exec(latin)![1]);
  const table = latin.slice(xref).split('\n').slice(3);
  for (const [i, n] of [...objects.keys()].sort((a, b) => a - b).entries()) {
    const offset = Number(table[i]!.slice(0, 10));
    if (!latin.startsWith(`${n} 0 obj`, offset)) throw new Error(`xref entry for ${n} is wrong`);
  }
  return {
    text: latin,
    objects,
    find: (needle) =>
      [...objects]
        .filter(([, o]) => o.dict.includes(needle))
        .map(([n, o]) => ({ n, dict: o.dict, stream: o.stream })),
  };
}
