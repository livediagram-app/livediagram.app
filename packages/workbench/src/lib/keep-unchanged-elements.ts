// A tab-wide restyle keeps the elements it does not change (each product's docs/specs/008-canvas/canvas-performance.md
// "A theme pick on a big board keeps the page answering"). A theme pick runs every element through several pure
// transforms (the appearance view, the preserve-customs switch, the arrows' reset, the label inks), and each hands
// back a new object even when nothing changed: a hand-coloured shape, a sticky, an image, or a field two themes share.
// A new object renders its memoised view again, so a pick on a 400-element board rendered all 400. This hands each
// element back as it was whenever its restyled copy holds the same values, so only the elements whose style really
// changed render.

type Plain = Record<string, unknown>;

const isPlain = (v: object): v is Plain => {
  const proto = Object.getPrototypeOf(v) as unknown;
  return proto === Object.prototype || proto === null;
};

// The keys that hold a value: a key set to `undefined` reads the same as one left out (a transform's patch writes
// `fill: undefined` where the element never had one).
const keysOf = (o: Plain) => Object.keys(o).filter((k) => o[k] !== undefined);

/** Structural equality over the plain data an element holds (objects, arrays, primitives). */
export function sameElementValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => sameElementValue(v, b[i]));
  }
  if (!isPlain(a) || !isPlain(b)) return false;
  const ka = keysOf(a);
  if (ka.length !== keysOf(b).length) return false;
  return ka.every((k) => sameElementValue(a[k], b[k]));
}

/** `after` with each element that holds the same values as its `before` (by id) handed back as the `before` object:
 *  `after` itself when none is, `before` itself when every element is. Linear in the elements' size. */
export function keepUnchangedElements<E extends { id: string }>(
  before: readonly E[],
  after: readonly E[],
): E[] {
  const was = new Map(before.map((el) => [el.id, el]));
  let kept = 0;
  const out = after.map((el) => {
    const old = was.get(el.id);
    if (old === undefined || old === el || !sameElementValue(old, el)) return el;
    kept++;
    return old;
  });
  if (kept === 0) return after as E[];
  return out.length === before.length && out.every((el, i) => el === before[i])
    ? (before as E[])
    : out;
}
