// The connections a knowledgebase has seen (docs/specs/030-knowledgebase/ai-knowledge.md "Connected agents"):
// `agent_seen`, one row an API token that called a knowledge route here. It is what lets Connected Agents show a
// connection's real scopes and lets an Editor grant one `write`: the reads (`page_reads`) are counted under the
// agent's name alone, and the grant is kept by the token's id (agent-grants.ts).
//
// The row holds the token's id, never the token: the id is what the platform shows its owner in Settings and what
// `PUT agents/<token>/scopes` takes. It is written at most once an hour a token (`AGENT_SEEN_WRITE_GAP_MS`) unless
// what it says changed, so a busy agent costs one statement a request and a write an hour.
import {
  agentScopesFor,
  type AgentScope,
  type KnowledgeAgentDoor,
} from '@liveknowledge/api-schema';
import { AGENT_SEEN_DAYS, stableHash } from '@liveknowledge/knowledge';
import type { FrontDoor } from '../changesets/front-door';
import type { DocumentEnv } from '../types';
import { scopesOfText } from './agent-grants';
import { knowledgeDb } from './knowledge-db';

const DAY_MS = 86_400_000;
/** The least time between two writes of an unchanged row. Safe range: a minute to a day. */
export const AGENT_SEEN_WRITE_GAP_MS = 3_600_000;
/** The most connections Connected Agents lists, the latest seen first. */
export const AGENTS_LISTED = 50;

type Exec = (query: string) => unknown;
type ShareRole = 'edit' | 'participate' | 'view';

/** The schema step (document-schema.ts STEPS). */
export function agentSeenSchemaStep(exec: Exec): void {
  exec(`CREATE TABLE IF NOT EXISTS agent_seen (
    token_id TEXT PRIMARY KEY, name TEXT NOT NULL, door TEXT NOT NULL, read_only INTEGER NOT NULL DEFAULT 0,
    person_role TEXT NOT NULL, last_seen INTEGER NOT NULL
  )`);
  exec('CREATE INDEX IF NOT EXISTS agent_seen_last ON agent_seen (last_seen)');
}

export const doorOf = (door: FrontDoor): KnowledgeAgentDoor =>
  door === 'Mcp' ? 'mcp' : door === 'Cli' ? 'cli' : 'token';

export type SeenNote = {
  tokenId: string;
  name: string;
  door: KnowledgeAgentDoor;
  readOnly: boolean;
  personRole: ShareRole;
};

/** Note that a token called here. Answers whether a row was written (false inside the hour, nothing changed). */
export async function noteAgentSeen(
  env: DocumentEnv,
  seen: SeenNote,
  now = Date.now(),
): Promise<boolean> {
  const done = await knowledgeDb(env)
    .prepare(
      `INSERT INTO agent_seen (token_id, name, door, read_only, person_role, last_seen)
         VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (token_id) DO UPDATE SET name = excluded.name, door = excluded.door,
         read_only = excluded.read_only, person_role = excluded.person_role, last_seen = excluded.last_seen
       WHERE agent_seen.last_seen <= excluded.last_seen - ? OR agent_seen.name <> excluded.name
          OR agent_seen.door <> excluded.door OR agent_seen.read_only <> excluded.read_only
          OR agent_seen.person_role <> excluded.person_role`,
    )
    .bind(
      seen.tokenId,
      seen.name,
      seen.door,
      seen.readOnly ? 1 : 0,
      seen.personRole,
      now,
      AGENT_SEEN_WRITE_GAP_MS,
    )
    .run();
  return (done.meta.changes ?? 0) > 0;
}

export type SeenAgent = {
  /** The row's id for a client: a hash of the token's id. */
  id: string;
  tokenId: string;
  name: string;
  door: KnowledgeAgentDoor;
  scopes: AgentScope[];
  canHoldWrite: boolean;
  lastSeenAt: number;
};

type SeenRow = {
  tokenId: string;
  name: string;
  door: string;
  readOnly: number;
  personRole: string;
  lastSeen: number;
  scopes: string | null;
};

const roleOf = (v: string): ShareRole => (v === 'edit' || v === 'participate' ? v : 'view');

/** The connections seen in the last `AGENT_SEEN_DAYS` days, the latest first, each with what it holds now: one
 *  read of at most `AGENTS_LISTED` rows, the grant joined by its key. */
export async function seenAgents(env: DocumentEnv, now = Date.now()): Promise<SeenAgent[]> {
  const { results } = await knowledgeDb(env)
    .prepare(
      `SELECT s.token_id AS tokenId, s.name AS name, s.door AS door, s.read_only AS readOnly,
              s.person_role AS personRole, s.last_seen AS lastSeen, g.scopes AS scopes
         FROM agent_seen s LEFT JOIN agent_grants g ON g.token_id = s.token_id
        WHERE s.last_seen > ? ORDER BY s.last_seen DESC, s.token_id ASC LIMIT ${AGENTS_LISTED}`,
    )
    .bind(now - AGENT_SEEN_DAYS * DAY_MS)
    .all<SeenRow>();
  return (results ?? []).map((row) => {
    const readOnly = row.readOnly === 1;
    const role = roleOf(row.personRole);
    return {
      id: stableHash('agent', row.tokenId),
      tokenId: row.tokenId,
      name: row.name,
      door: row.door === 'mcp' || row.door === 'cli' ? row.door : 'token',
      scopes: agentScopesFor({
        readOnly,
        role,
        granted: row.scopes === null ? null : scopesOfText(row.scopes),
      }),
      canHoldWrite: !readOnly && role === 'edit',
      lastSeenAt: row.lastSeen,
    };
  });
}

/** The daily prune: connections not seen in the days the reads are kept. */
export const pruneAgentSeen = (now: number, keptDays: number) => ({
  sql: 'DELETE FROM agent_seen WHERE last_seen <= ?',
  params: [now - keptDays * DAY_MS],
});
