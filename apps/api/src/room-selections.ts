import { MAX_SELECTION_IDS } from '@livediagram/api-schema';
import type { RoomSelection } from './room-client';

// The room's record of what each open editor has selected (docs/specs/024-agents/agent-changesets.md
// "What the room does", CS38): the api's held check asks for a tab's selections before it applies an
// agent's changeset. One DO storage key per session, so it survives hibernation like the sessions
// themselves; written on every `select`, deleted when the selection clears or the socket goes, and
// pruned on read for any session whose socket is gone.

const KEY_PREFIX = 'selection:';
// An element id longer than this is no element of ours; the same clamp the room puts on tab ids.
const MAX_ELEMENT_ID_LEN = 128;

export type StoredSelection = { tabId: string | null; elementIds: string[] };

// What the room knows about one live session, off its attachment.
export type LiveSession = { name: string; color: string; personTag: string | null };

type SelectionStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(opts: { prefix: string }): Promise<Map<string, unknown>>;
};

// A `select` op as the store keeps it: every selected id (`elementIds`, the whole selection, or the
// single `elementId` when a sender omits it), clamped; null for a cleared selection. A sender without a tab
// (an editor older than tab-scoped selections) holds on every tab.
export function selectionFromOp(op: unknown): StoredSelection | null {
  const o = (op ?? {}) as { elementId?: unknown; tabId?: unknown; elementIds?: unknown };
  const listed =
    Array.isArray(o.elementIds) && o.elementIds.length > 0
      ? o.elementIds
      : typeof o.elementId === 'string'
        ? [o.elementId]
        : [];
  const elementIds = listed
    .filter((id): id is string => typeof id === 'string' && id.length <= MAX_ELEMENT_ID_LEN)
    .slice(0, MAX_SELECTION_IDS);
  if (elementIds.length === 0) return null;
  const tabId = typeof o.tabId === 'string' ? o.tabId.slice(0, MAX_ELEMENT_ID_LEN) : null;
  return { tabId, elementIds };
}

export class RoomSelectionStore {
  private readonly storage: SelectionStorage;

  constructor(storage: SelectionStorage) {
    this.storage = storage;
  }

  async note(presenceId: string, selection: StoredSelection | null): Promise<void> {
    if (selection === null) await this.storage.delete(KEY_PREFIX + presenceId);
    else await this.storage.put(KEY_PREFIX + presenceId, selection);
  }

  async drop(presenceId: string): Promise<void> {
    await this.storage.delete(KEY_PREFIX + presenceId);
  }

  // Every live session's selection on `tabId`, whatever its role. `mine` when the session's
  // person tag equals `person`, both non-empty (CS39).
  async read(
    tabId: string,
    sessions: ReadonlyMap<string, LiveSession>,
    person: string,
  ): Promise<RoomSelection[]> {
    const out: RoomSelection[] = [];
    for (const [key, value] of await this.storage.list({ prefix: KEY_PREFIX })) {
      const presenceId = key.slice(KEY_PREFIX.length);
      const session = sessions.get(presenceId);
      if (!session) {
        await this.storage.delete(key);
        continue;
      }
      const selection = value as StoredSelection;
      if (selection.tabId !== null && selection.tabId !== tabId) continue;
      out.push({
        elementIds: selection.elementIds,
        name: session.name,
        color: session.color,
        mine: person !== '' && session.personTag !== null && session.personTag === person,
      });
    }
    return out;
  }
}
