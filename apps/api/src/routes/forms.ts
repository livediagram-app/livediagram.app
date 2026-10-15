// /api/forms/:code: a form link's public doors (docs/specs/030-forms/forms.md "Filling in a form"). Anyone with the
// code reads the form and sends a response; nothing here reads or answers the document itself. Every miss (unknown,
// suspended, trashed, tab gone) is the same 404, so a code tells nobody what lies behind it.
import {
  FORM_REPORT_NOTE_MAX,
  FORM_REPORT_REASONS,
  type FormReportReason,
  type PublicFormResponse,
} from '@livediagram/api-schema';
import { formLook } from '@livediagram/document';
import {
  FORM_CODE_PATTERN,
  closedMessageOf,
  closedReason,
  destinationProblem,
  publicForm,
} from '@livediagram/forms';
import { typesOf } from '@livediagram/items';
import { clientIp } from '../client-ip';
import { communityNetwork } from '../community-network';
import { addFormReport, countSuspendedFormLinks, suspendFormLink } from '../db';
import { notifyFormSuspended } from '../email/notifications';
import { boardsOnTab } from '../forms/form-tab';
import { reportServerEvent } from '../server-telemetry';
import { openFormLink, respond } from '../forms/respond';
import { json, methodNotAllowed, notFound } from '../responses';
import { readOptionalBody, type RouteContext } from './context';

const REASON_TYPES: Record<FormReportReason, string> = {
  spam: 'Spam',
  phishing: 'Phishing',
  offensive: 'Offensive',
  other: 'Other',
};

// Reports from this many distinct networks suspend a link for good (= Community's rule).
export const FORM_REPORTS_TO_SUSPEND = 3;
const BROWSER_ID = /^[A-Za-z0-9-]{8,64}$/;

const formNotFound = () => json({ error: 'form_not_found' }, { status: 404 });

async function read(ctx: RouteContext, code: string): Promise<Response> {
  const opened = await openFormLink(ctx, code);
  if (!opened) return formNotFound();
  const { link, doc, form, tab } = opened;
  const look = formLook(tab, form);
  let closed = closedReason(form, {
    open: link.open === 1,
    responses: link.responses,
    now: Date.now(),
  });
  // A destination broken since publishing shows as closed: a response could not be made.
  if (!closed) {
    const boards = form.destination
      ? await boardsOnTab(ctx.env, doc.id, form.destination.tabId)
      : [];
    if (destinationProblem(form.destination, boards, typesOf(doc.itemTypes)))
      closed = 'no_destination';
  }
  const body: PublicFormResponse = closed
    ? {
        state: 'closed',
        heading: form.heading,
        message: closedMessageOf(form),
        look,
      }
    : { state: 'open', form: publicForm(form), look };
  // Never cached: a form edited, closed or deleted shows as it is now.
  return json(body, { headers: { 'Cache-Control': 'no-store' } });
}

async function fileReport(ctx: RouteContext, code: string): Promise<Response> {
  const opened = await openFormLink(ctx, code);
  if (!opened) return formNotFound();
  const body = await readOptionalBody(ctx.request);
  const reason = body['reason'];
  const browser = body['browser'];
  if (
    !FORM_REPORT_REASONS.includes(reason as FormReportReason) ||
    typeof browser !== 'string' ||
    !BROWSER_ID.test(browser)
  )
    return json({ error: 'invalid_report' }, { status: 400 });
  const note =
    typeof body['note'] === 'string' && body['note'].trim()
      ? body['note'].trim().slice(0, FORM_REPORT_NOTE_MAX)
      : null;
  const now = Date.now();
  const { added, distinct } = await addFormReport(
    ctx.env,
    {
      code,
      browser,
      network: communityNetwork(clientIp(ctx.request)),
      reason: reason as string,
      note,
    },
    now,
  );
  if (added) {
    console.info('[forms] form.reported', { documentId: opened.doc.id, reason });
    // The reason is a preset value (FORM_REPORT_REASONS), never the note.
    const { env } = ctx;
    const type = REASON_TYPES[reason as FormReportReason];
    ctx.waitUntil?.(reportServerEvent(env, 'Form', 'Reported', type));
  }
  if (distinct >= FORM_REPORTS_TO_SUSPEND && (await suspendFormLink(ctx.env, code, now))) {
    const suspensions = await countSuspendedFormLinks(ctx.env, opened.doc.id);
    console.warn('[forms] form.suspended', { documentId: opened.doc.id, suspensions });
    ctx.waitUntil?.(
      notifyFormSuspended(
        ctx.env,
        { id: opened.doc.id, ownerId: opened.doc.ownerId, name: opened.doc.name },
        opened.form.heading,
      ),
    );
  }
  return json({ ok: true }, { status: 201 });
}

export async function handleForms(ctx: RouteContext): Promise<Response> {
  const { segments, request } = ctx;
  const code = segments[2] ?? '';
  if (!code) return notFound();
  // A code that cannot be one is answered as any missing form is.
  const known = FORM_CODE_PATTERN.test(code);
  if (segments.length === 3) {
    if (request.method !== 'GET') return methodNotAllowed();
    return known ? read(ctx, code) : formNotFound();
  }
  if (segments.length === 4 && segments[3] === 'responses') {
    if (request.method !== 'POST') return methodNotAllowed();
    return known ? respond(ctx, code) : formNotFound();
  }
  if (segments.length === 4 && segments[3] === 'reports') {
    if (request.method !== 'POST') return methodNotAllowed();
    return known ? fileReport(ctx, code) : formNotFound();
  }
  return notFound();
}
