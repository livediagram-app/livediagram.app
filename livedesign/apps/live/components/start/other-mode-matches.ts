// Found in other modes (docs/specs/007-editor/start-diagramming.md "Found in other modes"): what a start's search finds
// among the templates of every mode but the tab's own. A template's mode is the mode its tab opens in
// (templateEditorMode), so each template is in exactly one mode and never shows twice; the same search as the mode's own
// (templateMatchesQuery), so the same words find the same templates wherever they are typed. Pure.
import { EDITOR_MODES, type EditorMode } from '@livepages/document';
import {
  TEMPLATES,
  isBlankTemplate,
  popularKindsFor,
  templateEditorMode,
  templateMatchesQuery,
  type TemplateDescriptor,
  type TemplateKind,
} from '@livepages/templates';

// The most cards a mode shows before its Show All: a word matching dozens of one mode's templates never buries the rest.
export const OTHER_MODE_CARDS_MAX = 6;

type OtherModeMatch = { mode: EditorMode; kinds: readonly TemplateKind[] };

// Every listed template of each mode: its Popular picks first (the likeliest match leads), then catalogue order, and
// the blanks last, since a blank found from another mode is only a mode switch, the least a search can offer.
const LISTED_BY_MODE = {} as Record<EditorMode, readonly TemplateDescriptor[]>;
for (const mode of EDITOR_MODES) {
  const listed = TEMPLATES.filter((t) => !t.hidden && templateEditorMode(t.kind) === mode);
  const rank = new Map(popularKindsFor(mode).map((k, i) => [k, i]));
  const weight = (t: TemplateDescriptor) =>
    isBlankTemplate(t.kind) ? Number.MAX_SAFE_INTEGER : (rank.get(t.kind) ?? rank.size);
  LISTED_BY_MODE[mode] = [...listed].sort((a, b) => weight(a) - weight(b));
}

/**
 * Every other mode's templates matching `query`, one entry per mode that matched, in the modes' order. Nothing for an
 * empty query. `mayEnter` leaves out a mode the tab may not switch to (all may, by default).
 */
export function otherModeMatches(
  current: EditorMode,
  query: string,
  mayEnter: (mode: EditorMode) => boolean = () => true,
): OtherModeMatch[] {
  if (query.trim() === '') return [];
  return EDITOR_MODES.filter((mode) => mode !== current && mayEnter(mode))
    .map((mode) => ({
      mode,
      kinds: LISTED_BY_MODE[mode].filter((t) => templateMatchesQuery(t, query)).map((t) => t.kind),
    }))
    .filter((m) => m.kinds.length > 0);
}
