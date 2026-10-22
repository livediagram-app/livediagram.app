// Editor modes (docs/specs/007-editor/pages-mode.md "One mode"): livepages has one, Pages, which draws every tab as pages
// on a surround. The mode stays a named value so stored modes from livediagram (a tab's opensIn, a `/new?mode=`
// link, an `opens-in:` filter) read through one place.

// The one mode, as the interface names it.
export const EDITOR_MODE_CATALOGUE = [
  {
    id: 'pages',
    label: 'Pages',
    description: 'Lay out slides, infographics, articles and logos on pages.',
  },
] as const satisfies readonly { id: string; label: string; description: string }[];

export type EditorMode = (typeof EDITOR_MODE_CATALOGUE)[number]['id'];

export const EDITOR_MODES: readonly EditorMode[] = EDITOR_MODE_CATALOGUE.map((m) => m.id);

/** "Pages": the mode's name as the interface shows it. */
export function editorModeLabel(mode: EditorMode): string {
  return EDITOR_MODE_CATALOGUE.find((m) => m.id === mode)!.label;
}

/** What the mode is for. */
export function editorModeDescription(mode: EditorMode): string {
  return EDITOR_MODE_CATALOGUE.find((m) => m.id === mode)!.description;
}

export const DEFAULT_EDITOR_MODE: EditorMode = 'pages';

export function isEditorMode(v: unknown): v is EditorMode {
  return EDITOR_MODES.includes(v as EditorMode);
}

// livediagram's other modes, and the names Pages had before (Illustrate, Infographic), all read as Pages.
const LEGACY_EDITOR_MODES: ReadonlySet<string> = new Set([
  'diagram',
  'draw',
  'workshop',
  'facilitate',
  'plan',
  'illustrate',
  'infographic',
]);

/** A stored mode as today's id: Pages for Pages or any mode livediagram had, anything else undefined. Read every
 *  stored mode through this. */
export function parseEditorMode(v: unknown): EditorMode | undefined {
  if (isEditorMode(v)) return v;
  return typeof v === 'string' && LEGACY_EDITOR_MODES.has(v) ? DEFAULT_EDITOR_MODE : undefined;
}

/** The tab's editor mode: always Pages. */
export function opensInOf(_tab: { opensIn?: string } | undefined): EditorMode {
  return DEFAULT_EDITOR_MODE;
}
