// Offline Mode's store (each product's docs/specs/006-*/offline-mode.md): items saved only in THIS browser, in
// IndexedDB, never to the API. One record per item holds its meta and every tab body inline (offline items load
// whole, with no lazy per-tab fetch). Every editor's lib/offline/offline-store.ts binds this once with its record
// shape, its IndexedDB backend (whose database and store names stay the product's own), its id cache and its
// item projections, and keeps its own extra writes (components, item types) beside it.

// The record fields the shared operations read.
export type OfflineRecordBase<Tab> = {
  id: string;
  tabs: Tab[];
  savedAt: number;
  favourite?: boolean;
  trashedAt?: number;
};

export type OfflineChange<Rec> = (rec: Rec | undefined) => Rec | 'delete' | undefined;

export type OfflineStoreBackend<Rec> = {
  get(id: string): Promise<Rec | undefined>;
  put(rec: Rec): Promise<void>;
  delete(id: string): Promise<void>;
  all(): Promise<Rec[]>;
  // The read and the write in ONE transaction, so another browser tab's write cannot land between them and be
  // overwritten (two transactions let it: the write chain only orders this tab).
  update(id: string, change: OfflineChange<Rec>): Promise<void>;
};

// Sync Canvas's last step: what offlineDeleteIfUnchanged found.
export type OfflineDeleteOutcome<Rec> =
  { outcome: 'deleted' | 'changed'; rec: Rec } | { outcome: 'missing' };

export type OfflineStoreConfig<Rec, Tab, Item, Summary> = {
  backend: () => OfflineStoreBackend<Rec>;
  rememberId: (id: string) => void;
  forgetId: (id: string) => void;
  isOfflineIdSync: (id: string) => boolean;
  // This Browser's list (each editor's this-browser.ts) hears what every write left.
  noteThisBrowser: (id: string, after: Rec | 'delete' | undefined) => void;
  toItem: (rec: Rec) => Item;
  toSummary: (rec: Rec) => Summary;
  // A tab as the stored one migrates on read (retired schemes, retired fields).
  migrateTab: (tab: Tab) => Tab;
  // The local twin of the api's 410, for a trashed record.
  trashedError: (id: string) => Error;
  // A write whose record is gone while this tab still lists the id.
  missingError: (id: string) => Error;
};

// ---------------------------------------------------------------------------
// Pure transforms (no IndexedDB involved)
// ---------------------------------------------------------------------------

// A tab's summary row, under the product's name for the item's id (`documentId`, `designId`, `projectId`).
export function tabToSummaryFor<IdKey extends string>(idKey: IdKey) {
  return <Summary>(
    tab: { id: string; name: string; folder?: string },
    itemId: string,
    orderIndex: number,
    at: number,
  ): Summary => {
    const summary = {
      id: tab.id,
      [idKey]: itemId,
      name: tab.name,
      orderIndex,
      updatedAt: at,
    } as Record<string, unknown>;
    if (tab.folder !== undefined) summary.folder = tab.folder;
    return summary as Summary;
  };
}

// Apply a meta change (rename + tab order/folder, and a deck where the product keeps one) to a record, returning a
// new record. Mirrors the api's meta save: `tabs` (when given) reorders the existing tab bodies by id and refreshes
// each tab's folder. A deck absent leaves the stored one alone; null clears it, the server PUT's contract.
export function applyMeta<
  Tab extends { id: string; folder?: string },
  Rec extends OfflineRecordBase<Tab> & { name: string },
>(
  rec: Rec,
  patch: {
    name?: string;
    tabs?: { id: string; folder?: string }[];
    presentation?: string | null;
  },
  at: number,
): Rec {
  let tabs = rec.tabs;
  if (patch.tabs) {
    const byId = new Map(rec.tabs.map((t) => [t.id, t] as const));
    tabs = patch.tabs
      .map((entry) => {
        const tab = byId.get(entry.id);
        if (!tab) return null;
        return entry.folder === (tab.folder ?? undefined) ? tab : { ...tab, folder: entry.folder };
      })
      .filter((t): t is Tab => t !== null);
  }
  return {
    ...rec,
    name: patch.name ?? rec.name,
    tabs,
    ...(patch.presentation !== undefined ? { presentation: patch.presentation } : {}),
    savedAt: at,
  };
}

// Upsert one tab body into a record (the autosave path). A new tab id is appended; an existing one is replaced in
// place, preserving order. `stamp` stamps the tab kind where the product has kinds, for the same reason the cloud
// path stamps it: both stores must agree on what a tab IS.
export function upsertTabWith<Tab extends { id: string }, Rec extends OfflineRecordBase<Tab>>(
  rec: Rec,
  tab: Tab,
  at: number,
  stamp: (tab: Tab) => Tab = (t) => t,
): Rec {
  const stamped = stamp(tab);
  const i = rec.tabs.findIndex((t) => t.id === stamped.id);
  const tabs =
    i === -1 ? [...rec.tabs, stamped] : rec.tabs.map((t) => (t.id === stamped.id ? stamped : t));
  return { ...rec, tabs, savedAt: at };
}

export function removeTab<Tab extends { id: string }, Rec extends OfflineRecordBase<Tab>>(
  rec: Rec,
  tabId: string,
  at: number,
): Rec {
  return { ...rec, tabs: rec.tabs.filter((t) => t.id !== tabId), savedAt: at };
}

// ---------------------------------------------------------------------------
// The operations: the local mirror of the item/tab api surface
// ---------------------------------------------------------------------------

export function createOfflineStore<
  Tab extends { id: string },
  Rec extends OfflineRecordBase<Tab>,
  Item,
  Summary,
>(config: OfflineStoreConfig<Rec, Tab, Item, Summary>) {
  const { backend } = config;

  // Every mutation rewrites the WHOLE record after reading it, so two concurrent ops (two tab autosaves, or a tab
  // save racing a rename) could each read the same snapshot and the later put would silently drop the earlier
  // write. One chain serialises all read-modify-write ops in this browser tab; each is one IndexedDB transaction,
  // so queueing adds no perceptible latency. The read and the write share that transaction (updateRecord), which
  // is what keeps ANOTHER tab's write from landing between them.
  let writeChain: Promise<unknown> = Promise.resolve();

  // A record the editor may still write: present, and not in the local Trash (an editor left open on a binned item
  // must not keep changing it).
  const writable = (rec: Rec | undefined): rec is Rec =>
    rec !== undefined && rec.trashedAt === undefined;

  function serializeOfflineWrite<T>(op: () => Promise<T>): Promise<T> {
    const next = writeChain.then(op, op);
    writeChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  // Read-modify-write one record in a single transaction. Callers run it inside serializeOfflineWrite.
  function offlineUpdateRecord(id: string, change: OfflineChange<Rec>): Promise<void> {
    // What the change left, for This Browser's list.
    let after: ReturnType<OfflineChange<Rec>>;
    return backend()
      .update(id, (rec) => (after = change(rec)))
      .then(() => config.noteThisBrowser(id, after));
  }

  // The editor's writes to a live record: `change` runs on it when it is writable. A missing record is a no-op
  // when this tab has already forgotten the id (a queued autosave landing after this tab's own Sync Canvas), and
  // the product's missing error when the id is still listed: the id is forgotten first, so the autosave shows the
  // failure instead of "Saved" and its retry routes where the item now is.
  async function writeLive(id: string, change: (rec: Rec) => Rec): Promise<void> {
    await serializeOfflineWrite(async () => {
      let missing = false;
      await offlineUpdateRecord(id, (rec) => {
        missing = rec === undefined;
        return writable(rec) ? change(rec) : undefined;
      });
      if (missing && config.isOfflineIdSync(id)) {
        config.forgetId(id);
        console.warn('[offline-store] write-to-missing-record, id forgotten');
        throw config.missingError(id);
      }
    });
  }

  // Live records only: a trashed one waits in the local Trash.
  async function listItems(): Promise<Summary[]> {
    const recs = await backend().all();
    return recs.filter((r) => r.trashedAt === undefined).map(config.toSummary);
  }

  // A trashed record reads as the deleted state, the local twin of the api's 410.
  async function loadItem(id: string): Promise<Item | null> {
    const rec = await backend().get(id);
    if (rec?.trashedAt !== undefined) throw config.trashedError(id);
    return rec ? config.toItem(rec) : null;
  }

  // The offline twin of the api's rowToTab: an item kept in this browser can still be on a retired scheme or carry
  // retired element fields.
  async function loadTab(id: string, tabId: string): Promise<Tab | null> {
    const rec = await backend().get(id);
    const tab = rec?.tabs.find((t) => t.id === tabId) ?? null;
    return tab ? config.migrateTab(tab) : null;
  }

  // A new record, kept and listed; answers it as the editor hydrates it.
  async function createRecord(rec: Rec): Promise<Item> {
    await backend().put(rec);
    config.rememberId(rec.id);
    config.noteThisBrowser(rec.id, rec);
    return config.toItem(rec);
  }

  // Star / un-star (docs/specs/013-workspace/favourites.md). The savedAt stamp is left alone on purpose: a star is
  // a per-user bookmark, not an edit, and bumping it would reorder Recent on a click that changed nothing.
  async function setFavourite(id: string, favourite: boolean): Promise<void> {
    await serializeOfflineWrite(() =>
      offlineUpdateRecord(id, (rec) => (rec ? { ...rec, favourite } : undefined)),
    );
  }

  async function listFavouriteIds(): Promise<string[]> {
    const recs = await backend().all();
    return recs.filter((r) => r.favourite && r.trashedAt === undefined).map((r) => r.id);
  }

  // No create-on-missing: a save must never resurrect a deleted item. A pending debounced autosave can land AFTER
  // a sync-to-cloud deleted the record; recreating it here would shadow the freshly-synced cloud copy behind a
  // one-tab offline ghost. Records are only ever created by createRecord / offlinePutRecord.
  async function deleteTab(id: string, tabId: string, now: number): Promise<void> {
    await writeLive(id, (rec) => removeTab(rec, tabId, now));
  }

  // Serialized with the tab / meta writes so a queued save can't interleave with (or observe a half-applied)
  // delete.
  async function deleteItem(id: string): Promise<void> {
    await serializeOfflineWrite(async () => {
      await backend().delete(id);
      config.forgetId(id);
      config.noteThisBrowser(id, 'delete');
    });
  }

  // Sync Canvas's last step: remove the record only if it still matches what was uploaded, judged and done in one
  // transaction so no write (from this tab or another) can land between the check and the delete. Answers what it
  // found: `deleted` (with the record as it was), `changed` (with the record as it is now) or `missing`.
  async function offlineDeleteIfUnchanged(
    id: string,
    unchanged: (rec: Rec) => boolean,
  ): Promise<OfflineDeleteOutcome<Rec>> {
    return serializeOfflineWrite(async () => {
      let found = { outcome: 'missing' } as OfflineDeleteOutcome<Rec>;
      await offlineUpdateRecord(id, (rec) => {
        if (!rec) return undefined;
        const same = unchanged(rec);
        found = { outcome: same ? 'deleted' : 'changed', rec };
        return same ? 'delete' : undefined;
      });
      if (found.outcome !== 'changed') config.forgetId(id);
      return found;
    });
  }

  // The raw record: the Offline to Cloud conversion uploads the whole item, and "take offline" seeds one.
  async function offlineGetRecord(id: string): Promise<Rec | null> {
    return (await backend().get(id)) ?? null;
  }

  async function offlinePutRecord(rec: Rec): Promise<void> {
    await backend().put(rec);
    config.rememberId(rec.id);
    config.noteThisBrowser(rec.id, rec);
  }

  return {
    serializeOfflineWrite,
    offlineUpdateRecord,
    writeLive,
    listItems,
    loadItem,
    loadTab,
    createRecord,
    setFavourite,
    listFavouriteIds,
    deleteTab,
    deleteItem,
    offlineDeleteIfUnchanged,
    offlineGetRecord,
    offlinePutRecord,
  };
}
