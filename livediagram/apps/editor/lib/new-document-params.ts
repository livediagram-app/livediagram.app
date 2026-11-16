import { parseEditorMode, type EditorMode } from '@livediagram/document';
import { BLANK_TEMPLATE_FOR_MODE, templateKindOf, type TemplateKind } from '@livediagram/templates';

// The /new links that name a template (docs/specs/007-editor/new-document-route.md "Start Blank and template
// links"): `?blank=1` commits a blank document, `?template=<kind>` (built by the templates package's
// templateCreateHref) commits that template, both with the Default theme and the template's default name, their
// start closed. One reader for both.

// The params a template link reads.
export const WIZARD_BYPASS_PARAMS = ['blank', 'template'] as const;

// Which template the query asks to commit without the wizard, or null for
// the wizard itself. `blank` wins when both are present (it is the older,
// documented shortcut); an unknown template kind is ignored rather than
// guessed, so a stale marketing link falls back to the wizard, not a 404.
export function wizardBypassKind(search: string): TemplateKind | null {
  const params = new URLSearchParams(search);
  if (params.has('blank')) return 'blank';
  return templateKindOf(params.get('template'));
}

// The new document's presets (`?mode=`, `?q=`; docs/specs/007-editor/new-document-route.md "No welcome step"): the
// mode whose blank to make, and words to open its start's search with.
// An unknown mode, or empty words, is ignored; a retired mode's name (`?mode=pages`) reads as Diagram.
export const SEARCH_PRESET_MAX = 60;

export function wizardPresetMode(search: string): EditorMode | null {
  const mode = new URLSearchParams(search).get('mode');
  return parseEditorMode(mode) ?? null;
}

export function wizardPresetQuery(search: string): string | null {
  const q = new URLSearchParams(search).get('q')?.trim().slice(0, SEARCH_PRESET_MAX);
  return q ? q : null;
}

// `?start=blank` (docs/specs/007-editor/new-document-route.md "No welcome step"): the public sites' Start
// Blank links: the blank opens with its start closed, since whoever asked for a blank has already said they want no
// templates.
const START_BLANK_VALUE = 'blank';

export function wizardStartsBlank(search: string): boolean {
  return new URLSearchParams(search).get('start') === START_BLANK_VALUE;
}

// The placement context params (/new?folder=<id>, /new?team=<id>), pre-seeding the Settings
// step's picker.
const PLACEMENT_PARAMS = ['folder', 'team'] as const;

// Where "Choose another place" leads after a refused placement (docs/specs/007-editor/
// new-document-route.md "Placement rides the create"): /new without the refused placement and
// without the bypass, so the wizard opens with its picker on the root of My Work. Every other param is kept.
export function choosePlacementAgainUrl(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of [...WIZARD_BYPASS_PARAMS, ...PLACEMENT_PARAMS]) params.delete(key);
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

// What `/new` creates on arrival (docs/specs/007-editor/new-document-route.md "No welcome step"): a `?blank=1` or
// `?template=` link's template, its start closed; else the `?mode=` preset's blank (a Blank Diagram with none), on
// its start unless `?start=blank` asked for none. `link` names a link that chose the template, for its telemetry.
export function newDocumentKind(search: string): {
  kind: TemplateKind;
  startClosed: boolean;
  link: TemplateKind | null;
} {
  const link = wizardBypassKind(search);
  if (link) return { kind: link, startClosed: true, link };
  const mode = wizardPresetMode(search) ?? 'diagram';
  return { kind: BLANK_TEMPLATE_FOR_MODE[mode], startClosed: wizardStartsBlank(search), link: null };
}
