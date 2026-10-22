// Editor modes (docs/specs/007-editor/editor-modes.md): how a general tab is worked on, Diagram,
// Draw, Workshop or Plan. A mode tunes tools and rules; it never decides what the tab is (that is its kind). The
// mode is the tab's, the same for everyone on it (`Tab.opensIn`, Diagram when absent).
import type { Layer } from './layers';
import { isEventStormingTab } from './event-storming';
import { isPlanTabKind } from './tab-kind';

// Every editor mode, in the order the interface lists them (the mode switch, the tab menu's Opens
// in). The one place a mode is declared: a further mode is one entry here.
export const EDITOR_MODE_CATALOGUE = [
  {
    id: 'diagram',
    label: 'Diagram',
    description: 'Flowcharts, architecture and org charts with snapping shapes.',
  },
  {
    id: 'draw',
    label: 'Draw',
    description: 'Sketch freehand with pens, tidied into shapes as you go.',
  },
  {
    id: 'workshop',
    label: 'Workshop',
    description: 'Run a live session: timers, votes, polls and reveals.',
  },
  {
    id: 'plan',
    label: 'Plan',
    description: 'Boards of cards moving through columns, with types and fields.',
  },
] as const satisfies readonly { id: string; label: string; description: string }[];

export type EditorMode = (typeof EDITOR_MODE_CATALOGUE)[number]['id'];

export const EDITOR_MODES: readonly EditorMode[] = EDITOR_MODE_CATALOGUE.map((m) => m.id);

/** "Draw": the mode's name as the interface shows it. */
export function editorModeLabel(mode: EditorMode): string {
  return EDITOR_MODE_CATALOGUE.find((m) => m.id === mode)!.label;
}

/** "Sketch freehand with pens, tidied into shapes as you go.": what the mode is for. */
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

// Plan stands apart (docs/specs/007-editor/editor-modes.md "Plan stands apart"): a tab never switches into Plan from
// another mode, nor out of it; another mode is a new tab in it instead.
export function crossesPlan(from: EditorMode, to: EditorMode): boolean {
  return (from === 'plan') !== (to === 'plan');
}

// The modes a tab in `mode` may switch between, in order: Plan alone, or every mode but Plan.
export function modesBesidePlanRule(mode: EditorMode): EditorMode[] {
  return EDITOR_MODES.filter((m) => !crossesPlan(mode, m));
}

export function isEditorMode(v: unknown): v is EditorMode {
  return EDITOR_MODES.includes(v as EditorMode);
}

// Workshop mode was Facilitate mode, stored under its old id wherever a mode is kept (a tab's opensIn,
// a remembered mode, a placement-default key, a `/new?mode=` link, an `opens-in:` filter). Pages mode
// (once Illustrate, and Infographic before that) moved out to livedocuments: a mode stored as any of
// them reads as Diagram, so a former Pages tab opens with its ordinary elements on the canvas.
const LEGACY_EDITOR_MODES: Readonly<Record<string, EditorMode>> = {
  pages: 'diagram',
  illustrate: 'diagram',
  infographic: 'diagram',
  facilitate: 'workshop',
};

/** A stored mode as today's id: a current id as it is, a legacy one renamed, anything else
 *  undefined. Read every stored mode through this. */
export function parseEditorMode(v: unknown): EditorMode | undefined {
  if (isEditorMode(v)) return v;
  return typeof v === 'string' ? LEGACY_EDITOR_MODES[v] : undefined;
}

type ModeTab = { kind?: string; opensIn?: string; layers?: Layer[] };

// An event-storming board keeps its own tools and notation, so it is worked on in Diagram mode and
// offers no switch, whatever a forged or stale `opensIn` says; a Board, Sheet or Dashboard tab is always in Plan
// (docs/specs/026-plan/plan-tabs.md).
export function editorModeSwitchable(tab: ModeTab | undefined): boolean {
  return !isEventStormingTab(tab) && !isPlanTabKind(tab?.kind);
}

/** The tab's editor mode, the same for everyone on it (docs/specs/007-editor/editor-modes.md "Where
 *  the mode lives"): its stored mode, Diagram when absent or unreadable, always Diagram on an
 *  event-storming board. */
export function opensInOf(tab: ModeTab | undefined): EditorMode {
  if (isPlanTabKind(tab?.kind)) return 'plan';
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

// Plan mode works Plan boards as a planning tool (docs/specs/026-plan/plan-mode.md): pressing a card
// picks the card up, not the board. A rule about input, so it follows the person's mode.
export function hasPlanInput(mode: EditorMode): boolean {
  return mode === 'plan';
}
