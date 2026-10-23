// Editor modes (docs/specs/007-editor/pages-mode.md "One mode"): livedocuments has one, Pages, which draws every tab as
// pages on a surround.

// The one mode, as the interface names it.
export const EDITOR_MODE_CATALOGUE = [
  {
    id: 'pages',
    label: 'Pages',
    description: 'Lay out slides, infographics and articles on pages.',
  },
] as const satisfies readonly { id: string; label: string; description: string }[];

export type EditorMode = (typeof EDITOR_MODE_CATALOGUE)[number]['id'];

export const EDITOR_MODES: readonly EditorMode[] = EDITOR_MODE_CATALOGUE.map((m) => m.id);

/** "Pages": the mode's name as the interface shows it. */
export function editorModeLabel(mode: EditorMode): string {
  return EDITOR_MODE_CATALOGUE.find((m) => m.id === mode)!.label;
}

export const DEFAULT_EDITOR_MODE: EditorMode = 'pages';

export function isEditorMode(v: unknown): v is EditorMode {
  return EDITOR_MODES.includes(v as EditorMode);
}
