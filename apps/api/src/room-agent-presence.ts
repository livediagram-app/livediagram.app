import {
  AGENT_PRESENCE_MAX_TTL_MS,
  AGENT_PRESENCE_ROOM_MAX,
  type AgentPresence,
  type ShareRole,
} from '@livediagram/api-schema';

// The room's agent presence (docs/specs/024-agents/blueprints/agent-presence.md "Room"): one entry per token and tab,
// one Durable Object storage key each (PR3, PR13), restored by prefix on wake, swept on its expiry by the alarm or by
// any roster build (PR30). Entries travel in the presence frame's own `agents` array, so no reader of
// `participants` ever counts one (I1, PR14).

export const AGENT_PRESENCE_KEY_PREFIX = 'agent-presence:';

export type AgentPresenceRecord = {
  id: string;
  tokenId: string;
  tabId: string;
  // The owner's per-document person tag; never leaves the room (I4).
  personTag: string | null;
  // The share code the token was admitted by, so revoking it clears the entry (PR15).
  shareCode: string | null;
  name: string;
  color: string;
  role: ShareRole;
  status: string | null;
  focus: string[];
  setAt: number;
  expiresAt: number;
};

// `PUT /presence` from the api: a set replaces status and focus (PR4); a refresh keeps them and only extends the
// expiry (PR9), creating an entry with none when absent.
export type AgentPresenceWrite = {
  tokenId: string;
  tabId: string;
  personTag: string | null;
  shareCode: string | null;
  name: string;
  color: string;
  role: ShareRole;
  status: string | null;
  focus: string[];
  ttlMs: number;
  mode: 'set' | 'refresh';
};

export type AgentPresenceWriteResult =
  | { ok: true; expiresAt: number; created: boolean; broadcast: boolean }
  | { ok: false; error: 'agent_presence_full' };

type PresenceStorage = {
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(opts: { prefix: string }): Promise<Map<string, unknown>>;
};

export const agentPresenceKey = (tokenId: string, tabId: string) =>
  `${AGENT_PRESENCE_KEY_PREFIX}${tokenId}:${tabId}`;

export class RoomAgentPresence {
  private readonly storage: PresenceStorage;
  private readonly now: () => number;
  private readonly mintId: () => string;
  private readonly entries = new Map<string, AgentPresenceRecord>();

  constructor(storage: PresenceStorage, now: () => number, mintId: () => string) {
    this.storage = storage;
    this.now = now;
    this.mintId = mintId;
  }

  // Loads every stored entry after a wake, then sweeps the expired ones.
  async restore(): Promise<AgentPresenceRecord[]> {
    this.entries.clear();
    for (const [key, value] of await this.storage.list({ prefix: AGENT_PRESENCE_KEY_PREFIX }))
      this.entries.set(key, value as AgentPresenceRecord);
    return this.sweep();
  }

  async write(w: AgentPresenceWrite): Promise<AgentPresenceWriteResult> {
    const key = agentPresenceKey(w.tokenId, w.tabId);
    const now = this.now();
    const prior = this.entries.get(key);
    if (!prior && this.entries.size >= AGENT_PRESENCE_ROOM_MAX)
      return { ok: false, error: 'agent_presence_full' };
    const ttl = Math.min(w.ttlMs, AGENT_PRESENCE_MAX_TTL_MS);
    const refresh = w.mode === 'refresh' && prior;
    const record: AgentPresenceRecord = {
      id: prior?.id ?? this.mintId(),
      tokenId: w.tokenId,
      tabId: w.tabId,
      personTag: w.personTag,
      shareCode: w.shareCode,
      name: w.name,
      color: w.color,
      role: w.role,
      status: refresh ? prior.status : w.mode === 'refresh' ? null : w.status,
      focus: refresh ? prior.focus : w.mode === 'refresh' ? [] : w.focus,
      setAt: refresh ? prior.setAt : now,
      // A refresh never shortens a longer expiry an explicit set asked for (PR9); I3 holds either way.
      expiresAt: refresh ? Math.max(prior.expiresAt, now + ttl) : now + ttl,
    };
    this.entries.set(key, record);
    await this.storage.put(key, record);
    // Only what is on the wire warrants a frame: `expiresAt` is not.
    const broadcast =
      !prior ||
      !refresh ||
      prior.name !== record.name ||
      prior.color !== record.color ||
      prior.role !== record.role;
    return { ok: true, expiresAt: record.expiresAt, created: !prior, broadcast };
  }

  async clear(tokenId: string, tabId: string): Promise<boolean> {
    const key = agentPresenceKey(tokenId, tabId);
    if (!this.entries.delete(key)) return false;
    await this.storage.delete(key);
    return true;
  }

  // Every entry, or those admitted by one share code: a trashed document, a revoked or rescoped link (PR15).
  async clearWhere(match: (r: AgentPresenceRecord) => boolean): Promise<AgentPresenceRecord[]> {
    const gone = [...this.entries].filter(([, r]) => match(r));
    for (const [key] of gone) {
      this.entries.delete(key);
      await this.storage.delete(key);
    }
    return gone.map(([, r]) => r);
  }

  // Removes and answers every entry whose expiry has passed.
  async sweep(): Promise<AgentPresenceRecord[]> {
    const now = this.now();
    return this.clearWhere((r) => r.expiresAt <= now);
  }

  live(): AgentPresenceRecord[] {
    return [...this.entries.values()];
  }

  // The earliest expiry, for the room's one alarm (I5, PR29); null with no entries.
  nextExpiry(): number | null {
    let next: number | null = null;
    for (const r of this.entries.values())
      if (next === null || r.expiresAt < next) next = r.expiresAt;
    return next;
  }
}

// One hello'd session as the roster sees it.
export type RosterSession = { presenceId: string; personTag: string | null };

// The `agents` array one recipient receives (blueprint "Room"): entries in the order they were set, `joins` naming the
// other sessions of the same person, `self` when the recipient is that person, `person` numbered by first appearance.
// No person tag or token id leaves (I4).
export function agentRosterFor(
  recipient: RosterSession | null,
  sessions: readonly RosterSession[],
  entries: readonly AgentPresenceRecord[],
): AgentPresence[] {
  const persons = new Map<string, number>();
  return [...entries]
    .sort((a, b) => a.setAt - b.setAt || (a.id < b.id ? -1 : 1))
    .map((e) => {
      const personKey = e.personTag ?? `token:${e.tokenId}`;
      if (!persons.has(personKey)) persons.set(personKey, persons.size);
      const joins =
        e.personTag === null
          ? []
          : sessions
              .filter((s) => s.presenceId !== recipient?.presenceId && s.personTag === e.personTag)
              .map((s) => s.presenceId);
      const self = e.personTag !== null && recipient?.personTag === e.personTag;
      return {
        id: e.id,
        name: e.name,
        color: e.color,
        role: e.role,
        tabId: e.tabId,
        ...(e.status ? { status: e.status } : {}),
        focus: e.focus,
        joins,
        ...(self ? { self: true as const } : {}),
        person: persons.get(personKey)!,
      };
    });
}
