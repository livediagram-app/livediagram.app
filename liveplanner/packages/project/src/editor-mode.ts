// The editor mode (docs/specs/026-plan/plan-mode.md): every tab is worked on in Plan. The mode is still named wherever
// it is stored or sent (a project's recorded intent, its tab stats, a `mode:` default-folder key, an `opens-in:`
// filter), so it is declared here once.

export const EDITOR_MODE_CATALOGUE = [
  {
    id: 'plan',
    label: 'Plan',
    description: 'Boards of cards moving through columns, with types and fields.',
  },
] as const satisfies readonly { id: string; label: string; description: string }[];

export type EditorMode = (typeof EDITOR_MODE_CATALOGUE)[number]['id'];

export const EDITOR_MODES: readonly EditorMode[] = EDITOR_MODE_CATALOGUE.map((m) => m.id);

export function isEditorMode(v: unknown): v is EditorMode {
  return EDITOR_MODES.includes(v as EditorMode);
}

/** A stored mode as a mode id, or undefined for anything that is not one. Read every stored mode through this. */
export function parseEditorMode(v: unknown): EditorMode | undefined {
  return isEditorMode(v) ? v : undefined;
}
