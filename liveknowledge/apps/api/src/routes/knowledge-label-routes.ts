// The knowledgebase's labels over REST (docs/specs/030-knowledgebase/page-surface.md "Page labels"; blueprint
// docs/specs/030-knowledgebase/blueprints/page-labels.md "Interfaces and contracts"):
//   GET    /api/documents/<id>/labels                        every label, most used first, with its page count
//   POST   /api/documents/<id>/labels          { name, colour?, id? }  make one (a Writer)
//   PUT    /api/documents/<id>/labels/<label>  { name?, colour? }      rename or recolour it (a Writer)
//   DELETE /api/documents/<id>/labels/<label>                         delete it (a Writer)
// The labels are one value beside the Review Period (`knowledgeSettings.labels`), and a page keeps only the ids it
// carries, so each write here is one row whatever the number of pages that carry the label: no page is rewritten.
// The open editors are told as the Review Period's are (`document-meta` with the settings).
import {
  LABEL_REFUSAL_WORDS,
  applyLabelChange,
  labelPageCounts,
  labelsByUse,
  newLabelId,
  nextLabelColour,
  type LabelChange,
  type LabelRefusal,
} from '@liveknowledge/document';
import type {
  KnowledgeLabelChangeResponse,
  KnowledgeLabelsResponse,
} from '@liveknowledge/api-schema';
import { setKnowledgeLabels } from '../document-room/document-content';
import { forbidden, json, methodNotAllowed, notFound } from '../responses';
import { writesPages } from './context';
import { relayKnowledgeSettings } from './knowledge-settings-routes';
import type { KnowledgeRoute } from './knowledge-routes';

const STATUS: Record<LabelRefusal, number> = {
  invalid_label_id: 400,
  invalid_label_name: 400,
  invalid_label_colour: 400,
  label_name_taken: 409,
  label_limit: 409,
  unknown_label: 404,
};

const refused = (refusal: LabelRefusal) =>
  json({ error: refusal, message: LABEL_REFUSAL_WORDS[refusal] }, { status: STATUS[refusal] });
const invalidBody = (message: string) => json({ error: 'invalid_body', message }, { status: 400 });

async function bodyOf(route: KnowledgeRoute): Promise<Record<string, unknown> | null> {
  const body: unknown = await route.ctx.request.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

function handleList({ document }: KnowledgeRoute): Response {
  const labels = document.knowledgeSettings.labels ?? [];
  const counts = labelPageCounts(document.tabs);
  return json({
    labels: labelsByUse(labels, counts).map((l) => ({ ...l, pages: counts.get(l.id) ?? 0 })),
  } satisfies KnowledgeLabelsResponse);
}

/** The change a request asks for, or the response that refuses it. */
async function changeOf(
  route: KnowledgeRoute,
  labelId: string | undefined,
): Promise<LabelChange[] | Response> {
  const { request } = route.ctx;
  const labels = route.document.knowledgeSettings.labels ?? [];
  if (request.method === 'DELETE') return labelId ? [{ kind: 'delete', id: labelId }] : [];
  const body = await bodyOf(route);
  if (!body) return invalidBody('Send a JSON object.');
  if (request.method === 'POST') {
    const { name, colour, id } = body;
    return [
      {
        kind: 'add',
        id: id === undefined ? newLabelId() : (id as string),
        name: name as string,
        colour: colour === undefined ? nextLabelColour(labels) : (colour as string),
      },
    ];
  }
  if (!labelId) return [];
  const changes: LabelChange[] = [];
  if (body.name !== undefined)
    changes.push({ kind: 'rename', id: labelId, name: body.name as string });
  if (body.colour !== undefined)
    changes.push({ kind: 'recolour', id: labelId, colour: body.colour as string });
  if (changes.length === 0) return invalidBody('Send name, colour or both.');
  return changes;
}

async function handleChange(route: KnowledgeRoute, labelId: string | undefined): Promise<Response> {
  const { ctx, document } = route;
  const asked = await changeOf(route, labelId);
  if (asked instanceof Response) return asked;
  let labels = document.knowledgeSettings.labels ?? [];
  let label: KnowledgeLabelChangeResponse['label'];
  for (const change of asked) {
    const result = applyLabelChange(labels, change);
    if ('refusal' in result) return refused(result.refusal);
    labels = result.labels;
    label = result.label;
  }
  const knowledgeSettings = { ...document.knowledgeSettings, labels };
  if (!(await setKnowledgeLabels(ctx.env, document.id, knowledgeSettings, Date.now())))
    return notFound();
  console.info('[knowledge] labels changed', {
    documentId: document.id,
    change: asked.map((c) => c.kind).join(','),
    labels: labels.length,
  });
  await relayKnowledgeSettings(ctx.env, document, knowledgeSettings);
  return json({ ...(label ? { label } : {}), labels } satisfies KnowledgeLabelChangeResponse, {
    status: ctx.request.method === 'POST' ? 201 : 200,
  });
}

/** Null when the path is none of these routes. */
export async function handleLabelRoutes(route: KnowledgeRoute): Promise<Response | null> {
  const { ctx, grant } = route;
  const { request, segments } = ctx;
  if (segments[3] !== 'labels') return null;
  if (segments.length === 4) {
    if (request.method === 'GET') return handleList(route);
    if (request.method !== 'POST') return methodNotAllowed();
  } else if (segments.length === 5) {
    if (request.method !== 'PUT' && request.method !== 'DELETE') return methodNotAllowed();
  } else return null;
  // A label change is a page writer's (an Editor or a Participant), as putting one on a page is.
  if (!writesPages(grant)) return forbidden();
  return handleChange(route, segments[4]);
}
