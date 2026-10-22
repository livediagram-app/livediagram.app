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

/** "Plan": the mode's name as the interface shows it. */
export function editorModeLabel(mode: EditorMode): string {
  return EDITOR_MODE_CATALOGUE.find((m) => m.id === mode)!.label;
}

export function isEditorMode(v: unknown): v is EditorMode {
  return EDITOR_MODES.includes(v as EditorMode);
}

// The modes there used to be, under every id each was stored by (a tab's `opensIn`, a recorded intent, a
// placement-default key, a `/new?mode=` link, an `opens-in:` filter): each reads as Plan now.
const RETIRED_EDITOR_MODES: readonly string[] = [
  'diagram',
  'draw',
  'workshop',
  'pages',
  'illustrate',
  'infographic',
  'facilitate',
];

/** A stored mode as today's id: Plan for a current or retired id, anything else undefined. Read every stored mode
 *  through this. */
export function parseEditorMode(v: unknown): EditorMode | undefined {
  if (isEditorMode(v)) return v;
  return typeof v === 'string' && RETIRED_EDITOR_MODES.includes(v) ? 'plan' : undefined;
}
