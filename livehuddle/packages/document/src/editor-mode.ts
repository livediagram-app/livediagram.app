// The editor mode (docs/specs/007-editor/editor-modes.md): livehuddle has one, the meeting board, stored as
// 'workshop'. Every tab is a meeting board and there is no switch; the type stays so a stored mode, an api field and
// a template's mode still have a name, and every stored mode (Diagram, Draw, or an older id) reads as it. The
// interface never says "Workshop" (docs/specs/003-system-architecture/domain-language.md).

// The one editor mode, as the interface names it.
export const EDITOR_MODE_CATALOGUE = [
  {
    id: 'workshop',
    label: 'Meeting Board',
    description: 'Hold a meeting on one board: a timer, reactions and comments.',
  },
] as const satisfies readonly { id: string; label: string; description: string }[];

export type EditorMode = (typeof EDITOR_MODE_CATALOGUE)[number]['id'];

export const EDITOR_MODES: readonly EditorMode[] = EDITOR_MODE_CATALOGUE.map((m) => m.id);

export const DEFAULT_EDITOR_MODE: EditorMode = 'workshop';

/** "Meeting Board": the mode's name as the interface shows it, never "Workshop". */
export function editorModeLabel(mode: EditorMode): string {
  return EDITOR_MODE_CATALOGUE.find((m) => m.id === mode)!.label;
}

export function isEditorMode(v: unknown): v is EditorMode {
  return EDITOR_MODES.includes(v as EditorMode);
}

// The modes livediagram has (Diagram, Draw) and the older ids stored before them (Workshop was Facilitate; Pages,
// Illustrate, Infographic and Plan moved to other products): a document made in livediagram, or imported from it,
// carries them, and each reads as the meeting board.
const LEGACY_EDITOR_MODES: ReadonlySet<string> = new Set([
  'diagram',
  'draw',
  'pages',
  'plan',
  'illustrate',
  'infographic',
  'facilitate',
]);

/** A stored mode as today's id: 'workshop' for itself or any known older id, anything else undefined. Read every
 *  stored mode through this. */
export function parseEditorMode(v: unknown): EditorMode | undefined {
  if (isEditorMode(v)) return v;
  return typeof v === 'string' && LEGACY_EDITOR_MODES.has(v) ? DEFAULT_EDITOR_MODE : undefined;
}

/** The tab's editor mode, the same for everyone on it: always the meeting board, whatever it stored. */
export function opensInOf(_tab?: unknown): EditorMode {
  return DEFAULT_EDITOR_MODE;
}
