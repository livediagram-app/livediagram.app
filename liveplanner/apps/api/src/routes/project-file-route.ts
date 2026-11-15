// The plan's `.liveplanner` file for the editor (docs/specs/015-api/api.md `GET` / `POST /api/projects/:id/file`;
// docs/specs/026-plan/plan-tabs.md "Whole Plan"; blueprint plan-file.md): the Export dialog's Whole Plan downloads
// it, and the Import dialog's liveplanner Plan row makes a new plan from one. The file is the Drive mirror's
// (plan-room/project-file.ts): written by exportProjectFile, read by readProjectFile (the untrusted body capped, the
// envelope rebuilt from its known fields, the kind and schema version checked, every store's limits) and written by
// importProjectFile. Both doors are an Editor's of the whole plan: the file holds every tab and the rules.
import { PROJECT_FILE_MAX_BYTES } from '@liveplanner/project';
import { getProject } from '../db';
import { byteLength } from '../limits';
import { capStoredName } from '../names';
import { exportProjectFile, importProjectFile, readProjectFile } from '../plan-room/project-file';
import { CORS_HEADERS, conflict, forbidden, json, notFound } from '../responses';
import { grantOn, requireOwner, type PlanRouteContext } from './context';

const PROJECT_FILE_SEGMENT = 'file';

const tooLarge = () => json({ error: 'too_large' }, { status: 413 });

// The refusal for a caller who is not an Editor of the whole plan, or null: no grant, or one confined to a tab, 404
// (a tab-scoped link learns nothing of the rest); a grant below edit, 403.
function refusal(ctx: PlanRouteContext, id: string): Response | null {
  const grant = grantOn(ctx, id);
  if (!grant || grant.tabScope !== null) return notFound();
  if (grant.role !== 'edit') return forbidden();
  return null;
}

async function exportFile(ctx: PlanRouteContext, id: string): Promise<Response> {
  const refused = refusal(ctx, id);
  if (refused) return refused;
  const file = await exportProjectFile(ctx.env, id, null);
  if (file.status !== 'ok') return notFound();
  console.info('[plan-file] exported', { projectId: id, bytes: byteLength(file.body) });
  return new Response(file.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': file.contentType,
      'Content-Disposition': 'attachment; filename="plan.liveplanner"',
      'Cache-Control': 'no-store',
    },
  });
}

async function importFile(ctx: PlanRouteContext, id: string): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const refused = refusal(ctx, id);
  if (refused) return refused;
  const refuse = (reason: string, answer: Response) => {
    console.warn('[plan-file] refused', { projectId: id, reason });
    return answer;
  };
  // Past the cap by its declared length, the body is never read.
  const declared = Number(ctx.request.headers.get('Content-Length') ?? '0');
  if (declared > PROJECT_FILE_MAX_BYTES) return refuse('too_large', tooLarge());
  if (await getProject(ctx.env, id)) return refuse('exists', conflict('exists'));
  const text = await ctx.request.text();
  if (byteLength(text) > PROJECT_FILE_MAX_BYTES) return refuse('too_large', tooLarge());
  const read = readProjectFile(text);
  if (!read.ok)
    return refuse(
      read.failure,
      json({ error: read.failure }, { status: read.failure === 'too_large' ? 413 : 400 }),
    );
  await importProjectFile(ctx.env, id, {
    ...read.content,
    name: capStoredName(read.content.title, null, 'project') || 'Untitled',
    ownerId: owner,
    teamId: ctx.grant?.team ?? null,
  });
  console.info('[plan-file] imported', {
    projectId: id,
    tabs: read.content.copy.tabs.length,
    cards: read.content.copy.items.length,
  });
  return json({ project: await getProject(ctx.env, id) }, { status: 201 });
}

// /api/projects/<id>/file, or null for any other path.
export async function handleProjectFile(ctx: PlanRouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments.length !== 4 || segments[3] !== PROJECT_FILE_SEGMENT) return null;
  const id = segments[2]!;
  if (request.method === 'GET') return exportFile(ctx, id);
  if (request.method === 'POST') return importFile(ctx, id);
  return null;
}
