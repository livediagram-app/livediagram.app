// Google's partial-response `fields` parameter: `a,b(c,d(e)),f`. The fake
// honours it, so code that forgets to ask for a field (md5Checksum, parents,
// appProperties) gets the same hole it would get from Google.

export type FieldTree = Map<string, FieldTree | true>;

export function parseFields(spec: string): FieldTree {
  let i = 0;
  function list(): FieldTree {
    const out: FieldTree = new Map();
    while (i < spec.length) {
      let name = '';
      while (i < spec.length && !',()'.includes(spec[i]!)) name += spec[i++];
      name = name.trim();
      if (spec[i] === '(') {
        i++;
        const sub = list();
        if (spec[i] !== ')') throw new Error(`fields: missing ) in ${spec}`);
        i++;
        // `a/b` style paths are not used by the mirror; plain nesting only.
        if (name) out.set(name, sub);
      } else if (name) {
        out.set(name, true);
      }
      if (spec[i] === ',') {
        i++;
        continue;
      }
      if (spec[i] === ')' || i >= spec.length) break;
    }
    return out;
  }
  const tree = list();
  if (i < spec.length) throw new Error(`fields: unexpected ${spec[i]} in ${spec}`);
  return tree;
}

// Keep only the requested fields. A nested tree applies to an object or to
// every element of an array.
export function pickFields(value: unknown, tree: FieldTree | true): unknown {
  if (tree === true || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => pickFields(v, tree));
  const out: Record<string, unknown> = {};
  const src = value as Record<string, unknown>;
  if (tree.has('*')) return value;
  for (const [key, sub] of tree) {
    if (key in src && src[key] !== undefined) out[key] = pickFields(src[key], sub);
  }
  return out;
}
