import { templateKindOf, type TemplateKind } from '@liveplanner/templates';

// What a /new URL asks for (docs/specs/007-editor/new-document-route.md): `/new` makes a blank document at once and
// opens it on Start Planning; `?template=<kind>` (built by the templates package's templateCreateHref) makes that
// template instead. One reader for the page and the workbench's create in place, so both agree on what counts.

// The template the query asks for, or null for a blank document. An unknown template kind is ignored rather than
// guessed, so a stale marketing link makes a blank document, not a 404. A retired kind opens its replacement
// (templateKindOf).
export function newDocumentKind(search: string): TemplateKind | null {
  return templateKindOf(new URLSearchParams(search).get('template'));
}

// `?q=` (docs/specs/007-editor/new-document-route.md): words Start Planning's search opens with. Empty words are
// ignored.
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
