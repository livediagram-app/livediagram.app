import { describe, expect, it } from 'vitest';
import {
  addLayerAbove,
  isDefaultLayerName,
  clearLayerElements,
  hideOtherLayers,
  layerBands,
  layerOpacityOf,
  mergeLayerInto,
  setLayerOpacity,
  bringElementsToFrontLayer,
  DEFAULT_LAYER_ID,
  DEFAULT_LAYER_NAME,
  deleteLayer,
  hiddenLayerElementIds,
  layerElementCounts,
  lockedLayerElementIds,
  materializeLayers,
  moveElementsToLayer,
  moveLayer,
  nextLayerName,
  orderByLayer,
  renameLayer,
  resolveActiveLayerId,
  resolveLayerId,
  sendElementsToBackLayer,
  setLayerLock,
  setLayerVisibility,
  stampNewElementLayers,
  tabLayers,
  visibleLayerElements,
  type Element,
  type Layer,
  type ShapeElement,
  type Tab,
} from './index';

const box = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...overrides,
});

const arrow = (id: string, overrides: Partial<Element & { type: 'arrow' }> = {}): Element => ({
  id,
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 10, y: 10 },
  ...overrides,
});

const tab = (elements: Element[], layers?: Layer[]): Tab => ({
  id: 't1',
  name: 'Tab',
  elements,
  ...(layers ? { layers } : {}),
});

const ids = (els: Element[]) => els.map((e) => e.id);
const layerIds = (t: Tab) => (t.layers ?? []).map((l) => l.id);

const L = (id: string, overrides: Partial<Layer> = {}): Layer => ({ id, name: id, ...overrides });

describe('tabLayers / resolveLayerId', () => {
  it('normalises an absent array to the single implicit default layer', () => {
    expect(tabLayers(undefined)).toEqual([{ id: DEFAULT_LAYER_ID, name: DEFAULT_LAYER_NAME }]);
    expect(tabLayers([])).toEqual([{ id: DEFAULT_LAYER_ID, name: DEFAULT_LAYER_NAME }]);
  });

  it('resolves membership: own id, then the default layer, then the bottom', () => {
    const ls = [L(DEFAULT_LAYER_ID), L('a')];
    expect(resolveLayerId('a', ls)).toBe('a');
    expect(resolveLayerId(undefined, ls)).toBe(DEFAULT_LAYER_ID);
    expect(resolveLayerId('ghost', ls)).toBe(DEFAULT_LAYER_ID);
    const noDefault = [L('x'), L('y')];
    expect(resolveLayerId(undefined, noDefault)).toBe('x');
  });
});

describe('orderByLayer', () => {
  it('keeps array order (frames first) for a layerless tab', () => {
    const els = [box('a'), box('f', { shape: 'frame' }), box('b')];
    expect(ids(orderByLayer(els, undefined))).toEqual(['f', 'a', 'b']);
  });

  it('paints bands bottom -> top with frames first within each band', () => {
    const ls = [L(DEFAULT_LAYER_ID), L('top')];
    const els = [
      box('t1', { layerId: 'top' }),
      box('base1'),
      box('tf', { shape: 'frame', layerId: 'top' }),
      box('base2'),
    ];
    expect(ids(orderByLayer(els, ls))).toEqual(['base1', 'base2', 'tf', 't1']);
  });

  it('drops hidden bands unless includeHidden', () => {
    const ls = [L(DEFAULT_LAYER_ID), L('top', { visible: false })];
    const els = [box('a', { layerId: 'top' }), box('b')];
    expect(ids(orderByLayer(els, ls))).toEqual(['b']);
    expect(ids(orderByLayer(els, ls, { includeHidden: true }))).toEqual(['b', 'a']);
  });
});

describe('visibility / lock sets', () => {
  const ls = [L(DEFAULT_LAYER_ID, { locked: true }), L('top', { visible: false })];
  const els = [box('a'), box('b', { layerId: 'top' }), box('c', { layerId: 'ghost' })];

  it('visibleLayerElements filters hidden bands in array order', () => {
    expect(ids(visibleLayerElements(els, ls))).toEqual(['a', 'c']);
    // Nothing hidden -> same reference back.
    expect(visibleLayerElements(els, [L('x')])).toBe(els);
  });

  it('hidden / locked element-id sets resolve membership like the renderer', () => {
    expect(hiddenLayerElementIds(els, ls)).toEqual(new Set(['b']));
    // 'c' has an unknown layerId, so it lives on the (locked) default layer.
    expect(lockedLayerElementIds(els, ls)).toEqual(new Set(['a', 'c']));
    expect(lockedLayerElementIds(els, undefined).size).toBe(0);
  });
});

describe('layer operations', () => {
  it('materializeLayers is lazy and idempotent', () => {
    const t = tab([box('a')]);
    const m = materializeLayers(t);
    expect(layerIds(m)).toEqual([DEFAULT_LAYER_ID]);
    expect(materializeLayers(m)).toBe(m);
  });

  it('addLayerAbove inserts above the anchor and names it with the first free number', () => {
    const t = materializeLayers(tab([]));
    const { tab: t2, layerId: idA } = addLayerAbove(t, DEFAULT_LAYER_ID);
    const { tab: t3 } = addLayerAbove(t2, DEFAULT_LAYER_ID);
    expect(t3.layers!.map((l) => l.name)).toEqual(['Layer 1', 'Layer 3', 'Layer 2']);
    expect(t3.layers![2]!.id).toBe(idA);
    expect(nextLayerName(t3.layers!)).toBe('Layer 4');
  });

  it('renameLayer trims and no-ops on empty / unknown / unchanged', () => {
    const t = materializeLayers(tab([]));
    expect(renameLayer(t, DEFAULT_LAYER_ID, '  Sketch ').layers![0]!.name).toBe('Sketch');
    expect(renameLayer(t, DEFAULT_LAYER_ID, '   ')).toBe(t);
    expect(renameLayer(t, 'ghost', 'X')).toBe(t);
    expect(renameLayer(t, DEFAULT_LAYER_ID, DEFAULT_LAYER_NAME)).toBe(t);
  });

  it('visibility / lock setters store only the non-default state', () => {
    const t = materializeLayers(tab([]));
    const hidden = setLayerVisibility(t, DEFAULT_LAYER_ID, false);
    expect(hidden.layers![0]!.visible).toBe(false);
    expect('visible' in setLayerVisibility(hidden, DEFAULT_LAYER_ID, true).layers![0]!).toBe(false);
    const locked = setLayerLock(t, DEFAULT_LAYER_ID, true);
    expect(locked.layers![0]!.locked).toBe(true);
    expect('locked' in setLayerLock(locked, DEFAULT_LAYER_ID, false).layers![0]!).toBe(false);
  });

  it('moveLayer clamps and reorders', () => {
    const t = tab([], [L('a'), L('b'), L('c')]);
    expect(layerIds(moveLayer(t, 'c', 0))).toEqual(['c', 'a', 'b']);
    expect(layerIds(moveLayer(t, 'a', 99))).toEqual(['b', 'c', 'a']);
    expect(moveLayer(t, 'a', 0)).toBe(t);
    expect(moveLayer(t, 'ghost', 0)).toBe(t);
  });

  it('moveElementsToLayer restamps only real moves onto existing layers', () => {
    const t = tab([box('a'), box('b', { layerId: 'top' })], [L(DEFAULT_LAYER_ID), L('top')]);
    const moved = moveElementsToLayer(t, new Set(['a']), 'top');
    expect((moved.elements[0] as ShapeElement).layerId).toBe('top');
    expect(moveElementsToLayer(t, new Set(['b']), 'top')).toBe(t);
    expect(moveElementsToLayer(t, new Set(['a']), 'ghost')).toBe(t);
  });
});

describe('deleteLayer', () => {
  it('never deletes the last layer and ignores unknown ids', () => {
    const t = materializeLayers(tab([box('a')]));
    expect(deleteLayer(t, DEFAULT_LAYER_ID)).toBe(t);
    expect(deleteLayer(tab([], [L('a'), L('b')]), 'ghost')).toEqual(tab([], [L('a'), L('b')]));
  });

  it('removes the band, cascades arrows pinned to it, and keeps the rest', () => {
    const pinned = arrow('ar', {
      from: { kind: 'pinned', elementId: 'doomed', anchor: 'e' },
    } as Partial<Element & { type: 'arrow' }>);
    const t = tab(
      [box('doomed', { layerId: 'top' }), box('safe'), pinned],
      [L(DEFAULT_LAYER_ID), L('top')],
    );
    const out = deleteLayer(t, 'top');
    expect(layerIds(out)).toEqual([DEFAULT_LAYER_ID]);
    expect(ids(out.elements)).toEqual(['safe']);
  });

  it('elements with a missing layerId follow the default layer to deletion', () => {
    const t = tab(
      [box('legacy'), box('kept', { layerId: 'top' })],
      [L(DEFAULT_LAYER_ID), L('top')],
    );
    const out = deleteLayer(t, DEFAULT_LAYER_ID);
    expect(ids(out.elements)).toEqual(['kept']);
  });
});

describe('bring to front / send to back as layer moves', () => {
  it('creates a new top layer when the top band holds anything else', () => {
    const t = tab([box('a'), box('b')]);
    const out = bringElementsToFrontLayer(t, new Set(['a']));
    expect(out.layers!.length).toBe(2);
    const topId = out.layers![1]!.id;
    expect((out.elements.find((e) => e.id === 'a') as ShapeElement).layerId).toBe(topId);
    // Spliced to the array end so it tops its new band too.
    expect(ids(out.elements)).toEqual(['b', 'a']);
  });

  it('reuses the edge layer when it only holds the selection (or is empty)', () => {
    const t = tab([box('a'), box('b')], [L(DEFAULT_LAYER_ID), L('empty-top')]);
    const out = bringElementsToFrontLayer(t, new Set(['b']));
    expect(layerIds(out)).toEqual([DEFAULT_LAYER_ID, 'empty-top']);
    expect((out.elements.find((e) => e.id === 'b') as ShapeElement).layerId).toBe('empty-top');
  });

  it('is a no-op when the selection is already alone on the edge layer', () => {
    const t = tab([box('a'), box('b', { layerId: 'top' })], [L(DEFAULT_LAYER_ID), L('top')]);
    expect(bringElementsToFrontLayer(t, new Set(['b']))).toBe(t);
    expect(sendElementsToBackLayer(t, new Set(['a']))).toBe(t);
  });

  it('send to back mirrors at the bottom', () => {
    const t = tab([box('a'), box('b')]);
    const out = sendElementsToBackLayer(t, new Set(['b']));
    expect(out.layers!.length).toBe(2);
    const bottomId = out.layers![0]!.id;
    expect((out.elements.find((e) => e.id === 'b') as ShapeElement).layerId).toBe(bottomId);
    expect(ids(out.elements)).toEqual(['b', 'a']);
    // Legacy elements (no layerId) still resolve to the default layer,
    // which is no longer the bottom of the stack.
    expect(ids(orderByLayer(out.elements, out.layers))).toEqual(['b', 'a']);
  });

  it('prunes a layer the move emptied, but not one that was already empty', () => {
    const t = tab(
      [box('a', { layerId: 'mid' }), box('b')],
      [L(DEFAULT_LAYER_ID), L('mid'), L('spare')],
    );
    const out = bringElementsToFrontLayer(t, new Set(['a']));
    // 'mid' lost its only element -> pruned; 'spare' (already empty) stays
    // and is reused as the target since it's the top layer.
    expect(layerIds(out)).toEqual([DEFAULT_LAYER_ID, 'spare']);
    expect((out.elements.find((e) => e.id === 'a') as ShapeElement).layerId).toBe('spare');
  });
});

describe('resolveActiveLayerId / stampNewElementLayers', () => {
  it('active layer falls back to the top when the remembered one is gone', () => {
    const ls = [L('a'), L('b')];
    expect(resolveActiveLayerId(ls, 'a')).toBe('a');
    expect(resolveActiveLayerId(ls, 'ghost')).toBe('b');
    expect(resolveActiveLayerId(undefined, null)).toBe(DEFAULT_LAYER_ID);
  });

  it('stamps only NEW elements lacking a valid layer, once layers exist', () => {
    const prev = [box('old')];
    const next = [
      ...prev,
      box('fresh'),
      box('kept', { layerId: 'b' }),
      box('stale', { layerId: 'x' }),
    ];
    const out = stampNewElementLayers(prev, next, [L('a'), L('b')], 'a');
    expect((out[0] as ShapeElement).layerId).toBeUndefined();
    expect((out[1] as ShapeElement).layerId).toBe('a');
    expect((out[2] as ShapeElement).layerId).toBe('b');
    expect((out[3] as ShapeElement).layerId).toBe('a');
    // No layer array yet, or an unknown active layer -> untouched.
    expect(stampNewElementLayers(prev, next, undefined, 'a')).toBe(next);
    expect(stampNewElementLayers(prev, next, [L('a')], 'ghost')).toBe(next);
  });
});

describe('layerElementCounts', () => {
  it('counts resolved membership per layer', () => {
    const t = tab(
      [box('a'), box('b'), box('c', { layerId: 'top' }), box('d', { layerId: 'ghost' })],
      [L(DEFAULT_LAYER_ID), L('top')],
    );
    const counts = layerElementCounts(t);
    expect(counts.get(DEFAULT_LAYER_ID)).toBe(3);
    expect(counts.get('top')).toBe(1);
  });
});

describe('mergeLayerInto', () => {
  const stack = [L(DEFAULT_LAYER_ID), L('mid'), L('top')];

  it('merge below restamps onto the lower layer, on top of its band', () => {
    const t = tab([box('m', { layerId: 'mid' }), box('base')], stack);
    const out = mergeLayerInto(t, 'mid', 'below');
    expect(layerIds(out)).toEqual([DEFAULT_LAYER_ID, 'top']);
    expect((out.elements.find((e) => e.id === 'm') as ShapeElement).layerId).toBe(DEFAULT_LAYER_ID);
    // Joined at the TOP of the surviving band (array end), preserving
    // the pre-merge visual stacking.
    expect(ids(out.elements)).toEqual(['base', 'm']);
  });

  it('merge above restamps onto the upper layer, at the bottom of its band', () => {
    const t = tab([box('t', { layerId: 'top' }), box('m', { layerId: 'mid' })], stack);
    const out = mergeLayerInto(t, 'mid', 'above');
    expect(layerIds(out)).toEqual([DEFAULT_LAYER_ID, 'top']);
    expect((out.elements.find((e) => e.id === 'm') as ShapeElement).layerId).toBe('top');
    expect(ids(out.elements)).toEqual(['m', 't']);
  });

  it('no-ops at the edges of the stack and on unknown layers', () => {
    const t = tab([], stack);
    expect(mergeLayerInto(t, 'top', 'above')).toBe(t);
    expect(mergeLayerInto(t, DEFAULT_LAYER_ID, 'below')).toBe(t);
    expect(mergeLayerInto(t, 'ghost', 'above')).toBe(t);
  });
});

describe('layer opacity / clear / hide others', () => {
  it('setLayerOpacity clamps and drops the key at full opacity', () => {
    const t = materializeLayers(tab([]));
    const dimmed = setLayerOpacity(t, DEFAULT_LAYER_ID, 0.4);
    expect(dimmed.layers![0]!.opacity).toBe(0.4);
    expect(layerOpacityOf(dimmed.layers![0]!)).toBe(0.4);
    expect('opacity' in setLayerOpacity(dimmed, DEFAULT_LAYER_ID, 1).layers![0]!).toBe(false);
    expect(setLayerOpacity(t, DEFAULT_LAYER_ID, 9).layers![0]!.opacity).toBeUndefined();
    expect(setLayerOpacity(t, DEFAULT_LAYER_ID, -1).layers![0]!.opacity).toBe(0);
  });

  it('clearLayerElements empties the band (arrow cascade included) but keeps the layer', () => {
    const pinned = arrow('ar', {
      from: { kind: 'pinned', elementId: 'doomed', anchor: 'e' },
    } as Partial<Element & { type: 'arrow' }>);
    const t = tab(
      [box('doomed', { layerId: 'top' }), box('safe'), pinned],
      [L(DEFAULT_LAYER_ID), L('top')],
    );
    const out = clearLayerElements(t, 'top');
    expect(layerIds(out)).toEqual([DEFAULT_LAYER_ID, 'top']);
    expect(ids(out.elements)).toEqual(['safe']);
    // Already-empty layer -> same reference back.
    expect(clearLayerElements(out, 'top')).toBe(out);
  });

  it('hideOtherLayers leaves only the target visible', () => {
    const t = tab([], [L('a'), L('b', { visible: false }), L('c')]);
    const out = hideOtherLayers(t, 'b');
    expect(out.layers!.map((l) => l.visible !== false)).toEqual([false, true, false]);
    expect(hideOtherLayers(out, 'b')).toBe(out);
  });

  it('layerBands groups the paint order per layer', () => {
    const ls = [L(DEFAULT_LAYER_ID), L('top', { opacity: 0.5 })];
    const els = [box('t1', { layerId: 'top' }), box('base')];
    const bands = layerBands(els, ls);
    expect(bands.map((b) => b.layer.id)).toEqual([DEFAULT_LAYER_ID, 'top']);
    expect(ids(bands[1]!.elements)).toEqual(['t1']);
  });
});

describe('isDefaultLayerName', () => {
  it('matches only the untouched "Layer N" pattern', () => {
    expect(isDefaultLayerName('Layer 1')).toBe(true);
    expect(isDefaultLayerName('Layer 42')).toBe(true);
    expect(isDefaultLayerName('Sketch')).toBe(false);
    expect(isDefaultLayerName('Layer')).toBe(false);
    expect(isDefaultLayerName('layer 1')).toBe(false);
  });
});
