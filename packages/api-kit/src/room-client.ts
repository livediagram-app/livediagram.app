import type { AgentPresenceWrite } from './room-agent-presence';
import { LEDGER_LOCK_ELEMENTS_MAX } from './room-ledger-store';

// The api Worker's calls into an item's realtime room (each product's docs/specs/012-collaboration/collab-race-hardening.md):
// reading its collaboration ledger to merge a save, and handing it a change the api made. Every product's
// apps/api/src/room-client.ts binds this once with its room namespace, the name its logs give the item's id
// (`documentId`, `designId`, `projectId`), its meta op kind and its ledger merge, and keeps only the relays of its own.
//
// Every server-stored item has a room (docs/specs/024-agents/agent-changesets.md "Rooms for personal documents"): an
// agent is a second writer even on an item nobody else can open.

// `<epoch>:<seq>`, as the editor sends it. Null for anything else.
export function parseRoomCursor(header: string | null): { epoch: string; seq: number } | null {
  if (!header) return null;
  const cut = header.lastIndexOf(':');
  if (cut <= 0) return null;
  const epoch = header.slice(0, cut);
  const seq = Number(header.slice(cut + 1));
  if (epoch.length > 100 || !Number.isInteger(seq) || seq < 0) return null;
  return { epoch, seq };
}

// One open editor's selection on a tab, as the room answers it: every selected id, the session's
// name and colour, and whether it is the agent owner's own session (matched by person tag).
export type RoomSelection = { elementIds: string[]; name: string; color: string; mine: boolean };

// Agent presence in the room (docs/specs/024-agents/blueprints/agent-presence.md "Room"). The room is its only store,
// so a set or clear that cannot reach it throws `RoomUnavailableError` (the route answers 503, PR11).
const ROOM_AGENT_PRESENCE_TIMEOUT_MS = 3_000;

export class RoomUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`room unavailable: ${String(cause)}`);
    this.name = 'RoomUnavailableError';
  }
}

// `ordered` asks the room to sequence the op into its catch-up log, so a peer whose socket blipped
// still receives it (liveplanner's item store ops).
export function roomMutationInit(op: unknown, ordered = false): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ordered ? { op, ordered: true } : { op }),
  };
}

// Who posted each comment the room has seen, as a product's ledger reader answers it.
type CommentAuthors = Map<string, { authorName: string; authorColor: string }>;

// What a product's binding hands in.
export type RoomClientConfig<Env, IdKey extends string, Tab, Ledger> = {
  // The item's room stub (its Durable Object namespace).
  roomStub: (env: Env, roomId: string) => DurableObjectStub;
  // The name the item's id goes by in logs and in a presence write: `documentId`, `designId`, `projectId`.
  idKey: IdKey;
  // The op an editor's own rename of the item sends: `document-meta`, `design-meta`, `project-meta`.
  metaKind: string;
  relayTimeoutMs: number;
  selectionsTimeoutMs: number;
  activityTtlMs: number;
  mergeLedgerIntoTab: (tab: Tab, ledger: Ledger, seq: number) => Tab;
  ledgerCommentAuthors: (ledger: Ledger) => CommentAuthors;
};

export function createRoomClient<
  Env,
  IdKey extends string,
  Tab extends { id: string },
  Ledger extends { elements?: unknown },
>(config: RoomClientConfig<Env, IdKey, Tab, Ledger>) {
  const { roomStub, idKey, metaKind } = config;
  // A presence write as a route hands it in: the room's stamp fields plus the item's id under the product's key.
  type PresenceRoomWrite = AgentPresenceWrite & Record<IdKey, string>;
  // The item's id as the first log field, under the product's name for it.
  const idField = (roomId: string) => ({ [idKey]: roomId }) as Record<IdKey, string>;

  // A room call that gives up after `ms`: the api never waits on a room longer than that.
  async function roomFetch(
    env: Env,
    roomId: string,
    path: string,
    init: RequestInit | undefined,
    ms: number,
  ): Promise<Response> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`room timeout after ${ms} ms`)), ms);
    });
    try {
      return await Promise.race([
        roomStub(env, roomId).fetch(`https://room${path}`, init),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  // One mutation into the room within the relay timeout: true when it took it, else `warn` hears why.
  async function relayMutation(
    env: Env,
    roomId: string,
    op: unknown,
    warn: (error: string) => void,
  ): Promise<boolean> {
    try {
      const res = await roomFetch(
        env,
        roomId,
        '/mutation',
        roomMutationInit(op),
        config.relayTimeoutMs,
      );
      if (res.ok) return true;
      warn(`status ${res.status}`);
    } catch (err) {
      warn(String(err));
    }
    return false;
  }

  // Send one op to every socket in an item's room. Best-effort: the stored write before it is the
  // authoritative change, so a room that can't be reached is logged as `[room-broadcast] <label> did
  // not reach the room` rather than failing the request.
  async function broadcastOp(
    env: Env,
    roomId: string,
    op: unknown,
    label: string,
    ordered = false,
  ): Promise<void> {
    try {
      await roomStub(env, roomId).fetch('https://room/broadcast', roomMutationInit(op, ordered));
    } catch (err) {
      console.warn(`[room-broadcast] ${label} did not reach the room`, roomId, err);
    }
  }

  // Merge the room's collaboration ledger into a tab a client is saving (collab-race-hardening.md phase 3).
  //
  // Every client PUTs whole tabs and storage keeps the last one, so a save snapshotted before somebody's answer,
  // idea, tick or dot reached that client erased it. The room saw every one of them in order and keeps the latest
  // state of each; folding that into the save means the write holds what the room holds.
  //
  // Only what the saver had NOT seen is merged: the client sends the room cursor its snapshot was taken at
  // (`X-Room-Cursor: <epoch>:<seq>`), and a save without one (no live socket, the unload beacon) isn't merged at
  // all. That is what keeps a change the saver made while its socket was down from being overruled by the room's
  // older copy of it.
  //
  // Best-effort by design: if the room can't answer, the save goes through as the client sent it. Also answers who
  // posted each comment the room has seen, so the save can credit a comment new to storage to its author rather
  // than to the saver.
  //
  // The ledger fetch needs only the tab's id and the cursor, so a save asks for it alongside its own reads instead
  // of after them (applyRoomLedger merges it once the tab is ready).
  async function fetchRoomLedger(
    env: Env,
    roomId: string,
    tabId: string,
    cursorHeader: string | null,
  ): Promise<{ ledger: Ledger; seq: number } | null> {
    const cursor = parseRoomCursor(cursorHeader);
    if (!cursor) return null;
    try {
      const query = `tab=${encodeURIComponent(tabId)}&epoch=${encodeURIComponent(cursor.epoch)}&since=${cursor.seq}`;
      const res = await roomStub(env, roomId).fetch(`https://room/ledger?${query}`);
      if (!res.ok) return null;
      const ledger = (await res.json()) as Ledger;
      if (!ledger || typeof ledger !== 'object' || !ledger.elements) return null;
      return { ledger, seq: cursor.seq };
    } catch {
      return null;
    }
  }

  function applyRoomLedger(
    tab: Tab,
    fetched: { ledger: Ledger; seq: number } | null,
  ): { tab: Tab; commentAuthors: CommentAuthors } {
    if (!fetched) return { tab, commentAuthors: new Map() };
    return {
      tab: config.mergeLedgerIntoTab(tab, fetched.ledger, fetched.seq),
      commentAuthors: config.ledgerCommentAuthors(fetched.ledger),
    };
  }

  // The ledger entries a whole-tab write's lock reads beside the stored tab (each product's docs/specs/013-workspace/
  // share-roles.md "Whole-tab writes keep other people's entries"): every named element's entry, and the tab's vote
  // when asked, whatever their seq. Asked in chunks of LEDGER_LOCK_ELEMENTS_MAX ids, one after another. Null when
  // the room cannot answer any chunk: the lock then keeps the stored entries (it fails closed).
  async function fetchLedgerEntries(
    env: Env,
    roomId: string,
    tabId: string,
    want: { elementIds: readonly string[]; vote: boolean },
  ): Promise<Ledger | null> {
    let out: Ledger | null = null;
    const ids = [...want.elementIds];
    for (let i = 0; i === 0 || i < ids.length; i += LEDGER_LOCK_ELEMENTS_MAX) {
      const chunk = ids.slice(i, i + LEDGER_LOCK_ELEMENTS_MAX);
      try {
        const res = await roomStub(env, roomId).fetch('https://room/ledger-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tab: tabId, elements: chunk, vote: want.vote && i === 0 }),
        });
        if (!res.ok) return null;
        const ledger = (await res.json()) as Ledger;
        if (!ledger || typeof ledger !== 'object' || !ledger.elements) return null;
        out = out
          ? ({
              ...(out as object),
              elements: {
                ...(out.elements as Record<string, unknown>),
                ...(ledger.elements as Record<string, unknown>),
              },
            } as Ledger)
          : ledger;
      } catch {
        return null;
      }
    }
    return out;
  }

  // Hand the item's realtime room a change the api itself just wrote, so everyone connected sees it.
  //
  // The one case today is a view-role visitor's comment. The room refuses mutations from a view-role socket, so the
  // visitor writes through the comment endpoints instead; before this, the comment was stored but reached no
  // editor's screen, and the next editor save (built from a thread without it) erased it. Relayed as the same
  // `el-delta` an editor's own comment sends, so receivers need nothing new.
  //
  // Best-effort, like the share-revoked broadcast: the stored write is the record, this is the live copy; a relay
  // the room refused or never received is logged (PR26).
  function relayElementDelta(
    env: Env,
    roomId: string,
    tabId: string,
    elementId: string,
    delta: { kind: string },
  ): Promise<boolean> {
    return relayMutation(env, roomId, { kind: 'el-delta', tabId, elementId, delta }, (error) =>
      console.warn('[room-mutation] el-delta did not reach the room', {
        ...idField(roomId),
        tabId,
        delta: delta.kind,
        error,
      }),
    );
  }

  // One changeset into the room's ordered stream (docs/specs/024-agents/agent-changesets.md "The write path" step
  // 7): sequenced in one log slot and sent to everyone. It never fails the write: storage already holds the
  // changeset and the merge on save keeps it there, so a room that refuses or cannot be reached within the relay
  // timeout is logged and answers false.
  function relayChangeset(
    env: Env,
    roomId: string,
    op: { tabId: string; id: string },
  ): Promise<boolean> {
    return relayMutation(env, roomId, op, (error) =>
      console.warn('[changeset] relay-failed', {
        ...idField(roomId),
        tabId: op.tabId,
        changesetId: op.id,
        error,
      }),
    );
  }

  // An item an agent renamed, as the meta op an editor's own rename sends: open editors show the new name at once,
  // and their next tab reorder carries it instead of writing the old one back. Best-effort and logged, like the tab
  // rename relay.
  function relayItemRename(
    env: Env,
    roomId: string,
    name: string,
    tabs: readonly { id: string; name: string; orderIndex: number; folder?: string }[],
  ): Promise<boolean> {
    const op = {
      kind: metaKind,
      name,
      tabs: tabs.map((t) => ({
        id: t.id,
        name: t.name,
        orderIndex: t.orderIndex,
        ...(t.folder ? { folder: t.folder } : {}),
      })),
    };
    return relayMutation(env, roomId, op, (error) =>
      console.warn(`[room-mutation] ${metaKind} did not reach the room`, {
        ...idField(roomId),
        error,
      }),
    );
  }

  // A tab the api renamed (CS42), as the same tab-meta op an editor's own rename sends: the item's meta op keeps
  // every open editor's names, so a stale tab list can never revert a rename. Best-effort and logged.
  function relayTabRename(env: Env, roomId: string, tabId: string, name: string): Promise<boolean> {
    return relayMutation(env, roomId, { kind: 'tab-meta', tabId, patch: { name } }, (error) =>
      console.warn('[room-mutation] tab-meta did not reach the room', {
        ...idField(roomId),
        error,
      }),
    );
  }

  // Several ops an agent's write made, in order (an agent's Pages edit, a form write). Best-effort and logged under
  // `tag`, like the tab rename relay; answers how many reached the room.
  async function relayRoomOps(
    env: Env,
    roomId: string,
    ops: readonly { kind: string }[],
    tag: string,
  ): Promise<number> {
    let reached = 0;
    for (const op of ops) {
      const ok = await relayMutation(env, roomId, op, (error) =>
        console.warn(`${tag} relay-missed`, { ...idField(roomId), op: op.kind, error }),
      );
      if (ok) reached += 1;
    }
    return reached;
  }

  // Every selection on the tab (docs/specs/024-agents/agent-changesets.md "Held elements"). Null when the room
  // cannot answer within the selections timeout: then nothing counts as held, and the warning, under the reader's
  // own fingerprint, says so.
  async function readRoomSelections(
    env: Env,
    roomId: string,
    tabId: string,
    personTag: string | null,
    reader: 'changeset' | 'views' = 'changeset',
  ): Promise<RoomSelection[] | null> {
    const query = `tab=${encodeURIComponent(tabId)}&person=${encodeURIComponent(personTag ?? '')}`;
    try {
      const res = await roomFetch(
        env,
        roomId,
        `/selections?${query}`,
        undefined,
        config.selectionsTimeoutMs,
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = (await res.json()) as { selections?: unknown };
      if (!Array.isArray(body.selections)) throw new Error('no selections');
      return body.selections as RoomSelection[];
    } catch (err) {
      console.warn(`[${reader}] selections-unreachable`, {
        ...idField(roomId),
        tabId,
        error: String(err),
      });
      return null;
    }
  }

  // Tell every socket in an item's room that a share link changed: revoked (its holders leave the editor) or
  // rescoped (they reload into the new scope, docs/specs/013-workspace/tab-scoped-share-links.md). The room also
  // closes those sockets. Best-effort, like every broadcast.
  async function broadcastShareOp(
    env: Env,
    roomId: string,
    op: { kind: 'share-revoked' | 'share-rescoped'; code: string },
  ): Promise<void> {
    await broadcastOp(env, roomId, op, op.kind);
  }

  async function putAgentPresence(
    env: Env,
    write: PresenceRoomWrite,
  ): Promise<
    { ok: true; expiresAt: number; created: boolean } | { ok: false; error: 'agent_presence_full' }
  > {
    const { [idKey]: roomId, ...body } = write as PresenceRoomWrite & Record<string, string>;
    let res: Response;
    try {
      res = await roomFetch(
        env,
        roomId,
        '/presence',
        { method: 'PUT', body: JSON.stringify(body) },
        ROOM_AGENT_PRESENCE_TIMEOUT_MS,
      );
    } catch (err) {
      throw new RoomUnavailableError(err);
    }
    if (res.status === 409) return { ok: false, error: 'agent_presence_full' };
    if (!res.ok) throw new RoomUnavailableError(`status ${res.status}`);
    const answer = (await res.json()) as { expiresAt: number; created: boolean };
    return { ok: true, expiresAt: answer.expiresAt, created: answer.created };
  }

  async function deleteAgentPresence(
    env: Env,
    roomId: string,
    tokenId: string,
    tabId: string,
  ): Promise<boolean> {
    const query = `token=${encodeURIComponent(tokenId)}&tab=${encodeURIComponent(tabId)}`;
    let res: Response;
    try {
      res = await roomFetch(
        env,
        roomId,
        `/presence?${query}`,
        { method: 'DELETE' },
        ROOM_AGENT_PRESENCE_TIMEOUT_MS,
      );
    } catch (err) {
      throw new RoomUnavailableError(err);
    }
    if (!res.ok) throw new RoomUnavailableError(`status ${res.status}`);
    return (await res.json<{ cleared: boolean }>()).cleared;
  }

  // A token's changeset or read refreshes its presence on the tab for the activity window (spec "Presence"); a
  // refresh that fails is logged and the changeset or read stands (E7).
  async function refreshAgentPresence(
    env: Env,
    write: Omit<AgentPresenceWrite, 'mode' | 'status' | 'focus' | 'ttlMs'> & Record<IdKey, string>,
  ): Promise<void> {
    const fields = { ...idField(write[idKey]), tabId: write.tabId };
    try {
      const answer = await putAgentPresence(env, {
        ...write,
        status: null,
        focus: [],
        ttlMs: config.activityTtlMs,
        mode: 'refresh',
      });
      if (!answer.ok)
        console.warn('[agent-presence] refresh refused', { ...fields, error: answer.error });
    } catch (err) {
      console.warn('[agent-presence] refresh failed', { ...fields, error: String(err) });
    }
  }

  return {
    roomFetch,
    broadcastOp,
    fetchRoomLedger,
    applyRoomLedger,
    fetchLedgerEntries,
    relayElementDelta,
    relayChangeset,
    relayItemRename,
    relayTabRename,
    relayRoomOps,
    readRoomSelections,
    broadcastShareOp,
    putAgentPresence,
    deleteAgentPresence,
    refreshAgentPresence,
  };
}
