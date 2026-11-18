import {
  classifyStatusAnswer,
  STATUS_BIND_DELAY_MS,
  STATUS_BODY_MAX,
  STATUS_POLL_MS,
  STATUS_SOURCES_MAX,
  STATUS_TIMEOUT_MS,
  type ServiceStatus,
  type ServiceStatusOp,
} from '@livediagram/api-schema';
import { isStatusUrl, statusUrlsOf, type Element } from '@livediagram/document';
import { pooled } from '@liveworkspace/api-kit/pooled';
import { fetchPublicBytes, type PublicFetchResult } from '@liveworkspace/api-kit/public-fetch';
import type { ServerMessage } from '../types';
import type { DocumentRoom } from './document-room';
import { scopeOf } from './room-sockets';

// The room's live service status checks (docs/specs/009-elements/live-status.md "Polling"): while someone has the
// document open and it holds shapes bound to a `statusUrl`, the room checks each distinct URL at most once a minute
// from its alarm, keeps the latest state of each, and sends every session the states of the URLs on the tabs it may
// see. A document nobody has open fetches nothing and sets no alarm for it, and a deployment without
// LIVE_STATUS_ENABLED never runs a round. Only the state leaves the room: an answer's bytes are reduced to one of
// four states (classifyStatusAnswer) and dropped.

// The storage key holding each checked URL's latest ServiceStatus (at most STATUS_SOURCES_MAX entries).
export const SERVICE_STATUS_KEY = 'service-status';
// A round's checks run this many at a time. A Worker holds six connections open at once and queues the rest, and a
// check holds two while it resolves its host (A and AAAA), so three at a time never queue one behind another, whose
// 5 s deadline would otherwise start while it waited (api-kit pooled.ts).
export const STATUS_CHECKS_AT_ONCE = 3;
// Who the checks say they are; never a cookie or a credential.
export const STATUS_USER_AGENT = 'livediagram-status/1.0 (+https://www.livediagram.app)';

/** The bound URLs of a document, as one scan of its stored tabs finds them. */
export type StatusSources = {
  // The distinct URLs in tab then element order, at most STATUS_SOURCES_MAX: what a round checks.
  checked: string[];
  // Any beyond the cap: never checked, sent as Unknown.
  overflow: string[];
  // Each tab's distinct URLs, for a session scoped to one tab. Only tabs holding a binding.
  byTab: Map<string, string[]>;
};

/** What the checks need of the room: its storage, sockets and clock, and how one URL is fetched. */
export type ServiceStatusDeps = {
  storage: Pick<DurableObjectStorage, 'get' | 'put' | 'delete'>;
  // LIVE_STATUS_ENABLED is "true" on this deployment.
  enabled: () => boolean;
  sockets: () => WebSocket[];
  // The stored tabs' bindings (readStatusSources).
  sources: () => StatusSources;
  // A socket's tab scope (null: every tab), and whether it has said hello.
  scopeOf: (ws: WebSocket) => string | null;
  joined: (ws: WebSocket) => boolean;
  send: (ws: WebSocket, payload: ServerMessage) => void;
  // Re-arm the room's one alarm after `at` moved.
  arm: () => void;
  now: () => number;
  check?: (url: string) => Promise<PublicFetchResult>;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The bindings on the document's stored tabs. SQLite picks out the tabs whose data names `statusUrl` (instr), so a
 * document without bindings costs one query and parses nothing; each tab that holds one is parsed once. A tab whose
 * data doesn't parse is skipped.
 */
export function readStatusSources(sql: SqlStorage, documentId: string): StatusSources {
  const rows = sql
    .exec<{ tab_id: string; data: string }>(
      `SELECT dt.tab_id, t.data FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.document_id = ? AND instr(t.data, '"statusUrl"') > 0
        ORDER BY dt.order_index, t.id`,
      documentId,
    )
    .toArray();
  const all = new Set<string>();
  const byTab = new Map<string, string[]>();
  for (const row of rows) {
    let body: unknown;
    try {
      body = JSON.parse(row.data);
    } catch {
      continue;
    }
    const elements = isRecord(body) && Array.isArray(body.elements) ? body.elements : [];
    const urls = statusUrlsOf([{ elements: elements.filter(isRecord) as Element[] }], Infinity);
    if (urls.length === 0) continue;
    byTab.set(row.tab_id, urls);
    for (const url of urls) all.add(url);
  }
  const list = [...all];
  return {
    checked: list.slice(0, STATUS_SOURCES_MAX),
    overflow: list.slice(STATUS_SOURCES_MAX),
    byTab,
  };
}

/** One check of a public https status URL: no redirects, 5 s, 64 KiB, the host resolved just before. */
export function checkStatusUrl(url: string): Promise<PublicFetchResult> {
  return fetchPublicBytes(url, {
    maxBytes: STATUS_BODY_MAX,
    timeoutMs: STATUS_TIMEOUT_MS,
    maxRedirects: 0,
    headers: { 'User-Agent': STATUS_USER_AGENT, Accept: 'application/json, */*;q=0.5' },
  });
}

const isStatus = (v: unknown): v is ServiceStatus =>
  isRecord(v) && typeof v.state === 'string' && typeof v.checkedAt === 'number';

/** The room's live status checks: its next round (`at`) and each checked URL's latest state. */
export class RoomServiceStatus {
  // When the next round is due (null: none). The room's alarm (room-lifecycle.ts) takes it with its other times.
  at: number | null = null;
  private statuses = new Map<string, ServiceStatus>();
  private running: Promise<void> | null = null;
  private readonly check: (url: string) => Promise<PublicFetchResult>;
  private readonly deps: ServiceStatusDeps;

  constructor(deps: ServiceStatusDeps) {
    this.deps = deps;
    this.check = deps.check ?? checkStatusUrl;
  }

  /** After a wake: the states kept, and, while sessions are still connected, the round they are due. */
  async restore(): Promise<void> {
    const saved = await this.deps.storage.get<Record<string, unknown>>(SERVICE_STATUS_KEY);
    this.statuses = new Map(
      Object.entries(isRecord(saved) ? saved : {}).filter(
        (entry): entry is [string, ServiceStatus] => isStatus(entry[1]),
      ),
    );
    if (this.statuses.size > 0 && this.live()) this.at = this.nextDue([...this.statuses.keys()]);
  }

  /** A session said hello: the states it may see, and a round within a second for a URL never or long ago checked. */
  join(ws: WebSocket): void {
    if (!this.deps.enabled()) return;
    const sources = this.deps.sources();
    if (sources.byTab.size === 0) return;
    this.sendTo(ws, sources, this.deps.now());
    // A tab holding a binding means at least one checked URL.
    this.bring(this.nextDue(sources.checked));
  }

  /** A save while someone is connected: a round shortly, which checks only a URL not checked yet. */
  noteWrite(): void {
    if (!this.live()) return;
    this.bring(this.deps.now() + STATUS_BIND_DELAY_MS);
  }

  /** A socket closed: with nobody left, no round is due, so an idle room keeps no alarm for it. */
  left(ws: WebSocket): void {
    if (this.at === null) return;
    if (this.deps.sockets().some((s) => s !== ws)) return;
    this.at = null;
    this.deps.arm();
  }

  /** The room's alarm fired: run a round when one is due. Rounds never overlap. */
  async alarm(now: number): Promise<void> {
    if (this.at === null || this.at > now) return;
    if (this.running) return this.running;
    this.running = this.round(now).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** The document is gone: forget every state (its storage goes with the purge). */
  forget(): void {
    this.statuses.clear();
    this.at = null;
  }

  private live(): boolean {
    return this.deps.enabled() && this.deps.sockets().length > 0;
  }

  // Bring the next round forward to `at`, never back.
  private bring(at: number): void {
    if (this.at !== null && this.at <= at) return;
    this.at = at;
    this.deps.arm();
  }

  // The earliest a URL is due again: now for one never checked, a minute after its last check otherwise.
  private nextDue(urls: readonly string[]): number {
    const now = this.deps.now();
    let next = Infinity;
    for (const url of urls) {
      const status = this.statuses.get(url);
      next = Math.min(next, status ? status.checkedAt + STATUS_POLL_MS : now);
    }
    return next;
  }

  private async round(now: number): Promise<void> {
    this.at = null;
    // Nobody connected, or polling off: nothing is fetched and no round is set.
    if (!this.live()) return;
    const sources = this.deps.sources();
    const bound = new Set(sources.checked);
    let changed = false;
    for (const url of this.statuses.keys()) {
      if (!bound.has(url)) {
        this.statuses.delete(url);
        changed = true;
      }
    }
    const due = sources.checked.filter((url) => {
      const status = this.statuses.get(url);
      return status === undefined || status.checkedAt + STATUS_POLL_MS <= now;
    });
    const results = await pooled(
      due.map((url) => () => this.checkOne(url, now)),
      STATUS_CHECKS_AT_ONCE,
    );
    due.forEach((url, i) => this.statuses.set(url, results[i]!));
    if (due.length > 0 || changed) await this.persist();
    if (due.length > 0) {
      console.debug('[service-status] round', {
        checked: due.length,
        down: results.filter((s) => s.state === 'down').length,
        overflow: sources.overflow.length,
      });
      for (const ws of this.deps.sockets()) {
        if (this.deps.joined(ws)) this.sendTo(ws, sources, now);
      }
    }
    // A save or a join during the round may already have set an earlier one.
    if (sources.checked.length > 0) this.bring(this.nextDue(sources.checked));
  }

  // One URL, reduced to its state. A stored URL the address check now refuses is never fetched.
  private async checkOne(url: string, now: number): Promise<ServiceStatus> {
    if (!isStatusUrl(url)) {
      return { state: 'unknown', checkedAt: now, reason: 'refused' };
    }
    try {
      return classifyStatusAnswer(await this.check(url), now);
    } catch {
      return { state: 'down', checkedAt: now, reason: 'unreachable' };
    }
  }

  private async persist(): Promise<void> {
    if (this.statuses.size === 0) await this.deps.storage.delete(SERVICE_STATUS_KEY);
    else await this.deps.storage.put(SERVICE_STATUS_KEY, Object.fromEntries(this.statuses));
  }

  // The states of the URLs this session may see: every tab's, or its one tab's. Nothing when it may see none.
  private sendTo(ws: WebSocket, sources: StatusSources, now: number): void {
    const scope = this.deps.scopeOf(ws);
    const urls =
      scope === null ? [...sources.checked, ...sources.overflow] : (sources.byTab.get(scope) ?? []);
    const overflow = new Set(sources.overflow);
    const statuses: Record<string, ServiceStatus> = {};
    for (const url of urls) {
      const status = overflow.has(url)
        ? ({ state: 'unknown', checkedAt: now, reason: 'too_many_sources' } as const)
        : this.statuses.get(url);
      if (status) statuses[url] = status;
    }
    if (Object.keys(statuses).length === 0) return;
    const op: ServiceStatusOp = { kind: 'service-status', statuses };
    this.deps.send(ws, { kind: 'op', from: 'system', op });
  }
}

/** The room's checks, on its storage, sockets and scopes, switched by `LIVE_STATUS_ENABLED`. */
export function roomServiceStatus(room: DocumentRoom): RoomServiceStatus {
  return new RoomServiceStatus({
    storage: room.state.storage,
    enabled: () => room.roomEnv?.LIVE_STATUS_ENABLED === 'true',
    sockets: () => room.state.getWebSockets(),
    sources: () => {
      const sql = room.state.storage.sql;
      if (room.documentId === null || !sql || !room.hasSchema()) {
        return { checked: [], overflow: [], byTab: new Map() };
      }
      room.ensureSchema();
      return readStatusSources(sql, room.documentId);
    },
    scopeOf: (ws) => scopeOf(room, ws),
    joined: (ws) => !!room.readSession(ws)?.presence,
    send: (ws, payload) => room.sendTo(ws, payload),
    arm: () => room.armAlarm(),
    now: () => Date.now(),
  });
}
