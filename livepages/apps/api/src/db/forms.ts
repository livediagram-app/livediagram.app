// form_links, form_reports and form_reads (migrations 0092 and 0093, docs/specs/030-forms/blueprints/forms.md §11): a Form
// tab's public link, what respondents reported, and what each reader has seen of its responses.
import { FORM_CODE_LENGTH } from '@livediagram/forms';
import type { Env } from '../types';

export type FormLinkRow = {
  code: string;
  document_id: string;
  tab_id: string;
  open: number;
  created_at: number;
  responses: number;
  hour_start: number;
  hour_count: number;
  suspended_at: number | null;
  // When its owner deleted it (Delete Link): kept so the tab's numbers carry on, never answering again.
  deleted_at: number | null;
  last_email_at: number | null;
  held_emails: number;
};

const COLS =
  'code, document_id, tab_id, open, created_at, responses, hour_start, hour_count, suspended_at, deleted_at, last_email_at, held_emails';

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// A form code: FORM_CODE_LENGTH characters of base 62, each drawn without bias (bytes past the last whole
// multiple of 62 are drawn again).
export function generateFormCode(random: (n: number) => Uint8Array = randomBytes): string {
  let code = '';
  while (code.length < FORM_CODE_LENGTH) {
    for (const b of random(FORM_CODE_LENGTH)) {
      if (b >= 248) continue;
      code += BASE62[b % 62];
      if (code.length === FORM_CODE_LENGTH) break;
    }
  }
  return code;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

// The tab's live link (not suspended, not deleted), or null.
export async function getLiveFormLink(
  env: Env,
  documentId: string,
  tabId: string,
): Promise<FormLinkRow | null> {
  return env.DB.prepare(
    `SELECT ${COLS} FROM form_links WHERE document_id = ? AND tab_id = ? AND suspended_at IS NULL AND deleted_at IS NULL`,
  )
    .bind(documentId, tabId)
    .first<FormLinkRow>();
}

// The document's live links (not suspended, not deleted), each with its Form tab: few, one a Form tab at most.
export async function liveFormLinksOf(
  env: Env,
  documentId: string,
): Promise<{ code: string; tab_id: string }[]> {
  const res = await env.DB.prepare(
    'SELECT code, tab_id FROM form_links WHERE document_id = ? AND suspended_at IS NULL AND deleted_at IS NULL',
  )
    .bind(documentId)
    .all<{ code: string; tab_id: string }>();
  return res.results ?? [];
}

// The link a code names, suspended, deleted or not.
export async function getFormLink(env: Env, code: string): Promise<FormLinkRow | null> {
  return env.DB.prepare(`SELECT ${COLS} FROM form_links WHERE code = ?`)
    .bind(code)
    .first<FormLinkRow>();
}

// The tab's most recent suspended link, for its notice; null when none was.
export async function getSuspendedFormLink(
  env: Env,
  documentId: string,
  tabId: string,
): Promise<FormLinkRow | null> {
  return env.DB.prepare(
    `SELECT ${COLS} FROM form_links WHERE document_id = ? AND tab_id = ? AND suspended_at IS NOT NULL
      ORDER BY suspended_at DESC LIMIT 1`,
  )
    .bind(documentId, tabId)
    .first<FormLinkRow>();
}

export async function countSuspendedFormLinks(env: Env, documentId: string): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM form_links WHERE document_id = ? AND suspended_at IS NOT NULL',
  )
    .bind(documentId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

// A new live link for the tab. Its response number carries on from the tab's earlier links (suspended or deleted),
// so numbers never repeat on one form. Null when the tab already has a live link (the unique index refuses a second).
export async function createFormLink(
  env: Env,
  documentId: string,
  tabId: string,
  now: number,
): Promise<FormLinkRow | null> {
  const code = generateFormCode();
  const prior = await env.DB.prepare(
    'SELECT MAX(responses) AS n FROM form_links WHERE document_id = ? AND tab_id = ?',
  )
    .bind(documentId, tabId)
    .first<{ n: number | null }>();
  try {
    await env.DB.prepare(
      'INSERT INTO form_links (code, document_id, tab_id, open, created_at, responses) VALUES (?, ?, ?, 1, ?, ?)',
    )
      .bind(code, documentId, tabId, now, prior?.n ?? 0)
      .run();
  } catch {
    return null;
  }
  return getFormLink(env, code);
}

export async function setFormLinkOpen(env: Env, code: string, open: boolean): Promise<void> {
  await env.DB.prepare('UPDATE form_links SET open = ? WHERE code = ?')
    .bind(open ? 1 : 0, code)
    .run();
}

// A link deleted by its owner: kept, marked, closed (its number carries on to the tab's next link; its code never
// answers again). A suspended link stays as it is.
export async function deleteFormLink(env: Env, code: string, now: number): Promise<void> {
  await env.DB.prepare(
    'UPDATE form_links SET deleted_at = ?, open = 0 WHERE code = ? AND suspended_at IS NULL AND deleted_at IS NULL',
  )
    .bind(now, code)
    .run();
}

// Every link of a tab, when the tab is deleted from its document (suspended ones included: the tab is gone).
export async function deleteFormLinksForTab(
  env: Env,
  documentId: string,
  tabId: string,
): Promise<number> {
  const res = await env.DB.prepare('DELETE FROM form_links WHERE document_id = ? AND tab_id = ?')
    .bind(documentId, tabId)
    .run();
  return res.meta?.changes ?? 0;
}

const FORM_HOUR_MS = 60 * 60 * 1000;

// Takes the next response number, within the form's hourly cap and its Response Limit (`limit`, null for none or for
// a preview): one guarded UPDATE, so two responses at once never share a number and neither cap is passed. Null when
// one is reached (or the link went meanwhile).
export async function claimResponseNumber(
  env: Env,
  code: string,
  now: number,
  hourlyCap: number,
  limit: number | null = null,
): Promise<number | null> {
  const windowStart = now - FORM_HOUR_MS;
  const row = await env.DB.prepare(
    `UPDATE form_links
        SET responses = responses + 1,
            last_response_at = ?,
            hour_count = CASE WHEN hour_start <= ? THEN 1 ELSE hour_count + 1 END,
            hour_start = CASE WHEN hour_start <= ? THEN ? ELSE hour_start END
      WHERE code = ? AND suspended_at IS NULL AND deleted_at IS NULL AND (hour_start <= ? OR hour_count < ?)
        AND (? IS NULL OR responses < ?)
      RETURNING responses`,
  )
    .bind(now, windowStart, windowStart, now, code, windowStart, hourlyCap, limit, limit)
    .first<{ responses: number }>();
  return row ? row.responses : null;
}

// --- Reports -------------------------------------------------------------------------------------------------

// A report, once per browser; then how many distinct browsers on distinct networks have reported the link.
export async function addFormReport(
  env: Env,
  report: { code: string; browser: string; network: string; reason: string; note: string | null },
  now: number,
): Promise<{ added: boolean; distinct: number }> {
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO form_reports (code, browser, network, reason, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(report.code, report.browser, report.network, report.reason, report.note, now)
    .run();
  const row = await env.DB.prepare(
    'SELECT COUNT(DISTINCT network) AS n FROM form_reports WHERE code = ?',
  )
    .bind(report.code)
    .first<{ n: number }>();
  return { added: (res.meta?.changes ?? 0) > 0, distinct: Number(row?.n ?? 0) };
}

// Suspends a live link for good; true when this call did it.
export async function suspendFormLink(env: Env, code: string, now: number): Promise<boolean> {
  const res = await env.DB.prepare(
    'UPDATE form_links SET suspended_at = ?, open = 0 WHERE code = ? AND suspended_at IS NULL',
  )
    .bind(now, code)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

// --- Reads ---------------------------------------------------------------------------------------------------

// The reader has seen every response so far.
export async function markFormSeen(env: Env, code: string, ownerId: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO form_reads (code, owner_id, seen_number)
       SELECT code, ?, responses FROM form_links WHERE code = ?
     ON CONFLICT (code, owner_id) DO UPDATE SET seen_number = excluded.seen_number`,
  )
    .bind(ownerId, code)
    .run();
}

// How many of a link's responses the reader has not seen (the publisher is marked as having seen them all when
// they publish, so a reader with no row is one who has never opened the form since).
export async function unseenResponses(env: Env, code: string, ownerId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT l.responses - COALESCE(r.seen_number, 0) AS n
       FROM form_links l LEFT JOIN form_reads r ON r.code = l.code AND r.owner_id = ?
      WHERE l.code = ?`,
  )
    .bind(ownerId, code)
    .first<{ n: number }>();
  return Math.max(0, Number(row?.n ?? 0));
}

// --- Email throttle ------------------------------------------------------------------------------------------

// Whether to send the new-response email now: yes when none went within `throttleMs` (and the held count resets,
// returned so the email can say "and N more since"); otherwise the response is counted as held.
export async function claimFormEmail(
  env: Env,
  code: string,
  now: number,
  throttleMs: number,
): Promise<{ send: true; heldBefore: number } | { send: false }> {
  const row = await env.DB.prepare(
    'SELECT last_email_at, held_emails FROM form_links WHERE code = ?',
  )
    .bind(code)
    .first<{ last_email_at: number | null; held_emails: number }>();
  if (!row) return { send: false };
  if (row.last_email_at === null || row.last_email_at <= now - throttleMs) {
    // Compare-and-swap on the time read, so two responses at once send one email.
    const res = await env.DB.prepare(
      'UPDATE form_links SET last_email_at = ?, held_emails = 0 WHERE code = ? AND last_email_at IS ?',
    )
      .bind(now, code, row.last_email_at)
      .run();
    if ((res.meta?.changes ?? 0) > 0) return { send: true, heldBefore: row.held_emails };
  }
  await env.DB.prepare('UPDATE form_links SET held_emails = held_emails + 1 WHERE code = ?')
    .bind(code)
    .run();
  return { send: false };
}
