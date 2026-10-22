import { describe, expect, it } from 'vitest';
import { applyPhotoOps, diffPhoto, parsePhotoOps } from './ops';
import { photoBlobIds, photoBlobIdsOf } from './blob-ids';
import { blobIdOf, isBlobId, isLayerId, newLayerId, parseTileKey, tileKey } from './ids';
import { copyName, layerNameStem, nextLayerName, textLayerName, adjustmentName } from './names';
import { setLayer, addLayer, removeLayers, moveLayer } from './edits';
import { group, ids, photo, pixel } from './test-layers';
import type { Photo } from './types';

const BLOB = 'abcdefghijklmnopqrstuv';
const BLOB2 = 'ABCDEFGHIJKLMNOPQRSTUV';

describe('diffPhoto and applyPhotoOps', () => {
  it('round-trips any change', () => {
    const a = pixel();
    const b = pixel();
    const before = photo([a, b]);
    let after = setLayer(before, a.id, { name: 'Sky' });
    after = addLayer(after, pixel(), b.id);
    after = removeLayers(after, [b.id]);
    after = { ...after, width: 50, preview: BLOB };
    const ops = diffPhoto(before, after);
    expect(applyPhotoOps(before, ops)).toEqual(after);
  });

  it('says nothing when nothing changed, and returns the same photo for no ops', () => {
    const p = photo([pixel()]);
    expect(diffPhoto(p, p)).toEqual([]);
    expect(applyPhotoOps(p, [])).toBe(p);
  });

  it('builds a whole photo from nothing', () => {
    const p = photo([pixel(), pixel()]);
    const ops = diffPhoto(undefined, p);
    expect(applyPhotoOps({ width: 1, height: 1, layers: [] }, ops)).toEqual(p);
  });

  it('merges concurrent changes to different layers', () => {
    const a = pixel();
    const b = pixel();
    const base = photo([a, b]);
    const mine = setLayer(base, a.id, { name: 'Mine' });
    const theirs = setLayer(base, b.id, { opacity: 0.3 });
    const merged = applyPhotoOps(mine, diffPhoto(base, theirs));
    expect(merged.layers.find((l) => l.id === a.id)!.name).toBe('Mine');
    expect(merged.layers.find((l) => l.id === b.id)!.opacity).toBe(0.3);
  });

  it('lets the later commit win on the same layer', () => {
    const a = pixel();
    const base = photo([a]);
    const first = setLayer(base, a.id, { name: 'First' });
    const second = setLayer(base, a.id, { name: 'Second' });
    const atMe = applyPhotoOps(first, diffPhoto(base, second));
    expect(atMe.layers[0]!.name).toBe('Second');
  });

  it('places a new layer above the one it had under it', () => {
    const a = pixel();
    const b = pixel();
    const base = photo([a, b]);
    const n = pixel();
    const theirs = addLayer(base, n, a.id);
    // Meanwhile we added a layer on top.
    const mine = addLayer(base, pixel());
    const merged = applyPhotoOps(mine, diffPhoto(base, theirs));
    expect(ids(merged).indexOf(n.id)).toBe(1);
    // A put with after: null goes to the bottom; with an unknown after, on top.
    const bottom = applyPhotoOps(base, [{ op: 'put', layer: pixel('ly-000000ff'), after: null }]);
    expect(bottom.layers[0]!.id).toBe('ly-000000ff');
    const lost = applyPhotoOps(base, [
      { op: 'put', layer: pixel('ly-000000fe'), after: 'ly-0000dead' },
    ]);
    expect(lost.layers.at(-1)!.id).toBe('ly-000000fe');
  });

  it('reorders, keeping layers the op does not name beside their neighbour', () => {
    const [a, b, c] = [pixel(), pixel(), pixel()];
    const x = pixel();
    const p = photo([a, x, b, c]);
    const r = applyPhotoOps(p, [{ op: 'order', ids: [c.id, a.id, b.id] }]);
    expect(ids(r)).toEqual([c.id, a.id, x.id, b.id]);
    const lead = pixel();
    const r2 = applyPhotoOps(photo([lead, a, b]), [{ op: 'order', ids: [b.id, a.id] }]);
    expect(ids(r2)).toEqual([lead.id, b.id, a.id]);
  });

  it('sends an order op when the order changed', () => {
    const [a, b] = [pixel(), pixel()];
    const p = photo([a, b]);
    const moved = moveLayer(p, a.id, { top: true });
    const ops = diffPhoto(p, moved);
    expect(ops).toContainEqual({ op: 'order', ids: [b.id, a.id] });
    expect(applyPhotoOps(p, ops)).toEqual(moved);
  });

  it('removes a group with its layers, ignores a missing id, and clears a preview', () => {
    const g = group();
    const c = pixel(undefined, { parent: g.id });
    const p: Photo = photo([c, g], { preview: BLOB });
    expect(applyPhotoOps(p, [{ op: 'remove', id: g.id }]).layers).toEqual([]);
    expect(applyPhotoOps(p, [{ op: 'remove', id: 'ly-ffffffff' }]).layers).toHaveLength(2);
    expect(applyPhotoOps(p, [{ op: 'preview', blob: null }])).not.toHaveProperty('preview');
  });
});

describe('parsePhotoOps', () => {
  it('reads each op', () => {
    const l = pixel();
    const ops = [
      { op: 'size', width: 10, height: 20 },
      { op: 'put', layer: l, after: null },
      { op: 'put', layer: l },
      { op: 'remove', id: l.id },
      { op: 'order', ids: [l.id] },
      { op: 'preview', blob: BLOB },
      { op: 'preview', blob: null },
    ];
    expect(parsePhotoOps(ops)).toEqual(ops);
  });

  it('refuses anything malformed', () => {
    expect(parsePhotoOps('x')).toBeUndefined();
    expect(parsePhotoOps([null])).toBeUndefined();
    expect(parsePhotoOps([{ op: 'size', width: 0, height: 1 }])).toBeUndefined();
    expect(parsePhotoOps([{ op: 'size', width: 9000, height: 1 }])).toBeUndefined();
    expect(parsePhotoOps([{ op: 'put', layer: { id: 'x' } }])).toBeUndefined();
    expect(parsePhotoOps([{ op: 'remove' }])).toBeUndefined();
    expect(parsePhotoOps([{ op: 'order', ids: [1] }])).toBeUndefined();
    expect(parsePhotoOps([{ op: 'preview', blob: 'short' }])).toBeUndefined();
    expect(parsePhotoOps([{ op: 'nuke' }])).toBeUndefined();
    expect(
      parsePhotoOps(Array.from({ length: 1001 }, () => ({ op: 'remove', id: 'x' }))),
    ).toBeUndefined();
  });
});

describe('blob ids', () => {
  it('collects tiles, sources, masks and previews', () => {
    const a = pixel(undefined, {
      pixels: { tiles: { '0.0': BLOB, '1.0': '' }, source: { blob: BLOB2, width: 4, height: 4 } },
      mask: { pixels: { tiles: { '0.0': 'mmmmmmmmmmmmmmmmmmmmmm' } } },
    });
    const p = photo([a], { preview: 'pppppppppppppppppppppp' });
    expect([...photoBlobIds(p)].sort()).toEqual(
      [BLOB, BLOB2, 'mmmmmmmmmmmmmmmmmmmmmm', 'pppppppppppppppppppppp'].sort(),
    );
    expect(photoBlobIdsOf({ photos: { 'page-1': p } }).size).toBe(4);
    expect(photoBlobIdsOf({}).size).toBe(0);
  });

  it('names blobs by content', async () => {
    const id = await blobIdOf(new TextEncoder().encode('hello'));
    expect(isBlobId(id)).toBe(true);
    expect(id).toBe(await blobIdOf(new TextEncoder().encode('hello').buffer));
    expect(id).not.toBe(await blobIdOf(new TextEncoder().encode('hellp')));
    // SHA-256("hello") starts 2cf24dba5fb0a30e26e83b2ac5b9e29e.
    expect(id).toBe('LPJNul-wow4m6Dsqxbning');
  });
});

describe('ids and names', () => {
  it('makes layer ids and tile keys', () => {
    const id = newLayerId(['ly-00000000']);
    expect(isLayerId(id)).toBe(true);
    expect(tileKey(-1, 3)).toBe('-1.3');
    expect(parseTileKey('-1.3')).toEqual({ col: -1, row: 3 });
    expect(parseTileKey('1.2.3')).toBeUndefined();
    expect(parseTileKey('500.0')).toBeUndefined();
  });

  it('names layers', () => {
    expect(
      nextLayerName('Layer', [{ name: 'Layer 1' }, { name: 'Layer 7' }, { name: 'Layer x' }]),
    ).toBe('Layer 8');
    expect(nextLayerName('Levels', [])).toBe('Levels 1');
    expect(layerNameStem({ layerKind: 'pixel' })).toBe('Layer');
    expect(layerNameStem({ layerKind: 'group' })).toBe('Group');
    expect(layerNameStem({ layerKind: 'text' })).toBe('Text');
    expect(layerNameStem({ layerKind: 'fill', fill: { kind: 'gradient' } })).toBe('Gradient Fill');
    expect(layerNameStem({ layerKind: 'fill', fill: { kind: 'solid' } })).toBe('Colour Fill');
    expect(layerNameStem({ layerKind: 'adjustment', adjustment: { id: 'hue-saturation' } })).toBe(
      'Hue/Saturation',
    );
    expect(layerNameStem({ layerKind: 'adjustment' })).toBe('Adjustment');
    expect(adjustmentName('black-white')).toBe('Black & White');
    expect(textLayerName('  ')).toBe('Text');
    expect(textLayerName('Hello  world')).toBe('Hello world');
    expect(textLayerName('The quick brown fox jumps over the lazy dog')).toBe(
      'The quick brown fox jumps',
    );
    expect(textLayerName('x'.repeat(40))).toHaveLength(30);
    expect(copyName('Sky')).toBe('Sky Copy');
  });
});
