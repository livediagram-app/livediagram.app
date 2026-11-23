// The knowledgebase's labels over the api (docs/specs/030-knowledgebase/page-surface.md "Page labels"; routes in
// docs/specs/015-api/api.md): make, rename or recolour, and delete one. Each answers the list as stored, which the
// editor then holds. A page's own labels are not here: they ride its tab save and the room's tab-meta op.
import type {
  CreateLabelRequest,
  KnowledgeLabelChangeResponse,
  UpdateLabelRequest,
} from '@liveknowledge/api-schema';
import { apiFetch, expectOk } from './core';
import { knowledgeHeaders, knowledgeSignal, knowledgeUrl, type KnowledgeCaller } from './knowledge';

// The refusals the label picker words itself (LABEL_REFUSAL_WORDS), so none is reported as a fault.
const EXPECTED = new Set([
  'invalid_label_id',
  'invalid_label_name',
  'invalid_label_colour',
  'label_name_taken',
  'label_limit',
  'unknown_label',
  'forbidden',
]);
const expected = (code: string | null) => code !== null && EXPECTED.has(code);

async function send(
  who: KnowledgeCaller,
  documentId: string,
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  action: string,
  body?: unknown,
): Promise<KnowledgeLabelChangeResponse> {
  const res = await apiFetch(knowledgeUrl(documentId, path), {
    method,
    headers: await knowledgeHeaders(who, body !== undefined),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: knowledgeSignal(),
  });
  return expectOk<KnowledgeLabelChangeResponse>(res, action, expected);
}

const labelPath = (id: string) => `labels/${encodeURIComponent(id)}`;

export function apiCreateLabel(
  who: KnowledgeCaller,
  documentId: string,
  label: CreateLabelRequest & { id: string },
): Promise<KnowledgeLabelChangeResponse> {
  return send(who, documentId, 'POST', 'labels', 'create label', label);
}

export function apiUpdateLabel(
  who: KnowledgeCaller,
  documentId: string,
  id: string,
  change: UpdateLabelRequest,
): Promise<KnowledgeLabelChangeResponse> {
  return send(who, documentId, 'PUT', labelPath(id), 'update label', change);
}

export function apiDeleteLabel(
  who: KnowledgeCaller,
  documentId: string,
  id: string,
): Promise<KnowledgeLabelChangeResponse> {
  return send(who, documentId, 'DELETE', labelPath(id), 'delete label');
}
