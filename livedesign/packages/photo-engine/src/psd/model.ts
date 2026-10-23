// A PSD file's content as the engine reads and writes it (docs/specs/031-photo/photo-pages.md
// "Exports and other views"): 8 bits a channel, RGB or grey, its layers as a tree (bottom first) of
// pixel layers and groups, with names, opacity, blend modes, visibility, clipping and masks.
import type { BlendMode } from '../model/types';
import type { Raster } from '../raster/raster';

export type PsdMask = {
  // Grey, one byte a pixel, over its own rect (photo coordinates).
  data: Uint8Array;
  x: number;
  y: number;
  width: number;
  height: number;
  // What lies outside the rect: 0 (hidden) or 255 (shown).
  outside: 0 | 255;
  enabled: boolean;
};

export type PsdPixelLayer = {
  kind: 'layer';
  name: string;
  // The layer's pixels and where its top-left sits in the photo.
  raster: Raster;
  x: number;
  y: number;
  opacity: number;
  blend: BlendMode;
  visible: boolean;
  clip: boolean;
  lockAlpha: boolean;
  mask?: PsdMask;
};

export type PsdGroup = {
  kind: 'group';
  name: string;
  opacity: number;
  blend: BlendMode;
  visible: boolean;
  collapsed: boolean;
  mask?: PsdMask;
  children: PsdNode[];
};

export type PsdNode = PsdPixelLayer | PsdGroup;

export type PsdDesign = {
  width: number;
  height: number;
  children: PsdNode[];
  composite?: Raster;
};

export class PsdError extends Error {
  readonly reason: 'not-psd' | 'psb' | 'depth' | 'mode' | 'too-large' | 'corrupt';
  constructor(reason: PsdError['reason'], message: string) {
    super(message);
    this.name = 'PsdError';
    this.reason = reason;
  }
}
