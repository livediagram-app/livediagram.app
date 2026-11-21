// A plan's board addresses (docs/specs/026-plan/email-to-board.md "How it is kept"; blueprint email-to-board.md "Data
// and persistence"), in its own SQLite: one row per board with an address, holding its code, Who Can Send, its counts
// and its hour, and each sender's hour by a hash of their address.
import type { EmailIntakeSenders } from '@liveplanner/api-schema';
import type { PlanEnv } from '../types';

// A plan schema step (plan-room/plan-schema.ts), append-only like every other.
export const EMAIL_INTAKES_SCHEMA = `
CREATE TABLE IF NOT EXISTS email_intakes (
  plan_id     TEXT    NOT NULL REFERENCES plan (id) ON DELETE CASCADE,
  board_id    TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  code        TEXT    NOT NULL,
  senders     TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  made        INTEGER NOT NULL DEFAULT 0,
  refused     INTEGER NOT NULL DEFAULT 0,
  dropped     INTEGER NOT NULL DEFAULT 0,
  last_at     INTEGER NULL,
  hour_start  INTEGER NOT NULL DEFAULT 0,
  hour_count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, board_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS email_intakes_code ON email_intakes (code);
CREATE TABLE IF NOT EXISTS email_intake_senders (
  code        TEXT    NOT NULL,
  sender      TEXT    NOT NULL,
  hour_start  INTEGER NOT NULL,
  hour_count  INTEGER NOT NULL,
  PRIMARY KEY (code, sender)
);
`;

// What an address makes (email-to-board.md "What a message makes"): a card type and a status of its own, added after
// the table. Null on an address from before: it makes its board's first card type in its first column, as it did.
export function addIntakeTarget(
  exec: (sql: string) => { toArray: () => Record<string, unknown>[] },
): void {
  const have = new Set(
    exec('PRAGMA table_info(email_intakes)')
      .toArray()
      .map((c) => String(c.name)),
  );
  if (!have.has('type_id')) exec('ALTER TABLE email_intakes ADD COLUMN type_id TEXT NULL');
  if (!have.has('status')) exec('ALTER TABLE email_intakes ADD COLUMN status TEXT NULL');
}

// Cards one address makes an hour, and one sender to one address.
export const INTAKE_CARDS_PER_HOUR = 100;
export const INTAKE_SENDER_PER_HOUR = 20;
const HOUR_MS = 3_600_000;

/** A board's address as the room keeps it. */
export type IntakeRow = {
  boardId: string;
  tabId: string;
  code: string;
  // The card it makes; null for an address from before, which follows its board's first type and column.
  target: { typeId: string; status: string } | null;
  senders: EmailIntakeSenders;
  createdAt: number;
  made: number;
  refused: number;
  dropped: number;
  lastAt: number | null;
};

type Row = {
  board_id: string;
  tab_id: string;
  code: string;
  type_id: string | null;
  status: string | null;
  senders: string;
  created_at: number;
  made: number;
  refused: number;
  dropped: number;
  last_at: number | null;
};

const COLS =
  'board_id, tab_id, code, type_id, status, senders, created_at, made, refused, dropped, last_at';

const fromRow = (r: Row): IntakeRow => ({
  boardId: r.board_id,
  tabId: r.tab_id,
  code: r.code,
  target: r.type_id && r.status ? { typeId: r.type_id, status: r.status } : null,
  senders: r.senders === 'anyone' ? 'anyone' : 'members',
  createdAt: r.created_at,
  made: r.made,
  refused: r.refused,
  dropped: r.dropped,
  lastAt: r.last_at,
});

/** Every address of the plan, oldest first. */
export async function intakesOf(env: PlanEnv, planId: string): Promise<IntakeRow[]> {
  const res = await env.PLAN_DB.prepare(
    `SELECT ${COLS} FROM email_intakes WHERE plan_id = ? ORDER BY created_at, board_id`,
  )
    .bind(planId)
    .all<Row>();
  return (res.results ?? []).map(fromRow);
}

/** The board's address, or null. */
export async function intakeOfBoard(
  env: PlanEnv,
  planId: string,
  boardId: string,
): Promise<IntakeRow | null> {
  const row = await env.PLAN_DB.prepare(
    `SELECT ${COLS} FROM email_intakes WHERE plan_id = ? AND board_id = ?`,
  )
    .bind(planId, boardId)
    .first<Row>();
  return row ? fromRow(row) : null;
}

/** The address a code names on this plan, or null. */
export async function intakeByCode(
  env: PlanEnv,
  planId: string,
  code: string,
): Promise<IntakeRow | null> {
  const row = await env.PLAN_DB.prepare(
    `SELECT ${COLS} FROM email_intakes WHERE plan_id = ? AND code = ?`,
  )
    .bind(planId, code)
    .first<Row>();
  return row ? fromRow(row) : null;
}

/** The board's address turned on with `code`. */
export async function turnOnIntake(
  env: PlanEnv,
  planId: string,
  at: {
    boardId: string;
    tabId: string;
    code: string;
    target: { typeId: string; status: string } | null;
    senders: EmailIntakeSenders;
  },
  now: number,
): Promise<IntakeRow> {
  await env.PLAN_DB.prepare(
    'INSERT INTO email_intakes (plan_id, board_id, tab_id, code, type_id, status, senders, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      planId,
      at.boardId,
      at.tabId,
      at.code,
      at.target?.typeId ?? null,
      at.target?.status ?? null,
      at.senders,
      now,
    )
    .run();
  return { ...at, createdAt: now, made: 0, refused: 0, dropped: 0, lastAt: null };
}

/** Who Can Send and what it makes changed (and the board's tab kept current). */
export async function setIntakeSenders(
  env: PlanEnv,
  planId: string,
  at: { boardId: string; tabId: string; target: { typeId: string; status: string } | null },
  senders: EmailIntakeSenders,
): Promise<void> {
  await env.PLAN_DB.prepare(
    'UPDATE email_intakes SET senders = ?, tab_id = ?, type_id = ?, status = ? WHERE plan_id = ? AND board_id = ?',
  )
    .bind(
      senders,
      at.tabId,
      at.target?.typeId ?? null,
      at.target?.status ?? null,
      planId,
      at.boardId,
    )
    .run();
}

/** The address's code replaced: its counts kept, its hour and its senders' hours started again. */
export async function replaceIntakeCode(
  env: PlanEnv,
  planId: string,
  boardId: string,
  oldCode: string,
  code: string,
): Promise<void> {
  await env.PLAN_DB.prepare(
    'UPDATE email_intakes SET code = ?, hour_start = 0, hour_count = 0 WHERE plan_id = ? AND board_id = ?',
  )
    .bind(code, planId, boardId)
    .run();
  await env.PLAN_DB.prepare('DELETE FROM email_intake_senders WHERE code = ?').bind(oldCode).run();
}

/** The board's address deleted; its code, or null when it had none. */
export async function turnOffIntake(
  env: PlanEnv,
  planId: string,
  boardId: string,
): Promise<string | null> {
  const row = await env.PLAN_DB.prepare(
    'DELETE FROM email_intakes WHERE plan_id = ? AND board_id = ? RETURNING code',
  )
    .bind(planId, boardId)
    .first<{ code: string }>();
  if (!row) return null;
  await env.PLAN_DB.prepare('DELETE FROM email_intake_senders WHERE code = ?').bind(row.code).run();
  return row.code;
}

const COUNTS = {
  made: 'UPDATE email_intakes SET made = made + 1, last_at = ? WHERE code = ?',
  refused: 'UPDATE email_intakes SET refused = refused + 1 WHERE code = ?',
  dropped: 'UPDATE email_intakes SET dropped = dropped + 1 WHERE code = ?',
} as const;

/** One message counted against the address: a card made (with when), or one refused or dropped. */
export async function countIntake(
  env: PlanEnv,
  code: string,
  outcome: keyof typeof COUNTS,
  now: number,
): Promise<void> {
  const statement = env.PLAN_DB.prepare(COUNTS[outcome]);
  await (outcome === 'made' ? statement.bind(now, code) : statement.bind(code)).run();
}

/** One card taken from the address's hour and the sender's, or false when either is full (nothing kept taken). */
export async function takeIntakeHour(
  env: PlanEnv,
  code: string,
  sender: string,
  now: number,
): Promise<boolean> {
  const windowStart = now - HOUR_MS;
  await env.PLAN_DB.prepare('DELETE FROM email_intake_senders WHERE hour_start <= ?')
    .bind(windowStart)
    .run();
  const address = await env.PLAN_DB.prepare(
    `UPDATE email_intakes
        SET hour_count = CASE WHEN hour_start <= ? THEN 1 ELSE hour_count + 1 END,
            hour_start = CASE WHEN hour_start <= ? THEN ? ELSE hour_start END
      WHERE code = ? AND (hour_start <= ? OR hour_count < ?)
      RETURNING hour_count`,
  )
    .bind(windowStart, windowStart, now, code, windowStart, INTAKE_CARDS_PER_HOUR)
    .first<{ hour_count: number }>();
  if (!address) return false;
  const person = await env.PLAN_DB.prepare(
    `INSERT INTO email_intake_senders (code, sender, hour_start, hour_count) VALUES (?, ?, ?, 1)
       ON CONFLICT (code, sender) DO UPDATE SET hour_count = hour_count + 1
       WHERE hour_count < ?
     RETURNING hour_count`,
  )
    .bind(code, sender, now, INTAKE_SENDER_PER_HOUR)
    .first<{ hour_count: number }>();
  if (person) return true;
  await env.PLAN_DB.prepare(
    'UPDATE email_intakes SET hour_count = MAX(hour_count - 1, 0) WHERE code = ?',
  )
    .bind(code)
    .run();
  return false;
}
