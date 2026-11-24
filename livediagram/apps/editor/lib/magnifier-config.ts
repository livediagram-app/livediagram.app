// The Magnifier's settings (docs/specs/008-canvas/magnifier.md "Settings"): how much the lens enlarges, how
// big it is and its shape. Device-local, like the Spotlight's (docs/specs/008-canvas/spotlight-panel.md): how big
// a lens you want depends on your screen, not on the document.

import {
  readLocalStorageSafe,
  safeJson,
  storedRecord,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';

export type MagnifierShape = 'square' | 'round';
export type MagnifierConfig = { zoom: number; size: number; shape: MagnifierShape };
export type MagnifierSizePreset = 'small' | 'medium' | 'large' | 'custom';

export const DEFAULT_MAGNIFIER_CONFIG: MagnifierConfig = { zoom: 2, size: 240, shape: 'square' };

// The slider moves in half steps; the wheel in finer ones (one decimal).
export const MAGNIFIER_ZOOM_RANGE = { min: 1.5, max: 6, step: 0.5 } as const;
export const MAGNIFIER_SIZE_RANGE = { min: 120, max: 480 } as const;

export const MAGNIFIER_SIZES: readonly {
  id: Exclude<MagnifierSizePreset, 'custom'>;
  label: string;
  px: number;
}[] = [
  { id: 'small', label: 'Small', px: 160 },
  { id: 'medium', label: 'Medium', px: 240 },
  { id: 'large', label: 'Large', px: 360 },
];

export const MAGNIFIER_SHAPES: readonly { id: MagnifierShape; label: string }[] = [
  { id: 'square', label: 'Square' },
  { id: 'round', label: 'Round' },
];

export const MAGNIFIER_STORAGE_KEY = 'livediagram:v2:magnifier-config';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function clampZoom(zoom: number): number {
  return Math.round(clamp(zoom, MAGNIFIER_ZOOM_RANGE.min, MAGNIFIER_ZOOM_RANGE.max) * 10) / 10;
}

export function clampSize(size: number): number {
  return Math.round(clamp(size, MAGNIFIER_SIZE_RANGE.min, MAGNIFIER_SIZE_RANGE.max));
}

// Whatever was stored (or nothing), as a config the lens can draw: out of range is clamped, broken is the default.
export function clampMagnifierConfig(raw: unknown): MagnifierConfig {
  const record = storedRecord(raw);
  if (!record) return DEFAULT_MAGNIFIER_CONFIG;
  const { zoom, size, shape } = record;
  return {
    zoom:
      typeof zoom === 'number' && Number.isFinite(zoom)
        ? clampZoom(zoom)
        : DEFAULT_MAGNIFIER_CONFIG.zoom,
    size:
      typeof size === 'number' && Number.isFinite(size)
        ? clampSize(size)
        : DEFAULT_MAGNIFIER_CONFIG.size,
    shape: shape === 'round' || shape === 'square' ? shape : DEFAULT_MAGNIFIER_CONFIG.shape,
  };
}

// Which size row the lens matches, or `custom` once Shift+scroll left it between them.
export function magnifierSizePreset(size: number): MagnifierSizePreset {
  return MAGNIFIER_SIZES.find((s) => s.px === Math.round(size))?.id ?? 'custom';
}

// "2x", "2.5x", "3.2x": the magnification as the button and the badge say it.
export function formatMagnification(zoom: number): string {
  return `${Math.round(zoom * 10) / 10}x`;
}

export function loadMagnifierConfig(): MagnifierConfig {
  const raw = readLocalStorageSafe(MAGNIFIER_STORAGE_KEY);
  return raw === null ? DEFAULT_MAGNIFIER_CONFIG : clampMagnifierConfig(safeJson(raw));
}

export function saveMagnifierConfig(config: MagnifierConfig): void {
  writeLocalStorageSafe(MAGNIFIER_STORAGE_KEY, JSON.stringify(config));
}
