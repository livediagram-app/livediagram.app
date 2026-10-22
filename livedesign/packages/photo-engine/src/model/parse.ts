// Reading a stored photo defensively (docs/specs/031-photo/photo-layers.md "A layer", photo-store.md
// "What is stored where"): a malformed optional field is dropped, a layer with no valid id or kind is
// skipped, a parent naming no group is cleared, and the stack is cut to the layer cap.
import { isBlendMode } from './blend-modes';
import { isBlobId, isLayerId, parseTileKey } from './ids';
import {
  PHOTO_LAYER_NAME_MAX,
  PHOTO_MAX_AREA,
  PHOTO_MAX_LAYERS,
  PHOTO_PIXEL_CAP,
  PHOTO_TEXT_MAX,
} from './limits';
import { normaliseStack } from './stack';
import type {
  AdjustmentId,
  ColourStop,
  Gradient,
  GradientFill,
  GradientStyle,
  Hex,
  LayerEffects,
  LayerLocks,
  LayerMask,
  LayerPixels,
  OpacityStop,
  Photo,
  PhotoAdjustment,
  PhotoLayer,
  Point,
  SolidFill,
  TextSpec,
  TileMap,
} from './types';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const HEX = /^#[0-9a-f]{6}$/i;

export function isHex(v: unknown): v is Hex {
  return typeof v === 'string' && HEX.test(v);
}

function finite(v: unknown, min: number, max: number): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
}

function whole(v: unknown, min: number, max: number): number | undefined {
  const n = finite(v, min, max);
  return n !== undefined && Number.isInteger(n) ? n : undefined;
}

// How far a layer's pixels may sit from the photo's origin, either way.
const OFFSET_REACH = PHOTO_PIXEL_CAP * 2;

function parsePoint(v: unknown): Point | undefined {
  if (!isRec(v)) return undefined;
  const x = whole(v.x, -OFFSET_REACH, OFFSET_REACH);
  const y = whole(v.y, -OFFSET_REACH, OFFSET_REACH);
  return x === undefined || y === undefined ? undefined : { x, y };
}

export function parseTileMap(v: unknown): TileMap {
  const out: TileMap = {};
  if (!isRec(v)) return out;
  for (const [k, id] of Object.entries(v)) {
    if (!parseTileKey(k)) continue;
    if (id === '' || isBlobId(id)) out[k] = id;
  }
  return out;
}

export function parsePixels(v: unknown): LayerPixels {
  if (!isRec(v)) return { tiles: {} };
  const tiles = parseTileMap(v.tiles);
  const s = v.source;
  if (isRec(s) && isBlobId(s.blob)) {
    const width = whole(s.width, 1, PHOTO_PIXEL_CAP);
    const height = whole(s.height, 1, PHOTO_PIXEL_CAP);
    if (width !== undefined && height !== undefined)
      return { tiles, source: { blob: s.blob, width, height } };
  }
  return { tiles };
}

function parseLocks(v: unknown): LayerLocks | undefined {
  if (!isRec(v)) return undefined;
  const locks: LayerLocks = {};
  if (v.transparency === true) locks.transparency = true;
  if (v.pixels === true) locks.pixels = true;
  if (v.position === true) locks.position = true;
  if (v.all === true) locks.all = true;
  return Object.keys(locks).length > 0 ? locks : undefined;
}

function parseMask(v: unknown): LayerMask | undefined {
  if (!isRec(v)) return undefined;
  const mask: LayerMask = { pixels: parsePixels(v.pixels) };
  if (v.enabled === false) mask.enabled = false;
  if (v.linked === false) {
    mask.linked = false;
    const offset = parsePoint(v.offset);
    if (offset) mask.offset = offset;
  }
  return mask;
}

function parseEffects(v: unknown): LayerEffects | undefined {
  if (!isRec(v)) return undefined;
  const fx: LayerEffects = {};
  const off = (e: Rec) => (e.enabled === false ? { enabled: false as const } : {});
  const s = v.shadow;
  if (isRec(s) && isHex(s.colour)) {
    const opacity = finite(s.opacity, 0, 1);
    const angle = finite(s.angle, -360, 360);
    const distance = finite(s.distance, 0, 1000);
    const size = finite(s.size, 0, 250);
    const spread = finite(s.spread, 0, 1);
    if (
      opacity !== undefined &&
      angle !== undefined &&
      distance !== undefined &&
      size !== undefined &&
      spread !== undefined
    )
      fx.shadow = { ...off(s), colour: s.colour, opacity, angle, distance, size, spread };
  }
  const g = v.glow;
  if (isRec(g) && isHex(g.colour)) {
    const opacity = finite(g.opacity, 0, 1);
    const size = finite(g.size, 0, 250);
    const spread = finite(g.spread, 0, 1);
    if (opacity !== undefined && size !== undefined && spread !== undefined)
      fx.glow = { ...off(g), colour: g.colour, opacity, size, spread };
  }
  const st = v.stroke;
  if (isRec(st) && isHex(st.colour)) {
    const size = finite(st.size, 1, 250);
    const position =
      st.position === 'inside' || st.position === 'centre' || st.position === 'outside'
        ? st.position
        : undefined;
    if (size !== undefined && position)
      fx.stroke = { ...off(st), colour: st.colour, size, position };
  }
  const o = v.overlay;
  if (isRec(o) && isHex(o.colour)) {
    const opacity = finite(o.opacity, 0, 1);
    const blend = isBlendMode(o.blend) && o.blend !== 'pass-through' ? o.blend : 'normal';
    if (opacity !== undefined) fx.overlay = { ...off(o), colour: o.colour, opacity, blend };
  }
  return Object.keys(fx).length > 0 ? fx : undefined;
}

const GRADIENT_STYLES: readonly GradientStyle[] = [
  'linear',
  'radial',
  'angle',
  'reflected',
  'diamond',
];
// The most stops a gradient keeps, of each kind.
const MAX_STOPS = 32;

export function parseGradient(v: unknown): Gradient | undefined {
  if (!isRec(v) || !Array.isArray(v.colours)) return undefined;
  const colours: ColourStop[] = [];
  for (const s of v.colours.slice(0, MAX_STOPS)) {
    if (!isRec(s) || !isHex(s.colour)) continue;
    const at = finite(s.at, 0, 1);
    if (at !== undefined) colours.push({ at, colour: s.colour });
  }
  if (colours.length === 0) return undefined;
  const opacities: OpacityStop[] = [];
  for (const s of Array.isArray(v.opacities) ? v.opacities.slice(0, MAX_STOPS) : []) {
    if (!isRec(s)) continue;
    const at = finite(s.at, 0, 1);
    const opacity = finite(s.opacity, 0, 1);
    if (at !== undefined && opacity !== undefined) opacities.push({ at, opacity });
  }
  colours.sort((a, b) => a.at - b.at);
  opacities.sort((a, b) => a.at - b.at);
  return {
    colours,
    opacities:
      opacities.length > 0
        ? opacities
        : [
            { at: 0, opacity: 1 },
            { at: 1, opacity: 1 },
          ],
  };
}

function parseFill(v: unknown): SolidFill | GradientFill | undefined {
  if (!isRec(v)) return undefined;
  if (v.kind === 'solid') return isHex(v.colour) ? { kind: 'solid', colour: v.colour } : undefined;
  if (v.kind !== 'gradient') return undefined;
  const gradient = parseGradient(v.gradient);
  if (!gradient) return undefined;
  const style = GRADIENT_STYLES.includes(v.style as GradientStyle)
    ? (v.style as GradientStyle)
    : 'linear';
  return {
    kind: 'gradient',
    gradient,
    style,
    angle: finite(v.angle, -360, 360) ?? 90,
    scale: finite(v.scale, 0.1, 10) ?? 1,
    ...(v.reverse === true ? { reverse: true as const } : {}),
  };
}

function parseText(v: unknown): TextSpec | undefined {
  if (!isRec(v) || typeof v.text !== 'string' || typeof v.font !== 'string') return undefined;
  const size = finite(v.size, 4, 2000);
  const at = parsePoint(v.at);
  if (size === undefined || !at || !isHex(v.colour)) return undefined;
  const weight = v.weight === 500 || v.weight === 700 ? v.weight : 400;
  const align = v.align === 'centre' || v.align === 'right' ? v.align : 'left';
  const lineHeight = finite(v.lineHeight, 0.8, 3);
  const tracking = finite(v.tracking, -0.2, 1);
  const boxWidth = finite(v.boxWidth, 1, PHOTO_PIXEL_CAP * 2);
  return {
    text: v.text.slice(0, PHOTO_TEXT_MAX),
    font: v.font.slice(0, 64),
    size,
    weight,
    ...(v.italic === true ? { italic: true as const } : {}),
    colour: v.colour,
    align,
    ...(lineHeight !== undefined ? { lineHeight } : {}),
    ...(tracking !== undefined ? { tracking } : {}),
    at,
    ...(boxWidth !== undefined ? { boxWidth } : {}),
  };
}

const ADJUSTMENT_IDS: readonly AdjustmentId[] = [
  'brightness',
  'levels',
  'curves',
  'exposure',
  'vibrance',
  'hue-saturation',
  'colour-balance',
  'white-balance',
  'black-white',
  'photo-filter',
  'channel-mixer',
  'selective-colour',
  'gradient-map',
  'invert',
  'posterize',
  'threshold',
  'shadows-highlights',
  'desaturate',
  'equalize',
];

export function isAdjustmentId(v: unknown): v is AdjustmentId {
  return typeof v === 'string' && (ADJUSTMENT_IDS as readonly string[]).includes(v);
}

// The most characters an adjustment's settings take as JSON: a Curves of 4 channels of 16 points is
// well under it.
const ADJUSTMENT_PARAMS_MAX_CHARS = 8000;

function parseAdjustment(v: unknown): PhotoAdjustment | undefined {
  if (!isRec(v) || !isAdjustmentId(v.id)) return undefined;
  const params = isRec(v.params) ? v.params : {};
  // The settings are read by the catalogue (adjust/catalogue.ts) with their own bounds; here they
  // are only kept small and plain.
  let json: string;
  try {
    json = JSON.stringify(params);
  } catch {
    return { id: v.id, params: {} };
  }
  if (json.length > ADJUSTMENT_PARAMS_MAX_CHARS) return { id: v.id, params: {} };
  return { id: v.id, params: JSON.parse(json) as Record<string, unknown> };
}

/** A stored layer, or undefined when it has no valid id or kind (or its kind's required field). */
export function parseLayer(v: unknown): PhotoLayer | undefined {
  if (!isRec(v) || !isLayerId(v.id)) return undefined;
  const name =
    typeof v.name === 'string' && v.name.trim()
      ? v.name.trim().slice(0, PHOTO_LAYER_NAME_MAX)
      : 'Layer';
  const opacity = finite(v.opacity, 0, 1);
  const locks = parseLocks(v.locks);
  const mask = parseMask(v.mask);
  const base = {
    id: v.id,
    name,
    ...(v.visible === false ? { visible: false as const } : {}),
    ...(opacity !== undefined && opacity !== 1 ? { opacity: Math.round(opacity * 100) / 100 } : {}),
    ...(locks ? { locks } : {}),
    ...(v.clip === true ? { clip: true as const } : {}),
    ...(isLayerId(v.parent) && v.parent !== v.id ? { parent: v.parent } : {}),
    ...(mask ? { mask } : {}),
  };
  const blend = isBlendMode(v.blend) ? v.blend : undefined;
  switch (v.layerKind) {
    case 'pixel': {
      const offset = parsePoint(v.offset);
      const effects = parseEffects(v.effects);
      return {
        ...base,
        ...(blend && blend !== 'normal' && blend !== 'pass-through' ? { blend } : {}),
        layerKind: 'pixel',
        pixels: parsePixels(v.pixels),
        ...(offset && (offset.x !== 0 || offset.y !== 0) ? { offset } : {}),
        ...(effects ? { effects } : {}),
      };
    }
    case 'adjustment': {
      const adjustment = parseAdjustment(v.adjustment);
      if (!adjustment) return undefined;
      return {
        ...base,
        ...(blend && blend !== 'normal' && blend !== 'pass-through' ? { blend } : {}),
        layerKind: 'adjustment',
        adjustment,
      };
    }
    case 'fill': {
      const fill = parseFill(v.fill);
      if (!fill) return undefined;
      return {
        ...base,
        ...(blend && blend !== 'normal' && blend !== 'pass-through' ? { blend } : {}),
        layerKind: 'fill',
        fill,
      };
    }
    case 'text': {
      const text = parseText(v.text);
      if (!text) return undefined;
      const effects = parseEffects(v.effects);
      return {
        ...base,
        ...(blend && blend !== 'normal' && blend !== 'pass-through' ? { blend } : {}),
        layerKind: 'text',
        text,
        ...(effects ? { effects } : {}),
      };
    }
    case 'group':
      return {
        ...base,
        // A group's own default is Pass Through, so Normal is stored and Pass Through is not.
        ...(blend && blend !== 'pass-through' ? { blend } : {}),
        layerKind: 'group',
        ...(v.collapsed === true ? { collapsed: true as const } : {}),
      };
    default:
      return undefined;
  }
}

/** A stored photo, or undefined when its size is not valid. */
export function parsePhoto(v: unknown): Photo | undefined {
  if (!isRec(v)) return undefined;
  const width = whole(v.width, 1, PHOTO_PIXEL_CAP);
  const height = whole(v.height, 1, PHOTO_PIXEL_CAP);
  if (width === undefined || height === undefined || width * height > PHOTO_MAX_AREA)
    return undefined;
  const seen = new Set<string>();
  const layers: PhotoLayer[] = [];
  for (const raw of Array.isArray(v.layers) ? v.layers : []) {
    const layer = parseLayer(raw);
    if (!layer || seen.has(layer.id)) continue;
    seen.add(layer.id);
    layers.push(layer);
  }
  const rev = whole(v.rev, 0, Number.MAX_SAFE_INTEGER);
  return {
    width,
    height,
    // The cap keeps the top of the stack: its newest layers.
    layers: normaliseStack(layers).slice(-PHOTO_MAX_LAYERS),
    ...(isBlobId(v.preview) ? { preview: v.preview } : {}),
    ...(rev !== undefined ? { rev } : {}),
  };
}

const PAGE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const EMPTY: Readonly<Record<string, Photo>> = Object.freeze({});
const READ = new WeakMap<object, Record<string, Photo>>();

export function isPhotoPageId(v: unknown): v is string {
  return typeof v === 'string' && PAGE_ID.test(v);
}

/** The tab's photos by page id, each read defensively; an unreadable one is left out. */
export function photosOf(tab: { photos?: unknown } | undefined): Readonly<Record<string, Photo>> {
  const raw = tab?.photos;
  if (!isRec(raw)) return EMPTY;
  // Read once per stored object: the editor asks on every render, and a tab's photos only change
  // by being replaced.
  const cached = READ.get(raw);
  if (cached) return cached;
  const out: Record<string, Photo> = {};
  for (const [pageId, v] of Object.entries(raw)) {
    if (!isPhotoPageId(pageId)) continue;
    const photo = parsePhoto(v);
    if (photo) out[pageId] = photo;
  }
  READ.set(raw, out);
  return out;
}
