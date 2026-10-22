import { describe, expect, it } from 'vitest';
import {
  addLayer,
  duplicateLayers,
  groupLayers,
  moveLayer,
  removeLayers,
  setLayer,
  stepLayer,
  ungroup,
  withPhotoSize,
} from './edits';
import {
  ancestorIds,
  clipBaseOf,
  depthOf,
  descendantIds,
  isShown,
  listedLayers,
  normaliseStack,
  siblingsOf,
} from './stack';
import { group, ids, photo, pixel } from './test-layers';

describe('normaliseStack', () => {
  it('returns the same array when in order', () => {
    const g = group();
    const layers = [pixel(undefined, { parent: g.id }), g, pixel()];
    expect(normaliseStack(layers)).toBe(layers);
  });

  it('moves children directly under their group', () => {
    const g = group();
    const a = pixel();
    const c = pixel(undefined, { parent: g.id });
    // c is above its group: it moves under it.
    expect(normaliseStack([a, g, c]).map((l) => l.id)).toEqual([a.id, c.id, g.id]);
  });

  it('clears cycles and nesting past five', () => {
    const g1 = group('ly-000000a1', { parent: 'ly-000000a2' });
    const g2 = group('ly-000000a2', { parent: 'ly-000000a1' });
    const out = normaliseStack([g1, g2]);
    expect(out.some((l) => !l.parent)).toBe(true);
    const chain = Array.from({ length: 7 }, (_, i) => group(`ly-0000b0${i}0`));
    for (let i = 1; i < chain.length; i++) chain[i] = { ...chain[i]!, parent: chain[i - 1]!.id };
    const deep = normaliseStack([...chain].reverse());
    const deepest = deep.find((l) => l.id === chain[6]!.id)!;
    expect(depthOf(deep, deepest.id)).toBeLessThanOrEqual(5);
  });
});

describe('stack walks', () => {
  const g = group();
  const inner = group(undefined, { parent: g.id, collapsed: true });
  const a = pixel(undefined, { parent: inner.id });
  const b = pixel(undefined, { parent: g.id, clip: true });
  const base = pixel();
  const top = pixel(undefined, { clip: true });
  const layers = normaliseStack([base, a, inner, b, g, top]);

  it('finds descendants and ancestors', () => {
    expect(descendantIds(layers, g.id).sort()).toEqual([a.id, inner.id, b.id].sort());
    expect(ancestorIds(layers, a.id)).toEqual([inner.id, g.id]);
    expect(depthOf(layers, a.id)).toBe(2);
    expect(siblingsOf(layers, undefined).map((l) => l.id)).toEqual([base.id, g.id, top.id]);
  });

  it('finds a clipped layer base, skipping a sibling group inside', () => {
    expect(clipBaseOf(layers, top.id)!.id).toBe(g.id);
    expect(clipBaseOf(layers, b.id)!.id).toBe(inner.id);
    expect(clipBaseOf(layers, base.id)).toBeUndefined();
  });

  it('knows what shows', () => {
    const hidden = layers.map((l) => (l.id === g.id ? { ...l, visible: false as const } : l));
    expect(isShown(layers, a.id)).toBe(true);
    expect(isShown(hidden, a.id)).toBe(false);
    expect(isShown(layers, 'ly-ffffffff')).toBe(false);
  });

  it('lists top first, collapsed groups folded', () => {
    expect(listedLayers(layers).map((r) => [r.layer.id, r.depth])).toEqual([
      [top.id, 0],
      [g.id, 0],
      [b.id, 1],
      [inner.id, 1],
      [base.id, 0],
    ]);
  });
});

describe('layer operations', () => {
  it('adds above a layer, in its group, or on top', () => {
    const g = group();
    const c = pixel(undefined, { parent: g.id });
    const p = photo([c, g]);
    const n = pixel();
    const added = addLayer(p, n, c.id);
    expect(ids(added)).toEqual([c.id, n.id, g.id]);
    expect(added.layers[1]!.parent).toBe(g.id);
    const onTop = addLayer(p, pixel(undefined, { parent: g.id }));
    expect(onTop.layers.at(-1)!.parent).toBeUndefined();
    expect(p.layers).toHaveLength(2);
  });

  it('removes a group with its layers', () => {
    const g = group();
    const c = pixel(undefined, { parent: g.id });
    const x = pixel();
    expect(ids(removeLayers(photo([c, g, x]), [g.id]))).toEqual([x.id]);
  });

  it('sets and clears fields, never id or kind', () => {
    const a = pixel(undefined, { opacity: 0.5 });
    const p = setLayer(photo([a]), a.id, {
      opacity: undefined,
      name: 'Sky',
      id: 'x',
      layerKind: 'group',
    });
    expect(p.layers[0]).toMatchObject({ id: a.id, layerKind: 'pixel', name: 'Sky' });
    expect(p.layers[0]).not.toHaveProperty('opacity');
    const same = photo([a]);
    expect(setLayer(same, 'ly-ffffffff', { name: 'x' })).toBe(same);
  });

  it('duplicates a layer above itself and a group with its layers', () => {
    const g = group();
    const c = pixel(undefined, { parent: g.id, name: 'Child' });
    const a = pixel(undefined, { name: 'Alone' });
    const { photo: p, copies } = duplicateLayers(photo([a, c, g]), [a.id, g.id, c.id]);
    expect(copies).toHaveLength(2);
    expect(p.layers).toHaveLength(6);
    expect(p.layers[1]!.name).toBe('Alone Copy');
    const gCopy = p.layers.find((l) => l.id === copies[1])!;
    expect(gCopy.name).toBe(`${g.name} Copy`);
    const cCopy = p.layers.find((l) => l.parent === gCopy.id)!;
    expect(cCopy.name).toBe('Child');
    expect(new Set(p.layers.map((l) => l.id)).size).toBe(6);
  });

  it('moves above, below, into, to the top and bottom', () => {
    const a = pixel();
    const b = pixel();
    const g = group();
    const c = pixel(undefined, { parent: g.id });
    const p = photo([a, b, c, g]);
    expect(ids(moveLayer(p, a.id, { above: b.id }))).toEqual([b.id, a.id, c.id, g.id]);
    expect(ids(moveLayer(p, b.id, { below: a.id }))).toEqual([b.id, a.id, c.id, g.id]);
    const into = moveLayer(p, a.id, { into: g.id });
    expect(ids(into)).toEqual([b.id, c.id, a.id, g.id]);
    expect(into.layers[2]!.parent).toBe(g.id);
    expect(ids(moveLayer(p, a.id, { top: true }))).toEqual([b.id, c.id, g.id, a.id]);
    const out = moveLayer(p, c.id, { bottom: true });
    expect(ids(out)).toEqual([c.id, a.id, b.id, g.id]);
    expect(out.layers[0]!.parent).toBeUndefined();
    // A group moved below a layer brings its layers.
    expect(ids(moveLayer(p, g.id, { below: a.id }))).toEqual([c.id, g.id, a.id, b.id]);
    // Never into itself, nor into a non-group.
    expect(moveLayer(p, g.id, { into: g.id })).toBe(p);
    expect(moveLayer(p, g.id, { above: c.id })).toBe(p);
    expect(moveLayer(p, a.id, { into: b.id })).toBe(p);
    expect(moveLayer(p, 'ly-ffffffff', { top: true })).toBe(p);
  });

  it('steps among siblings, staying at the ends', () => {
    const a = pixel();
    const b = pixel();
    const g = group();
    const c = pixel(undefined, { parent: g.id });
    const p = photo([a, b, c, g]);
    expect(ids(stepLayer(p, a.id, 1))).toEqual([b.id, a.id, c.id, g.id]);
    expect(ids(stepLayer(p, g.id, -1))).toEqual([a.id, c.id, g.id, b.id]);
    expect(stepLayer(p, c.id, 1)).toBe(p);
    expect(stepLayer(p, a.id, -1)).toBe(p);
  });

  it('groups layers at the top one place, keeping their order, and ungroups', () => {
    const a = pixel();
    const b = pixel();
    const x = pixel();
    const done = groupLayers(photo([a, x, b]), [b.id, a.id], 'Group 1')!;
    const gId = done.group;
    expect(ids(done.photo)).toEqual([x.id, a.id, b.id, gId]);
    expect(done.photo.layers.filter((l) => l.parent === gId).map((l) => l.id)).toEqual([
      a.id,
      b.id,
    ]);
    const back = ungroup(done.photo, gId);
    expect(ids(back)).toEqual([x.id, a.id, b.id]);
    expect(back.layers.every((l) => !l.parent)).toBe(true);
    expect(groupLayers(photo([a]), ['ly-ffffffff'], 'G')).toBeUndefined();
    expect(ungroup(photo([a]), a.id).layers).toEqual([a]);
  });

  it('ungroups a nested group into its own group', () => {
    const outer = group();
    const inner = group(undefined, { parent: outer.id });
    const c = pixel(undefined, { parent: inner.id });
    const p = ungroup(photo([c, inner, outer]), inner.id);
    expect(p.layers.find((l) => l.id === c.id)!.parent).toBe(outer.id);
  });

  it('changes the size only when it differs', () => {
    const p = photo([]);
    expect(withPhotoSize(p, 100, 80)).toBe(p);
    expect(withPhotoSize(p, 50, 40)).toMatchObject({ width: 50, height: 40 });
  });
});
