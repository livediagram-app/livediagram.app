import { templateKindOf, type TemplateKind } from '@livehuddle/templates';

// What a /new link asks for (docs/specs/007-editor/new-document-route.md "What a /new link can ask for"). Every /new
// creates at once; the query only says what and where. One reader so the page and its bfcache cleanup agree.

// The template a URL names: `?blank` as the Blank Space, `?template=<kind>` for a catalogue kind, else null. `blank`
// wins over `template`; an unknown or retired kind is ignored rather than guessed.
export function linkedTemplateKind(search: string): TemplateKind | null {
  const params = new URLSearchParams(search);
  if (params.has('blank')) return 'blank-session';
  return templateKindOf(params.get('template'));
}

// The template a /new URL creates: the one it names, else the Blank Space, so a stale link still makes a Space.
export const newSpaceKind = (search: string): TemplateKind =>
  linkedTemplateKind(search) ?? 'blank-session';

// Start Blank (`?blank=1`, `?start=blank`): the new Space opens with its start closed, since whoever asked for a
// blank has already said they want no templates.
const START_BLANK_VALUE = 'blank';

export function startsBlank(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('blank') || params.get('start') === START_BLANK_VALUE;
}

// The start's search preset (`?q=`; docs/specs/007-editor/new-document-route.md): words to open the new document's
// start with. Not a bypass: the author still picks. Empty words are ignored, and so is a `?mode=`: there is one mode.
export const SEARCH_PRESET_MAX = 60;

export function startPresetQuery(search: string): string | null {
  const q = new URLSearchParams(search).get('q')?.trim().slice(0, SEARCH_PRESET_MAX);
  return q ? q : null;
}

// The placement context params (/new?folder=<id>, /new?team=<id>).
const PLACEMENT_PARAMS = ['folder', 'team'] as const;

// Where "Use Default Place" leads after a refused placement (docs/specs/007-editor/new-document-route.md
// "Placement rides the create"): /new without the refused placement and the template, so the next create goes where
// new documents go by default. Every other param is kept.
export function choosePlacementAgainUrl(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of ['template', ...PLACEMENT_PARAMS]) params.delete(key);
  const qs = params.toString();
  return qs ? `/new?${qs}` : '/new';
}

/**
 * The placement context a /new URL carries (docs/specs/013-workspace/team-shared-documents.md): `?folder=<id>`,
 * `?team=<id>` or both file the new document there. A missing param is absent, never the root: neither is no
 * placement, which leaves room for a default folder (docs/specs/013-workspace/default-folders.md "Precedence").
 */
export function placementParamsFromSearch(search: string): { folderId?: string; teamId?: string } {
  const params = new URLSearchParams(search);
  const folderId = params.get('folder') || undefined;
  const teamId = params.get('team') || undefined;
  return { ...(folderId ? { folderId } : {}), ...(teamId ? { teamId } : {}) };
}
