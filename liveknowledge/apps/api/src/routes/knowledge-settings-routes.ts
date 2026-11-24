// The knowledgebase's settings over REST (docs/specs/030-knowledgebase/verification.md "The Review Period"):
//   GET  /api/documents/<id>/knowledge-settings                    the Review Period (every role)
//   PUT  /api/documents/<id>/knowledge-settings   { reviewEvery?, aiEditing?, aiEditUnverifies? }
//                                                                  set them (Editor: in person, or a token granted
//                                                                  `write` for the period; AI Editing in person only,
//                                                                  docs/specs/030-knowledgebase/ai-editing.md)
//   GET  /api/documents/<id>/knowledge-settings/preview?reviewEvery=
//                                                                  how many pages would be Review Due (Editor)
// The period is one value on the document's row. Setting it writes that row and nothing else: every page's state
// is worked out when read (trust.ts), so no page, trust row or index entry is rewritten however many pages there
// are. The room then owes its review check (the next review to wait for moved) and tells every open editor.
import {
  DEFAULT_AI_EDITING,
  aiEditingOf,
  isAiEditing,
  isReviewEvery,
  storedKnowledgeSettings,
} from '@liveknowledge/knowledge';
import type { KnowledgeSettings } from '@liveknowledge/document';
import type {
  KnowledgeSettingsPreviewResponse,
  KnowledgeSettingsResponse,
} from '@liveknowledge/api-schema';
import { getDocument } from '../db';
import { setKnowledgeSettings } from '../document-room/document-content';
import { reviewDueCount } from '../knowledge/knowledge-reads';
import { forbidden, json, methodNotAllowed, notFound } from '../responses';
import { relayPages } from '../room-client';
import type { KnowledgeRoute } from './knowledge-routes';

const PERIODS = 'reviewEvery is 30, 90, 180, 365 or "never".';
const SEND = 'Send reviewEvery, aiEditing or aiEditUnverifies.';
const invalid = (error: string, message: string) => json({ error, message }, { status: 400 });

// A period as a query carries it: the days as digits, or `never`.
const periodOf = (text: string | null): unknown =>
  text !== null && /^\d{1,3}$/.test(text) ? Number(text) : text;

async function handlePreview({ ctx, document }: KnowledgeRoute): Promise<Response> {
  const reviewEvery = periodOf(ctx.url.searchParams.get('reviewEvery'));
  if (!isReviewEvery(reviewEvery)) return invalid('invalid_review_every', PERIODS);
  const now = Date.now();
  // Two reads of one index, whatever the knowledgebase holds: what the period asked about makes due, and what is
  // due under the period it has.
  const [reviewDue, reviewDueNow] = await Promise.all([
    reviewDueCount(ctx.env, reviewEvery, now),
    reviewDueCount(ctx.env, document.knowledgeSettings.reviewEvery, now),
  ]);
  return json({ reviewEvery, reviewDue, reviewDueNow } satisfies KnowledgeSettingsPreviewResponse);
}

async function handleSet({ ctx, document }: KnowledgeRoute): Promise<Response> {
  const body = (await ctx.request.json().catch(() => null)) as {
    reviewEvery?: unknown;
    aiEditing?: unknown;
    aiEditUnverifies?: unknown;
  } | null;
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return invalid('invalid_body', SEND);
  const { reviewEvery, aiEditing, aiEditUnverifies } = body;
  if (reviewEvery === undefined && aiEditing === undefined && aiEditUnverifies === undefined)
    return invalid('invalid_body', SEND);
  if (reviewEvery !== undefined && !isReviewEvery(reviewEvery))
    return invalid('invalid_review_every', PERIODS);
  if (aiEditing !== undefined && !isAiEditing(aiEditing))
    return invalid('invalid_ai_editing', 'aiEditing is "suggest", "unverified" or "any".');
  if (aiEditUnverifies !== undefined && typeof aiEditUnverifies !== 'boolean')
    return invalid('invalid_ai_edit_unverifies', 'aiEditUnverifies is true or false.');
  // AI Editing is an Editor's in person (ai-editing.md "Who sets it"): an agent never raises its own reach.
  if ((aiEditing !== undefined || aiEditUnverifies !== undefined) && (ctx.token || ctx.workbench))
    return json(
      {
        error: 'needs_a_person',
        message: 'AI Editing is changed by an Editor in the app, never by an agent.',
      },
      { status: 403 },
    );
  const was = document.knowledgeSettings;
  // The labels ride the same value (page-surface.md "Page labels"): a change of one setting keeps the rest.
  const { aiEditing: _ai, aiEditUnverifies: _un, ...rest } = was;
  const level = aiEditing === undefined ? aiEditingOf(was) : aiEditing;
  const unverifies =
    aiEditUnverifies === undefined ? was.aiEditUnverifies === true : aiEditUnverifies;
  const knowledgeSettings: KnowledgeSettings = {
    ...rest,
    ...(reviewEvery === undefined ? {} : { reviewEvery }),
    ...(level !== DEFAULT_AI_EDITING ? { aiEditing: level } : {}),
    ...(unverifies ? { aiEditUnverifies: true as const } : {}),
  };
  if (storedKnowledgeSettings(knowledgeSettings) === storedKnowledgeSettings(was))
    return json({ knowledgeSettings } satisfies KnowledgeSettingsResponse);
  if (!(await setKnowledgeSettings(ctx.env, document.id, knowledgeSettings, Date.now())))
    return notFound();
  if (reviewEvery !== undefined && reviewEvery !== was.reviewEvery)
    console.info('[knowledge] review period', {
      documentId: document.id,
      reviewEvery,
      was: was.reviewEvery,
    });
  if (aiEditing !== undefined || aiEditUnverifies !== undefined)
    console.info('[knowledge] ai editing', {
      documentId: document.id,
      aiEditing: level,
      aiEditUnverifies: unverifies,
      was: aiEditingOf(was),
    });
  await relayKnowledgeSettings(ctx.env, document, knowledgeSettings);
  return json({ knowledgeSettings } satisfies KnowledgeSettingsResponse);
}

/** To every open editor, as the document's other metadata goes: the tab list as it stands, and the settings (the
 *  Review Period and the labels). */
export async function relayKnowledgeSettings(
  env: KnowledgeRoute['ctx']['env'],
  document: KnowledgeRoute['document'],
  knowledgeSettings: KnowledgeSettings,
): Promise<void> {
  const after = (await getDocument(env, document.id)) ?? document;
  await relayPages(
    env,
    document.id,
    [
      {
        kind: 'document-meta',
        name: after.name,
        knowledgeSettings,
        tabs: after.tabs.map((t) => ({
          id: t.id,
          name: t.name,
          orderIndex: t.orderIndex,
          ...(t.folder ? { folder: t.folder } : {}),
          parent: t.parent ?? null,
        })),
      },
    ],
    '[knowledge]',
  );
}

/** Null when the path is none of these routes. */
export async function handleSettingsRoutes(route: KnowledgeRoute): Promise<Response | null> {
  const { ctx, document, grant } = route;
  const { request, segments } = ctx;
  if (segments[3] !== 'knowledge-settings') return null;
  const editor = grant.role === 'edit';
  if (segments.length === 5 && segments[4] === 'preview') {
    if (request.method !== 'GET') return methodNotAllowed();
    return editor ? handlePreview(route) : forbidden();
  }
  if (segments.length !== 4) return null;
  if (request.method === 'GET')
    return json({
      knowledgeSettings: document.knowledgeSettings,
    } satisfies KnowledgeSettingsResponse);
  if (request.method !== 'PUT') return methodNotAllowed();
  return editor ? handleSet(route) : forbidden();
}
