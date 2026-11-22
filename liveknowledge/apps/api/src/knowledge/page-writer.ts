// What kind of writer made a page and changed it last (docs/specs/030-knowledgebase/verification.md "Made by a person
// or an agent"): a person, or an agent. An agent is any write made with an API token (the MCP server's tools, the CLI,
// the api called with a token), named by the token's name and the door it came through where they are known; and a
// person accepting an agent's suggestion, whose words are the agent's. The stamp's `by` is always a person: the
// token's maker, or the Editor who accepted. Kept beside each stamp of `page_authors` (page-authors.ts, schema step
// V18).
import { isAccountIdShape } from '@liveknowledge/api-schema';
import { guestVerifier, isGuestVerifier } from '@liveknowledge/knowledge';
import type { PageAuthorKind, PageAuthorStamp, PageAuthorVia } from '@liveknowledge/api-schema';
import { agentName as cleanAgentName } from '@liveknowledge/knowledge';
import { frontDoorOf } from '../changesets/front-door';
import { AGENT_NAME_HEADER } from './knowledge-caller';

type Exec = (query: string) => unknown;

/** Who wrote: the person, what kind of writer, and an agent's name and door. */
export type PageWriter = {
  by: string;
  kind: PageAuthorKind;
  agent?: string | null;
  via?: PageAuthorVia | null;
};

// The kind of each stamp and, for an agent's, its name and door. V17 noted people's writes alone, so a row from before
// reads as a person's: the default says so, and nothing is guessed.
const KIND_COLUMNS = [
  "created_kind TEXT NOT NULL DEFAULT 'human'",
  'created_agent TEXT NULL',
  'created_via TEXT NULL',
  "updated_kind TEXT NOT NULL DEFAULT 'human'",
  'updated_agent TEXT NULL',
  'updated_via TEXT NULL',
] as const;

/** The schema step (document-schema.ts V18): each column added only when the table lacks it, so it is safe however
 *  far a room got (as V15 and V16 ask before their ALTER). */
export function pageAuthorKindsSchemaStep(exec: Exec): void {
  const have = new Set(
    (exec('PRAGMA table_info(page_authors)') as { toArray(): { name: unknown }[] })
      .toArray()
      .map((c) => String(c.name)),
  );
  for (const column of KIND_COLUMNS) {
    const name = column.slice(0, column.indexOf(' '));
    if (!have.has(name)) exec(`ALTER TABLE page_authors ADD COLUMN ${column}`);
  }
}

/** The longest agent name kept: a token's name is the platform's, at most this many characters shown. */
export const AGENT_NAME_MAX = 80;

const VIA: Record<ReturnType<typeof frontDoorOf>, PageAuthorVia> = {
  Mcp: 'mcp',
  Cli: 'cli',
  Api: 'api',
  // The editor never writes with a token; a token that says it is the editor is still an API caller.
  Editor: 'api',
};

const agentName = (name: string | null | undefined): string | null =>
  name?.trim().slice(0, AGENT_NAME_MAX) || null;

/** A person's write. */
export const personWriter = (by: string): PageWriter => ({ by, kind: 'human' });

/** The writer of a request: an agent when it bears an API token, named as its reads are (its client's name from its
 *  front door, else the token's own name) with the door it came through; else the person. */
export function writerOf(
  ctx: { token?: { name?: string | null } | null; request: Request },
  by: string,
): PageWriter {
  if (!ctx.token) return personWriter(by);
  const header = ctx.request.headers.get(AGENT_NAME_HEADER)?.trim();
  const named = header ? cleanAgentName(header) : null;
  return {
    by,
    kind: 'ai',
    agent: agentName(named || ctx.token.name),
    via: VIA[frontDoorOf(ctx.request)],
  };
}

/** A person accepting an agent's suggestion: the words are the agent's, the stamp is the person's. */
export const acceptedSuggestionWriter = (by: string, agent: string): PageWriter => ({
  by,
  kind: 'ai',
  agent: agentName(agent),
  via: 'suggestion',
});

const KINDS: readonly PageAuthorKind[] = ['human', 'ai'];
const VIAS: readonly PageAuthorVia[] = ['mcp', 'cli', 'api', 'suggestion'];

/** One stamp as read: an unknown kind reads as a person's, an unknown door as none. */
export function stampOf(
  by: string,
  at: number,
  kind: unknown,
  agent: unknown,
  via: unknown,
): PageAuthorStamp {
  return {
    by,
    at,
    kind: KINDS.includes(kind as PageAuthorKind) ? (kind as PageAuthorKind) : 'human',
    ...(typeof agent === 'string' && agent ? { agent } : {}),
    ...(VIAS.includes(via as PageAuthorVia) ? { via: via as PageAuthorVia } : {}),
  };
}

// A guest's owner id (`guest_…`, never an account's `user_…`) on a stamp, and not one already naming a guest.
const isGuestOwner = (by: string): boolean => !!by && !isAccountIdShape(by) && !isGuestVerifier(by);

/** Who a save by `owner` is stamped as: a guest by the name they edit under (`guest:<name> (Guest)`, guestVerifier),
 *  as their Verify is, since a guest has no profile to name them from later (owner 2026-11-22: Updated read "Guest");
 *  a guest with no name, an account and an agent as they are. */
export function savedBy(owner: string, name: string | null | undefined): string {
  if (!isGuestOwner(owner)) return owner;
  const named = guestVerifier(name);
  return isGuestVerifier(named) && named.includes(':') ? named : owner;
}

/** The guests' owner ids among stamps, once each: whose names to read. */
export const guestOwnersOf = (stamps: readonly { by: string }[]): string[] => [
  ...new Set(stamps.map((s) => s.by).filter(isGuestOwner)),
];

/**
 * A stamp as it leaves the api: a guest's owner id is a credential, so it never does. It reads `guest:<name> (Guest)`
 * from their profile's name, or `guest` with none (owner 2026-11-21: "Bright Marlin (Guest)"), as a guest's Verify is
 * stored (guestVerifier). An account's stamp and an agent's pass as they are.
 */
export const guestStampNamer =
  (nameOf: (id: string) => string | undefined) =>
  <T extends { by: string }>(stamp: T): T =>
    isGuestOwner(stamp.by) ? { ...stamp, by: guestVerifier(nameOf(stamp.by)) } : stamp;
