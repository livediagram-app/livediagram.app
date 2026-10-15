// A response (docs/specs/030-forms/forms.md "What a response makes", blueprint §11 "The response write"): checked
// against the form as its tab holds it now, numbered, and made into one card in the form's destination, which the
// room relays to everyone with the board open.
import type { FormResponseAccepted, FormResponseRefusal } from '@livediagram/api-schema';
import {
  RESPONSE_BODY_MAX,
  checkResponse,
  closedReason,
  destinationProblem,
  destinationType,
  responseCard,
  type FormDefinition,
} from '@livediagram/forms';
import { readItemCreate, typesOf, type ItemPerson } from '@livediagram/items';
import { claimResponseNumber, getDocument, getFormLink, type FormLinkRow } from '../db';
import { notifyFormResponse } from '../email/notifications';
import { json } from '../responses';
import { createMany } from '../routes/item-routes';
import { relay } from '../routes/item-route-kit';
import type { RouteContext } from '../routes/context';
import { reportServerEvent } from '../server-telemetry';
import { boardsOnTab, readFormTab } from './form-tab';

// How many responses one form takes an hour from everyone (docs/specs/030-forms/forms.md "Abuse and limits").
// Safe range 100..2000.
export const FORM_RESPONSES_PER_HOUR = 500;

const refuse = (body: FormResponseRefusal, status: number) => json(body, { status });

// The person a response's card names as its maker: the form itself, never a respondent.
export function formPerson(
  code: string,
  form: Pick<FormDefinition, 'heading' | 'accent'>,
): ItemPerson {
  return {
    id: `form:${code.slice(0, 8)}`,
    name: `${form.heading} form`.slice(0, 80),
    color: form.accent ?? '#0284c7',
  };
}

// The live link a public request names, with its document and form; null for anything that is not there now (an
// unknown or suspended code, a trashed document, a tab gone or no longer a Form tab), all answered alike.
export async function openFormLink(ctx: RouteContext, code: string) {
  const link = await getFormLink(ctx.env, code);
  if (!link || link.suspended_at !== null) return null;
  const doc = await getDocument(ctx.env, link.document_id);
  if (!doc) return null;
  const formTab = await readFormTab(ctx.env, link.document_id, link.tab_id);
  if (!formTab) return null;
  return { link, doc, ...formTab };
}

function isClosed(form: FormDefinition, link: FormLinkRow, now: number): boolean {
  return closedReason(form, { open: link.open === 1, responses: link.responses, now }) !== null;
}

export async function respond(ctx: RouteContext, code: string): Promise<Response> {
  const { env } = ctx;
  const text = await ctx.request.text();
  if (text.length > RESPONSE_BODY_MAX) return refuse({ error: 'form_busy' }, 413);
  let body: { answers?: unknown; other?: unknown; website?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || !body.answers || typeof body.answers !== 'object')
    return json({ error: 'invalid_answers', errors: {} }, { status: 400 });

  const opened = await openFormLink(ctx, code);
  if (!opened) return refuse({ error: 'form_not_found' }, 404);
  const { link, doc, form, tab } = opened;
  // The hidden field: a person never fills it, so a bot learns nothing from the answer it gets.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    console.info('[forms] form.response.dropped', { documentId: doc.id });
    ctx.waitUntil?.(reportServerEvent(env, 'Form', 'Sent', 'Dropped'));
    const accepted: FormResponseAccepted = { number: 0 };
    return json(accepted, { status: 201 });
  }
  const now = Date.now();
  if (isClosed(form, link, now)) {
    console.info('[forms] form.response.refused', { error: 'form_closed' });
    return refuse({ error: 'form_closed' }, 409);
  }

  const checked = checkResponse(form, {
    answers: body.answers as Record<string, unknown>,
    other:
      body.other && typeof body.other === 'object' ? (body.other as Record<string, unknown>) : {},
  });
  if (!checked.ok) {
    console.info('[forms] form.response.refused', { error: 'invalid_answers' });
    return refuse({ error: 'invalid_answers', errors: checked.errors }, 400);
  }

  const types = typesOf(doc.itemTypes);
  const boards = form.destination ? await boardsOnTab(ctx.env, doc.id, form.destination.tabId) : [];
  const problem = destinationProblem(form.destination, boards, types);
  const type = destinationType(form.destination, types);
  if (problem || !type) {
    console.warn('[forms] form.destination.broken', { documentId: doc.id, problem });
    return refuse({ error: 'form_closed' }, 409);
  }

  // The card the item store would make, checked before a number is taken: a form whose answers make no valid card
  // (it should never happen: the answers were checked) refuses the response rather than burning a number.
  const cardFor = (n: number) => {
    const card = responseCard(form, tab.id, checked.answers, type, n);
    return readItemCreate({
      type: card.type,
      fields: card.fields,
      place: { status: form.destination!.status },
    });
  };
  const preview = cardFor(1);
  if (typeof preview === 'string') {
    console.error('[forms] form.response.unmade', { documentId: doc.id, rejection: preview });
    return refuse({ error: 'invalid_answers', errors: {} }, 400);
  }

  const number = await claimResponseNumber(ctx.env, code, now, FORM_RESPONSES_PER_HOUR);
  if (number === null) {
    console.info('[forms] form.response.refused', { error: 'form_busy' });
    return refuse({ error: 'form_busy' }, 429);
  }
  const create = cardFor(number);
  // Only the title's number differs from the preview, so the check holds.
  const made = await createMany(
    ctx,
    { documentId: doc.id, owner: formPerson(code, form).id },
    [typeof create === 'string' ? preview : create],
    { by: formPerson(code, form) },
  );
  if (made instanceof Response) {
    // A full item store: the number stays claimed, so numbers never repeat.
    if (made.status === 413) return refuse({ error: 'form_full' }, 413);
    return refuse({ error: 'form_busy' }, 429);
  }
  relay(ctx, doc.id, made.items, [], made.rev);
  console.info('[forms] form.response.accepted', { documentId: doc.id, number });
  ctx.waitUntil?.(reportServerEvent(env, 'Form', 'Sent', 'Response'));
  ctx.waitUntil?.(
    notifyFormResponse(
      ctx.env,
      { id: doc.id, ownerId: doc.ownerId, name: doc.name },
      { code, heading: form.heading },
      String(made.items[0]?.fields['title'] ?? ''),
    ),
  );
  const accepted: FormResponseAccepted = { number };
  return json(accepted, { status: 201 });
}
