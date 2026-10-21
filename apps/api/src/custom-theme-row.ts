import type { CustomThemeDTO, CustomThemeDefinition } from './types';

// custom_themes row shape as read from D1 (migration 0026). The
// `definition` column is a JSON string (the themable payload); every
// read parses it here so the rest of the worker handles a structured
// `CustomThemeDefinition`, not raw text. Pulled into its own module
// (like folder-row.ts / tab-row.ts) so the snake_case -> camelCase +
// JSON-parse mapping has its own test surface.

export type CustomThemeRow = {
  id: string;
  owner_id: string;
  name: string;
  definition: string;
  created_at: number;
  updated_at: number;
};

// A definition that fails to parse (corrupt row) collapses to a minimal
// safe theme rather than throwing the whole list endpoint — one bad row
// shouldn't 500 the picker. The editor's getTheme fallback then renders
// it as the default if it somehow reaches a tab.
function parseDefinition(json: string): CustomThemeDefinition {
  try {
    return JSON.parse(json) as CustomThemeDefinition;
  } catch {
    return {
      backgroundColor: '#ffffff',
      backgroundPattern: 'grid',
      patternColor: '#cbd5e1',
      elementFill: null,
      elementStroke: null,
      elementText: null,
    };
  }
}

export function rowToCustomTheme(row: CustomThemeRow): CustomThemeDTO {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    definition: parseDefinition(row.definition),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
