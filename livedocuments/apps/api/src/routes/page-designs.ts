// GET /api/page-designs: the Page Designs saved to the caller's Library, theirs and their teams'
// (docs/specs/011-theme/page-designs.md "Saved designs"; liveworkspace/docs/specs/006-media/libraries.md "Saved Page
// Designs"). For a signed-in person and for an API token alike, and only to read: the agents' way to list them.
// Each design is read from its item's preview, so one list answers them all.

import type { SavedPageDesign, SavedPageDesignsResponse } from '@livedocuments/api-schema';
import { designFromPreview, SAVED_DESIGN_KIND, SAVED_DESIGN_PREFIX } from '@livedocuments/document';
import { accountsTeamReader, createTeamAccess } from '@liveworkspace/index-app';
import { libraryActorOf } from '@liveworkspace/media';
import { accountCredentials } from '../auth/accounts';
import { mediaClient, mediaOwner } from '../media';
import { json, missingAuth } from '../responses';
import type { RouteContext } from './context';

const teamAccess = createTeamAccess();

export async function handlePageDesigns(ctx: RouteContext): Promise<Response> {
  if (ctx.request.method !== 'GET' || ctx.segments.length !== 2) {
    return json({ error: 'not_found' }, { status: 404 });
  }
  const owner = ctx.resolveOwner();
  if (!owner || ctx.workbench) return missingAuth();
  const library = mediaClient(ctx.env)?.library;
  if (!library) return json({ error: 'library_unavailable' }, { status: 503 });
  // The caller's teams as accounts has them now (a token carries no claim), as the Library's door reads them.
  const teams = await teamAccess.currentTeams(
    accountsTeamReader(accountCredentials(ctx.env)),
    owner,
    ctx.teams ?? null,
  );
  const actor = libraryActorOf(await mediaOwner(owner), teams);
  const listed = await library.list(actor, [SAVED_DESIGN_KIND]);
  if (!listed.ok) return json(listed.body, { status: listed.status });
  const teamName = new Map(listed.value.teams.map((t) => [t.id, t.name]));
  const designs: SavedPageDesign[] = [];
  for (const item of listed.value.items) {
    if (!item.kinds.includes(SAVED_DESIGN_KIND)) continue;
    const design = designFromPreview(item.preview);
    if (!design) continue;
    designs.push({
      id: `${SAVED_DESIGN_PREFIX}${item.id}`,
      title: item.title,
      scope: item.scope,
      team: item.teamId ? (teamName.get(item.teamId) ?? null) : null,
      design,
    });
  }
  const body: SavedPageDesignsResponse = { designs };
  return json(body);
}
