// The page's one copy of the reader's default folders (docs/specs/013-workspace/default-folders.md
// "Surfaces"; blueprint "Behaviour and state (surfaces)"). Loaded once per owner and changed in place
// by every surface that sets or clears one, so the menus, the markers, the wizard and Settings agree
// without refetching. Writes are optimistic and roll back on refusal; telemetry fires before the
// write, as every surface's must.
import { placementDefaultTelemetryType, type PlacementDefaultKey } from '@livediagram/api-schema';
import {
  apiClearPlacementDefault,
  apiListPlacementDefaults,
  apiSetPlacementDefault,
} from '@/lib/api/placement-defaults';
import { ApiError } from '@/lib/api/core';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';
import type { PlacementDefaults } from './default-destination';

export type PlacementDefaultsStatus = 'idle' | 'loading' | 'ready' | 'failed';

export type PlacementDefaultsState = {
  ownerId: string | null;
  status: PlacementDefaultsStatus;
  defaults: PlacementDefaults;
};

/** Which surface changed a default: for the log line only. */
export type DefaultSurface = 'menu' | 'wizard' | 'settings';

const IDLE: PlacementDefaultsState = { ownerId: null, status: 'idle', defaults: new Map() };

let state: PlacementDefaultsState = IDLE;
const listeners = new Set<() => void>();

function publish(next: PlacementDefaultsState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribePlacementDefaults(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function placementDefaultsSnapshot(): PlacementDefaultsState {
  return state;
}

/** Loads this owner's defaults, once: a repeat for the same owner is a no-op, a new owner replaces
 *  the state, and an answer for an owner no longer current is dropped. */
export async function loadPlacementDefaults(ownerId: string): Promise<void> {
  if (state.ownerId === ownerId && (state.status === 'loading' || state.status === 'ready')) return;
  publish({ ownerId, status: 'loading', defaults: new Map() });
  try {
    const list = await apiListPlacementDefaults(ownerId);
    if (state.ownerId !== ownerId) return;
    publish({ ownerId, status: 'ready', defaults: new Map(list.map((d) => [d.key, d.folderId])) });
    debugLog(`[default-folders] loaded count=${list.length}`);
  } catch (err) {
    if (state.ownerId !== ownerId) return;
    publish({ ownerId, status: 'failed', defaults: new Map() });
    console.warn(
      `[default-folders] load failed status=${err instanceof ApiError ? err.status : 0}`,
    );
  }
}

function withKey(
  defaults: PlacementDefaults,
  key: PlacementDefaultKey,
  folderId: string | null,
): PlacementDefaults {
  const next = new Map(defaults);
  if (folderId === null) next.delete(key);
  else next.set(key, folderId);
  return next;
}

// One write, optimistic: the change shows at once, and a refusal puts the key back as it was.
async function write(
  key: PlacementDefaultKey,
  folderId: string | null,
  surface: DefaultSurface,
): Promise<boolean> {
  const { ownerId, status, defaults } = state;
  if (!ownerId || status !== 'ready') return false;
  const previous = defaults.get(key) ?? null;
  if (previous === folderId) return true;
  track('Folder', folderId ? 'Changed' : 'Cleared', placementDefaultTelemetryType(key));
  publish({ ...state, defaults: withKey(defaults, key, folderId) });
  try {
    if (folderId) await apiSetPlacementDefault(ownerId, key, folderId);
    else await apiClearPlacementDefault(ownerId, key);
    debugLog(`[default-folders] ${folderId ? 'set' : 'cleared'} key=${key} surface=${surface}`);
    return true;
  } catch (err) {
    if (state.ownerId === ownerId)
      publish({ ...state, defaults: withKey(state.defaults, key, previous) });
    const code = err instanceof ApiError ? (err.code ?? err.status) : 'network';
    console.warn(`[default-folders] write failed key=${key} code=${code}, rolled back`);
    return false;
  }
}

/** Makes `folderId` the key's default (a key points at one folder). Resolves whether it held. */
export function setPlacementDefault(
  key: PlacementDefaultKey,
  folderId: string,
  surface: DefaultSurface,
): Promise<boolean> {
  return write(key, folderId, surface);
}

/** Clears the key's default: its documents go back to the root. Resolves whether it held. */
export function clearPlacementDefault(
  key: PlacementDefaultKey,
  surface: DefaultSurface,
): Promise<boolean> {
  return write(key, null, surface);
}

/** Test seam: back to no owner. */
export function resetPlacementDefaultsForTests(): void {
  publish(IDLE);
}
