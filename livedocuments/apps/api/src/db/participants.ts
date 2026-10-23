// participants — display name + colour per owner id.

import type { Env, ParticipantDTO } from '../types';

type ParticipantRow = {
  id: string;
  name: string;
  color: string;
  created_at: number;
};

export async function getParticipant(env: Env, id: string): Promise<ParticipantDTO | null> {
  const row = await env.DB.prepare(
    'SELECT id, name, color, created_at FROM participants WHERE id = ?',
  )
    .bind(id)
    .first<ParticipantRow>();
  return row
    ? {
        id: row.id,
        name: row.name,
        color: row.color,
        createdAt: row.created_at,
      }
    : null;
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
