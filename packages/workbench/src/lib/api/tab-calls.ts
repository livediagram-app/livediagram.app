// Per-tab calls: lazy load, upsert (the autosave path), the unload flush, the comment endpoints, linking a tab into
// another item, and delete (each product's docs/specs/006-*/per-tab-storage.md). Every editor's lib/api/tabs.ts binds
// this once with its api core, its item path (`documents`, `designs`, `projects`), its offline store and the few
// places its copy had drifted, and keeps only its own extra calls.
import { dedupeInFlight } from '../dedupe';
import { createTabDeltaSaves, type TabDeltaConfig } from './tab-delta-save';
import { createTabDrafts, type TabDraftEvent, type TabDraftStore } from './tab-drafts';

type ApiHeaders = (
  ownerId: string,
  opts?: { share?: string | null; body?: boolean; extra?: Record<string, string> },
) => Promise<HeadersInit>;

// The tab fields the calls read.
type TabBase = { id: string; folder?: string; elements: { type: string }[] };

export type TabCallsConfig<Tab extends TabBase, NoGrant> = {
  core: {
    API_BASE: string;
    apiFetch: (input: string, init?: RequestInit, opts?: NoGrant) => Promise<Response>;
    apiHeaders: ApiHeaders;
    expectOk: <T>(res: Response, action: string) => Promise<T>;
    expectOkOrNull: <T>(res: Response, action: string) => Promise<T | null>;
    expectOkVoid: (res: Response, action: string) => Promise<void>;
    apiDelete: (
      url: string,
      ownerId: string,
      opts: { action: string; share?: string | null },
    ) => Promise<void>;
    tabForWire: (tab: Tab) => unknown;
    saveTimeoutSignal: (body: string) => AbortSignal;
  };
  // The item's collection in the api's paths, and its id's name in the tab the api answers.
  itemPath: string;
  idKey: string;
  changesetSeenHeader: string;
  offline: {
    isOfflineId: (id: string) => Promise<boolean>;
    isOfflineIdSync: (id: string) => boolean;
    loadTab: (id: string, tabId: string) => Promise<Tab | null>;
    saveTab: (id: string, tab: Tab, now: number) => Promise<void>;
    deleteTab: (id: string, tabId: string, now: number) => Promise<void>;
    saveMeta: (
      id: string,
      patch: { name: string; tabs: { id: string; folder?: string }[] },
      now: number,
    ) => Promise<void>;
    // This browser counts an offline item's opens, since the server never sees it.
    recordOpen: (id: string, now: number) => Promise<unknown>;
  };
  // How a read declares itself an open of the item, for the reader's Home: a header on the tab read, or a call of
  // its own beside it (the index's recordOpen).
  openHeader?: string;
  onOpen?: (itemId: string, shareCode: string | null) => void;
  // Coerce what the store holds into what the editor renders (tables to rectangular grids); absent, as stored.
  normalizeElement?: (el: Tab['elements'][number]) => Tab['elements'][number];
  // The header a save's change summary rides in, where the product sends one.
  saveChangesHeader?: string;
  // The unload flush's headers, built synchronously; null skips the flush.
  unloadHeaders: (
    ownerId: string,
    itemId: string,
    shareCode: string | null,
  ) => Record<string, string> | null;
  // Whether a body may go as keepalive now. Absent, each flush keeps its own 60 KB budget.
  takeKeepalive?: (body: string | undefined) => boolean;
  // The unload flush's requests go at once, with the grant they hold.
  noGrantWait: NoGrant;
  // Delta saves (livediagram's docs/specs/006-document/delta-saves.md): the product's element diff. Absent, every
  // save sends the whole tab and no base copy is held.
  delta?: TabDeltaConfig<Tab['elements'][number] & { id: string }>;
  // Drafts of the unload flush's tabs (delta-saves.md "Drafts of unsaved changes"), with `delta` only: the browser
  // storage they live in. Absent, no draft is kept or read.
  drafts?: TabDraftStore;
};

// The keepalive bodies one unload flush sends at most: browsers allow 64 KB in all per page; the rest is headroom
// for another keepalive request in flight. Safe range: 32 KB to 63 KB.
const KEEPALIVE_BUDGET_BYTES = 60 * 1024;

export type AddedComment = {
  id: string;
  text: string;
  createdAt: number;
  authorName: string;
  authorColor: string;
};

// The headers an unload request about one item carries, built synchronously: identity, the share link, the held
// grant and the share password. Null for a signed-in owner with no cached token, whose requests would only 401.
export function createUnloadHeaders(deps: {
  identityHeaders: (ownerId: string, token: string | null) => Record<string, string>;
  getLastKnownToken: () => string | null;
  heldGrant: (itemId: string, share: { code: string } | null) => string | null;
  grantHeader: string;
  getSessionSharePassword: () => string | null;
}) {
  return (
    ownerId: string,
    itemId: string,
    shareCode: string | null,
  ): Record<string, string> | null => {
    let base: Record<string, string>;
    try {
      base = deps.identityHeaders(ownerId, deps.getLastKnownToken());
    } catch {
      console.warn('[save] unload flush skipped: no session token for a signed-in owner');
      return null;
    }
    if (shareCode) base['X-Share-Code'] = shareCode;
    const grant = deps.heldGrant(itemId, shareCode ? { code: shareCode } : null);
    if (grant) base[deps.grantHeader] = grant;
    // The share password is a synchronous session read too: without it an edit-role visitor's flush 403s on a
    // protected item, losing the final debounce window's edits.
    const sharePassword = deps.getSessionSharePassword();
    if (sharePassword) base['X-Share-Password'] = sharePassword;
    return base;
  };
}

// The revision a save wrote and the elements it stored, from the tab the api echoes; null when the answer names none.
async function savedEchoOf(
  res: Response,
): Promise<{ rev: number | null; elements: unknown[] | null }> {
  try {
    const body = (await res.json()) as { tab?: { rev?: unknown; elements?: unknown } };
    const rev = body.tab?.rev;
    const elements = body.tab?.elements;
    return {
      rev: typeof rev === 'number' ? rev : null,
      elements: Array.isArray(elements) ? elements : null,
    };
  } catch {
    return { rev: null, elements: null };
  }
}

export function createTabCalls<Tab extends TabBase, NoGrant, Summary>(
  config: TabCallsConfig<Tab, NoGrant>,
) {
  const { core, offline, itemPath } = config;
  const enc = encodeURIComponent;
  type DeltaElement = Tab['elements'][number] & { id: string };
  // The base copies and the delta save, only for a product that sends deltas.
  const deltas = config.delta
    ? createTabDeltaSaves<DeltaElement>({
        diff: config.delta.diff,
        fetch: (url, init) => core.apiFetch(url, init),
        expectOkVoid: (res, action) => core.expectOkVoid(res, action),
        saveTimeoutSignal: (body) => core.saveTimeoutSignal(body),
      })
    : null;
  // The unload flush's drafts, only beside delta saves: a draft is stamped with its base copy's revision.
  const drafts = deltas && config.drafts ? createTabDrafts<Tab>(config.drafts) : null;

  // The full tab payload, elements and per-tab metadata, pulled lazily when the user opens a tab. `open` declares
  // this read an open of the item, for the reader's Home: only the editor's first-tab read sets it. The tab's
  // revision rides beside it, never inside it; an offline tab has none (0). `draft` reads this browser's draft of
  // the tab beside it and decides on it (delta-saves.md "Drafts of unsaved changes"): the editor's own loads only.
  async function loadTabRevisioned(
    ownerId: string,
    itemId: string,
    tabId: string,
    shareCode: string | null,
    opts: { open?: boolean; draft?: boolean } = {},
  ): Promise<{ tab: Tab; rev: number } | null> {
    if (await offline.isOfflineId(itemId)) {
      if (opts.open) void offline.recordOpen(itemId, Date.now());
      const tab = await offline.loadTab(itemId, tabId);
      return tab ? { tab, rev: 0 } : null;
    }
    if (opts.open) config.onOpen?.(itemId, shareCode);
    const openHeaders =
      opts.open && config.openHeader ? { extra: { [config.openHeader]: '1' } } : {};
    // Read beside the tab's own GET, so the draft costs the load no wait of its own.
    const draftRead = drafts && opts.draft ? drafts.read(ownerId, itemId, tabId) : null;
    const res = await core.apiFetch(`${core.API_BASE}/${itemPath}/${itemId}/tabs/${tabId}`, {
      headers: await core.apiHeaders(ownerId, { share: shareCode, ...openHeaders }),
    });
    const body = await core.expectOkOrNull<{ tab: Record<string, unknown> }>(res, 'load tab');
    if (!body) return null;
    const { [config.idKey]: _id, orderIndex: _oi, updatedAt: _ua, rev, ...rest } = body.tab;
    void _id;
    void _oi;
    void _ua;
    const clientTab = rest as unknown as Tab;
    const stored = clientTab.elements;
    // The base copy is the elements as stored, so it is taken before the load's own fixes below.
    if (deltas && typeof rev === 'number' && Array.isArray(stored)) {
      deltas.hold(itemId, tabId, rev, stored as DeltaElement[]);
    }
    // Coerce on load: this is the single boundary where stored elements enter the editor, so a legacy or
    // hand-edited row cannot reach the renderer and break it. A no-op for the common case.
    const normalizeTab = (tab: Tab): Tab => {
      const normalize = config.normalizeElement;
      if (!normalize || !tab.elements.some((el) => el.type === 'table')) return tab;
      return {
        ...tab,
        elements: tab.elements.map((el) => (el.type === 'table' ? normalize(el) : el)),
      };
    };
    const shown = normalizeTab(clientTab);
    // This browser's draft of the tab, judged against the revision and elements as stored; one put back waits for
    // the editor (takeDraftReplay), one overtaken is announced (onDraft).
    if (drafts && draftRead && typeof rev === 'number' && Array.isArray(stored)) {
      drafts.settle(
        ownerId,
        itemId,
        tabId,
        await draftRead,
        { rev, elements: stored },
        normalizeTab,
      );
    }
    // An api older than tab revisions answers none: nothing held, so every changeset is news.
    return { tab: shown, rev: typeof rev === 'number' ? rev : 0 };
  }
  const loadTabDeduped = dedupeInFlight<
    Parameters<typeof loadTabRevisioned>,
    { tab: Tab; rev: number } | null
  >(
    loadTabRevisioned,
    // The open marker is part of the key: an unmarked load already in flight must not swallow the editor's marked
    // one, or the open would never be recorded.
    (ownerId, itemId, tabId, shareCode, opts) =>
      `${ownerId}␟${itemId}␟${tabId}␟${shareCode ?? ''}␟${opts?.open ? 'open' : ''}␟${opts?.draft ? 'draft' : ''}`,
  );

  // The tab alone, for callers that need no revision (a duplicate, Take Offline, the Drive mirror).
  async function loadTab(...args: Parameters<typeof loadTabRevisioned>): Promise<Tab | null> {
    return (await loadTabDeduped(...args))?.tab ?? null;
  }

  // Upsert a single tab: the active edit path. `allowEmpty` opts into overwriting a stored tab that has content
  // with an empty one (`X-Allow-Empty: 1`, the per-tab storage data-loss backstop), set only when the tab's content
  // was authoritatively loaded. `roomCursor` is where this client stood in the realtime room when it took the
  // snapshot; `changesetSeen` the highest changeset revision applied to this tab here.
  async function saveTab(
    ownerId: string,
    itemId: string,
    tab: Tab,
    shareCode: string | null = null,
    opts: {
      allowEmpty?: boolean;
      roomCursor?: { epoch: string; seq: number } | null;
      changesetSeen?: number;
      saveChanges?: string | null;
    } = {},
  ): Promise<number | null> {
    if (await offline.isOfflineId(itemId)) {
      await offline.saveTab(itemId, tab, Date.now());
      return null;
    }
    const headers = new Headers(await core.apiHeaders(ownerId, { share: shareCode, body: true }));
    if (opts.allowEmpty) headers.set('X-Allow-Empty', '1');
    if (opts.roomCursor) {
      headers.set('X-Room-Cursor', `${opts.roomCursor.epoch}:${opts.roomCursor.seq}`);
    }
    if (opts.changesetSeen !== undefined) {
      headers.set(config.changesetSeenHeader, String(opts.changesetSeen));
    }
    if (opts.saveChanges && config.saveChangesHeader) {
      headers.set(config.saveChangesHeader, opts.saveChanges);
    }
    const wire = core.tabForWire(tab);
    const url = `${core.API_BASE}/${itemPath}/${itemId}/tabs/${tab.id}`;
    // A draft kept before this save started is in what it sends, so it goes once the save lands.
    const startedAt = drafts?.saveStarted() ?? 0;
    const landed = (rev: number | null) => {
      drafts?.saveLanded(ownerId, itemId, tab.id, startedAt);
      return rev;
    };
    if (deltas) {
      // A delta when one is held and worth sending; null (no base, too large, or refused) saves whole below.
      const sent = await deltas.send({
        itemId,
        tabId: tab.id,
        url,
        tab: wire as { elements: DeltaElement[] },
        headers,
      });
      if (sent) return landed(sent.rev);
    }
    const body = JSON.stringify(wire);
    const res = await core.apiFetch(url, {
      method: 'PUT',
      headers,
      body,
      // A hung save would hold every later save of this tab behind it (saveTimeoutMs).
      signal: core.saveTimeoutSignal(body),
    });
    await core.expectOkVoid(res, 'save tab');
    const echo = await savedEchoOf(res);
    // The echo is what the api stored, merges and all: the next delta's base copy.
    if (deltas && echo.rev !== null && echo.elements) {
      deltas.holdEcho(
        itemId,
        tab.id,
        echo.rev,
        echo.elements as DeltaElement[],
        (wire as { elements: DeltaElement[] }).elements,
      );
    }
    return landed(echo.rev);
  }

  // The last-ditch unload flush of pending tab/meta writes, so a fast edit then reload doesn't lose changes. A
  // `beforeunload` handler can't await, and the account token provider is async, so this builds headers
  // synchronously and uses `keepalive` to let each request outlive the teardown. A tab with a base copy goes as a
  // delta, planned synchronously, when it fits the keepalive budget (delta saves). Callers pass an already-diffed
  // change set; empty sets fire nothing. Only tabs whose content is authoritative in memory (`loadedTabIds`) may
  // authorise an empty-body overwrite.
  function flushSavesBeacon(args: {
    ownerId: string;
    itemId: string;
    shareCode: string | null;
    changedTabs: Tab[];
    deletedIds: string[];
    loadedTabIds: Set<string>;
    orderChanged: boolean;
    nameChanged: boolean;
    name: string;
    tabs: Tab[];
    changesetSeen?: ReadonlyMap<string, number>;
    saveChanges?: ReadonlyMap<string, string>;
  }): void {
    // Offline Mode: a best-effort flush to IndexedDB. These writes may not finish; the debounced autosave covers
    // all but the final edit window. The rename / tab order too, like the cloud branch below.
    if (offline.isOfflineIdSync(args.itemId)) {
      const now = Date.now();
      for (const t of args.changedTabs) void offline.saveTab(args.itemId, t, now);
      for (const tabId of args.deletedIds) void offline.deleteTab(args.itemId, tabId, now);
      if (args.orderChanged || args.nameChanged) {
        void offline.saveMeta(
          args.itemId,
          { name: args.name, tabs: args.tabs.map((t) => ({ id: t.id, folder: t.folder })) },
          now,
        );
      }
      return;
    }
    const base = config.unloadHeaders(args.ownerId, args.itemId, args.shareCode);
    if (!base) return;
    const jsonHeaders = { ...base, 'Content-Type': 'application/json' };
    // Browsers refuse keepalive bodies past 64 KB in all (per page). Keepalive while the bodies fit; past that, a
    // plain request, which still lands when the page lives on.
    let keepaliveLeft = KEEPALIVE_BUDGET_BYTES;
    const keepaliveFor =
      config.takeKeepalive ??
      ((body: string | undefined) => {
        const bytes = body ? new TextEncoder().encode(body).length : 0;
        if (bytes > keepaliveLeft) return false;
        keepaliveLeft -= bytes;
        return true;
      });
    const tabUrl = (tabId: string) => `${core.API_BASE}/${itemPath}/${args.itemId}/tabs/${tabId}`;
    for (const t of args.changedTabs) {
      const seen = args.changesetSeen?.get(t.id);
      const changes = config.saveChangesHeader ? args.saveChanges?.get(t.id) : undefined;
      const headers: Record<string, string> = {
        ...jsonHeaders,
        ...(args.loadedTabIds.has(t.id) ? { 'X-Allow-Empty': '1' } : {}),
        ...(seen !== undefined ? { [config.changesetSeenHeader]: String(seen) } : {}),
        ...(changes ? { [config.saveChangesHeader as string]: changes } : {}),
      };
      const wire = core.tabForWire(t);
      const url = tabUrl(t.id);
      // The whole body, made once: the draft keeps it too.
      let wholeBody: string | null = null;
      const bodyOf = () => (wholeBody ??= JSON.stringify(wire));
      // A delta where one is held and fits the keepalive budget, so a large tab's last edits outlive the page
      // (delta-saves.md "Unload"). Refused, the whole tab follows if the page is still here to send it.
      const delta = deltas?.planUnload({
        itemId: args.itemId,
        tabId: t.id,
        url,
        tab: wire as { elements: DeltaElement[] },
      });
      // A draft of what goes, over the base copy's revision, so an edit the api refuses or never gets comes back on
      // the next load (delta-saves.md "Drafts of unsaved changes"). Written before anything is sent.
      const baseRev = drafts ? deltas?.base(args.itemId, t.id)?.rev : undefined;
      if (drafts && baseRev !== undefined) {
        drafts.write(args.ownerId, args.itemId, t.id, {
          baseRev,
          tab: bodyOf(),
          changed: delta?.changed ?? null,
          removed: delta?.removed ?? null,
        });
      }
      const startedAt = drafts?.saveStarted() ?? 0;
      const landed = () => drafts?.saveLanded(args.ownerId, args.itemId, t.id, startedAt);
      const whole = () => {
        const body = bodyOf();
        void core
          .apiFetch(
            url,
            { method: 'PUT', headers, body, keepalive: keepaliveFor(body) },
            config.noGrantWait,
          )
          .then((res) => {
            if (res.ok) landed();
          })
          .catch(() => {});
      };
      if (delta && keepaliveFor(delta.body)) {
        void core
          .apiFetch(
            delta.url,
            { method: 'POST', headers, body: delta.body, keepalive: true },
            config.noGrantWait,
          )
          .then((res) => delta.settle(res))
          .then((settled) => {
            if (settled === 'refused') whole();
            else if (settled === 'saved') landed();
          })
          .catch(() => {});
        continue;
      }
      whole();
    }
    for (const tabId of args.deletedIds) {
      void core
        .apiFetch(
          tabUrl(tabId),
          { method: 'DELETE', headers: base, keepalive: keepaliveFor(undefined) },
          config.noGrantWait,
        )
        .catch(() => {});
    }
    if (args.orderChanged || args.nameChanged) {
      const body = JSON.stringify({
        name: args.name,
        tabs: args.tabs.map((t) => ({ id: t.id, folder: t.folder })),
      });
      void core
        .apiFetch(
          `${core.API_BASE}/${itemPath}/${args.itemId}`,
          { method: 'PUT', headers: jsonHeaders, body, keepalive: keepaliveFor(body) },
          config.noGrantWait,
        )
        .catch(() => {});
    }
  }

  const commentsUrl = (itemId: string, tabId: string) =>
    `${core.API_BASE}/${itemPath}/${enc(itemId)}/tabs/${enc(tabId)}/comments`;

  // Append a comment to one element's thread on a tab: the write path of a view-role visitor, whose contribution
  // has no autosave to ride. Answers the created comment so the caller merges it without a refetch. `mentions` are
  // the teammates it @-tags (cleaned server-side); `cell` the table cell it is on, where the product has them.
  async function addComment(
    ownerId: string,
    itemId: string,
    tabId: string,
    elementId: string,
    text: string,
    shareCode: string | null = null,
    mentions?: unknown[],
    cell?: string,
  ): Promise<AddedComment> {
    const res = await core.apiFetch(commentsUrl(itemId, tabId), {
      method: 'POST',
      headers: await core.apiHeaders(ownerId, { share: shareCode, body: true }),
      body: JSON.stringify({
        elementId,
        text,
        ...(mentions?.length ? { mentions } : {}),
        ...(cell !== undefined ? { cell } : {}),
      }),
    });
    return core.expectOk<{ comment: AddedComment }>(res, 'add comment').then((b) => b.comment);
  }

  // Delete a comment you authored: the server authorises it on the comment's stamped author, so a view-role visitor
  // can remove their OWN comment without edit rights.
  async function deleteComment(
    ownerId: string,
    itemId: string,
    tabId: string,
    commentId: string,
    shareCode: string | null = null,
  ): Promise<void> {
    const res = await core.apiFetch(`${commentsUrl(itemId, tabId)}/${enc(commentId)}`, {
      method: 'DELETE',
      headers: await core.apiHeaders(ownerId, { share: shareCode }),
    });
    await core.expectOkVoid(res, 'delete comment');
  }

  // Resolve or reopen a thread through the comment endpoints: the path of a session that may comment but not edit.
  // The thread is named by any of its comments.
  async function setThreadResolved(
    ownerId: string,
    itemId: string,
    tabId: string,
    commentId: string,
    resolved: boolean,
    shareCode: string | null = null,
  ): Promise<void> {
    const verb = resolved ? 'resolve' : 'reopen';
    const res = await core.apiFetch(`${commentsUrl(itemId, tabId)}/${enc(commentId)}/${verb}`, {
      method: 'POST',
      headers: await core.apiHeaders(ownerId, { share: shareCode }),
    });
    await core.expectOkVoid(res, `${verb} thread`);
  }

  // Share a tab of `fromItemId` into another of the caller's items: after this both hold the tab, and an edit in
  // either reaches the other. Answers the tab as the target now holds it.
  async function linkTab(
    ownerId: string,
    itemId: string,
    tabId: string,
    fromItemId: string,
  ): Promise<Summary> {
    const res = await core.apiFetch(
      `${core.API_BASE}/${itemPath}/${enc(itemId)}/tabs/${enc(tabId)}/link`,
      {
        method: 'POST',
        headers: {
          ...((await core.apiHeaders(ownerId)) as Record<string, string>),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: fromItemId }),
      },
    );
    return core.expectOk<{ tab: Summary }>(res, 'link tab').then((b) => b.tab);
  }

  async function deleteTab(
    ownerId: string,
    itemId: string,
    tabId: string,
    shareCode: string | null = null,
  ): Promise<void> {
    if (await offline.isOfflineId(itemId)) return offline.deleteTab(itemId, tabId, Date.now());
    return core.apiDelete(`${core.API_BASE}/${itemPath}/${itemId}/tabs/${tabId}`, ownerId, {
      action: 'delete tab',
      share: shareCode,
    });
  }

  // A peer's save moves the base copy (delta-saves.md): what this editor's save of `tabId` that wrote `rev`
  // announces to the room (the stored elements' digest, or null when no copy is held at `rev`), and a peer's
  // announcement taken over `tab` as this editor's baseline holds it.
  async function savedDigest(tabId: string, rev: number): Promise<string | null> {
    return deltas ? deltas.stampOf(tabId, rev) : null;
  }
  async function adoptPeerSave(
    itemId: string,
    tab: Tab,
    rev: number,
    digest: string,
  ): Promise<boolean> {
    if (!deltas || offline.isOfflineIdSync(itemId)) return false;
    const wire = core.tabForWire(tab) as { elements: DeltaElement[] };
    return deltas.adopt(itemId, tab.id, rev, digest, wire.elements);
  }

  // Drafts a load put back, for the editor to put on screen (takeDraftReplay), and every draft put back or dropped
  // (onDraft). Without drafts, nothing is ever put back.
  const takeDraftReplay = (ownerId: string, itemId: string, tabId: string): Tab | null =>
    drafts ? drafts.takeReplay(ownerId, itemId, tabId) : null;
  const onDraft = (listener: (event: TabDraftEvent) => void): (() => void) =>
    drafts ? drafts.subscribe(listener) : () => {};

  return {
    loadTabRevisioned: loadTabDeduped,
    loadTab,
    saveTab,
    flushSavesBeacon,
    addComment,
    deleteComment,
    setThreadResolved,
    linkTab,
    deleteTab,
    savedDigest,
    adoptPeerSave,
    takeDraftReplay,
    onDraft,
  };
}
