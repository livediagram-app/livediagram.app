import type { ApiTokenDTO } from './types';

// api_tokens row as read from D1 (migration 0027). Pulled into its own module
// (like custom-theme-row.ts / folder-row.ts) so the snake_case -> camelCase
// mapping has its own test surface.
export type ApiTokenRow = {
  id: string;
  owner_id: string;
  token_hash: string;
  name: string | null;
  created_at: number;
  last_used_at: number | null;
  expires_at: number;
  revoked: number;
  // 1 = the token may only read (GET/HEAD); the api rejects its writes.
  read_only: number;
};

// Row -> DTO for the management list. NEVER exposes `token_hash` (and the
// plaintext is never stored) — only the public id + metadata the owner sees.
export function rowToApiToken(row: ApiTokenRow): ApiTokenDTO {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    readOnly: row.read_only === 1,
  };
}
