// Writes each riding element's offset to the page (livediagram/docs/specs/008-canvas/drag-preview.md "Moves ride an
// offset", the same in livehuddle): outside React, so a move frame renders no element view. Two ways, whichever
// touches fewer nodes:
//
// - Per node: a CSS `translate` on every node tagged with a riding id (`data-ride-id`: the element's own root, its
//   arrow <svg>, its grips in the grips layer). `translate` composes with the element's own `transform` (rotation,
//   the insert-between shift) instead of replacing it. React never sets `translate`, so it never overwrites or
//   clears the offset.
// - Per plane ("A very large move rides as one layer"): a node marked `data-ride-plane` whose children are all
//   tagged (the element plane, the grips layer's hosts) carries the offset most of its children share, as one
//   `transform`, and only the children that do not share it get a `translate` of their own: the difference. Every
//   element stays where it is in the page, so paint order holds, and a rider keeps its own `translate` (isometric's
//   per-element depth) untouched. A whole-board drag then restyles a handful of nodes a frame, and the page moves
//   the plane the way a pan moves the canvas, instead of restyling every element.
//   No `will-change`: promoting the plane split everything that overlaps it into layers of their own (a layer a
//   row of the board), and laying those out again on every frame cost more than the restyle it saved, and a
//   promoted layer draws its text without sub-pixel smoothing, so a drag would not look the same.
//
// Under isometric view (`data-iso` on the root or above it), a written `translate` keeps the node's depth through
// `--ride-z`, which the isometric rules set beside their own `translate`.

export type RideOffset = { readonly dx: number; readonly dy: number };

// An offset to a thousandth of a pixel. Each element's offset is its new place less its old one, and in floating
// point those differ in the last bits from element to element though the move is one: rounded, a move's elements
// share one offset exactly, which is what lets a plane carry it and a ride send it once.
const round = (v: number) => Math.round(v * 1000) / 1000 || 0;
export function rideOffset(dx: number, dy: number): RideOffset {
  return { dx: round(dx), dy: round(dy) };
}

export const RIDE_ATTRIBUTE = 'data-ride-id';
// `data-ride-plane="contents"`: the plane has no box of its own (`display: contents`) and takes one while it
// carries an offset, the same size and place as its parent's, so its children's positions do not change.
export const RIDE_PLANE_ATTRIBUTE = 'data-ride-plane';
// livediagram/docs/specs/008-canvas/blueprints/DEFAULTS.md D126: the fewest children sharing one offset for their
// plane to carry it. Below it a move writes few nodes anyway, and a plane changing its box re-lays its children.
export const RIDE_PLANE_MIN_NODES = 200;

export type RideWriter = {
  // Where the tagged nodes are: the element plane's parent, which also holds the grips layer.
  setRoot: (root: ParentNode | null) => void;
  // Shifts every node of each id in `rides`, and puts back any node shifted before whose id is no longer there.
  apply: (rides: ReadonlyMap<string, RideOffset>) => void;
  // Whether any node is shifted now.
  active: () => boolean;
  // How many planes carry an offset now (for the ride log and the tests).
  planesCarrying: () => number;
};

type Styled = {
  style: { translate: string };
  isConnected: boolean;
  getAttribute(n: string): string | null;
};

type PlaneNode = Styled & {
  style: Styled['style'] & {
    transform: string;
    display: string;
    position: string;
    inset: string;
    transformStyle: string;
  };
  children: ArrayLike<Styled>;
  childElementCount: number;
};

type Plane = {
  node: PlaneNode;
  contents: boolean;
  // Its children and their ids; null when one is untagged, as such a plane never carries an offset.
  children: { node: Styled; id: string }[] | null;
  // The offset it carries now, or null.
  carries: RideOffset | null;
};

const ZERO: RideOffset = { dx: 0, dy: 0 };
const keyOf = (o: RideOffset) => `${round(o.dx)},${round(o.dy)}`;

export function createRideWriter(): RideWriter {
  let root: ParentNode | null = null;
  // The nodes of each riding id, found once per set of riding ids: a query of the page per gesture, not per frame.
  let nodes = new Map<string, Styled[]>();
  let nodesFor: ReadonlySet<string> = new Set();
  let planes: Plane[] = [];
  const planeOf = new Map<Styled, Plane>();
  let iso = false;
  // What each shifted node carries now, so a frame writes only what changed.
  let written = new Map<Styled, string>();

  const sameIds = (rides: ReadonlyMap<string, RideOffset>) =>
    rides.size === nodesFor.size && [...rides.keys()].every((id) => nodesFor.has(id));
  const isoNow = () => root !== null && (root as Partial<Element>).closest?.('[data-iso]') != null;

  // Finds the planes and their children again, keeping what each plane still found carries; a plane no longer
  // there puts its offset down.
  function findPlanes(): void {
    const before = new Map(planes.map((p) => [p.node, p] as const));
    planes = [];
    planeOf.clear();
    const found = root
      ? (Array.from(root.querySelectorAll(`[${RIDE_PLANE_ATTRIBUTE}]`)) as unknown as PlaneNode[])
      : [];
    for (const [node, p] of before) if (!found.includes(node)) carry(p, null);
    for (const node of found) {
      const plane: Plane = {
        node,
        contents: node.getAttribute(RIDE_PLANE_ATTRIBUTE) === 'contents',
        children: [],
        carries: before.get(node)?.carries ?? null,
      };
      for (const child of Array.from(node.children)) {
        const id = child.getAttribute(RIDE_ATTRIBUTE);
        if (id === null) {
          plane.children = null;
          break;
        }
        plane.children!.push({ node: child, id });
      }
      if (plane.children) for (const c of plane.children) planeOf.set(c.node, plane);
      planes.push(plane);
    }
  }

  function find(rides: ReadonlyMap<string, RideOffset>): void {
    nodes = new Map();
    nodesFor = new Set(rides.keys());
    iso = isoNow();
    if (root)
      for (const node of root.querySelectorAll(`[${RIDE_ATTRIBUTE}]`) as Iterable<Styled>) {
        const id = node.getAttribute(RIDE_ATTRIBUTE)!;
        if (!rides.has(id)) continue;
        const list = nodes.get(id);
        if (list) list.push(node);
        else nodes.set(id, [node]);
      }
    // Only a move large enough for a plane to carry looks at the planes' children; a smaller one puts down
    // what they carry.
    if (rides.size >= RIDE_PLANE_MIN_NODES) findPlanes();
    else {
      for (const p of planes) carry(p, null);
      planes = [];
      planeOf.clear();
    }
  }

  // A plane's children changed under it (React added, removed or replaced one).
  const planesStale = () =>
    planes.some(
      (p) =>
        !p.node.isConnected ||
        (p.children !== null &&
          (p.node.childElementCount !== p.children.length ||
            p.children.some((c) => !c.node.isConnected))),
    );

  // The offset most of the plane's children share, when enough of them do; else null.
  function carriedBy(plane: Plane, rides: ReadonlyMap<string, RideOffset>): RideOffset | null {
    if (!plane.children || rides.size < RIDE_PLANE_MIN_NODES) return null;
    const counts = new Map<string, { offset: RideOffset; n: number }>();
    let best: { offset: RideOffset; n: number } | null = null;
    for (const { id } of plane.children) {
      const o = rides.get(id);
      if (!o || (o.dx === 0 && o.dy === 0)) continue;
      const key = keyOf(o);
      const tally = counts.get(key) ?? { offset: o, n: 0 };
      tally.n++;
      counts.set(key, tally);
      if (!best || tally.n > best.n) best = tally;
    }
    return best && best.n >= RIDE_PLANE_MIN_NODES && best.n * 2 > plane.children.length
      ? rideOffset(best.offset.dx, best.offset.dy)
      : null;
  }

  function carry(plane: Plane, offset: RideOffset | null): void {
    const s = plane.node.style;
    if (offset) {
      if (!plane.carries && plane.contents) {
        // A box of its own, where its parent's is; under isometric view it keeps its children in the scene's
        // 3D space.
        s.display = 'block';
        s.position = 'absolute';
        s.inset = '0';
      }
      const style3d = iso && plane.contents ? 'preserve-3d' : '';
      if (s.transformStyle !== style3d) s.transformStyle = style3d;
      if (!plane.carries || keyOf(plane.carries) !== keyOf(offset))
        s.transform = `translate(${offset.dx}px, ${offset.dy}px)`;
    } else if (plane.carries) {
      s.transform = '';
      s.transformStyle = '';
      if (plane.contents) {
        s.display = '';
        s.position = '';
        s.inset = '';
      }
    }
    plane.carries = offset;
  }

  const css = (x: number, y: number) => {
    const dx = round(x);
    const dy = round(y);
    return dx === 0 && dy === 0 ? '' : `${dx}px ${dy}px${iso ? ' var(--ride-z, 0px)' : ''}`;
  };

  return {
    setRoot(next) {
      for (const p of planes) carry(p, null);
      root = next;
      nodesFor = new Set();
      planes = [];
      planeOf.clear();
    },
    apply(rides) {
      if (rides.size === 0 && written.size === 0 && planes.every((p) => !p.carries)) return;
      const stale =
        !sameIds(rides) ||
        isoNow() !== iso ||
        [...nodes.values()].some((list) => list.some((n) => !n.isConnected)) ||
        planesStale();
      if (stale) {
        // What the old nodes carry is put back while they are still the ones found.
        for (const [node, was] of written) if (was !== '') node.style.translate = '';
        written = new Map();
        find(rides);
      }
      for (const p of planes) carry(p, carriedBy(p, rides));
      const want = new Map<Styled, string>();
      const lift = (node: Styled) => planeOf.get(node)?.carries ?? ZERO;
      for (const [id, o] of rides)
        for (const node of nodes.get(id) ?? []) {
          const p = lift(node);
          want.set(node, css(o.dx - p.dx, o.dy - p.dy));
        }
      // A carrying plane's children that do not ride: held where they are.
      for (const p of planes) {
        if (!p.carries) continue;
        for (const { node, id } of p.children!)
          if (!rides.has(id)) want.set(node, css(-p.carries.dx, -p.carries.dy));
      }
      for (const [node, was] of written)
        if (!want.has(node) && was !== '') node.style.translate = '';
      const next = new Map<Styled, string>();
      for (const [node, value] of want) {
        if ((written.get(node) ?? '') !== value) node.style.translate = value;
        if (value !== '') next.set(node, value);
      }
      written = next;
      if (rides.size === 0) {
        nodes = new Map();
        nodesFor = new Set();
        planes = [];
        planeOf.clear();
      }
    },
    active: () => written.size > 0 || planes.some((p) => p.carries !== null),
    planesCarrying: () => planes.filter((p) => p.carries !== null).length,
  };
}
