// What the CPU draws for the GPU (docs/specs/031-photo/blueprints/photo-engine.md "The GPU
// compositor"): a gradient fill, a text layer, and a pixel layer with effects, each drawn whole as
// tiles once and kept until the layer's settings (or pixels) change.
import {
  effectsMargin,
  fillGradientLine,
  hasEffects,
  renderGradient,
  TiledRaster,
  withEffects,
  type Photo,
  type PhotoLayer,
  type PixelsLookup,
} from '@livedesign/photo-engine';
import { textTiles } from './text-raster';

type Entry = { key: string; tiles: TiledRaster };

export class ContentCache {
  private readonly entries = new Map<string, Entry>();

  /** The layer's picture, or null when the GPU draws it itself (a plain pixel layer, a solid fill). */
  get(layer: PhotoLayer, photo: Photo, pixels: PixelsLookup): TiledRaster | null {
    let key: string | null = null;
    let make: (() => TiledRaster) | null = null;
    if (layer.layerKind === 'fill' && layer.fill.kind === 'gradient') {
      const f = layer.fill;
      key = `g|${photo.width}x${photo.height}|${JSON.stringify(f)}`;
      make = () => {
        const { from, to } = fillGradientLine(photo.width, photo.height, f.angle, f.scale, f.style);
        const r = renderGradient(
          f.gradient,
          f.style,
          from,
          to,
          { x: 0, y: 0, width: photo.width, height: photo.height },
          {
            reverse: f.reverse === true,
          },
        );
        return TiledRaster.fromRaster(r);
      };
    } else if (layer.layerKind === 'text') {
      key = `t|${JSON.stringify(layer.text)}|${JSON.stringify(layer.effects ?? null)}`;
      make = () => {
        const tiles = textTiles(layer);
        return hasEffects(layer.effects) ? withEffectsTiles(tiles, { x: 0, y: 0 }, layer) : tiles;
      };
    } else if (layer.layerKind === 'pixel' && hasEffects(layer.effects)) {
      const raster = pixels.layer(layer.id);
      if (!raster) return null;
      // Keyed by the stored tiles: a stroke in progress shows without its effects until it lands.
      key = `e|${JSON.stringify(layer.pixels)}|${JSON.stringify(layer.effects)}|${JSON.stringify(layer.offset ?? null)}`;
      make = () => withEffectsTiles(raster, layer.offset ?? { x: 0, y: 0 }, layer);
    }
    if (!key || !make) return null;
    const had = this.entries.get(layer.id);
    if (had && had.key === key) return had.tiles;
    const tiles = make();
    this.entries.set(layer.id, { key, tiles });
    return tiles;
  }

  forget(layerId: string): void {
    this.entries.delete(layerId);
  }

  clear(): void {
    this.entries.clear();
  }
}

/** A layer's pixels with its effects drawn, as tiles in photo coordinates. */
function withEffectsTiles(
  raster: TiledRaster,
  at: { x: number; y: number },
  layer: PhotoLayer & { effects?: unknown },
): TiledRaster {
  const bounds = raster.tileBounds();
  if (!bounds) return new TiledRaster();
  const fx = (layer as { effects?: Parameters<typeof withEffects>[1] }).effects;
  const m = effectsMargin(fx);
  const rect = {
    x: bounds.x - m,
    y: bounds.y - m,
    width: bounds.width + m * 2,
    height: bounds.height + m * 2,
  };
  const drawn = withEffects(raster.read(rect), fx);
  return TiledRaster.fromRaster(drawn, rect.x + at.x, rect.y + at.y);
}
