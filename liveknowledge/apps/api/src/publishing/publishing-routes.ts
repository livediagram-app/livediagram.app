// Publish to the Web over REST (docs/specs/030-knowledgebase/publishing.md; blueprint publishing.md P1 to P9):
//   GET    /api/documents/<id>/publishing[?root=]   the site as it stands, and what a publish of `root` would show
//   PUT    /api/documents/<id>/publishing           publish, or change what is published
//   DELETE /api/documents/<id>/publishing           unpublish
// Only an Editor of the whole knowledgebase, in person and signed in. Every answer is a `PublishingState`. With Pro
// on, a publish first claims a place of the owner's Public Knowledgebases (published-gauge.ts, spec "Tiers"). A write
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
import type {
  PublishingRequest,
  PublishingState,
  PublishingTierSaid,
} from '@liveknowledge/api-schema';
import { refusedByService, tierRefusal, type GaugeResult } from '@liveworkspace/subscription';
import { readDocumentOutline } from '../document-room/document-content';
import { knowledgeDb } from '../knowledge/knowledge-db';
import { workerTierOf, type WorkerTier } from '../knowledge/tier-limits';
import { json, methodNotAllowed } from '../responses';
import type { KnowledgeRoute } from '../routes/knowledge-routes';
import {
  claimSite,
  countSite,
  markOfClaim,
  releaseSite,
  SITE_GAUGE,
  siteServes,
} from './published-gauge';
import {
  dropSite,
  heldSiteAddresses,
  scopePagesOf,
  publishedPaths,
  readSite,
  writeSite,
  type PublishedSiteRow,
} from './published-snapshot';
import { siteAddress } from './site-addresses';

/** The header a write's answer names its changed public paths in, JSON. */
export const PUBLISH_PURGE_HEADER = 'X-Publish-Purge';

const refuse = (status: number, error: string, message: string, more: object = {}) =>
  json({ error, message, ...more }, { status });

const MESSAGES = {
  forbidden: 'Only an Editor of the whole knowledgebase can publish it.',
  needs_a_person: 'A person publishes a knowledgebase, never an agent.',
  sign_in: 'Sign in to publish a knowledgebase.',
  publishing_unavailable: "Publishing isn't available for this knowledgebase.",
  publish_limit_reached:
    'Every knowledgebase this owner may publish is published. Unpublish one to publish this.',
} as const;

// Who may: an Editor of the whole knowledgebase (no tab-scoped link), in person, with an account.
function refusal({ ctx, grant }: KnowledgeRoute): Response | null {
  if (ctx.token) return refuse(403, 'needs_a_person', MESSAGES.needs_a_person);
  if (grant.role !== 'edit' || grant.tabScope !== null)
    return refuse(403, 'forbidden', MESSAGES.forbidden);
  if (!ctx.accountUserId) return refuse(403, 'sign_in_required', MESSAGES.sign_in);
  return null;
}

/** What the state says of the tier, with Pro on (spec "Tiers"): the limit, what the owner holds when a claim
 *  answered, and the owner to offer an upgrade for (or `guest`). Nothing with Pro off. */
function tierSaid(
  tier: WorkerTier | null,
  claim: GaugeResult | null,
  served: boolean,
): PublishingTierSaid {
  if (!tier?.on || (!tier.owner && !tier.guest)) return {};
  const limit = tier.limit(SITE_GAUGE, null);
  if (tier.guest) return { usage: { used: served ? 1 : 0, limit }, guest: true };
  const used = claim && !claim.unmetered ? claim.used : undefined;
  return { usage: { ...(used !== undefined ? { used } : {}), limit }, owner: tier.owner! };
}

/** The site's state and the preview of `root` (the site's own when none is asked). With Pro on, a site that holds
 *  no counted place reads as not published; `said` is what the tier adds. */
async function stateOf(
  route: KnowledgeRoute,
  askedRoot?: string | null,
  tier: WorkerTier | null = null,
  said: PublishingTierSaid = {},
): Promise<PublishingState> {
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
  const live = site && siteServes(tier, site.counted) ? site : null;
  const root = askedRoot !== undefined ? askedRoot : (site?.root ?? null);
  const scope = publishableScope(tabs, root) ?? { pages: [], leftOut: [] };
  const shown = withoutEmptyPages(scope, empty);
  const names = new Map(tabs.map((t) => [t.id, t.name]));
  const title = (id: string) => names.get(id)!.trim() || UNTITLED_PAGE;
  return {
    offered: publishingOffered({ ownerId: document.ownerId, teamId: document.teamId }),
    published: live !== null,
    site: live
      ? {
          address: live.address,
          url: `${ctx.url.origin}/kb/${live.address}`,
          root: live.root,
          noindex: live.noindex,
          showWriters: live.showWriters,
          publishedAt: live.publishedAt,
        }
      : null,
    defaultAddress: site?.address ?? defaultSiteAddress(document.name),
    preview: {
      root,
      pages: shown.pages.map((p) => ({ id: p.id, title: title(p.id) })),
      leftOut: shown.leftOut.map((l) => ({ id: l.id, title: title(l.id), reason: l.reason })),
    },
    ...said,
  };
}

/** The GET: with Pro on, the site counted again on the dialog's first read (no `root` asked), so a site from before
 *  takes its place and the owner's count is known; a preview of another section asks nothing. */
async function handleRead(route: KnowledgeRoute, asked: string | null | undefined) {
  const tier = await workerTierOf(route.ctx.env, route.document);
  if (!tier?.on) return json(await stateOf(route, asked));
  const counted =
    asked === undefined
      ? await countSite(route.ctx.env, tier, route.document.id)
      : await readSite(route.ctx.env).then((site) =>
          site ? { claim: null, counted: site.counted } : null,
        );
  const served = counted !== null && siteServes(tier, counted.counted);
  return json(await stateOf(route, asked, tier, tierSaid(tier, counted?.claim ?? null, served)));
}

/**
 * With Pro on, a place for a site that holds none (a first publish, or one refused before), claimed before anything
 * is written. A Response is the refusal at the limit; otherwise the claim and the mark to write (undefined: leave
 * it). The service refusing the request itself is this api's fault to answer for, never a limit to offer.
 */
async function placeFor(
  route: KnowledgeRoute,
  tier: WorkerTier | null,
  site: PublishedSiteRow | null,
): Promise<Response | { claim: GaugeResult | null; counted?: boolean | null }> {
  if (!tier?.on || (site && siteServes(tier, site.counted))) return { claim: null };
  const claim = await claimSite(tier, route.document.id);
  if (claim && refusedByService(claim))
    throw new Error('the subscription service refused the publish claim');
  if (claim && !claim.ok && claim.limit !== null) {
    console.info('[publishing] refused', { reason: 'tier_limit' });
    return refuse(
      409,
      'publish_limit_reached',
      MESSAGES.publish_limit_reached,
      tierRefusal(tier, SITE_GAUGE, claim.used, claim.limit),
    );
  }
  // Counted where the service (or a guest's knowledgebase itself) said so; one it could not be asked about is
  // claimed at the next count.
  return { claim, counted: markOfClaim(claim) };
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
  if (!body) return refuse(400, 'invalid_body', 'Send address, root, noindex and showWriters.');
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
  const tier = await workerTierOf(ctx.env, document);
  const place = await placeFor(route, tier, site);
  if (place instanceof Response) return place;
  try {
    return await publishSite(route, body, site, tier, place);
  } catch (error) {
    // Nothing was published: the place claimed for it goes back.
    if (place.counted === true) await releaseSite(tier!, document.id);
    throw error;
  }
}

async function publishSite(
  route: KnowledgeRoute,
  body: PublishingRequest,
  site: PublishedSiteRow | null,
  tier: WorkerTier | null,
  place: { claim: GaugeResult | null; counted?: boolean | null },
): Promise<Response> {
  const { ctx, document } = route;
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
  await writeSite(ctx.env, document.id, body, ctx.accountUserId!, now, place.counted);
  console.info('[publishing] published', {
    documentId: document.id,
    first: site === null,
    section: body.root !== null,
    noindex: body.noindex,
  });
  return withPurge(await stateOf(route, undefined, tier, tierSaid(tier, place.claim, true)), [
    ...before,
    ...(await publishedPaths(ctx.env)),
  ]);
}

async function handleUnpublish(route: KnowledgeRoute): Promise<Response> {
  const { ctx, document } = route;
  const site = await readSite(ctx.env);
  const tier = await workerTierOf(ctx.env, document);
  const said = tierSaid(tier, null, false);
  // Given back whether or not a site is there: taking off a key that is not there changes nothing.
  if (!site) {
    if (tier?.on) await releaseSite(tier, document.id);
    return json(await stateOf(route, null, tier, said));
  }
  const [paths, held] = await Promise.all([publishedPaths(ctx.env), heldSiteAddresses(ctx.env)]);
  // The registry first: once an address is let go, no reader reaches this knowledgebase through it.
  await Promise.all(
    held.map((a) => siteAddress(ctx.env, a, { kind: 'release', documentId: document.id })),
  );
  await dropSite(ctx.env);
  if (tier?.on) await releaseSite(tier, document.id);
  console.info('[publishing] unpublished', { documentId: document.id });
  return withPurge(await stateOf(route, null, tier, said), paths);
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
    return handleRead(route, asked === null ? undefined : asked || null);
  }
  // Unpublish is always allowed, so a site can come down even if publishing stops being offered.
  if (method === 'DELETE') return handleUnpublish(route);
  if (!publishingOffered({ ownerId: document.ownerId, teamId: document.teamId }))
    return refuse(403, 'publishing_unavailable', MESSAGES.publishing_unavailable);
  return handlePublish(route);
}
