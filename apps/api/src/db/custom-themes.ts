// custom_themes — user-built themes, owner-scoped (docs/specs/011-theme/custom-themes.md). Mirrors
// the folders resource: flat owner-keyed rows, newest-first list, plus
// a JSON `definition` column the row mapper parses.

import { rowToCustomTheme, type CustomThemeRow } from '../custom-theme-row';
import type { CustomThemeDTO, CustomThemeDefinition, Env } from '../types';

const COLS = 'id, owner_id, name, definition, created_at, updated_at';

export async function listCustomThemesByOwner(
  env: Env,
  ownerId: string,
): Promise<CustomThemeDTO[]> {
  const result = await env.DB.prepare(
    `SELECT ${COLS} FROM custom_themes WHERE owner_id = ? ORDER BY created_at DESC`,
  )
    .bind(ownerId)
    .all<CustomThemeRow>();
  return (result.results ?? []).map(rowToCustomTheme);
}

export async function getCustomTheme(env: Env, id: string): Promise<CustomThemeDTO | null> {
  const row = await env.DB.prepare(`SELECT ${COLS} FROM custom_themes WHERE id = ?`)
    .bind(id)
    .first<CustomThemeRow>();
  return row ? rowToCustomTheme(row) : null;
}

export async function createCustomTheme(
  env: Env,
  t: { id: string; ownerId: string; name: string; definition: CustomThemeDefinition },
): Promise<CustomThemeDTO> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO custom_themes (id, owner_id, name, definition, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(t.id, t.ownerId, t.name, JSON.stringify(t.definition), now, now)
    .run();
  return {
    id: t.id,
    ownerId: t.ownerId,
    name: t.name,
    definition: t.definition,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateCustomTheme(
  env: Env,
  id: string,
  patch: { name?: string; definition?: CustomThemeDefinition },
): Promise<void> {
  const now = Date.now();
  // Partial UPDATE so an absent field is left alone (same "undefined =
  // leave" semantic as updateFolder). name + definition can change
  // independently, so they're separate statements.
  if (patch.name !== undefined) {
    await env.DB.prepare('UPDATE custom_themes SET name = ?, updated_at = ? WHERE id = ?')
      .bind(patch.name, now, id)
      .run();
  }
  if (patch.definition !== undefined) {
    await env.DB.prepare('UPDATE custom_themes SET definition = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(patch.definition), now, id)
      .run();
  }
}

export async function deleteCustomTheme(env: Env, id: string): Promise<void> {
  // Diagrams that reference this theme id keep rendering: the editor's
  // getTheme falls back to the default when an id no longer resolves
  // (docs/specs/011-theme/custom-themes.md), so there's nothing to cascade here.
  await env.DB.prepare('DELETE FROM custom_themes WHERE id = ?').bind(id).run();
}
