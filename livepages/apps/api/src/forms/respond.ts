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
import { itemTitle, readItemCreate, typesOf, type ItemPerson } from '@livediagram/items';
import { claimResponseNumber, getDocument, getFormLink, type FormLinkRow } from '../db';
import { notifyFormResponse } from '../email/notifications';
import { json } from '../responses';
import { createMany } from '../routes/item-routes';
import { relay } from '../routes/item-route-kit';
import type { RouteContext } from '../routes/context';
import { reportServerEvent } from '../server-telemetry';
import { boardsOnTab, readFormTab } from './form-tab';
import { sheetThere, writeResponseRow } from './sheet-response';

// How many responses one form takes an hour from everyone (docs/specs/030-forms/forms.md "Abuse and limits").
// Safe range 100..2000.
export const FORM_RESPONSES_PER_HOUR = 500;

const refuse = (body: FormResponseRefusal, status: number) => json(body, { status });

// The brand blue a form's person is drawn in.
const FORM_PERSON_COLOR = '#0284c7';

// The person a response's card names as its maker: the form itself, never a respondent.
function formPerson(code: string, form: Pick<FormDefinition, 'heading'>): ItemPerson {
  return {
    id: `form:${code.slice(0, 8)}`,
    name: `${form.heading} form`.slice(0, 80),
    color: FORM_PERSON_COLOR,
  };
}

// The live link a public request names, with its document and form; null for anything that is not there now (an
// unknown, suspended or deleted code, a trashed document, a tab gone or no longer a Form tab), all answered alike.
export async function openFormLink(ctx: RouteContext, code: string) {
  const link = await getFormLink(ctx.env, code);
  if (!link || link.suspended_at !== null || link.deleted_at !== null) return null;
  const doc = await getDocument(ctx.env, link.document_id);
  if (!doc) return null;
  const formTab = await readFormTab(ctx.env, link.document_id, link.tab_id);
  if (!formTab) return null;
  return { link, doc, ...formTab };
}

function isClosed(form: FormDefinition, link: FormLinkRow, now: number): boolean {
  return closedReason(form, { open: link.open === 1, responses: link.responses, now }) !== null;
}

// `preview`: an Editor's Preview of the published form (docs/specs/030-forms/forms.md "Preview"), sent through the
// form-preview route: a counted response like any other, titled "Preview: …", taken even while the form is closed,
// with no hidden field to check and no email (the Editor made it).
type ResponseBodyRaw = { answers: object; other?: unknown; website?: unknown };

// The request's body: within RESPONSE_BODY_MAX, JSON with `answers`.
async function readResponseBody(ctx: RouteContext): Promise<ResponseBodyRaw | Response> {
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
  return body as ResponseBodyRaw;
}

// An Editor's Preview of a form with no live link that sends its responses to a Sheet (docs/specs/030-forms/forms.md
// "Preview"): nothing counts it, so its row reads Preview; the editor makes a board's preview card itself.
export async function previewToSheet(
  ctx: RouteContext,
  doc: { id: string },
  form: FormDefinition,
  by: ItemPerson,
): Promise<Response> {
  const body = await readResponseBody(ctx);
  if (body instanceof Response) return body;
  const checked = checkResponse(form, {
    answers: body.answers as Record<string, unknown>,
    other:
      body.other && typeof body.other === 'object' ? (body.other as Record<string, unknown>) : {},
  });
  if (!checked.ok) return refuse({ error: 'invalid_answers', errors: checked.errors }, 400);
  const wrote = await writeResponseRow(ctx, {
    documentId: doc.id,
    sheet: form.sheet!,
    form,
    answers: checked.answers,
    number: null,
    preview: true,
    by,
  });
  if (wrote !== 'written')
    return refuse(
      { error: wrote === 'missing' ? 'form_closed' : wrote === 'full' ? 'form_full' : 'form_busy' },
      wrote === 'missing' ? 409 : wrote === 'full' ? 413 : 429,
    );
  const { env } = ctx;
  ctx.waitUntil?.(reportServerEvent(env, 'Form', 'Sent', 'Preview'));
  const accepted: FormResponseAccepted = { number: 0 };
  return json(accepted, { status: 201 });
}

export async function respond(
  ctx: RouteContext,
  code: string,
  { preview = false }: { preview?: boolean } = {},
): Promise<Response> {
  const { env } = ctx;
  const body = await readResponseBody(ctx);
  if (body instanceof Response) return body;

  const opened = await openFormLink(ctx, code);
  if (!opened) return refuse({ error: 'form_not_found' }, 404);
  const { link, doc, form, tab } = opened;
  // The hidden field: a person never fills it, so a bot learns nothing from the answer it gets.
  if (!preview && typeof body.website === 'string' && body.website.trim() !== '') {
    console.info('[forms] form.response.dropped', { documentId: doc.id });
    ctx.waitUntil?.(reportServerEvent(env, 'Form', 'Sent', 'Dropped'));
    const accepted: FormResponseAccepted = { number: 0 };
    return json(accepted, { status: 201 });
  }
  const now = Date.now();
  if (!preview && isClosed(form, link, now)) {
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

  // To a Sheet: a row, no card (sheet-response.ts).
  if (form.sheet) {
    if (!(await sheetThere(ctx, doc.id, form.sheet))) {
      console.warn('[forms] form.destination.broken', {
        documentId: doc.id,
        problem: 'sheet_missing',
      });
      return refuse({ error: 'form_closed' }, 409);
    }
    const number = await claimNumber(ctx, code, form, now, preview);
    if (number instanceof Response) return number;
    const wrote = await writeResponseRow(ctx, {
      documentId: doc.id,
      sheet: form.sheet,
      form,
      answers: checked.answers,
      number,
      preview,
      by: formPerson(code, form),
    });
    // The number stays claimed whatever happened, so numbers never repeat.
    if (wrote === 'full') return refuse({ error: 'form_full' }, 413);
    if (wrote !== 'written')
      return refuse(
        { error: wrote === 'missing' ? 'form_closed' : 'form_busy' },
        wrote === 'missing' ? 409 : 429,
      );
    return accepted(ctx, { doc, form, code, number, preview, title: `${form.heading} #${number}` });
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
    const card = responseCard(form, tab.id, checked.answers, type, n, preview);
    return readItemCreate({
      type: card.type,
      fields: card.fields,
      place: { status: form.destination!.status },
    });
  };
  const first = cardFor(1);
  if (typeof first === 'string') {
    console.error('[forms] form.response.unmade', { documentId: doc.id, rejection: first });
    return refuse({ error: 'invalid_answers', errors: {} }, 400);
  }

  const number = await claimNumber(ctx, code, form, now, preview);
  if (number instanceof Response) return number;
  const create = cardFor(number);
  // Only the title's number differs from the first, so the check holds.
  const made = await createMany(
    ctx,
    { documentId: doc.id, owner: formPerson(code, form).id },
    [typeof create === 'string' ? first : create],
    { by: formPerson(code, form) },
  );
  if (made instanceof Response) {
    // A full item store: the number stays claimed, so numbers never repeat.
    if (made.status === 413) return refuse({ error: 'form_full' }, 413);
    return refuse({ error: 'form_busy' }, 429);
  }
  relay(ctx, doc.id, made.items, [], made.rev);
  return accepted(ctx, {
    doc,
    form,
    code,
    number,
    preview,
    title: made.items[0] ? itemTitle(made.items[0]) : '',
  });
}

// The next response number, or the refusal: the Response Limit reached meanwhile (another response took the last
// place since the form was read: closed, as the form now is), else the hourly cap (busy). A preview passes the limit,
// as it is taken while the form is closed.
async function claimNumber(
  ctx: RouteContext,
  code: string,
  form: Pick<FormDefinition, 'limit'>,
  now: number,
  preview: boolean,
): Promise<number | Response> {
  const limit = preview ? null : (form.limit ?? null);
  const number = await claimResponseNumber(ctx.env, code, now, FORM_RESPONSES_PER_HOUR, limit);
  if (number !== null) return number;
  const link = limit === null ? null : await getFormLink(ctx.env, code);
  if (link && limit !== null && link.responses >= limit) {
    console.info('[forms] form.response.refused', { error: 'form_closed' });
    return refuse({ error: 'form_closed' }, 409);
  }
  console.info('[forms] form.response.refused', { error: 'form_busy' });
  return refuse({ error: 'form_busy' }, 429);
}

// A response taken (a card or a sheet row): logged, counted, the owner emailed (not for a preview), and answered.
function accepted(
  ctx: RouteContext,
  r: {
    doc: { id: string; ownerId: string; name: string };
    form: Pick<FormDefinition, 'heading'>;
    code: string;
    number: number;
    preview: boolean;
    title: string;
  },
): Response {
  const { doc, form, code, number, preview } = r;
  const { env } = ctx;
  console.info('[forms] form.response.accepted', { documentId: doc.id, number, preview });
  ctx.waitUntil?.(reportServerEvent(env, 'Form', 'Sent', preview ? 'Preview' : 'Response'));
  if (!preview)
    ctx.waitUntil?.(
      notifyFormResponse(
        env,
        { id: doc.id, ownerId: doc.ownerId, name: doc.name },
        { code, heading: form.heading },
        r.title,
      ),
    );
  const body: FormResponseAccepted = { number };
  return json(body, { status: 201 });
}
