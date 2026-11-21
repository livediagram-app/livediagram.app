// Publish to the Web over REST (docs/specs/030-knowledgebase/publishing.md; blueprint publishing.md P1 to P9):
//   GET    /api/documents/<id>/publishing[?root=]   the site as it stands, and what a publish of `root` would show
//   PUT    /api/documents/<id>/publishing           publish, or change what is published
//   DELETE /api/documents/<id>/publishing           unpublish
// Only an Editor of the whole knowledgebase, in person and signed in. Every answer is a `PublishingState`. A write
// names the public paths it changed in `X-Publish-Purge`, which the worker drops from its edge copy and strips
// (public-site.ts purgePublished).
import {
  defaultSiteAddress,
  publishableScope,
  publishingOffered,
  siteAddressRefusal,
  UNTITLED_PAGE,
  withoutEmptyPages,
} from '@liveknowledge/knowledge';
import type { PublishingRequest, PublishingState } from '@liveknowledge/api-schema';
import { readDocumentOutline } from '../document-room/document-content';
import { knowledgeDb } from '../knowledge/knowledge-db';
import { json, methodNotAllowed } from '../responses';
import type { KnowledgeRoute } from '../routes/knowledge-routes';
import {
  dropSite,
  heldSiteAddresses,
  scopePagesOf,
  publishedPaths,
  readSite,
  writeSite,
} from './published-snapshot';
import { siteAddress } from './site-addresses';

/** The header a write's answer names its changed public paths in, JSON. */
export const PUBLISH_PURGE_HEADER = 'X-Publish-Purge';

const refuse = (status: number, error: string, message: string) =>
  json({ error, message }, { status });

const MESSAGES = {
  forbidden: 'Only an Editor of the whole knowledgebase can publish it.',
  needs_a_person: 'A person publishes a knowledgebase, never an agent.',
  sign_in: 'Sign in to publish a knowledgebase.',
  publishing_unavailable: "Publishing isn't available for this knowledgebase.",
} as const;

// Who may: an Editor of the whole knowledgebase (no tab-scoped link), in person, with an account.
function refusal({ ctx, grant }: KnowledgeRoute): Response | null {
  if (ctx.token) return refuse(403, 'needs_a_person', MESSAGES.needs_a_person);
  if (grant.role !== 'edit' || grant.tabScope !== null)
    return refuse(403, 'forbidden', MESSAGES.forbidden);
  if (!ctx.accountUserId) return refuse(403, 'sign_in_required', MESSAGES.sign_in);
  return null;
}

/** The site's state and the preview of `root` (the site's own when none is asked). */
async function stateOf(route: KnowledgeRoute, askedRoot?: string | null): Promise<PublishingState> {
  const { ctx, document } = route;
  const [site, outline, empty] = await Promise.all([
    readSite(ctx.env),
    readDocumentOutline(ctx.env, document.id),
    knowledgeDb(ctx.env)
      .prepare('SELECT tab FROM published_empty')
      .all<{ tab: string }>()
      .then((r) => new Set(r.results.map((row) => row.tab))),
  ]);
  const tabs = scopePagesOf(outline);
  const root = askedRoot !== undefined ? askedRoot : (site?.root ?? null);
  const scope = publishableScope(tabs, root) ?? { pages: [], leftOut: [] };
  const shown = withoutEmptyPages(scope, empty);
  const names = new Map(tabs.map((t) => [t.id, t.name]));
  const title = (id: string) => names.get(id)!.trim() || UNTITLED_PAGE;
  return {
    offered: publishingOffered({ ownerId: document.ownerId, teamId: document.teamId }),
    published: site !== null,
    site: site
      ? {
          address: site.address,
          url: `${ctx.url.origin}/kb/${site.address}`,
          root: site.root,
          noindex: site.noindex,
          showWriters: site.showWriters,
          publishedAt: site.publishedAt,
        }
      : null,
    defaultAddress: site?.address ?? defaultSiteAddress(document.name),
    preview: {
      root,
      pages: shown.pages.map((p) => ({ id: p.id, title: title(p.id) })),
      leftOut: shown.leftOut.map((l) => ({ id: l.id, title: title(l.id), reason: l.reason })),
    },
  };
}

const withPurge = (state: PublishingState, paths: readonly string[], status = 200) =>
  json(state, {
    status,
    headers: { [PUBLISH_PURGE_HEADER]: JSON.stringify([...new Set(paths)]) },
  });

function parseRequest(body: unknown): PublishingRequest | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.address !== 'string') return null;
  if (b.root !== null && typeof b.root !== 'string') return null;
  if (typeof b.noindex !== 'boolean' || typeof b.showWriters !== 'boolean') return null;
  return { address: b.address, root: b.root, noindex: b.noindex, showWriters: b.showWriters };
}

async function handlePublish(route: KnowledgeRoute): Promise<Response> {
  const { ctx, document } = route;
  const body = parseRequest(await ctx.request.json().catch(() => null));
  if (!body)
    return refuse(400, 'invalid_body', 'Send address, root, noindex and showWriters.');
  const bad = siteAddressRefusal(body.address);
  if (bad)
    return refuse(
      400,
      bad,
      bad === 'address_reserved'
        ? 'That address is kept for liveknowledge. Choose another.'
        : 'An address is 3 to 48 lowercase letters, numbers and single hyphens.',
    );
  const outline = await readDocumentOutline(ctx.env, document.id);
  const scope = publishableScope(scopePagesOf(outline), body.root);
  if (!scope) return refuse(400, 'invalid_root', 'That page is not in this knowledgebase.');
  if (scope.pages.length === 0)
    return refuse(409, 'nothing_to_publish', 'No page in it can be published yet.');

  const site = await readSite(ctx.env);
  const before = site ? await publishedPaths(ctx.env) : [];
  if (site?.address !== body.address) {
    const claimed = await siteAddress(ctx.env, body.address, {
      kind: 'claim',
      documentId: document.id,
    });
    if (claimed === 'taken')
      return refuse(409, 'address_taken', 'Another knowledgebase has that address.');
    // Every address the site had before now points readers to the new one (P6).
    const held = await heldSiteAddresses(ctx.env);
    await Promise.all(
      held
        .filter((a) => a !== body.address)
        .map((a) =>
          siteAddress(ctx.env, a, { kind: 'move', documentId: document.id, to: body.address }),
        ),
    );
  }
  const now = Date.now();
  await writeSite(ctx.env, document.id, body, ctx.accountUserId!, now);
  console.info('[publishing] published', {
    documentId: document.id,
    first: site === null,
    section: body.root !== null,
    noindex: body.noindex,
  });
  return withPurge(await stateOf(route), [...before, ...(await publishedPaths(ctx.env))]);
}

async function handleUnpublish(route: KnowledgeRoute): Promise<Response> {
  const { ctx, document } = route;
  const site = await readSite(ctx.env);
  if (!site) return json(await stateOf(route, null));
  const [paths, held] = await Promise.all([
    publishedPaths(ctx.env),
    heldSiteAddresses(ctx.env),
  ]);
  // The registry first: once an address is let go, no reader reaches this knowledgebase through it.
  await Promise.all(
    held.map((a) => siteAddress(ctx.env, a, { kind: 'release', documentId: document.id })),
  );
  await dropSite(ctx.env);
  console.info('[publishing] unpublished', { documentId: document.id });
  return withPurge(await stateOf(route, null), paths);
}

/** Null when the path is not `/api/documents/<id>/publishing`. */
export async function handlePublishingRoutes(route: KnowledgeRoute): Promise<Response | null> {
  const { ctx, document } = route;
  // isKnowledgePath lets `publishing` through at four segments alone.
  if (ctx.segments[3] !== 'publishing') return null;
  const refused = refusal(route);
  if (refused) return refused;
  const method = ctx.request.method;
  if (method !== 'GET' && method !== 'PUT' && method !== 'DELETE') return methodNotAllowed();
  if (method === 'GET') {
    const asked = ctx.url.searchParams.get('root');
    return json(await stateOf(route, asked === null ? undefined : asked || null));
  }
  // Unpublish is always allowed, so a site can come down even if publishing stops being offered.
  if (method === 'DELETE') return handleUnpublish(route);
  if (!publishingOffered({ ownerId: document.ownerId, teamId: document.teamId }))
    return refuse(403, 'publishing_unavailable', MESSAGES.publishing_unavailable);
  return handlePublish(route);
}
