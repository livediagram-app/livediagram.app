// A PSD to a photo and back (docs/specs/031-photo/photo-pages.md "Exports and other views"). Opening
// one brings its layers in as pixel layers and groups with their settings; saving one writes each
// pixel layer as it is, a fill or text layer as its pixels, and an adjustment layer as the picture it
// makes of what is under it in its group, so the file looks the same in another editor.
import { compositePhoto, type PixelsLookup, type TextRasterizer } from '../composite/composite';
import { newLayerId } from '../model/ids';
import { PHOTO_TILE } from '../model/limits';
import { normaliseStack } from '../model/stack';
import type { GroupLayer, Photo, PhotoLayer, PixelLayer } from '../model/types';
import { alphaBounds, cropRaster, type Raster } from '../raster/raster';
import { TiledRaster } from '../raster/tiles';
import type { PsdDesign, PsdMask, PsdNode } from './model';

export type PhotoPixels = { layers: Map<string, TiledRaster>; masks: Map<string, TiledRaster> };

/** A mask's pixels in its layer's coordinates (the layer at `at`). */
function maskRaster(
  m: PsdMask,
  at: { x: number; y: number },
  photo: { width: number; height: number },
): TiledRaster {
  const t = new TiledRaster(1, 255);
  const rx = m.x - at.x;
  const ry = m.y - at.y;
  if (m.outside === 0) {
    // Hidden outside its rect: every tile over the photo starts black.
    const area = { x: -at.x, y: -at.y, width: photo.width, height: photo.height };
    for (const [c, r] of TiledRaster.tilesIn(area)) t.markCleared(`${c}.${r}`);
  }
  if (m.width > 0 && m.height > 0)
    t.writeChannel({ x: rx, y: ry, width: m.width, height: m.height }, m.data);
  t.takeDirty();
  return t;
}

/** The photo a PSD opens as, and its layers' pixels by id (to be stored by the editor). */
export function photoFromPsd(doc: PsdDesign): { photo: Photo; pixels: PhotoPixels } {
  const layers: PhotoLayer[] = [];
  const pixels: PhotoPixels = { layers: new Map(), masks: new Map() };
  const taken = new Set<string>();
  const id = () => {
    const v = newLayerId(taken);
    taken.add(v);
    return v;
  };
  const add = (nodes: readonly PsdNode[], parent: string | undefined) => {
    for (const n of nodes) {
      const lid = id();
      const common = {
        id: lid,
        name: n.name.trim().slice(0, 60) || (n.kind === 'group' ? 'Group' : 'Layer'),
        ...(n.visible ? {} : { visible: false as const }),
        ...(n.opacity < 1 ? { opacity: Math.round(n.opacity * 100) / 100 } : {}),
        ...(parent ? { parent } : {}),
      };
      const at = n.kind === 'layer' ? { x: n.x, y: n.y } : { x: 0, y: 0 };
      if (n.mask) {
        pixels.masks.set(lid, maskRaster(n.mask, at, doc));
      }
      const mask = n.mask
        ? {
            mask: { pixels: { tiles: {} }, ...(n.mask.enabled ? {} : { enabled: false as const }) },
          }
        : {};
      if (n.kind === 'group') {
        // Children first: they sit below their group.
        add(n.children, lid);
        const g: GroupLayer = {
          ...common,
          ...mask,
          layerKind: 'group',
          ...(n.blend !== 'pass-through' ? { blend: n.blend } : {}),
          ...(n.collapsed ? { collapsed: true as const } : {}),
        };
        layers.push(g);
        continue;
      }
      pixels.layers.set(lid, TiledRaster.fromRaster(n.raster));
      const l: PixelLayer = {
        ...common,
        ...mask,
        layerKind: 'pixel',
        pixels: { tiles: {} },
        ...(n.x !== 0 || n.y !== 0 ? { offset: { x: n.x, y: n.y } } : {}),
        ...(n.blend !== 'normal' && n.blend !== 'pass-through' ? { blend: n.blend } : {}),
        ...(n.clip ? { clip: true as const } : {}),
        ...(n.lockAlpha ? { locks: { transparency: true as const } } : {}),
      };
      layers.push(l);
    }
  };
  add(doc.children, undefined);
  if (layers.length === 0 && doc.composite) {
    const lid = id();
    pixels.layers.set(lid, TiledRaster.fromRaster(doc.composite));
    layers.push({ id: lid, name: 'Background', layerKind: 'pixel', pixels: { tiles: {} } });
  }
  return {
    photo: { width: doc.width, height: doc.height, layers: normaliseStack(layers) },
    pixels,
  };
}

/** A layer's own pixels over the whole of its stored tiles, trimmed to what holds anything. */
function layerPicture(
  t: TiledRaster | undefined,
  offset: { x: number; y: number },
): { raster: Raster; x: number; y: number } {
  const bounds = t?.tileBounds();
  if (!t || !bounds)
    return {
      raster: { width: 0, height: 0, data: new Uint8ClampedArray(0) },
      x: offset.x,
      y: offset.y,
    };
  const full = t.read(bounds);
  const tight = alphaBounds(full);
  if (!tight)
    return {
      raster: { width: 0, height: 0, data: new Uint8ClampedArray(0) },
      x: offset.x,
      y: offset.y,
    };
  return {
    raster: cropRaster(full, tight),
    x: bounds.x + tight.x + offset.x,
    y: bounds.y + tight.y + offset.y,
  };
}

function psdMask(
  t: TiledRaster | undefined,
  enabled: boolean,
  at: { x: number; y: number },
  photo: { width: number; height: number },
): PsdMask | undefined {
  if (!t) return undefined;
  // The mask over the photo, in photo coordinates.
  const rect = { x: -at.x, y: -at.y, width: photo.width, height: photo.height };
  return {
    data: t.readChannel(rect),
    x: 0,
    y: 0,
    width: photo.width,
    height: photo.height,
    outside: 255,
    enabled,
  };
}

/** The PSD of a photo. `pixels` reads its layers' and masks' pixels; `text` draws text layers. */
export function psdFromPhoto(
  photo: Photo,
  pixels: PixelsLookup,
  text?: TextRasterizer,
): PsdDesign {
  const all = { x: 0, y: 0, width: photo.width, height: photo.height };
  const byParent = new Map<string | undefined, PhotoLayer[]>();
  for (const l of photo.layers) {
    const list = byParent.get(l.parent) ?? [];
    list.push(l);
    byParent.set(l.parent, list);
  }
  const nodes = (parent: string | undefined): PsdNode[] => {
    const out: PsdNode[] = [];
    const siblings = byParent.get(parent) ?? [];
    siblings.forEach((l, i) => {
      const visible = l.visible !== false;
      const opacity = l.opacity ?? 1;
      if (l.layerKind === 'group') {
        out.push({
          kind: 'group',
          name: l.name,
          opacity,
          blend: l.blend ?? 'pass-through',
          visible,
          collapsed: l.collapsed === true,
          ...(l.mask
            ? { mask: psdMask(pixels.mask(l.id), l.mask.enabled !== false, { x: 0, y: 0 }, photo)! }
            : {}),
          children: nodes(l.id),
        });
        return;
      }
      let picture: { raster: Raster; x: number; y: number };
      if (l.layerKind === 'pixel')
        picture = layerPicture(pixels.layer(l.id), l.offset ?? { x: 0, y: 0 });
      else {
        // A fill or text layer drawn alone; an adjustment as what it makes of its siblings under it,
        // at full strength (its opacity and mask go on the layer written).
        const full = (x: PhotoLayer): PhotoLayer => {
          const {
            parent: _p,
            opacity: _o,
            mask: _m,
            clip: _c,
            blend: _b,
            ...rest
          } = x as PhotoLayer & Record<string, unknown>;
          void _p;
          void _o;
          void _m;
          void _c;
          void _b;
          return rest;
        };
        let lone: PhotoLayer[];
        if (l.layerKind !== 'adjustment') lone = [full(l)];
        else {
          const below = new Set(siblings.slice(0, i).map((s) => s.id));
          lone = photo.layers
            .filter((x) => below.has(x.id) || isUnder(photo.layers, x, below))
            .map((x) => {
              if (!below.has(x.id)) return x;
              const { parent: _p, ...rest } = x;
              void _p;
              return rest;
            });
          lone.push(full(l));
        }
        const r = compositePhoto(
          { width: photo.width, height: photo.height, layers: lone },
          pixels,
          all,
          { text },
        );
        picture = { raster: r, x: 0, y: 0 };
      }
      const at = l.layerKind === 'pixel' ? (l.offset ?? { x: 0, y: 0 }) : { x: 0, y: 0 };
      out.push({
        kind: 'layer',
        name: l.name,
        raster: picture.raster,
        x: picture.x,
        y: picture.y,
        opacity,
        blend: l.layerKind === 'adjustment' ? 'normal' : (l.blend ?? 'normal'),
        visible,
        clip: l.clip === true,
        lockAlpha: l.locks?.transparency === true,
        ...(l.mask
          ? { mask: psdMask(pixels.mask(l.id), l.mask.enabled !== false, at, photo)! }
          : {}),
      });
    });
    return out;
  };
  return {
    width: photo.width,
    height: photo.height,
    children: nodes(undefined),
    composite: compositePhoto(photo, pixels, all, { text }),
  };
}

function isUnder(layers: readonly PhotoLayer[], l: PhotoLayer, groups: Set<string>): boolean {
  const byId = new Map(layers.map((x) => [x.id, x]));
  for (let at = l.parent; at; at = byId.get(at)?.parent) if (groups.has(at)) return true;
  return false;
}

/** The tiles a layer of the given picture size spans, for budgeting. */
export function tilesFor(width: number, height: number): number {
  return Math.ceil(width / PHOTO_TILE) * Math.ceil(height / PHOTO_TILE);
}
