// Brush Presets (docs/specs/031-photo/photo-tools.md "Shared gestures and options"): a row of saved tips,
// each a size, hardness, flow and spacing, taken by any tool with the brush options. Seven come built in;
// Save Preset keeps the tip in hand as the person's own, in this browser, deletable. Pure but for the store.
import { useSyncExternalStore } from 'react';

export type BrushTip = { size: number; hardness: number; flow: number; spacing: number };
export type BrushPreset = BrushTip & { id: string; name: string; own?: true };

export const BUILT_IN_PRESETS: readonly BrushPreset[] = [
  { id: 'soft-round', name: 'Soft Round', size: 60, hardness: 0, flow: 1, spacing: 0.1 },
  { id: 'hard-round', name: 'Hard Round', size: 30, hardness: 1, flow: 1, spacing: 0.1 },
  { id: 'airbrush', name: 'Airbrush', size: 120, hardness: 0, flow: 0.08, spacing: 0.05 },
  { id: 'chalk', name: 'Chalk', size: 40, hardness: 0.6, flow: 0.5, spacing: 0.4 },
  { id: 'ink', name: 'Ink', size: 6, hardness: 1, flow: 1, spacing: 0.05 },
  { id: 'marker', name: 'Marker', size: 24, hardness: 0.8, flow: 0.6, spacing: 0.15 },
  { id: 'spray', name: 'Spray', size: 80, hardness: 0.2, flow: 0.15, spacing: 0.8 },
];

// The most presets a person keeps; saving past it drops the oldest of their own.
export const OWN_PRESETS_MAX = 24;
const STORAGE_KEY = 'livedesign:photo-brush-presets';

const isTip = (v: unknown): v is BrushPreset => {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    [p.size, p.hardness, p.flow, p.spacing].every(
      (n) => typeof n === 'number' && Number.isFinite(n),
    )
  );
};

let own: readonly BrushPreset[] | null = null;
const listeners = new Set<() => void>();

function load(): readonly BrushPreset[] {
  if (own) return own;
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    own = Array.isArray(list) ? list.filter(isTip).map((p) => ({ ...p, own: true as const })) : [];
  } catch {
    own = [];
  }
  return own;
}

function save(next: readonly BrushPreset[]): void {
  own = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A full or blocked store: the presets stay for the session.
  }
  for (const fn of listeners) fn();
}

/** The presets offered: the built-in ones, then the person's own, oldest first. */
export function brushPresets(): readonly BrushPreset[] {
  return [...BUILT_IN_PRESETS, ...load()];
}

/** The tip in hand kept as a preset of the person's own; answers it. */
export function savePreset(name: string, tip: BrushTip): BrushPreset {
  const list = load();
  const trimmed = name.trim() || `Preset ${list.length + 1}`;
  const preset: BrushPreset = {
    id: `own-${Date.now().toString(36)}-${list.length}`,
    name: trimmed.slice(0, 40),
    size: tip.size,
    hardness: tip.hardness,
    flow: tip.flow,
    spacing: tip.spacing,
    own: true,
  };
  save([...list, preset].slice(-OWN_PRESETS_MAX));
  return preset;
}

/** One of the person's own presets deleted (the built-in ones stay). */
export function deletePreset(id: string): void {
  save(load().filter((p) => p.id !== id));
}

/** The tip a preset gives, without its name. */
export const tipOf = (p: BrushPreset): BrushTip => ({
  size: p.size,
  hardness: p.hardness,
  flow: p.flow,
  spacing: p.spacing,
});

export function useBrushPresets(): readonly BrushPreset[] {
  const mine = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    load,
    () => [],
  );
  return [...BUILT_IN_PRESETS, ...mine];
}
