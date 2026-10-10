// Editor modes (docs/specs/007-editor/editor-modes.md): how a general tab is worked on, Diagram,
// Draw, Illustrate, Plan or Facilitate. A mode tunes tools and rules; it never decides what the tab is (that is its kind). The
// mode is the tab's, the same for everyone on it (`Tab.opensIn`, Diagram when absent).
import type { Layer } from './layers';
import { isEventStormingTab } from './event-storming';

// Every editor mode, in the order the interface lists them (the mode switch, the tab menu's Opens
// in). The one place a mode is declared: a further mode is one entry here.
export const EDITOR_MODE_CATALOGUE = [
  { id: 'diagram', label: 'Diagram', description: 'Shapes, arrows, the palette and snapping.' },
  { id: 'draw', label: 'Draw', description: 'Pens, the eraser and shape recognition.' },
  {
    id: 'illustrate',
    label: 'Illustrate',
    description: 'Pages: infographics to lay out, and articles to write.',
  },
  {
    id: 'plan',
    label: 'Plan',
    description: 'Boards of items: columns, cards and the work moving through them.',
  },
  {
    id: 'facilitate',
    label: 'Facilitate',
    description: 'Run a session with your team: timers, votes, polls and reveals.',
  },
] as const satisfies readonly { id: string; label: string; description: string }[];

export type EditorMode = (typeof EDITOR_MODE_CATALOGUE)[number]['id'];

export const EDITOR_MODES: readonly EditorMode[] = EDITOR_MODE_CATALOGUE.map((m) => m.id);

/** "Draw": the mode's name as the interface shows it. */
export function editorModeLabel(mode: EditorMode): string {
  return EDITOR_MODE_CATALOGUE.find((m) => m.id === mode)!.label;
}

/** "Pens, the eraser and shape recognition.": what the mode brings into focus. */
export function editorModeDescription(mode: EditorMode): string {
  return EDITOR_MODE_CATALOGUE.find((m) => m.id === mode)!.description;
}

export const DEFAULT_EDITOR_MODE: EditorMode = 'diagram';

/** The mode `step` places along `modes` (the catalogue unless narrowed) from `mode`, wrapping at
 *  either end. A mode not in `modes` steps as if just before the first. */
export function nextEditorMode(
  mode: EditorMode,
  step: 1 | -1 = 1,
  modes: readonly EditorMode[] = EDITOR_MODES,
): EditorMode {
  const count = modes.length;
  return modes[(modes.indexOf(mode) + step + count) % count]!;
}

export function isEditorMode(v: unknown): v is EditorMode {
  return EDITOR_MODES.includes(v as EditorMode);
}

// Illustrate mode was called Infographic mode, and stored as `infographic` wherever a mode is kept
// (a tab's opensIn, a remembered mode, a placement-default key).
const LEGACY_EDITOR_MODES: Readonly<Record<string, EditorMode>> = { infographic: 'illustrate' };

/** A stored mode as today's id: a current id as it is, a legacy one renamed, anything else
 *  undefined. Read every stored mode through this. */
export function parseEditorMode(v: unknown): EditorMode | undefined {
  if (isEditorMode(v)) return v;
  return typeof v === 'string' ? LEGACY_EDITOR_MODES[v] : undefined;
}

type ModeTab = { kind?: string; opensIn?: string; layers?: Layer[] };

// An event-storming board keeps its own tools and notation, so it is worked on in Diagram mode and
// offers no switch, whatever a forged or stale `opensIn` says.
export function editorModeSwitchable(tab: ModeTab | undefined): boolean {
  return !isEventStormingTab(tab);
}

/** The tab's editor mode, the same for everyone on it (docs/specs/007-editor/editor-modes.md "Where
 *  the mode lives"): its stored mode, Diagram when absent or unreadable, always Diagram on an
 *  event-storming board. */
export function opensInOf(tab: ModeTab | undefined): EditorMode {
  if (!editorModeSwitchable(tab)) return DEFAULT_EDITOR_MODE;
  return parseEditorMode(tab?.opensIn) ?? DEFAULT_EDITOR_MODE;
}

// The tab's mode set (docs/specs/007-editor/editor-modes.md "Where the mode lives"): the mode only.
// The same tab when nothing changes; an event-storming board is always Diagram and is never given
// a mode. A switch also brings what the mode brings: withEditorModeSwitched (editor-mode-switch.ts).
export function setTabOpensIn<T extends ModeTab & { id: string }>(tab: T, mode: EditorMode): T {
  if (!editorModeSwitchable(tab) || opensInOf(tab) === mode) return tab;
  return { ...tab, opensIn: mode };
}

// The one gate the look reads, keyed on the viewer's effective editor mode: in Draw mode the
// canvas pattern is the person's own (resolveViewBackdrop); everything else looks the same in both.
export function hasBoardLook(mode: EditorMode): boolean {
  return mode === 'draw';
}

// Illustrate mode draws the canvas as pages on a surround (docs/specs/007-editor/editor-modes.md
// "The pages"); a view of the tab, like the board look, never stored.
export function hasPageLook(mode: EditorMode): boolean {
  return mode === 'illustrate';
}

// Plan mode works Plan boards as a planning tool (docs/specs/026-plan/plan-mode.md): pressing a card
// picks the card up, not the board. A rule about input, so it follows the person's mode.
export function hasPlanInput(mode: EditorMode): boolean {
  return mode === 'plan';
}
