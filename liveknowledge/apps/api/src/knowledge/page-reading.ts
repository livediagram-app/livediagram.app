// Required Reading in the knowledgebase's own SQLite (docs/specs/030-knowledgebase/required-reading.md; blueprint
// required-reading.md): a page's requirement in `page_required_reading`, one row a page, and each person's I've Read
// This in `page_read_confirmations`, one row a person a page. Never in the page's body: none of it is an edit, so it
// writes through the database that notes nothing (knowledgeDb). A page deleted for good takes its rows with it; a
// closed account's confirmations go and it leaves every chosen list (document-anonymise.ts).
import {
  REQUIRED_READING_PAGES_MAX,
  type PageReadingChange,
  type ReadingAudience,
} from '@liveknowledge/api-schema';
import type { DocumentEnv } from '../types';
import { knowledgeDb } from './knowledge-db';

type Exec = (query: string) => unknown;

/** The schema step (document-schema.ts V42). Additive, IF NOT EXISTS. */
export function requiredReadingSchemaStep(exec: Exec): void {
  exec(`CREATE TABLE IF NOT EXISTS page_required_reading (
    tab TEXT PRIMARY KEY, audience TEXT NOT NULL CHECK (audience IN ('everyone', 'people')),
    people TEXT NOT NULL DEFAULT '[]', set_by TEXT NOT NULL, set_at INTEGER NOT NULL,
    asked_at INTEGER NOT NULL, round INTEGER NOT NULL DEFAULT 1
  )`);
  exec(`CREATE TRIGGER IF NOT EXISTS page_required_reading_tab_removed AFTER DELETE ON tabs
    BEGIN DELETE FROM page_required_reading WHERE tab = OLD.id; END`);
  exec(`CREATE TABLE IF NOT EXISTS page_read_confirmations (
    tab TEXT NOT NULL, person TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (tab, person)
  )`);
  exec(
    'CREATE INDEX IF NOT EXISTS page_read_confirmations_person ON page_read_confirmations (person)',
  );
  exec(`CREATE TRIGGER IF NOT EXISTS page_read_confirmations_tab_removed AFTER DELETE ON tabs
    BEGIN DELETE FROM page_read_confirmations WHERE tab = OLD.id; END`);
}

export type Requirement = {
  tab: string;
  audience: ReadingAudience;
  /** The chosen account ids (`people` only; empty for `everyone`). */
  people: string[];
  setBy: string;
  askedAt: number;
  round: number;
};

type RequirementRow = {
  tab: string;
  audience: ReadingAudience;
  people: string;
  set_by: string;
  asked_at: number;
  round: number;
};

const parsePeople = (json: string): string[] => {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

const requirementOfRow = (row: RequirementRow): Requirement => ({
  tab: row.tab,
  audience: row.audience,
  people: row.audience === 'people' ? parsePeople(row.people) : [],
  setBy: row.set_by,
  askedAt: row.asked_at,
  round: row.round,
});

const COLUMNS = 'tab, audience, people, set_by, asked_at, round';

/** The page's requirement, or null: one read by the primary key. */
export async function requirementOf(env: DocumentEnv, tab: string): Promise<Requirement | null> {
  const row = await knowledgeDb(env)
    .prepare(`SELECT ${COLUMNS} FROM page_required_reading WHERE tab = ?`)
    .bind(tab)
    .first<RequirementRow>();
  return row ? requirementOfRow(row) : null;
}

/** Every requirement in the knowledgebase (at most REQUIRED_READING_PAGES_MAX rows). */
export async function allRequirements(env: DocumentEnv): Promise<Requirement[]> {
  const { results } = await knowledgeDb(env)
    .prepare(`SELECT ${COLUMNS} FROM page_required_reading ORDER BY set_at, tab`)
    .all<RequirementRow>();
  return (results ?? []).map(requirementOfRow);
}

/** Who confirmed the page, and when, by person. */
export async function confirmationsOf(env: DocumentEnv, tab: string): Promise<Map<string, number>> {
  const { results } = await knowledgeDb(env)
    .prepare('SELECT person, at FROM page_read_confirmations WHERE tab = ?')
    .bind(tab)
    .all<{ person: string; at: number }>();
  return new Map((results ?? []).map((r) => [r.person, r.at]));
}

/** Every confirmation of every Required Reading page, by page: one read for the overview. */
export async function allConfirmations(env: DocumentEnv): Promise<Map<string, Set<string>>> {
  const { results } = await knowledgeDb(env)
    .prepare(
      `SELECT c.tab, c.person FROM page_read_confirmations c
         JOIN page_required_reading r ON r.tab = c.tab`,
    )
    .all<{ tab: string; person: string }>();
  const out = new Map<string, Set<string>>();
  for (const row of results ?? []) {
    const held = out.get(row.tab) ?? new Set<string>();
    held.add(row.person);
    out.set(row.tab, held);
  }
  return out;
}

export type SetOutcome = { refusal: 'reading_pages_full' } | { ok: true };

/** Require the page for this audience, or change who it is for: a page already required keeps its round and its
 *  confirmations. A new row only while the knowledgebase holds fewer than the bound: one statement. */
export async function setRequirement(
  env: DocumentEnv,
  tab: string,
  change: Required<Pick<PageReadingChange, 'people'>> & { audience: ReadingAudience },
  by: string,
  now: number,
): Promise<SetOutcome> {
  const people = JSON.stringify(change.audience === 'people' ? change.people : []);
  const res = await knowledgeDb(env)
    .prepare(
      `INSERT INTO page_required_reading (tab, audience, people, set_by, set_at, asked_at, round)
         SELECT ?1, ?2, ?3, ?4, ?5, ?5, 1
          WHERE EXISTS (SELECT 1 FROM page_required_reading WHERE tab = ?1)
             OR (SELECT COUNT(*) FROM page_required_reading) < ?6
       ON CONFLICT (tab) DO UPDATE SET audience = excluded.audience, people = excluded.people,
         set_by = excluded.set_by, set_at = excluded.set_at`,
    )
    .bind(tab, change.audience, people, by, now, REQUIRED_READING_PAGES_MAX)
    .run();
  return (res.meta.changes ?? 0) > 0 ? { ok: true } : { refusal: 'reading_pages_full' };
}

/** Stop requiring the page: its row and its confirmations go. Answers whether it was required. */
export async function clearRequirement(env: DocumentEnv, tab: string): Promise<boolean> {
  const db = knowledgeDb(env);
  const [gone] = await db.batch([
    db.prepare('DELETE FROM page_required_reading WHERE tab = ?').bind(tab),
    db.prepare('DELETE FROM page_read_confirmations WHERE tab = ?').bind(tab),
  ]);
  return (gone?.meta.changes ?? 0) > 0;
}

/** The person read the page: their row, once (pressing again keeps the first time). */
export async function confirmRead(
  env: DocumentEnv,
  tab: string,
  person: string,
  now: number,
): Promise<void> {
  await knowledgeDb(env)
    .prepare(
      'INSERT INTO page_read_confirmations (tab, person, at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    )
    .bind(tab, person, now)
    .run();
}

/** Ask everyone again (a significant change): the confirmations go and a new round starts. Answers how many went. */
export async function askAgain(env: DocumentEnv, tab: string, now: number): Promise<number> {
  const db = knowledgeDb(env);
  const [cleared] = await db.batch([
    db.prepare('DELETE FROM page_read_confirmations WHERE tab = ?').bind(tab),
    db
      .prepare('UPDATE page_required_reading SET asked_at = ?, round = round + 1 WHERE tab = ?')
      .bind(now, tab),
  ]);
  return cleared?.meta.changes ?? 0;
}
