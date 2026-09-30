// participants — display name + colour per owner id, plus the published profile picture
// (docs/specs/014-identity/profile-picture.md §6).

import type { Env, ParticipantDTO } from '../types';

type ParticipantRow = {
  id: string;
  name: string;
  color: string;
  created_at: number;
  picture_url: string | null;
};

export async function getParticipant(env: Env, id: string): Promise<ParticipantDTO | null> {
  const row = await env.DB.prepare(
    'SELECT id, name, color, created_at, picture_url FROM participants WHERE id = ?',
  )
    .bind(id)
    .first<ParticipantRow>();
  return row
    ? {
        id: row.id,
        name: row.name,
        color: row.color,
        createdAt: row.created_at,
        pictureUrl: row.picture_url ?? null,
      }
    : null;
}

// Name + colour only: the picture has its own writer below, so a name save never touches it.
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

// Set or clear the published picture. False when there is no participant row to write to.
export async function setParticipantPicture(
  env: Env,
  id: string,
  pictureUrl: string | null,
): Promise<boolean> {
  const res = await env.DB.prepare('UPDATE participants SET picture_url = ? WHERE id = ?')
    .bind(pictureUrl, id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}
