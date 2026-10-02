// The per-person, per-tab editor mode (docs/specs/007-editor/editor-modes.md "Where the mode
// lives"). Pure resolution plus the device-local memory behind it; the hook (useEditorMode) binds
// the two to React.
//
// - Effective mode: the person's remembered choice for the tab, else the tab's opening mode
//   (`Tab.opensIn`), else Diagram.
// - Event-storming boards are always Diagram and offer no switch.
// - View-role visitors always see the opening mode and offer no switch.
// - A choice is remembered in this browser only, one key per tab under `livediagram:v2:`, and is
//   never written onto the tab: switching changes nothing for anyone else.
import {
  editorModeSwitchable,
  isEditorMode,
  opensInOf,
  type EditorMode,
  type Tab,
} from '@livediagram/document';
import { readLocalStorageSafe, writeLocalStorageSafe } from './local-storage-safe';

export type EditorModeTab = Pick<Tab, 'id' | 'kind' | 'opensIn' | 'layers'>;

export type ResolvedEditorMode = { mode: EditorMode; canSwitch: boolean };

export function resolveEditorMode(input: {
  tab: EditorModeTab | undefined;
  remembered: EditorMode | null;
  canEdit: boolean;
}): ResolvedEditorMode {
  const { tab, remembered, canEdit } = input;
  const opening = opensInOf(tab);
  const canSwitch = !!tab && canEdit && editorModeSwitchable(tab);
  return { mode: canSwitch ? (remembered ?? opening) : opening, canSwitch };
}

const STORAGE_PREFIX = 'livediagram:v2:editor-mode:';
export const editorModeKey = (tabId: string): string => `${STORAGE_PREFIX}${tabId}`;

// Read once per tab and then served from memory: the editor resolves its mode on every render.
const cache = new Map<string, EditorMode | null>();
const listeners = new Set<() => void>();

export function readRememberedMode(tabId: string): EditorMode | null {
  if (cache.has(tabId)) return cache.get(tabId)!;
  const raw = readLocalStorageSafe(editorModeKey(tabId));
  const mode = isEditorMode(raw) ? raw : null;
  if (raw !== null && mode === null)
    console.warn('[editor-mode] remembered mode unreadable, ignored', { tabId });
  cache.set(tabId, mode);
  return mode;
}

export function rememberMode(tabId: string, mode: EditorMode): void {
  writeLocalStorageSafe(editorModeKey(tabId), mode);
  cache.set(tabId, mode);
  listeners.forEach((l) => l());
}

// Another window of this browser switched a tab: forget what was read so the next read sees it.
function onStorage(event: StorageEvent): void {
  if (event.key !== null && !event.key.startsWith(STORAGE_PREFIX)) return;
  if (event.key === null) cache.clear();
  else cache.delete(event.key.slice(STORAGE_PREFIX.length));
  listeners.forEach((l) => l());
}

export function subscribeEditorModes(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined')
    window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined')
      window.removeEventListener('storage', onStorage);
  };
}
