// A template picked after creation: an app whose New makes a blank first and lets the person pick a template on
// its start screen can only apply that template's default folder at the pick. The create notes the item it made,
// its first tab and whether the person chose the place themselves (`handTemplatePick`, this browser tab only);
// the editor takes the note at the first pick (`takeTemplatePick`) and moves the item to the template's default
// folder (`moveOnTemplatePick`) when one answers somewhere else. Every failure leaves the item where it is: being
// unable to apply a default is no reason to disturb the work.

import {
  LIST_LIMIT_MAX,
  placementDefaultKeysFor,
  type App,
  type Folder,
  type IndexClient,
} from '@liveworkspace/index-client';

const KEY = 'liveworkspace:template-pick-handoff';

export type TemplatePickHandoff = {
  itemId: string;
  tabId: string;
  // The place was the person's own choice: it is kept whatever template is picked.
  placementChosen: boolean;
};

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Notes (or, with null, drops) the item a create just made, for its first template pick. */
export function handTemplatePick(handoff: TemplatePickHandoff | null): void {
  const store = storage();
  if (!store) return;
  try {
    if (handoff) store.setItem(KEY, JSON.stringify(handoff));
    else store.removeItem(KEY);
  } catch {
    // Full or blocked storage: the template's default is simply not applied.
  }
}

export function readTemplatePick(): TemplatePickHandoff | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw: unknown = JSON.parse(store.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    const h = raw as Record<string, unknown>;
    if (typeof h.itemId !== 'string' || typeof h.tabId !== 'string') return null;
    return { itemId: h.itemId, tabId: h.tabId, placementChosen: h.placementChosen === true };
  } catch {
    return null;
  }
}

/** The note for this item's first tab, taken (read and cleared) so it applies once. */
export function takeTemplatePick(itemId: string, tabId: string): TemplatePickHandoff | null {
  const handoff = readTemplatePick();
  if (!handoff || handoff.itemId !== itemId) return null;
  handTemplatePick(null);
  return handoff.tabId === tabId ? handoff : null;
}

// Folders past this many pages are not read: a guard, not a limit anyone meets.
const MAX_FOLDER_PAGES = 50;

/**
 * Moves the item to its template's default folder, the same precedence as a create (the template's key, then the
 * app's). Resolves the toast's words ("Moved to Boards, your default folder for Kanban plans.") or null when it
 * stayed where it was.
 */
export async function moveOnTemplatePick(
  client: IndexClient,
  at: {
    app: App;
    itemId: string;
    handoff: TemplatePickHandoff;
    // The creation intent the template gives ("plan:board:kanban").
    intent: string;
    // The entry's words for the toast ("Kanban plans").
    noun: (key: string) => string;
  },
): Promise<string | null> {
  if (at.handoff.placementChosen || at.handoff.itemId !== at.itemId) return null;
  try {
    const keys = placementDefaultKeysFor(at.app, at.intent);
    const [{ item }, { defaults }] = await Promise.all([
      client.getItem(at.itemId),
      client.listPlacementDefaults(),
    ]);
    const held = new Map(defaults.map((d) => [d.key, d.folderId]));
    if (!keys.some((k) => held.has(k))) return null;
    const folders = new Map<string, Folder>();
    let cursor: string | undefined;
    for (let page = 0; page < MAX_FOLDER_PAGES; page++) {
      const res = await client.listFolders({ limit: LIST_LIMIT_MAX, cursor });
      for (const f of res.folders) folders.set(f.id, f);
      if (!res.nextCursor) break;
      cursor = res.nextCursor;
    }
    for (const key of keys) {
      const folder = folders.get(held.get(key) ?? '');
      if (!folder) continue;
      // Already there (the app's default and the template's are the same folder): nothing to move.
      if (folder.id === item.folderId && folder.teamId === item.teamId) return null;
      await client.updateItem(at.itemId, { folderId: folder.id, teamId: folder.teamId });
      return `Moved to ${folder.name}, your default folder for ${at.noun(key)}.`;
    }
    return null;
  } catch {
    return null;
  }
}
