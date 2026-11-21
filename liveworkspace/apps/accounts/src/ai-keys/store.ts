// The `ai_key` rows (liveworkspace/docs/specs/003-accounts/ai-keys.md; migrations/0025_ai_keys.sql): one per owner, a
// person's or a team's. Reads never answer `sealed` to anything but the internal door and the reseal sweep, which
// open it; every other reader takes the row without it (`AiKeyState`).
import type { KeyProviderId } from '@liveworkspace/ai';
import { MAX_TEAMS_PER_ACCOUNT } from '../teams/shared.ts';
import {
  openAiKey,
  sealAiKey,
  AiKeySealError,
  type AiKeyOwner,
  type AiKeySecrets,
} from './seal.ts';

export type AiKeyOwnerKind = 'account' | 'team';

export type AiKeyRow = {
  ownerKind: AiKeyOwnerKind;
  ownerId: string;
  provider: KeyProviderId;
  model: string;
  sealed: string;
  keyVersion: number;
  hint: string;
  setBy: string;
  setAt: number;
};

/** A key as Settings may know it: never the key, never the sealed form. */
export type AiKeyState = { provider: KeyProviderId; model: string; hint: string; setAt: number };

export const ownerOf = (row: Pick<AiKeyRow, 'ownerKind' | 'ownerId'>): AiKeyOwner =>
  `${row.ownerKind}:${row.ownerId}` as AiKeyOwner;

export const stateOf = (row: AiKeyRow): AiKeyState => ({
  provider: row.provider,
  model: row.model,
  hint: row.hint,
  setAt: row.setAt,
});

// The row's columns as AiKeyRow names them, from the table aliased `k`.
const COLUMNS = `k.owner_kind AS ownerKind, k.owner_id AS ownerId, k.provider AS provider, k.model AS model,
  k.sealed AS sealed, k.key_version AS keyVersion, k.hint AS hint, k.set_by AS setBy, k.set_at AS setAt`;

export function readAiKey(
  db: D1Database,
  kind: AiKeyOwnerKind,
  id: string,
): Promise<AiKeyRow | null> {
  return db
    .prepare(`SELECT ${COLUMNS} FROM ai_key k WHERE k.owner_kind = ? AND k.owner_id = ?`)
    .bind(kind, id)
    .first<AiKeyRow>();
}

export type TeamAiKey = {
  id: string;
  name: string;
  role: 'admin' | 'member';
  key: AiKeyRow | null;
};

/** Each team the person has joined (at most MAX_TEAMS_PER_ACCOUNT), with its key row if it has one: one query. */
export async function readTeamAiKeys(db: D1Database, userId: string): Promise<TeamAiKey[]> {
  const { results } = await db
    .prepare(
      `SELECT t.id AS teamId, t.name AS teamName, m.role AS role, ${COLUMNS}
       FROM team_member m JOIN team t ON t.id = m.teamId
       LEFT JOIN ai_key k ON k.owner_kind = 'team' AND k.owner_id = t.id
       WHERE m.userId = ? AND m.status = 'joined' AND t.deletedAt IS NULL
       ORDER BY t.name COLLATE NOCASE, t.id LIMIT ?`,
    )
    .bind(userId, MAX_TEAMS_PER_ACCOUNT)
    .all<AiKeyRow & { teamId: string; teamName: string; role: 'admin' | 'member' }>();
  return (results ?? []).map(({ teamId, teamName, role, ...key }) => ({
    id: teamId,
    name: teamName,
    role,
    key: key.ownerKind ? (key as AiKeyRow) : null,
  }));
}

/** The keys that may answer for `userId` now: their own, and the team's if they are a joined member of that
 *  undeleted team. One query; membership is read here, never from a token's claim. */
export async function readApplyingKeys(
  db: D1Database,
  userId: string,
  teamId: string | null,
): Promise<{ team: AiKeyRow | null; account: AiKeyRow | null }> {
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNS} FROM ai_key k WHERE k.owner_kind = 'account' AND k.owner_id = ?1
       UNION ALL
       SELECT ${COLUMNS}
         FROM ai_key k JOIN team t ON t.id = k.owner_id
         JOIN team_member m ON m.teamId = t.id AND m.userId = ?1 AND m.status = 'joined'
       WHERE k.owner_kind = 'team' AND k.owner_id = ?2 AND t.deletedAt IS NULL`,
    )
    .bind(userId, teamId ?? '')
    .all<AiKeyRow>();
  const rows = results ?? [];
  return {
    team: rows.find((r) => r.ownerKind === 'team') ?? null,
    account: rows.find((r) => r.ownerKind === 'account') ?? null,
  };
}

/** The statement that saves a key, replacing whatever the owner had. */
export function saveAiKeyStatement(db: D1Database, row: AiKeyRow): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO ai_key (owner_kind, owner_id, provider, model, sealed, key_version, hint, set_by, set_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (owner_kind, owner_id) DO UPDATE SET provider = excluded.provider, model = excluded.model,
         sealed = excluded.sealed, key_version = excluded.key_version, hint = excluded.hint,
         set_by = excluded.set_by, set_at = excluded.set_at`,
    )
    .bind(
      row.ownerKind,
      row.ownerId,
      row.provider,
      row.model,
      row.sealed,
      row.keyVersion,
      row.hint,
      row.setBy,
      row.setAt,
    );
}

export const setAiModelStatement = (
  db: D1Database,
  kind: AiKeyOwnerKind,
  id: string,
  model: string,
): D1PreparedStatement =>
  db
    .prepare('UPDATE ai_key SET model = ? WHERE owner_kind = ? AND owner_id = ?')
    .bind(model, kind, id);

export const deleteAiKeyStatement = (
  db: D1Database,
  kind: AiKeyOwnerKind,
  id: string,
): D1PreparedStatement =>
  db.prepare('DELETE FROM ai_key WHERE owner_kind = ? AND owner_id = ?').bind(kind, id);

/** A team's key goes in the batch that deletes the team (teams/manage.ts deleteTeamRows). */
export const deleteTeamAiKeyStatement = (db: D1Database, teamId: string): D1PreparedStatement =>
  deleteAiKeyStatement(db, 'team', teamId);

/** An account's own key, when the account closes (delete-account.ts). */
export async function deleteAccountAiKey(db: D1Database, userId: string): Promise<void> {
  await deleteAiKeyStatement(db, 'account', userId).run();
}

/** Rows re-sealed a cron run, at most. */
export const RESEAL_BATCH = 50;

export type ResealResult = { resealed: number; unreadable: number; left: number };

/** A rotation's second half (ai-keys.md "Rotating the master secret"): rows sealed under an older version, opened
 *  and sealed again under the current secret, `RESEAL_BATCH` a run, oldest first. A row replaced meanwhile is left
 *  as it is; one that opens under neither secret is counted and left. Runs only while a previous secret is set. */
export async function resealAiKeys(
  db: D1Database,
  secrets: AiKeySecrets,
  batch = RESEAL_BATCH,
): Promise<ResealResult> {
  const result: ResealResult = { resealed: 0, unreadable: 0, left: 0 };
  if (!secrets.previous) return result;
  const version = secrets.current.version;
  const { results } = await db
    .prepare(`SELECT ${COLUMNS} FROM ai_key k WHERE k.key_version != ? ORDER BY k.set_at LIMIT ?`)
    .bind(version, batch)
    .all<AiKeyRow>();
  for (const row of results ?? []) {
    let apiKey: string;
    try {
      apiKey = await openAiKey(secrets, ownerOf(row), row.provider, row.sealed);
    } catch (error) {
      if (!(error instanceof AiKeySealError)) throw error;
      result.unreadable++;
      continue;
    }
    const next = await sealAiKey(secrets, ownerOf(row), row.provider, apiKey);
    const written = await db
      .prepare(
        `UPDATE ai_key SET sealed = ?, key_version = ? WHERE owner_kind = ? AND owner_id = ? AND sealed = ?`,
      )
      .bind(next.sealed, next.version, row.ownerKind, row.ownerId, row.sealed)
      .run();
    if (written.meta.changes > 0) result.resealed++;
  }
  const left = await db
    .prepare('SELECT COUNT(*) AS n FROM ai_key WHERE key_version != ?')
    .bind(version)
    .first<{ n: number }>();
  result.left = left?.n ?? 0;
  return result;
}
