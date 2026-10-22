// The photo model (docs/specs/031-photo/photo-layers.md, photo-store.md): a photo page's picture as
// the tab stores it. A photo is its pixel size and its layer stack; a layer's pixels are tiles named
// by blob id, kept in the photo blob store. Pure data, shared by the editor, its workers and the api.

/** A blob's name: the first 16 bytes of the SHA-256 of its bytes, base64url (22 characters). */
export type BlobId = string;

/** A tile's place in its layer: `"col.row"`, each counted in tiles from the layer's origin. */
export type TileKey = string;

/** A layer's or a mask's tiles by place; an empty string is a cleared tile (transparent; a mask's black). */
export type TileMap = Record<TileKey, BlobId>;

/** A whole picture under a layer's tiles (the picture a photo was opened from). */
export type PixelSource = { blob: BlobId; width: number; height: number };

export type LayerPixels = { tiles: TileMap; source?: PixelSource };

export type Point = { x: number; y: number };

export type BlendMode =
  | 'normal'
  | 'dissolve'
  | 'darken'
  | 'multiply'
  | 'colour-burn'
  | 'linear-burn'
  | 'darker-colour'
  | 'lighten'
  | 'screen'
  | 'colour-dodge'
  | 'linear-dodge'
  | 'lighter-colour'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'vivid-light'
  | 'linear-light'
  | 'pin-light'
  | 'hard-mix'
  | 'difference'
  | 'exclusion'
  | 'subtract'
  | 'divide'
  | 'hue'
  | 'saturation'
  | 'colour'
  | 'luminosity'
  | 'pass-through';

export type LayerLocks = { transparency?: true; pixels?: true; position?: true; all?: true };

export type LayerMask = {
  pixels: LayerPixels;
  // Absent is enabled.
  enabled?: false;
  // Absent is linked: the mask moves with its layer.
  linked?: false;
  // An unlinked mask's own offset; a linked mask uses its layer's.
  offset?: Point;
};

/** A colour as `#rrggbb`. */
export type Hex = string;

export type ShadowEffect = {
  enabled?: false;
  colour: Hex;
  opacity: number;
  angle: number;
  distance: number;
  size: number;
  spread: number;
};
export type GlowEffect = {
  enabled?: false;
  colour: Hex;
  opacity: number;
  size: number;
  spread: number;
};
export type StrokeEffect = {
  enabled?: false;
  colour: Hex;
  size: number;
  position: 'outside' | 'inside' | 'centre';
};
export type OverlayEffect = { enabled?: false; colour: Hex; opacity: number; blend: BlendMode };
export type LayerEffects = {
  shadow?: ShadowEffect;
  glow?: GlowEffect;
  stroke?: StrokeEffect;
  overlay?: OverlayEffect;
};

export type GradientStyle = 'linear' | 'radial' | 'angle' | 'reflected' | 'diamond';
export type ColourStop = { at: number; colour: Hex };
export type OpacityStop = { at: number; opacity: number };
export type Gradient = { colours: ColourStop[]; opacities: OpacityStop[] };

export type SolidFill = { kind: 'solid'; colour: Hex };
export type GradientFill = {
  kind: 'gradient';
  gradient: Gradient;
  style: GradientStyle;
  // Degrees, 0 is left to right.
  angle: number;
  // 0.1 to 10: the gradient's length as a share of the photo's diagonal.
  scale: number;
  reverse?: true;
};

export type TextAlign = 'left' | 'centre' | 'right';
export type TextSpec = {
  text: string;
  font: string;
  size: number;
  weight: 400 | 500 | 700;
  italic?: true;
  colour: Hex;
  align: TextAlign;
  lineHeight?: number;
  tracking?: number;
  at: Point;
  boxWidth?: number;
};

// The adjustment ids (docs/specs/031-photo/photo-adjustments.md "The adjustments").
export type AdjustmentId =
  | 'brightness'
  | 'levels'
  | 'curves'
  | 'exposure'
  | 'vibrance'
  | 'hue-saturation'
  | 'colour-balance'
  | 'white-balance'
  | 'black-white'
  | 'photo-filter'
  | 'channel-mixer'
  | 'selective-colour'
  | 'gradient-map'
  | 'invert'
  | 'posterize'
  | 'threshold'
  | 'shadows-highlights'
  | 'desaturate'
  | 'equalize';

/** An adjustment and its settings; the settings' shape is the catalogue's (adjust/catalogue.ts). */
export type PhotoAdjustment = { id: AdjustmentId; params: Record<string, unknown> };

type LayerBase = {
  id: string;
  name: string;
  visible?: false;
  // 0 to 1; absent is 1.
  opacity?: number;
  // Absent is normal (pass-through for a group).
  blend?: BlendMode;
  locks?: LayerLocks;
  clip?: true;
  // The group it is in; absent is the top level.
  parent?: string;
  mask?: LayerMask;
};

export type PixelLayer = LayerBase & {
  layerKind: 'pixel';
  pixels: LayerPixels;
  offset?: Point;
  effects?: LayerEffects;
};
export type AdjustmentLayer = LayerBase & { layerKind: 'adjustment'; adjustment: PhotoAdjustment };
export type FillLayer = LayerBase & { layerKind: 'fill'; fill: SolidFill | GradientFill };
export type TextLayer = LayerBase & { layerKind: 'text'; text: TextSpec; effects?: LayerEffects };
export type GroupLayer = LayerBase & { layerKind: 'group'; collapsed?: true };

export type PhotoLayer = PixelLayer | AdjustmentLayer | FillLayer | TextLayer | GroupLayer;
export type LayerKind = PhotoLayer['layerKind'];

export type Photo = {
  width: number;
  height: number;
  // Stack order, bottom first; a group's children sit contiguously directly below it.
  layers: PhotoLayer[];
  preview?: BlobId;
  rev?: number;
};

/** One change to a photo, as the `photo` room op carries it (docs/specs/031-photo/photo-store.md
 *  "Live sync"). */
export type PhotoOp =
  | { op: 'size'; width: number; height: number }
  // `after`: the id of the layer under it at the sender, so a new layer lands in the same place.
  | { op: 'put'; layer: PhotoLayer; after?: string | null }
  | { op: 'remove'; id: string }
  | { op: 'order'; ids: string[] }
  | { op: 'preview'; blob: BlobId | null };
