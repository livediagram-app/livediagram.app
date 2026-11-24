// The Magnifier's settings as one small store (docs/specs/008-canvas/magnifier.md "Settings";
// docs/specs/008-canvas/blueprints/magnifier.md). Outside React on purpose: the scroll wheel changes them dozens of
// times a second, and only the lens and its cluster button subscribe, so the canvas never renders for a change.
//
// Every change is saved at once (the next lens picks it up) and reported once it settles: one
// `UI·Changed·Magnifier<Field>` per field per quiet window, so a scroll or a slider drag counts once.

import { onPageHide } from '@liveworkspace/telemetry-client';
import {
  clampSize,
  clampZoom,
  loadMagnifierConfig,
  saveMagnifierConfig,
  type MagnifierConfig,
} from '@/lib/magnifier-config';
import { track } from '@/lib/telemetry';

// One event per field per settled change (blueprint D134): the canvas sliders' window.
export const MAGNIFIER_TELEMETRY_DEBOUNCE_MS = 800;

const TELEMETRY_TYPE: Record<keyof MagnifierConfig, string> = {
  zoom: 'MagnifierZoom',
  size: 'MagnifierSize',
  shape: 'MagnifierShape',
};

export type MagnifierStore = {
  get: () => MagnifierConfig;
  set: <K extends keyof MagnifierConfig>(field: K, value: MagnifierConfig[K]) => void;
  subscribe: (listener: () => void) => () => void;
};

type Deps = {
  load: () => MagnifierConfig;
  save: (config: MagnifierConfig) => void;
  report: (field: keyof MagnifierConfig) => void;
};

const DEFAULT_DEPS: Deps = {
  load: loadMagnifierConfig,
  save: saveMagnifierConfig,
  report: (field) => track('UI', 'Changed', TELEMETRY_TYPE[field]),
};

export function createMagnifierStore(deps: Deps = DEFAULT_DEPS): MagnifierStore {
  // Read on first use, not at import: the static export renders without a browser.
  let config: MagnifierConfig | null = null;
  const listeners = new Set<() => void>();
  const pending = new Map<keyof MagnifierConfig, ReturnType<typeof setTimeout>>();
  // The page-hide flush is attached on the first change, once (the store lives as long as the page).
  let flushOnHide = false;

  const flush = () => {
    for (const [field, timer] of pending) {
      clearTimeout(timer);
      deps.report(field);
    }
    pending.clear();
  };

  const get = () => (config ??= deps.load());

  const set: MagnifierStore['set'] = (field, value) => {
    const current = get();
    const next: MagnifierConfig = { ...current, [field]: value };
    // The store owns the ranges, so every caller (the wheel, the slider, a test) gets the same clamping.
    next.zoom = clampZoom(next.zoom);
    next.size = clampSize(next.size);
    if (next[field] === current[field]) return;
    config = next;
    deps.save(next);
    for (const listener of listeners) listener();
    const waiting = pending.get(field);
    if (waiting) clearTimeout(waiting);
    pending.set(
      field,
      setTimeout(() => {
        pending.delete(field);
        deps.report(field);
      }, MAGNIFIER_TELEMETRY_DEBOUNCE_MS),
    );
    // A change made just before the page goes still counts.
    if (!flushOnHide) {
      flushOnHide = true;
      onPageHide(flush);
    }
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return { get, set, subscribe };
}

// The editor's one store: the lens, its button and the popover all read and write this.
export const magnifierStore: MagnifierStore = createMagnifierStore();
