// The plan's `.liveplanner` file for the editor (docs/specs/015-api/api.md `GET` / `POST /api/projects/:id/file`;
// docs/specs/026-plan/plan-tabs.md "Whole Plan"; blueprint plan-file.md): the Export dialog's Whole Plan downloads
// it, and the Import dialog's liveplanner Plan row makes a new plan from one. The file is the Drive mirror's
// (plan-room/project-file.ts): written by exportProjectFile, read by readProjectFile (the untrusted body capped, the
// envelope rebuilt from its known fields, the kind and schema version checked, every store's limits) and written by
// importProjectFile. Both doors are an Editor's of the whole plan: the file holds every tab and the rules.
import { PROJECT_FILE_MAX_BYTES } from '@liveplanner/project';
import { getProject } from '../db';
import { byteLength } from '../limits';
import { ImportClaimRefused } from '../plan-room/copy-image-claims';
import { capStoredName } from '../names';
import {
  exportProjectFile,
  importProjectFile,
  readProjectFile,
  type ProjectFileRead,
} from '../plan-room/project-file';
import { CORS_HEADERS, conflict, forbidden, json, notFound } from '../responses';
import { grantOn, requireOwner, type PlanRouteContext } from './context';
import { rulesCopyMax } from '../plan-room/tier/room-tier';

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
  const bytes = typeof file.body === 'string' ? byteLength(file.body) : file.body.byteLength;
  console.info('[plan-file] exported', { projectId: id, bytes });
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

// The body read as a plan's content, or too_large past the cap by its length. Its own function, so the text is let go
// before the content is written: at the cap it is 20 MB of the plan's object's 128 MB (blueprint plan-file.md
// "Performance and limits").
async function readBodyFile(
  request: Request,
  rulesMax: number,
): Promise<ProjectFileRead | 'too_large'> {
  const text = await request.text();
  if (byteLength(text) > PROJECT_FILE_MAX_BYTES) return 'too_large';
  return readProjectFile(text, undefined, { rulesMax });
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
  const read = await readBodyFile(ctx.request, rulesCopyMax());
  if (read === 'too_large') return refuse('too_large', tooLarge());
  if (!read.ok)
    return refuse(
      read.failure,
      json({ error: read.failure }, { status: read.failure === 'too_large' ? 413 : 400 }),
    );
  try {
    await importProjectFile(ctx.env, id, {
      ...read.content,
      name: capStoredName(read.content.title, null, 'project') || 'Untitled',
      ownerId: owner,
      teamId: ctx.grant?.team ?? null,
    });
  } catch (err) {
    // The media service refused the pictures' claim (copy-image-claims.ts claimImportedImages): nothing landed, so
    // the editor's Try again works.
    if (!(err instanceof ImportClaimRefused)) throw err;
    return refuse('media_unavailable', json({ error: 'media_unavailable' }, { status: 503 }));
  }
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
