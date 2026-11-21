// Version history over REST (docs/specs/006-document/version-history.md "API"; blueprint VH9 to VH13):
//   GET  /api/documents/<id>/tabs/<tabId>/versions                         the tab's versions, newest first
//   GET  /api/documents/<id>/tabs/<tabId>/versions/<versionId>             one, with its body as it was
//   POST /api/documents/<id>/tabs/<tabId>/versions                         Name This Version (the current content)
//   PUT  /api/documents/<id>/tabs/<tabId>/versions/<versionId>/name        name, rename or unname one
//   POST /api/documents/<id>/tabs/<tabId>/versions/<versionId>/restore     restore it, as one changeset
//   POST /api/documents/<id>/tabs/<tabId>/versions/<versionId>/copy        Make a Copy, as a new tab
// Looking is every level's (gateRead: a tab link its own tab, never a Community pass); the rest is an Editor's.

import { truncateName } from '@liveknowledge/document';
import { VERSION_NAMED_MAX, type VersionSummary } from '@liveknowledge/api-schema';
import { redactCommentAuthorIds } from '../comments';
import { VERSION_NAMED_EVENT } from '@liveknowledge/document/automations';
import { getDocument, getVersion, listVersions, nameVersion, namedVersionCount } from '../db';
import {
  hearsVersion,
  personWho,
  queueVersionEvent,
} from '../document-room/automations/version-events';
import { nameCurrentVersion } from '../versions/name-current';
import { forbidden, json, notFound } from '../responses';
import { frontDoorOf } from '../changesets/front-door';
import type { DocumentDTO } from '../types';
import { copyVersion } from '../versions/copy';
import { parseVersionBody } from '../versions/restore-tab';
import { restoreVersion } from '../versions/restore';
import { versionTelemetry } from '../versions/telemetry';
import { authorOf, notePageWriteAfter, refreshAfterWrite } from './changesets';
import { agentRewriteRefusal } from './tab-pages-route';
import {
  gateWrite,
  gateRead,
  grantOn,
  missingDocument,
  readOptionalBody,
  requireOwner,
  type DocumentRouteContext,
} from './context';

type Door = 'list' | 'read' | 'name-current' | 'rename' | 'restore' | 'copy';

// Which door the path is, or null when it is not a version route.
function doorOf(segments: readonly string[], method: string): Door | null {
  if (segments[1] !== 'documents' || segments[3] !== 'tabs' || segments[5] !== 'versions')
    return null;
  if (segments.length === 6)
    return method === 'GET' ? 'list' : method === 'POST' ? 'name-current' : null;
  if (segments.length === 7) return method === 'GET' ? 'read' : null;
  if (segments.length !== 8) return null;
  if (segments[7] === 'name' && method === 'PUT') return 'rename';
  if (segments[7] === 'restore' && method === 'POST') return 'restore';
  if (segments[7] === 'copy' && method === 'POST') return 'copy';
  return null;
}

// Null when the path is not a version route.
export async function handleVersionRoutes(ctx: DocumentRouteContext): Promise<Response | null> {
  const { segments } = ctx;
  const door = doorOf(segments, ctx.request.method);
  if (!door) return null;
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const document = await getDocument(ctx.env, segments[2]!);
  if (!document) return missingDocument(ctx, segments[2]!);
  const tabId = segments[4]!;
  const reads = door === 'list' || door === 'read';
  const allowed = reads
    ? await gateRead(ctx, document.id, document.ownerId, document.teamId, tabId)
    : await gateWrite(ctx, document.id, document.ownerId, document.teamId, tabId);
  if (!allowed) return refused(ctx, document, door);
  if (!document.tabs.some((t) => t.id === tabId)) return notFound();
  if (door === 'list') return json({ versions: await listVersions(ctx.env, tabId) });
  if (door === 'name-current') return nameCurrent(ctx, document, tabId, owner);
  const version = await getVersion(ctx.env, tabId, segments[6]!);
  if (!version) return notFound();
  if (door === 'read') {
    const body = parseVersionBody(version.data);
    if (!body) return notFound();
    const tab = { ...body, id: tabId, name: version.tabName };
    // A visitor sees only their own comment author ids, as in a tab read.
    const safe =
      owner === document.ownerId
        ? tab
        : { ...tab, elements: redactCommentAuthorIds(tab.elements, owner) };
    return json({ version: version.summary, tab: safe });
  }
  if (door === 'rename') return rename(ctx, document, tabId, version.summary);
  const author = await authorOf(ctx, owner);
  const tokenId = ctx.token?.id ?? null;
  if (door === 'restore') {
    // A restore rewrites the page's writing: an agent's is refused on a page a person vouched for, as `write_page`.
    const refusal = ctx.token ? agentRewriteRefusal(document, tabId) : null;
    if (refusal) return refusal;
    const result = await restoreVersion({
      env: ctx.env,
      document,
      tabId,
      version,
      author,
      tokenId,
      tokenName: ctx.token?.name ?? null,
    });
    if (result.status === 200 && result.body.restored) {
      ctx.waitUntil?.(versionTelemetry(ctx.env, 'Restored', frontDoorOf(ctx.request)));
      const after = { status: 200, body: { changeset: result.body.restored.changesetId } };
      refreshAfterWrite(ctx, document.id, tabId, author, after);
      await notePageWriteAfter(ctx, tabId, owner, after);
    }
    return json(result.body, { status: result.status });
  }
  // A link confined to one tab never makes a tab (docs/specs/013-workspace/tab-scoped-share-links.md).
  if ((grantOn(ctx, document.id)?.tabScope ?? null) !== null) return forbidden();
  const raw = await readOptionalBody(ctx.request);
  const name = typeof raw.name === 'string' ? raw.name : null;
  const result = await copyVersion({
    env: ctx.env,
    document,
    version,
    name,
    author,
    tokenId,
    tokenName: ctx.token?.name ?? null,
  });
  if (result.status === 201) {
    ctx.waitUntil?.(versionTelemetry(ctx.env, 'Copied', frontDoorOf(ctx.request)));
    // The copy is a new page, made by whoever copied it.
    await notePageWriteAfter(ctx, result.body.tab.id, owner, {
      status: 200,
      body: { changeset: true },
    });
  }
  return json(result.body, { status: result.status });
}

// A tab link on another tab reads the tab as missing (no existence leak), and so does a document read without any
// grant; anyone else below the gate is refused.
function refused(ctx: DocumentRouteContext, document: DocumentDTO, door: Door): Response {
  const grant = grantOn(ctx, document.id);
  const otherTab = grant !== null && grant.tabScope !== null && grant.tabScope !== ctx.segments[4];
  console.info('[versions] refused', { documentId: document.id, door, reason: 'role' });
  if (otherTab || (grant === null && (door === 'list' || door === 'read'))) return notFound();
  return forbidden();
}

// The name a request gives: trimmed and capped; null for no name ("" or null), undefined for a body that names
// nothing a name can be.
function nameOf(raw: Record<string, unknown>): string | null | undefined {
  if (raw.name === null) return null;
  if (typeof raw.name !== 'string') return undefined;
  const name = truncateName(raw.name);
  return name === '' ? null : name;
}

const invalidName = () =>
  json({ error: 'invalid_name', message: 'A version needs a name.' }, { status: 400 });

const tooManyNames = () =>
  json(
    {
      error: 'too_many_names',
      message: `This tab has ${VERSION_NAMED_MAX} named versions. Remove a name from one first.`,
    },
    { status: 409 },
  );

const tabBusy = () =>
  json({ error: 'tab_busy', message: 'The tab kept changing; try again.' }, { status: 409 });

// Name This Version (VH10, VH20), by the path a rule's step takes too (versions/name-current.ts).
async function nameCurrent(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tabId: string,
  owner: string,
): Promise<Response> {
  const name = nameOf(await readOptionalBody(ctx.request));
  if (!name) return invalidName();
  const outcome = await nameCurrentVersion(ctx.env, {
    documentId: document.id,
    tabId,
    name,
    author: () => authorOf(ctx, owner),
    who: (author) => personWho(author, tokenOf(ctx)),
  });
  if (outcome.ok) return json({ version: outcome.version }, { status: 201 });
  if (outcome.reason === 'too_many_names') return tooManyNames();
  return outcome.reason === 'tab_busy' ? tabBusy() : notFound();
}

// The token that asks, for an agent's name on the rules' events; null for a person.
const tokenOf = (ctx: DocumentRouteContext) =>
  ctx.token ? { name: ctx.token.name ?? null } : null;

// A name given, changed or taken off (VH11).
async function rename(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tabId: string,
  current: VersionSummary,
): Promise<Response> {
  const name = nameOf(await readOptionalBody(ctx.request));
  if (name === undefined) return invalidName();
  if (name !== null && current.name === null) {
    if ((await namedVersionCount(ctx.env, tabId)) >= VERSION_NAMED_MAX) return tooManyNames();
  }
  const version = await nameVersion(ctx.env, tabId, current.id, name);
  console.info('[versions] named', { documentId: document.id, tabId, named: name !== null });
  // A name given or changed is a version named, for the document's rules; one taken off is not.
  if (version && name !== null && hearsVersion(ctx.env, VERSION_NAMED_EVENT)) {
    const owner = ctx.resolveOwner();
    if (owner !== null)
      queueVersionEvent(ctx.env, 'named', {
        tab: tabId,
        version: version.id,
        name: version.name,
        who: personWho(await authorOf(ctx, owner), tokenOf(ctx)),
      });
  }
  return json({ version });
}
