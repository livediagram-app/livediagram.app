// PUT /api/documents/<id>/tabs/<tabId>/name: a tab rename on its own
// (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab renames"), for the CLI, the
// MCP and any script, which never do whole-tab saves. Advances the tab's revision and is relayed to
// the room as the same tab-meta an editor's own rename sends (CS42).

import { getDocument, renameTab } from '../db';
import { capStoredName } from '../names';
import { forbidden, json, notFound } from '../responses';
import { relayTabRename } from '../room-client';
import { gateEdit, missingDocument, requireOwner, type RouteContext } from './context';

export async function handleTabRename(
  ctx: RouteContext,
  id: string,
  tabId: string,
): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const existing = await getDocument(ctx.env, id);
  if (!existing) return missingDocument(ctx, id);
  if (!(await gateEdit(ctx, id, existing.ownerId, existing.teamId, tabId))) return forbidden();
  const summary = existing.tabs.find((t) => t.id === tabId);
  if (!summary) return notFound();
  const body = (await ctx.request.json().catch(() => null)) as { name?: unknown } | null;
  if (typeof body?.name !== 'string' || body.name.trim() === '') {
    return json(
      { error: 'invalid_name', message: 'name must be a non-empty string' },
      { status: 400 },
    );
  }
  const name = capStoredName(body.name, summary.name, 'tab');
  const rev = await renameTab(ctx.env, tabId, name);
  if (rev === null) return notFound();
  console.info('[changeset] tab-renamed', { documentId: id, tabId, rev });
  // Awaited, bounded by ROOM_RELAY_TIMEOUT_MS; a room that misses it is logged and never fails the rename.
  await relayTabRename(ctx.env, id, tabId, name);
  return json({ tab: { ...summary, name } });
}
