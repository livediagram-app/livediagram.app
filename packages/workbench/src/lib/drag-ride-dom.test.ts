// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  createRideWriter,
  RIDE_PLANE_MIN_NODES,
  rideOffset,
  type RideOffset,
} from './drag-ride-dom';

// livediagram/docs/specs/008-canvas/drag-preview.md "Moves ride an offset": the offsets go on every tagged node of
// each id; "A very large move rides as one layer": a plane most of whose children share one offset carries it.

function page() {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  root.innerHTML =
    '<div data-ride-id="a"></div><svg><g data-ride-id="a"></g></svg><div data-ride-id="b"></div><div data-ride-id="c"></div>';
  const of = (id: string) =>
    [...root.querySelectorAll<HTMLElement>(`[data-ride-id="${id}"]`)].map((n) => n.style.translate);
  return { root, of };
}

// A board: a contents plane of `count` tagged children (ids e0..), and a grips host holding a grip for e0.
function board(count: number, { iso = false, untagged = false } = {}) {
  const root = document.createElement('div');
  if (iso) root.setAttribute('data-iso', '');
  document.body.replaceChildren(root);
  const plane = document.createElement('div');
  plane.setAttribute('data-ride-plane', 'contents');
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.setAttribute('data-ride-id', `e${i}`);
    plane.append(el);
  }
  if (untagged) plane.append(document.createElement('span'));
  const grips = document.createElement('div');
  grips.setAttribute('data-ride-plane', '');
  const grip = document.createElement('div');
  grip.setAttribute('data-ride-id', 'e0');
  grips.append(grip);
  root.append(plane, grips);
  const node = (i: number) => plane.children[i] as HTMLElement;
  return { root, plane, grips, grip, node };
}

const allBut = (count: number, skip: number, o: RideOffset) => {
  const rides = new Map<string, RideOffset>();
  for (let i = skip; i < count; i++) rides.set(`e${i}`, o);
  return rides;
};

describe('the ride writer', () => {
  it('shifts every node of each riding id, and puts back the ones that stop riding', () => {
    const { root, of } = page();
    const writer = createRideWriter();
    writer.setRoot(root);
    writer.apply(
      new Map([
        ['a', { dx: 4, dy: 2 }],
        ['b', { dx: 1, dy: 1 }],
      ]),
    );
    expect(of('a')).toEqual(['4px 2px', '4px 2px']);
    expect(of('b')).toEqual(['1px 1px']);
    expect(of('c')).toEqual(['']);
    expect(writer.active()).toBe(true);
    writer.apply(new Map([['a', { dx: 8, dy: 4 }]]));
    expect(of('a')).toEqual(['8px 4px', '8px 4px']);
    expect(of('b')).toEqual(['']);
    writer.apply(new Map());
    expect(of('a')).toEqual(['', '']);
    expect(writer.active()).toBe(false);
  });

  it('writes only what changed, and finds a node React put back in place of one it shifted', () => {
    const { root, of } = page();
    const writer = createRideWriter();
    writer.setRoot(root);
    const rides = new Map([['b', { dx: 3, dy: 0 }]]);
    writer.apply(rides);
    // A write the writer did not make survives a frame with the same offset: nothing is written.
    root.querySelector<HTMLElement>('[data-ride-id="b"]')!.style.translate = '9px 9px';
    writer.apply(rides);
    expect(of('b')).toEqual(['9px 9px']);
    // The node is replaced: the next frame finds the new one.
    const fresh = document.createElement('div');
    fresh.setAttribute('data-ride-id', 'b');
    root.querySelector('[data-ride-id="b"]')!.replaceWith(fresh);
    writer.apply(new Map([['b', { dx: 3, dy: 0 }]]));
    expect(fresh.style.translate).toBe('3px 0px');
  });

  it('does nothing without a root, and nothing when nothing rides', () => {
    const writer = createRideWriter();
    writer.apply(new Map());
    writer.apply(new Map([['a', { dx: 1, dy: 1 }]]));
    expect(writer.active()).toBe(false);
    writer.setRoot(null);
    writer.apply(new Map());
    expect(writer.active()).toBe(false);
  });
});

describe('a plane carrying a very large move', () => {
  const N = RIDE_PLANE_MIN_NODES + 50;

  it('carries the shared offset as one layer and holds the children that do not ride', () => {
    const { root, plane, grips, grip, node } = board(N);
    const writer = createRideWriter();
    writer.setRoot(root);
    writer.apply(allBut(N, 10, { dx: 5, dy: 3 }));
    expect(plane.style.transform).toBe('translate(5px, 3px)');
    expect(plane.style.display).toBe('block');
    expect(plane.style.position).toBe('absolute');
    expect(writer.planesCarrying()).toBe(1);
    // Riders draw as they are; the rest are held where they were.
    expect(node(20).style.translate).toBe('');
    expect(node(3).style.translate).toBe('-5px -3px');
    // The grips host has too few children to carry: e0 does not ride, so nothing is written there.
    expect(grips.style.transform).toBe('');
    expect(grip.style.translate).toBe('');

    // The next frame moves the layer and the held children with it; a rider of its own offset takes the difference.
    const next = allBut(N, 10, { dx: 9, dy: 4 });
    next.set('e15', { dx: 1, dy: 1 });
    writer.apply(next);
    expect(plane.style.transform).toBe('translate(9px, 4px)');
    expect(node(3).style.translate).toBe('-9px -4px');
    expect(node(15).style.translate).toBe('-8px -3px');
    expect(node(20).style.translate).toBe('');

    writer.apply(new Map());
    expect(plane.style.transform).toBe('');
    expect(plane.style.display).toBe('');
    expect(plane.style.position).toBe('');
    expect(node(3).style.translate).toBe('');
    expect(node(15).style.translate).toBe('');
    expect(writer.active()).toBe(false);
    expect(writer.planesCarrying()).toBe(0);
  });

  it('takes offsets a float rounding apart as one', () => {
    const { root, plane, node } = board(N);
    const rides = allBut(N, 0, { dx: 967.593, dy: 0.1 + 0.2 });
    rides.set('e1', { dx: 967.5930000000001, dy: 0.3 });
    const writer = createRideWriter();
    writer.setRoot(root);
    writer.apply(rides);
    expect(plane.style.transform).toBe('translate(967.593px, 0.3px)');
    expect(node(1).style.translate).toBe('');
    expect(rideOffset(967.5930000000001, -0.0000001)).toEqual({ dx: 967.593, dy: 0 });
  });

  it('moves a plain plane (a grips host) without giving it a box', () => {
    const { root, grips } = board(N);
    for (let i = 1; i < N; i++) {
      const g = document.createElement('div');
      g.setAttribute('data-ride-id', `e${i}`);
      grips.append(g);
    }
    const writer = createRideWriter();
    writer.setRoot(root);
    writer.apply(allBut(N, 0, { dx: 2, dy: 2 }));
    expect(grips.style.transform).toBe('translate(2px, 2px)');
    expect(grips.style.display).toBe('');
    expect(writer.planesCarrying()).toBe(2);
    writer.apply(new Map());
    expect(grips.style.transform).toBe('');
  });

  it('keeps per-node offsets when too few share one, when under half the plane does, or a child is untagged', () => {
    const few = board(N);
    const writer = createRideWriter();
    writer.setRoot(few.root);
    writer.apply(allBut(RIDE_PLANE_MIN_NODES - 1, 0, { dx: 1, dy: 0 }));
    expect(few.plane.style.transform).toBe('');
    expect(few.node(0).style.translate).toBe('1px 0px');

    const half = board(RIDE_PLANE_MIN_NODES * 5);
    const w2 = createRideWriter();
    w2.setRoot(half.root);
    w2.apply(allBut(RIDE_PLANE_MIN_NODES * 2, 0, { dx: 1, dy: 0 }));
    expect(half.plane.style.transform).toBe('');

    const mixed = board(N, { untagged: true });
    const w3 = createRideWriter();
    w3.setRoot(mixed.root);
    w3.apply(allBut(N, 0, { dx: 1, dy: 0 }));
    expect(mixed.plane.style.transform).toBe('');
    expect(mixed.node(0).style.translate).toBe('1px 0px');
  });

  it('puts the offset down when the move shrinks, the root changes, or the plane goes', () => {
    const { root, plane, node } = board(N);
    const writer = createRideWriter();
    writer.setRoot(root);
    writer.apply(allBut(N, 0, { dx: 4, dy: 4 }));
    expect(plane.style.transform).toBe('translate(4px, 4px)');
    writer.apply(new Map([['e1', { dx: 4, dy: 4 }]]));
    expect(plane.style.transform).toBe('');
    expect(node(1).style.translate).toBe('4px 4px');

    writer.apply(allBut(N, 0, { dx: 4, dy: 4 }));
    writer.setRoot(null);
    expect(plane.style.transform).toBe('');
    expect(plane.style.display).toBe('');

    writer.setRoot(root);
    writer.apply(allBut(N, 0, { dx: 4, dy: 4 }));
    expect(writer.planesCarrying()).toBe(1);
    plane.remove();
    writer.apply(allBut(N, 0, { dx: 5, dy: 5 }));
    expect(plane.style.transform).toBe('');
    expect(writer.planesCarrying()).toBe(0);
  });

  it('finds the children again when React adds or replaces one', () => {
    const { root, plane, node } = board(N);
    const writer = createRideWriter();
    writer.setRoot(root);
    const rides = allBut(N, 0, { dx: 3, dy: 3 });
    writer.apply(rides);
    // A child that does not ride arrives: it is held.
    const added = document.createElement('div');
    added.setAttribute('data-ride-id', 'new');
    plane.append(added);
    writer.apply(rides);
    expect(added.style.translate).toBe('-3px -3px');
    // A held child is replaced: its replacement is held, and the plane keeps its layer.
    const fresh = document.createElement('div');
    fresh.setAttribute('data-ride-id', 'new');
    added.replaceWith(fresh);
    writer.apply(rides);
    expect(fresh.style.translate).toBe('-3px -3px');
    expect(plane.style.transform).toBe('translate(3px, 3px)');
    expect(node(0).style.translate).toBe('');
  });

  it('keeps isometric depth on what it writes, and the plane in the scene', () => {
    const { root, plane, node } = board(N, { iso: true });
    const writer = createRideWriter();
    writer.setRoot(root);
    writer.apply(allBut(N, 1, { dx: 2, dy: 1 }));
    expect(plane.style.transformStyle).toBe('preserve-3d');
    expect(node(0).style.translate).toBe('-2px -1px var(--ride-z, 0px)');
    // Leaving isometric mid-gesture writes again without the depth.
    root.removeAttribute('data-iso');
    writer.apply(allBut(N, 1, { dx: 2, dy: 1 }));
    expect(plane.style.transformStyle).toBe('');
    expect(node(0).style.translate).toBe('-2px -1px');
    expect(plane.style.transform).toBe('translate(2px, 1px)');
  });
});
