// Agent changesets over REST (docs/specs/024-agents/agent-changesets.md; blueprint "Interfaces and
// contracts"):
//   POST /api/documents/<id>/tabs/<tabId>/changesets          submit (`?dryRun=1` plans only)
//   GET  /api/documents/<id>/changesets[?tab=&limit=]         the history, newest first
//   GET  /api/documents/<id>/changesets/<changesetId>         one, with its result lines
//   POST /api/documents/<id>/changesets/<changesetId>/revert  its inverse, as a new changeset

import {
  CHANGESET_LIST_DEFAULT,
  CHANGESET_LIST_MAX,
  type ChangesetConflict,
  type ChangesetSummary,
  type ResultLine,
} from '@livediagram/api-schema';
import { redactCommentAuthorIds } from '../comments';
import { getChangeset, getChangesetPart, getDocument, getParticipant, listChangesets } from '../db';
import type { ChangesetRecord } from '../db';
import { forbidden, json, notFound } from '../responses';
import { personTagFor } from '../person-tag';
import { refreshAgentPresence } from '../room-client';
import { frontDoorOf } from '../changesets/front-door';
import { engineLog } from '../changesets/log';
import { parseChangesetRequest } from '../changesets/request';
import { revertChangeset } from '../changesets/revert';
import { submitChangeset, type SubmitResult } from '../changesets/submit';
import type { Author } from '../changesets/write';
import type { DocumentDTO } from '../types';
import {
  gateEdit,
  gateGrant,
  gateRead,
  missingDocument,
  requireOwner,
  shareCodeOf,
  type RouteContext,
} from './context';

// The author's name and colour when they have no participant row (CS16).
const FALLBACK_AUTHOR = { name: 'Someone', color: '#0ea5e9' };

// Null when the path is not a changeset route.
export async function handleChangesetRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, segments } = ctx;
  const id = segments[2];
  if (!id || segments[1] !== 'documents') return null;
  const submit =
    segments.length === 6 &&
    segments[3] === 'tabs' &&
    segments[5] === 'changesets' &&
    request.method === 'POST';
  const list = segments.length === 4 && segments[3] === 'changesets' && request.method === 'GET';
  const one = segments.length === 5 && segments[3] === 'changesets' && request.method === 'GET';
  const revert =
    segments.length === 6 &&
    segments[3] === 'changesets' &&
    segments[5] === 'revert' &&
    request.method === 'POST';
  if (!submit && !list && !one && !revert) return null;

  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const document = await getDocument(ctx.env, id);
  if (!document) return missingDocument(ctx, id);
  if (submit) return handleSubmit(ctx, document, segments[4]!, owner);
  if (list) return handleList(ctx, document, owner);
  const record = await getChangeset(ctx.env, id, segments[4]!);
  if (!record) return notFound();
  if (one) return handleOne(ctx, document, record, owner);
  return handleRevert(ctx, document, record, owner);
}

async function handleSubmit(
  ctx: RouteContext,
  document: DocumentDTO,
  tabId: string,
  owner: string,
): Promise<Response> {
  if (!(await gateEdit(ctx, document.id, document.ownerId, document.teamId, tabId)))
    return forbidden();
  const raw = await ctx.request.json().catch(() => undefined);
  const parsed = parseChangesetRequest(raw, engineLog({ documentId: document.id, tabId }));
  if (!parsed.ok) return json(parsed.refusal.body, { status: parsed.refusal.status });
  const author = await authorOf(ctx, owner);
  const result = await submitChangeset({
    env: ctx.env,
    document,
    tabId,
    request: parsed.value,
    dryRun: ctx.url.searchParams.get('dryRun') === '1',
    author,
    tokenId: ctx.token?.id ?? null,
    frontDoor: frontDoorOf(ctx.request),
    ...(ctx.waitUntil ? { waitUntil: ctx.waitUntil } : {}),
  });
  refreshAfterWrite(ctx, document.id, tabId, author, result);
  return respond(redactConflicts(result, document, owner));
}

async function handleList(
  ctx: RouteContext,
  document: DocumentDTO,
  owner: string,
): Promise<Response> {
  const grant = await gateGrant(ctx, document.id, document.ownerId, document.teamId);
  if (!grant) return notFound();
  const limit = parseLimit(ctx.url.searchParams.get('limit'));
  if (limit === null) {
    return json(
      { error: 'invalid_value', message: `limit is an integer from 1 to ${CHANGESET_LIST_MAX}` },
      { status: 400 },
    );
  }
  const asked = ctx.url.searchParams.get('tab');
  // A tab-scoped link reads its own tab's history only (docs/specs/013-workspace/tab-scoped-share-links.md).
  if (grant.tabScope !== null && asked !== null && asked !== grant.tabScope) {
    return json({ changesets: [] });
  }
  const tabId = grant.tabScope ?? asked ?? undefined;
  const records = await listChangesets(ctx.env, document.id, {
    limit,
    ...(tabId ? { tabId } : {}),
  });
  return json({ changesets: records.map((r) => summaryOf(r, owner)) });
}

async function handleOne(
  ctx: RouteContext,
  document: DocumentDTO,
  record: ChangesetRecord,
  owner: string,
): Promise<Response> {
  if (!(await gateRead(ctx, document.id, document.ownerId, document.teamId, record.tabId))) {
    return notFound();
  }
  const part = await getChangesetPart(ctx.env, record.id, 'results');
  const { results, text } = part
    ? (JSON.parse(part) as { results: ResultLine[]; text: string })
    : { results: [], text: '' };
  return json({ changeset: summaryOf(record, owner), results, text });
}

async function handleRevert(
  ctx: RouteContext,
  document: DocumentDTO,
  record: ChangesetRecord,
  owner: string,
): Promise<Response> {
  if (!(await gateEdit(ctx, document.id, document.ownerId, document.teamId, record.tabId))) {
    return forbidden();
  }
  const author = await authorOf(ctx, owner);
  const result = await revertChangeset({
    env: ctx.env,
    document,
    record,
    author,
    tokenId: ctx.token?.id ?? null,
    frontDoor: frontDoorOf(ctx.request),
    ...(ctx.waitUntil ? { waitUntil: ctx.waitUntil } : {}),
  });
  refreshAfterWrite(ctx, document.id, record.tabId, author, result);
  return respond(result);
}

// A token's written changeset or revert keeps its presence on the tab (docs/specs/024-agents/agent-presence.md
// "Presence"); a dry run, a refusal and a session's write leave presence alone. Off the response path.
export function refreshAfterWrite(
  ctx: RouteContext,
  documentId: string,
  tabId: string,
  author: Author,
  result: { status: number; body: unknown },
): void {
  const written = (result.body as { changeset?: unknown } | null)?.changeset;
  if (!ctx.token || result.status !== 200 || !written) return;
  const tokenId = ctx.token.id;
  ctx.waitUntil?.(
    personTagFor(documentId, author.id).then((personTag) =>
      refreshAgentPresence(ctx.env, {
        documentId,
        tokenId,
        tabId,
        personTag,
        shareCode: shareCodeOf(ctx.request),
        name: author.name,
        color: author.color,
        // A changeset passed the edit gate.
        role: 'edit',
      }),
    ),
  );
}

// The resolved owner of the request: the token's owner for an agent. Nothing in the body names an
// author.
export async function authorOf(ctx: RouteContext, owner: string): Promise<Author> {
  const participant = await getParticipant(ctx.env, owner);
  return {
    id: owner,
    name: participant?.name ?? FALLBACK_AUTHOR.name,
    color: participant?.color ?? FALLBACK_AUTHOR.color,
  };
}

function summaryOf(record: ChangesetRecord, viewer: string): ChangesetSummary {
  return {
    id: record.id,
    tabId: record.tabId,
    rev: record.rev,
    author: { name: record.authorName, color: record.authorColor },
    agent: record.tokenId !== null,
    // The audit field reaches only the changeset's author (CS26).
    ...(record.tokenId !== null && record.authorId === viewer ? { tokenId: record.tokenId } : {}),
    summary: record.summary,
    counts: record.counts,
    revertOf: record.revertOf,
    createdAt: record.createdAt,
  };
}

function parseLimit(raw: string | null): number | null {
  if (raw === null) return CHANGESET_LIST_DEFAULT;
  if (!/^\d+$/.test(raw)) return null;
  const limit = Number(raw);
  return limit >= 1 && limit <= CHANGESET_LIST_MAX ? limit : null;
}

// Comment author ids never leave the server for a non-owner, conflicts included.
function redactConflicts(
  result: SubmitResult,
  document: DocumentDTO,
  viewer: string,
): SubmitResult {
  if (viewer === document.ownerId) return result;
  const body = result.body as { conflicts?: ChangesetConflict[] };
  if (!Array.isArray(body?.conflicts)) return result;
  const conflicts = body.conflicts.map((c) =>
    c.now ? { ...c, now: redactCommentAuthorIds([c.now], viewer)[0] ?? null } : c,
  );
  return { ...result, body: { ...body, conflicts } };
}

function respond(result: SubmitResult): Response {
  return json(result.body, { status: result.status });
}
