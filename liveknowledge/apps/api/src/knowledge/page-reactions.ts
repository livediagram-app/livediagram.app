// Reactions on a page in the knowledgebase's own SQLite (docs/specs/030-knowledgebase/page-reactions.md): one row a
// person a page an emoji in `page_reactions`, never in the page's body. A reaction is no edit of the page, so the
// writes go through the database that notes nothing (knowledgeDb): no revision, no History, no Most Used day, no
// outbox, no version. A deleted page takes its reactions with it; a closed account's are removed
// (document-anonymise.ts).
import {
  PAGE_REACTION_EMOJI_MAX,
  PAGE_REACTIONS_MAX,
  PERSON_PAGE_REACTIONS_MAX,
  type PageReaction,
  type PageReactionChange,
} from '@liveknowledge/api-schema';
import type { DocumentEnv } from '../types';
import { knowledgeDb } from './knowledge-db';

type Exec = (query: string) => unknown;

/** The schema step (document-schema.ts). Additive, IF NOT EXISTS. */
export function pageReactionsSchemaStep(exec: Exec): void {
  exec(`CREATE TABLE IF NOT EXISTS page_reactions (
    tab TEXT NOT NULL, emoji TEXT NOT NULL, person TEXT NOT NULL, by_key TEXT NOT NULL, name TEXT NOT NULL,
    at INTEGER NOT NULL, PRIMARY KEY (tab, emoji, person)
  )`);
  exec('CREATE INDEX IF NOT EXISTS page_reactions_tab_at ON page_reactions (tab, at)');
  exec(`CREATE TRIGGER IF NOT EXISTS page_reactions_tab_removed AFTER DELETE ON tabs
    BEGIN DELETE FROM page_reactions WHERE tab = OLD.id; END`);
}

/** Who is reacting: their account id (never on the wire), their collab key and their name. */
export type Reactor = { person: string; by: string; name: string };

type Row = { emoji: string; person: string; by_key: string; name: string };

export type ReactionRefusal = 'reactions_full' | 'too_many_reactions';

/** Why adding `emoji` for `person` would break a bound of the page, or null. Taking one back never does. */
export function reactionRefusal(
  rows: readonly Pick<Row, 'emoji' | 'person'>[],
  emoji: string,
  person: string,
): ReactionRefusal | null {
  if (rows.some((r) => r.emoji === emoji && r.person === person)) return null;
  if (rows.length >= PAGE_REACTIONS_MAX) return 'reactions_full';
  const kinds = new Set(rows.map((r) => r.emoji));
  if (!kinds.has(emoji) && kinds.size >= PAGE_REACTION_EMOJI_MAX) return 'reactions_full';
  const own = rows.filter((r) => r.person === person).length;
  return own >= PERSON_PAGE_REACTIONS_MAX ? 'too_many_reactions' : null;
}

const publicOf = (row: Row): PageReaction => ({ emoji: row.emoji, by: row.by_key, name: row.name });

async function rowsOf(env: DocumentEnv, tab: string): Promise<Row[]> {
  const rows = await knowledgeDb(env)
    .prepare(
      'SELECT emoji, person, by_key, name FROM page_reactions WHERE tab = ? ORDER BY at, rowid',
    )
    .bind(tab)
    .all<Row>();
  return rows.results ?? [];
}

/** Every reaction on the page, oldest first, as the wire carries them. */
export async function readPageReactions(env: DocumentEnv, tab: string): Promise<PageReaction[]> {
  return (await rowsOf(env, tab)).map(publicOf);
}

export type ReactionOutcome =
  { refusal: ReactionRefusal } | { reaction: PageReaction; changed: boolean };

/** Add or take back the reactor's `emoji` on the page. `changed` is false when it already stood so. */
export async function togglePageReaction(
  env: DocumentEnv,
  tab: string,
  change: PageReactionChange,
  who: Reactor,
  now: number,
): Promise<ReactionOutcome> {
  const db = knowledgeDb(env);
  const reaction: PageReaction = { emoji: change.emoji, by: who.by, name: who.name };
  if (!change.on) {
    const res = await db
      .prepare('DELETE FROM page_reactions WHERE tab = ? AND emoji = ? AND person = ?')
      .bind(tab, change.emoji, who.person)
      .run();
    return { reaction, changed: (res.meta.changes ?? 0) > 0 };
  }
  const refusal = reactionRefusal(await rowsOf(env, tab), change.emoji, who.person);
  if (refusal) return { refusal };
  const res = await db
    .prepare(
      'INSERT OR IGNORE INTO page_reactions (tab, emoji, person, by_key, name, at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(tab, change.emoji, who.person, who.by, who.name, now)
    .run();
  return { reaction, changed: (res.meta.changes ?? 0) > 0 };
}
