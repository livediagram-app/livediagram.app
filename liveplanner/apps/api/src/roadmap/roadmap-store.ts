// The plan's public roadmaps (docs/specs/026-plan/public-roadmap.md; blueprint public-roadmap.md "Data and
// persistence"), in its own SQLite: one row per published board, holding its code, its settings and the vote cap's
// hour. No person is kept: votes live on the cards. Unpublish deletes the row, so its code answers nothing at once,
// and publishing again makes a new one.
import type { RoadmapSettings } from '@liveplanner/api-schema';
import type { PlanEnv } from '../types';
import { newRoadmapCode } from './roadmap-code';

// A plan schema step (plan-room/plan-schema.ts), append-only like every other.
export const ROADMAPS_SCHEMA = `
CREATE TABLE IF NOT EXISTS roadmaps (
  plan_id     TEXT    NOT NULL REFERENCES plan (id) ON DELETE CASCADE,
  board_id    TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  code        TEXT    NOT NULL,
  settings    TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  hour_start  INTEGER NOT NULL DEFAULT 0,
  hour_count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, board_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS roadmaps_code ON roadmaps (code);
`;

// The vote cap's window.
const HOUR_MS = 3_600_000;

/** A published roadmap as the room keeps it. */
export type RoadmapRow = {
  boardId: string;
  tabId: string;
  code: string;
  settings: RoadmapSettings;
  createdAt: number;
};

type Row = { board_id: string; tab_id: string; code: string; settings: string; created_at: number };

const COLS = 'board_id, tab_id, code, settings, created_at';

const fromRow = (r: Row): RoadmapRow => ({
  boardId: r.board_id,
  tabId: r.tab_id,
  code: r.code,
  settings: JSON.parse(r.settings) as RoadmapSettings,
  createdAt: r.created_at,
});

/** The board published with a fresh code. */
export async function publishRoadmap(
  env: PlanEnv,
  planId: string,
  at: { boardId: string; tabId: string },
  settings: RoadmapSettings,
  now: number,
): Promise<RoadmapRow> {
  const code = newRoadmapCode();
  await env.PLAN_DB.prepare(
    `INSERT INTO roadmaps (plan_id, board_id, tab_id, code, settings, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(planId, at.boardId, at.tabId, code, JSON.stringify(settings), now)
    .run();
  return { ...at, code, settings, createdAt: now };
}

/** A published roadmap's settings changed, its code kept; whether it was published. */
export async function setRoadmapSettings(
  env: PlanEnv,
  planId: string,
  at: { boardId: string; tabId: string },
  settings: RoadmapSettings,
): Promise<boolean> {
  const result = await env.PLAN_DB.prepare(
    'UPDATE roadmaps SET settings = ?, tab_id = ? WHERE plan_id = ? AND board_id = ?',
  )
    .bind(JSON.stringify(settings), at.tabId, planId, at.boardId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** The board's roadmap taken down; whether it was published. */
export async function unpublishRoadmap(
  env: PlanEnv,
  planId: string,
  boardId: string,
): Promise<boolean> {
  const result = await env.PLAN_DB.prepare(
    'DELETE FROM roadmaps WHERE plan_id = ? AND board_id = ?',
  )
    .bind(planId, boardId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** Every published roadmap of the plan, oldest first. */
export async function roadmapsOf(env: PlanEnv, planId: string): Promise<RoadmapRow[]> {
  const res = await env.PLAN_DB.prepare(
    `SELECT ${COLS} FROM roadmaps WHERE plan_id = ? ORDER BY created_at, board_id`,
  )
    .bind(planId)
    .all<Row>();
  return (res.results ?? []).map(fromRow);
}

/** The roadmap a code names on this plan, or null. */
export async function roadmapByCode(
  env: PlanEnv,
  planId: string,
  code: string,
): Promise<RoadmapRow | null> {
  const row = await env.PLAN_DB.prepare(
    `SELECT ${COLS} FROM roadmaps WHERE plan_id = ? AND code = ?`,
  )
    .bind(planId, code)
    .first<Row>();
  return row ? fromRow(row) : null;
}

/** One vote counted against the roadmap's hour, or false when the hour's cap is reached. */
export async function takeRoadmapVote(
  env: PlanEnv,
  code: string,
  now: number,
  hourlyCap: number,
): Promise<boolean> {
  const windowStart = now - HOUR_MS;
  const row = await env.PLAN_DB.prepare(
    `UPDATE roadmaps
        SET hour_count = CASE WHEN hour_start <= ? THEN 1 ELSE hour_count + 1 END,
            hour_start = CASE WHEN hour_start <= ? THEN ? ELSE hour_start END
      WHERE code = ? AND (hour_start <= ? OR hour_count < ?)
      RETURNING hour_count`,
  )
    .bind(windowStart, windowStart, now, code, windowStart, hourlyCap)
    .first<{ hour_count: number }>();
  return !!row;
}

/** A counted vote given back when it changed nothing (a full card). */
export async function giveBackRoadmapVote(env: PlanEnv, code: string): Promise<void> {
  await env.PLAN_DB.prepare(
    'UPDATE roadmaps SET hour_count = MAX(hour_count - 1, 0) WHERE code = ?',
  )
    .bind(code)
    .run();
}
