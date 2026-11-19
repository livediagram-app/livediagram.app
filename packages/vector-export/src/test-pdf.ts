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

const hexText = (hex: string) => {
  let s = '';
  for (let i = 4; i < hex.length; i += 4)
    s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return s;
};

/** The structure tree as indented lines, a reader's tag pane in text: each element's tag, its `/Alt` or `/Scope`,
 *  and its marked content as `page:mcid` (pages numbered from 0 in the page tree's order). Throws when an element's
 *  `/P` doesn't name its parent or the parent tree doesn't map one of its MCIDs back to it. */
export function structDump(pdf: ReadPdf): string {
  const root = pdf.find('/Type /StructTreeRoot')[0];
  if (!root) return '(untagged)';
  const pagesDict = pdf.find('/Type /Pages')[0]!.dict;
  const pageObjs = [.../\/Kids \[([^\]]*)\]/.exec(pagesDict)![1]!.matchAll(/(\d+) 0 R/g)].map((m) =>
    Number(m[1]),
  );
  const parentTree = pdf.objects.get(Number(/\/ParentTree (\d+) 0 R/.exec(root.dict)![1]))!.dict;
  const owners = new Map<string, number>();
  for (const [, i, refs] of parentTree.matchAll(/(\d+) \[([^\]]*)\]/g))
    [...refs!.matchAll(/(\d+) 0 R/g)].forEach((m, mcid) =>
      owners.set(`${pageObjs[Number(i)]}:${mcid}`, Number(m[1])),
    );
  const lines: string[] = [];
  const walk = (n: number, parent: number, depth: number) => {
    const dict = pdf.objects.get(n)!.dict;
    if (Number(/\/P (\d+) 0 R/.exec(dict)![1]) !== parent) throw new Error(`${n}: wrong /P`);
    const tag = /\/S \/(\w+)/.exec(dict)![1]!;
    const alt = /\/Alt <([0-9A-F]+)>/.exec(dict);
    const scope = /\/Scope \/(\w+)/.exec(dict);
    const k = dict.slice(dict.indexOf('/K [') + 4, dict.lastIndexOf(']'));
    const mcrs: string[] = [];
    const kids: number[] = [];
    for (const m of k.matchAll(/<< \/Type \/MCR \/Pg (\d+) 0 R \/MCID (\d+) >>|(\d+) 0 R/g)) {
      if (m[3]) kids.push(Number(m[3]));
      else {
        if (owners.get(`${m[1]}:${m[2]}`) !== n)
          throw new Error(`${n}: parent tree misses ${m[2]}`);
        mcrs.push(`${pageObjs.indexOf(Number(m[1]))}:${m[2]}`);
      }
    }
    lines.push(
      `${'  '.repeat(depth)}${tag}${alt ? ` "${hexText(alt[1]!)}"` : ''}${scope ? ` ${scope[1]}` : ''}${mcrs.length ? ` [${mcrs.join(' ')}]` : ''}`,
    );
    for (const kid of kids) walk(kid, n, depth + 1);
  };
  walk(Number(/\/K (\d+) 0 R/.exec(root.dict)![1]), root.n, 0);
  return lines.join('\n');
}
