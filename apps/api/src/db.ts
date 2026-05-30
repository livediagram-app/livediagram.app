import type { DiagramDTO, DiagramSummary, Env, ParticipantDTO } from './types';

// Thin D1 wrapper. Every diagram read/write parses or stringifies the
// `data` JSON at this boundary; the rest of the worker deals with
// plain DiagramDTO objects.

type DiagramRow = {
  id: string;
  owner_id: string;
  name: string;
  data: string;
  shareable: number;
  share_code: string | null;
  saved_at: number;
  created_at: number;
};

type SummaryRow = Omit<DiagramRow, 'data'>;

type ParticipantRow = {
  id: string;
  name: string;
  color: string;
  created_at: number;
};

function rowToDiagram(row: DiagramRow): DiagramDTO {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    tabs: JSON.parse(row.data),
    shareable: row.shareable === 1,
    shareCode: row.share_code,
    savedAt: row.saved_at,
    createdAt: row.created_at,
  };
}

function rowToSummary(row: SummaryRow): DiagramSummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    shareable: row.shareable === 1,
    shareCode: row.share_code,
    savedAt: row.saved_at,
    createdAt: row.created_at,
  };
}

const DIAGRAM_COLS = 'id, owner_id, name, data, shareable, share_code, saved_at, created_at';
const DIAGRAM_SUMMARY_COLS = 'id, owner_id, name, shareable, share_code, saved_at, created_at';

export async function getDiagram(env: Env, id: string): Promise<DiagramDTO | null> {
  const row = await env.DB.prepare(`SELECT ${DIAGRAM_COLS} FROM diagrams WHERE id = ?`)
    .bind(id)
    .first<DiagramRow>();
  return row ? rowToDiagram(row) : null;
}

export async function getDiagramByShareCode(env: Env, code: string): Promise<DiagramDTO | null> {
  const row = await env.DB.prepare(
    `SELECT ${DIAGRAM_COLS} FROM diagrams WHERE share_code = ? AND shareable = 1`,
  )
    .bind(code)
    .first<DiagramRow>();
  return row ? rowToDiagram(row) : null;
}

export async function listDiagramsByOwner(env: Env, ownerId: string): Promise<DiagramSummary[]> {
  const result = await env.DB.prepare(
    `SELECT ${DIAGRAM_SUMMARY_COLS} FROM diagrams WHERE owner_id = ? ORDER BY saved_at DESC`,
  )
    .bind(ownerId)
    .all<SummaryRow>();
  return (result.results ?? []).map(rowToSummary);
}

// Full upsert. The frontend always knows the whole diagram and sends the
// full payload on save, so we don't track per-element deltas in the DB.
// The room broadcasts ops separately for live updates.
export async function upsertDiagram(env: Env, d: DiagramDTO): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO diagrams (id, owner_id, name, data, shareable, share_code, saved_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       owner_id = excluded.owner_id,
       name = excluded.name,
       data = excluded.data,
       saved_at = excluded.saved_at`,
  )
    .bind(
      d.id,
      d.ownerId,
      d.name,
      JSON.stringify(d.tabs),
      d.shareable ? 1 : 0,
      d.shareCode,
      d.savedAt,
      d.createdAt,
    )
    .run();
}

export async function setDiagramShare(
  env: Env,
  id: string,
  shareable: boolean,
  shareCode: string | null,
): Promise<void> {
  await env.DB.prepare('UPDATE diagrams SET shareable = ?, share_code = ? WHERE id = ?')
    .bind(shareable ? 1 : 0, shareCode, id)
    .run();
}

export async function deleteDiagram(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM diagrams WHERE id = ?').bind(id).run();
}

export async function getParticipant(env: Env, id: string): Promise<ParticipantDTO | null> {
  const row = await env.DB.prepare(
    'SELECT id, name, color, created_at FROM participants WHERE id = ?',
  )
    .bind(id)
    .first<ParticipantRow>();
  return row ? { id: row.id, name: row.name, color: row.color, createdAt: row.created_at } : null;
}

export async function upsertParticipant(env: Env, p: ParticipantDTO): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO participants (id, name, color, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       color = excluded.color`,
  )
    .bind(p.id, p.name, p.color, p.createdAt)
    .run();
}

// Short, URL-safe alphabet. Avoids visually ambiguous characters
// (0/O/1/I/l) so the share codes are easy to read aloud or transcribe.
const SHARE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateShareCode(length = 8): string {
  let code = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    code += SHARE_ALPHABET[byte % SHARE_ALPHABET.length];
  }
  return code;
}
