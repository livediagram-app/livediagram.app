import { templateKindOf, type TemplateKind } from '@livepages/templates';

// What a /new URL asks for (docs/specs/007-editor/new-document-route.md): `/new` makes a document at once and opens it
// on its start, where the templates are; `?blank=1` makes a blank one with its start closed; `?template=<kind>` (built
// by the templates package's templateCreateHref) makes that template. One reader for the page and the workbench's
// create in place, so both agree on what counts.

// The template the query asks for, or null for a document that opens on its start. `blank` wins when both are present
// (it is the older, documented shortcut); an unknown template kind is ignored rather than guessed, so a stale
// marketing link makes a document, not a 404. A retired kind opens its replacement (templateKindOf).
export function newDocumentKind(search: string): TemplateKind | null {
  const params = new URLSearchParams(search);
  if (params.has('blank')) return 'blank';
  return templateKindOf(params.get('template'));
}

// `?start=blank` (docs/specs/007-editor/new-document-route.md "Start Blank"): the public sites' Start Blank links. The
// document opens with its start closed, as `?blank=1`'s does, since whoever asked for a blank wants no templates.
export function newDocumentStartsBlank(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('blank') || params.get('start') === 'blank';
}

// `?q=` (docs/specs/007-editor/new-document-route.md): words the start's search opens with. Empty words are ignored.
export const SEARCH_PRESET_MAX = 60;

export function newDocumentQuery(search: string): string | null {
  const q = new URLSearchParams(search).get('q')?.trim().slice(0, SEARCH_PRESET_MAX);
  return q ? q : null;
}

// The placement context params (/new?folder=<id>, /new?team=<id>).
const PLACEMENT_PARAMS = ['folder', 'team'] as const;

// Where "Choose another place" leads after a refused placement (docs/specs/007-editor/new-document-route.md
// "Placement rides the create"): /new without the refused placement, so the document is made where new documents go by
// default. Every other param is kept.
export function choosePlacementAgainUrl(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of PLACEMENT_PARAMS) params.delete(key);
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
