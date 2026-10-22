// Layer builders for the model's tests.
import type { GroupLayer, Photo, PhotoLayer, PixelLayer } from './types';

let n = 0;
/** A layer id the parser accepts, unique per call. */
export function lid(): string {
  n += 1;
  return `ly-${n.toString(16).padStart(8, '0')}`;
}

export function pixel(id = lid(), extra: Partial<PixelLayer> = {}): PixelLayer {
  return { id, name: id, layerKind: 'pixel', pixels: { tiles: {} }, ...extra };
}

export function group(id = lid(), extra: Partial<GroupLayer> = {}): GroupLayer {
  return { id, name: id, layerKind: 'group', ...extra };
}

export function photo(layers: PhotoLayer[], extra: Partial<Photo> = {}): Photo {
  return { width: 100, height: 80, layers, ...extra };
}

export const ids = (p: Photo) => p.layers.map((l) => l.id);
