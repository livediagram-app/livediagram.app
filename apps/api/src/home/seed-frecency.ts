// Seeding Jump back in once from a person's real edit days (docs/specs/013-workspace/explorer-home.md
// "Jump back in"; blueprint "Seeding frecency"). Without it the strip would be empty for everyone on
// the day Home arrives. An edit needs an open, so each UTC day the person really edited a document
// counts as a day they opened it.
//
// Only days strictly before the document's first recorded open are added, and a seeded row's first
// open moves back to its earliest seeded day: after one run no edit day lies before it, so running
// again writes nothing. The stamp only saves the work of looking.

import {
  TIMELINE_RETENTION_MS,
  mergeFrecencyKeys,
  nextFrecencyKey,
  utcDay,
} from '@livediagram/api-schema';
import { REAL_EDIT } from '../db/home';
import { markFrecencySeeded } from '../db/timeline';
import type { Env } from '../types';

/** The newest real edits one seed reads: one person's recent edit days. */
export const FRECENCY_SEED_EVENT_MAX = 2000;
/** The most documents one seed writes: the Timeline backfill's document cap. */
export const FRECENCY_SEED_DOCUMENT_MAX = 200;

export type FrecencySeedResult = { docs: number; days: number; conflicts: number; capped: boolean };

type ExistingRow = {
  document_id: string;
  open_days: number;
  first_opened_at: number;
  last_opened_at: number;
  last_open_day: string;
  frecency_key: number;
};

export async function seedFrecency(
  env: Env,
  personId: string,
  now: number,
): Promise<FrecencySeedResult> {
  const edits = await env.DB.prepare(
    `SELECT e.source_id AS document_id, e.occurred_at
       FROM timeline_events e
       JOIN documents d ON d.id = e.source_id
      WHERE e.actor_id = ?1 AND e.source_type = 'document' AND e.event_type = 'document_edited'
        AND ${REAL_EDIT}
        AND e.occurred_at >= ?2 AND e.occurred_at <= ?3
      ORDER BY e.occurred_at DESC
      LIMIT ?4`,
  )
    .bind(personId, now - TIMELINE_RETENTION_MS, now, FRECENCY_SEED_EVENT_MAX)
    .all<{ document_id: string; occurred_at: number }>();
  const rows = edits.results ?? [];

  // Per document, newest first: one time per UTC day (the newest edit of that day).
  const days = new Map<string, Map<string, number>>();
  for (const r of rows) {
    let perDoc = days.get(r.document_id);
    if (!perDoc) {
      if (days.size === FRECENCY_SEED_DOCUMENT_MAX) continue;
      perDoc = new Map();
      days.set(r.document_id, perDoc);
    }
    const day = utcDay(r.occurred_at);
    if (!perDoc.has(day)) perDoc.set(day, r.occurred_at);
  }
  const capped =
    rows.length === FRECENCY_SEED_EVENT_MAX ||
    new Set(rows.map((r) => r.document_id)).size > days.size;

  const existing = await env.DB.prepare(
    `SELECT document_id, open_days, first_opened_at, last_opened_at, last_open_day, frecency_key
       FROM document_opens WHERE owner_id = ?1`,
  )
    .bind(personId)
    .all<ExistingRow>();
  const byDoc = new Map((existing.results ?? []).map((r) => [r.document_id, r]));

  const insert = env.DB.prepare(
    `INSERT INTO document_opens
       (owner_id, document_id, open_days, first_opened_at, last_opened_at, last_open_day, frecency_key)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT (owner_id, document_id) DO NOTHING`,
  );
  // Guarded on what was read: a concurrent open or seed wins, and this document is a conflict.
  const merge = env.DB.prepare(
    `UPDATE document_opens
        SET open_days = open_days + ?3, first_opened_at = ?4, frecency_key = ?5
      WHERE owner_id = ?1 AND document_id = ?2 AND first_opened_at = ?6 AND frecency_key = ?7`,
  );
  const writes: { statement: D1PreparedStatement; days: number }[] = [];
  for (const [documentId, perDoc] of days) {
    const row = byDoc.get(documentId);
    const before = row ? utcDay(row.first_opened_at) : null;
    const times = [...perDoc]
      .filter(([day]) => before === null || day < before)
      .map(([, at]) => at)
      .sort((a, b) => a - b);
    if (times.length === 0) continue;
    const key = times.reduce<number | null>((k, at) => nextFrecencyKey(k, at), null)!;
    const first = times[0]!;
    const last = times[times.length - 1]!;
    writes.push({
      days: times.length,
      statement: row
        ? merge.bind(
            personId,
            documentId,
            times.length,
            first,
            mergeFrecencyKeys(row.frecency_key, key, now),
            row.first_opened_at,
            row.frecency_key,
          )
        : // A new row: its first and last opens are its oldest and newest seeded days.
          insert.bind(personId, documentId, times.length, first, last, utcDay(last), key),
    });
  }

  const results = await env.DB.batch([
    ...writes.map((w) => w.statement),
    markFrecencySeeded(env, personId, now),
  ]);
  let docs = 0;
  let seededDays = 0;
  writes.forEach((w, i) => {
    if ((results[i]?.meta?.changes ?? 0) > 0) {
      docs += 1;
      seededDays += w.days;
    }
  });
  const result = { docs, days: seededDays, conflicts: writes.length - docs, capped };
  console.info(
    `home: frecency-seeded docs=${docs} days=${seededDays} conflicts=${result.conflicts} capped=${capped ? 'yes' : 'no'}`,
  );
  return result;
}
