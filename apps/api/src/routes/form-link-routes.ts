// /api/documents/:id/tabs/:tabId/form-link and .../form-seen (docs/specs/030-forms/forms.md "Publishing and the form
// link", "Who may do what"): a Form tab's link, as its document's people see and change it. Anyone who may read the
// tab sees the response count; only an Editor sees the code and publishes, opens, closes or deletes the link.
import type { FormLinkResponse } from '@livediagram/api-schema';
import { FORM_SUSPENSIONS_MAX, destinationProblem } from '@livediagram/forms';
import { typesOf } from '@livediagram/items';
import {
  countSuspendedFormLinks,
  createFormLink,
  deleteFormLink,
  getDocument,
  getLiveFormLink,
  getSuspendedFormLink,
  markFormSeen,
  setFormLinkOpen,
  unseenResponses,
} from '../db';
import { boardsOnTab, readFormTab } from '../forms/form-tab';
import { conflict, forbidden, json, methodNotAllowed, notFound } from '../responses';
import {
  gateEdit,
  gateRead,
  missingDocument,
  readBody,
  requireOwner,
  type RouteContext,
} from './context';

async function answer(
  ctx: RouteContext,
  documentId: string,
  tabId: string,
  owner: string,
  editor: boolean,
): Promise<Response> {
  const [live, suspended, suspensions] = await Promise.all([
    getLiveFormLink(ctx.env, documentId, tabId),
    getSuspendedFormLink(ctx.env, documentId, tabId),
    countSuspendedFormLinks(ctx.env, documentId),
  ]);
  const body: FormLinkResponse = {
    link:
      live && editor
        ? { code: live.code, open: live.open === 1, createdAt: live.created_at }
        : live
          ? { code: '', open: live.open === 1, createdAt: live.created_at }
          : null,
    responses: live?.responses ?? suspended?.responses ?? 0,
    unseen: live ? await unseenResponses(ctx.env, live.code, owner) : 0,
    suspendedAt: live ? null : (suspended?.suspended_at ?? null),
    canPublish: suspensions < FORM_SUSPENSIONS_MAX,
  };
  return json(body);
}

export async function handleFormLinkRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (!(
    segments.length === 6 &&
    segments[3] === 'tabs' &&
    (segments[5] === 'form-link' || segments[5] === 'form-seen')
  ))
    return null;
  const documentId = segments[2]!;
  const tabId = segments[4]!;
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getDocument(env, documentId);
  if (!doc) return missingDocument(ctx, documentId);
  if (!(await gateRead(ctx, documentId, doc.ownerId, doc.teamId, tabId))) return forbidden();
  const editor = await gateEdit(ctx, documentId, doc.ownerId, doc.teamId, tabId);

  if (segments[5] === 'form-seen') {
    if (request.method !== 'POST') return methodNotAllowed();
    const live = await getLiveFormLink(env, documentId, tabId);
    if (live) await markFormSeen(env, live.code, owner);
    return answer(ctx, documentId, tabId, owner, editor);
  }

  if (request.method === 'GET') return answer(ctx, documentId, tabId, owner, editor);
  if (!editor) return forbidden();
  const live = await getLiveFormLink(env, documentId, tabId);

  if (request.method === 'POST') {
    if (live) return conflict('form_already_published');
    const formTab = await readFormTab(env, documentId, tabId);
    if (!formTab) return notFound();
    const { form } = formTab;
    const boards = form.destination
      ? await boardsOnTab(env, documentId, form.destination.tabId)
      : [];
    const problem = destinationProblem(form.destination, boards, typesOf(doc.itemTypes));
    if (problem) return conflict('form_destination_missing');
    if ((await countSuspendedFormLinks(env, documentId)) >= FORM_SUSPENSIONS_MAX)
      return forbidden('form_suspensions');
    const made = await createFormLink(env, documentId, tabId, Date.now());
    if (!made) return conflict('form_already_published');
    // The publisher has seen every response so far (none, or the suspended link's).
    await markFormSeen(env, made.code, owner);
    console.info('[forms] form.published', { documentId });
    return answer(ctx, documentId, tabId, owner, editor);
  }
  if (!live) return notFound();
  if (request.method === 'PUT') {
    const body = await readBody(ctx);
    if (body instanceof Response) return body;
    if (typeof body['open'] !== 'boolean') return json({ error: 'invalid open' }, { status: 400 });
    await setFormLinkOpen(env, live.code, body['open']);
    console.info(body['open'] ? '[forms] form.reopened' : '[forms] form.closed', { documentId });
    return answer(ctx, documentId, tabId, owner, editor);
  }
  if (request.method === 'DELETE') {
    await deleteFormLink(env, live.code);
    console.info('[forms] form.deleted', { documentId });
    return answer(ctx, documentId, tabId, owner, editor);
  }
  return methodNotAllowed();
}
