// A knowledgebase's Sources over REST (docs/specs/030-knowledgebase/search-and-ask.md "Sources in AI Settings"):
//   GET /api/documents/<id>/ai/sources   { connected, folderId, folderName, team, items }
//   PUT /api/documents/<id>/ai/sources   { connected?, folderId?, folderName? } (an Editor's) → the same
// Reading is every role's, as AI Settings is; changing is an Editor's. A change owes the room a look at its set of
// sources (knowledge/source-work.ts), and a folder change a summary push, so the index knows which folder this
// knowledgebase reads (`knowledgeFolder`, liveworkspace/docs/specs/004-index/knowledge-sources.md "Keeping in step").
import type { KnowledgeSourceRow, KnowledgeSources } from '@liveknowledge/api-schema';
import { rowsOf, runAll, sqlOf } from '../knowledge/knowledge-db';
import { readSourceSettings, sourceSettingsWrites } from '../knowledge/source-settings';
import { SOURCE_SYNC_KEY, SOURCE_SYNC_SOON_MS } from '../knowledge/source-work';
import { forbidden, json, methodNotAllowed } from '../responses';
import type { KnowledgeRoute } from './knowledge-routes';

/** Sources AI Settings lists at most: the knowledgebase reads at most 100, and capped ones are listed too. */
export const SOURCES_LISTED_MAX = 200;

type Row = {
  itemId: string;
  app: KnowledgeSourceRow['app'];
  title: string;
  origin: KnowledgeSourceRow['origin'];
  state: KnowledgeSourceRow['state'];
  chunks: number;
  readAt: number | null;
};

export async function readKnowledgeSources(
  route: Pick<KnowledgeRoute, 'ctx' | 'document'>,
): Promise<KnowledgeSources> {
  const { env } = route.ctx;
  const settings = await readSourceSettings(env);
  const rows = await rowsOf<Row>(
    env,
    sqlOf(
      `SELECT item_id AS itemId, app, title, origin, state, chunks, read_at AS readAt FROM source_items
        ORDER BY origin, title COLLATE NOCASE LIMIT ?`,
      SOURCES_LISTED_MAX,
    ),
  );
  return {
    ...settings,
    teamId: route.document.teamId ?? null,
    items: rows.map(({ readAt, ...row }) => ({ ...row, ...(readAt ? { readAt } : {}) })),
  };
}

export async function handleSourcesRoute(route: KnowledgeRoute): Promise<Response> {
  const { ctx, document, grant } = route;
  const { env, request } = ctx;
  if (request.method === 'GET') return json(await readKnowledgeSources(route));
  if (request.method !== 'PUT') return methodNotAllowed();
  if (grant.role !== 'edit') return forbidden();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  // A folder is a team's: a personal knowledgebase keeps none.
  if (body && body.folderId && !document.teamId)
    return json(
      { error: 'not_a_team', message: 'Only a team knowledgebase reads a team folder.' },
      { status: 400 },
    );
  const writes = sourceSettingsWrites(body);
  if (!writes)
    return json({ error: 'invalid_sources', message: 'Nothing to change.' }, { status: 400 });
  const folderChanged = body?.folderId !== undefined;
  await runAll(env, [
    ...writes,
    // The index learns the folder from the summary: owe one.
    ...(folderChanged
      ? [
          sqlOf(
            `DELETE FROM outbox WHERE document_id = ? AND kind = 'summary' AND key = ''`,
            document.id,
          ),
          sqlOf(
            `INSERT INTO outbox (document_id, kind, key) VALUES (?, 'summary', '')`,
            document.id,
          ),
        ]
      : []),
  ]);
  if (folderChanged) env.OUTBOX_OWED?.();
  env.SOURCES_OWED?.(SOURCE_SYNC_KEY, Date.now() + SOURCE_SYNC_SOON_MS);
  console.info('[knowledge] sources changed', {
    documentId: document.id,
    connected: body?.connected ?? null,
    folder: folderChanged ? Boolean(body?.folderId) : null,
  });
  return json(await readKnowledgeSources(route));
}
