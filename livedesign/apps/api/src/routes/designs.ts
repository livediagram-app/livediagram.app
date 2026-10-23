// /api/designs — design metadata, per-tab content, copy, folder
// assignment, tab linking, comments, share links, the realtime WS
// upgrade. The largest resource: every sub-path
// under a design id lives here.

import type { Tab } from '@livedesign/design';
import { isValidTab, migrateIncomingTab } from '@livedesign/design';
import { capStoredName } from '../names';
import {
  MAX_DECK_LEN,
  MAX_TAB_BYTES,
  TabTooLargeError,
  logTabRefused,
  tabDataBytes,
} from '../limits';
import {
  DESIGN_CONVERSION_HEADER,
  INTENT_INVALID,
  MARK_USED_INVALID,
  readCreationIntent,
  readDesignConversion,
  readMarkUsed,
  TEAM_RECENT_INCLUDE,
  TEAM_RECENT_LIMIT,
  type CreationIntent,
} from '@livedesign/api-schema';
import {} from '../comments';
import {
  copyDesign,
  getDesign,
  getDesignThumbMeta,
  getTrashedDesignMeta,
  countDesignsByOwner,
  getParticipant,
  listDesignsByOwner,
  listRecentTeamDesigns,
  listSharedWith,
  readReorderEntries,
  reorderTabs,
  seedTabs,
  setDesignPresentation,
  tabIdsHeldElsewhere,
  upsertDesignMeta,
} from '../db';
import {
  badRequest,
  designTrashed,
  forbidden,
  json,
  notFound,
  payloadTooLarge,
  svgImage,
} from '../responses';
import { designDates, isDesignSource } from '@livedesign/api-schema';
import { designImageSvg } from '../design-image';
import { redactDesignForReader, redactDesignForScope } from '../redact-design';
import { answerOverview, parseViewQuery } from './design-views-route';
import { emailEnabled } from '../email/client';
import { notifyMilestone } from '../email/notifications';
import {
  recordDesignCreated,
  recordDesignDuplicated,
  recordDesignSynced,
  recordVisitorCopied,
} from '../timeline';
import { handleDesignDelete } from './design-delete-route';
import { handleDesignPlacement } from './design-placement-route';
import { handleDesignSharedTabs } from './design-shared-tabs-route';
import { forkTakenTabIds } from '../tab-id-fork';
import { relayDesignRename } from '../room-client';
import { handleDesignRoomRoutes } from './design-room-routes';
import { handleDesignSubresources } from './design-subresource-routes';
import { compileSeededTabs } from './design-seed';
import { parsePlacement, resolvePlacement } from '../placement/resolve-placement';
import { placementLookups } from '../placement/placement-lookups';
import {
  logDefaultSkipped,
  logPlacementRejected,
  logPlacementResolved,
  logPlacementSkipped,
  placementScope,
} from '../placement/placement-log';
import { intentRejected, placementRejected } from '../placement/placement-response';
import type { DesignDTO } from '../types';
import {
  gateEdit,
  gateGrant,
  missingDesign,
  requireOwner,
  shareCodeOf,
  sharePasswordOf,
  type RouteContext,
  readBody,
} from './context';
import { sharePasswordOk } from '../auth/share-access';

export async function handleDesigns(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'designs') return notFound();
  if (segments.length === 2) {
    if (request.method === 'GET') {
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      // `?include=team-recent` (docs/specs/019-marketing/returning-visitor.md): the newest designs of
      // the teams the caller has joined, for their recent diagrams. Membership is read from the
      // verified account only, never the guest header, which anyone can set to any id.
      if (ctx.url.searchParams.get('include') === TEAM_RECENT_INCLUDE) {
        const [liveDocs, teamRecent] = await Promise.all([
          listDesignsByOwner(env, owner),
          ctx.verifiedUserId
            ? listRecentTeamDesigns(env, ctx.verifiedUserId, TEAM_RECENT_LIMIT)
            : [],
        ]);
        return json({ designs: liveDocs, teamRecent });
      }
      const liveDocs = await listDesignsByOwner(env, owner);
      return json({ designs: liveDocs });
    }
    if (request.method === 'POST') {
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read as Omit<Partial<DesignDTO>, 'tabs'> & {
        tabs?: Tab[];
        intent?: unknown;
        markUsed?: unknown;
      };
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      if (!body.id || typeof body.name !== 'string') {
        return badRequest('missing id/name');
      }
      // The design's own dates (docs/specs/015-api/api.md "Design dates"), refused whole when
      // invalid, before anything is written.
      const dates = designDates(body, Date.now());
      if (!dates.ok) return badRequest('invalid design dates');
      // Placement (docs/specs/013-workspace/folders.md "Placement on create"): read up front so a
      // malformed one is refused before anything else is looked at.
      const requested = parsePlacement(body);
      if (!requested) {
        logPlacementRejected('placement_invalid', placementScope(body.teamId));
        return placementRejected('placement_invalid');
      }
      // Seeded tabs given as a template are compiled first (docs/specs/015-api/api.md);
      // with no intent given, the first compiled tab supplies it, as the MCP derives it.
      let derivedIntent: CreationIntent | null = null;
      if (Array.isArray(body.tabs)) {
        const seed = compileSeededTabs(body.tabs, body.id);
        if ('refusal' in seed) return json(seed.refusal.body, { status: seed.refusal.status });
        body.tabs = seed.tabs as Tab[];
        derivedIntent = seed.intent;
      }
      // The creation intent (docs/specs/013-workspace/default-folders.md): which default folder a
      // create at the root of My Work lands in. Malformed, it refuses the create.
      const intent =
        body.intent === undefined && derivedIntent
          ? { ok: true as const, intent: derivedIntent }
          : readCreationIntent(body.intent);
      if (!intent.ok) {
        logPlacementRejected(INTENT_INVALID, placementScope(body.teamId));
        return intentRejected();
      }
      // Whether making it is a use (docs/specs/015-api/api.md "Marking a design used"): absent
      // counts; anything but a boolean refuses the create before anything is written.
      const making = readMarkUsed(body.markUsed);
      if (!making.ok) {
        console.warn('designs: rejected reason=mark_used_invalid');
        return badRequest(MARK_USED_INVALID);
      }
      // Validate any seeded tabs up front (structure + per-tab byte cap) so a
      // create can't smuggle a malformed / oversized tab past the tab gate.
      if (Array.isArray(body.tabs)) {
        // Former stored shapes (an offline sync, an API-token script) are
        // migrated before validation, as every tab read migrates them (docs/specs/015-api/api.md).
        body.tabs = body.tabs.map((tab) => migrateIncomingTab(tab) as Tab);
        for (const tab of body.tabs) {
          if (!isValidTab(tab)) return badRequest('invalid tab');
          // The cap D1's row sets (docs/specs/015-api/api.md "Tab size"), measured as stored,
          // before anything is written, so a create never leaves a design without its tabs.
          const bytes = tabDataBytes(tab);
          if (bytes > MAX_TAB_BYTES) {
            logTabRefused('create', tab.id, bytes);
            return payloadTooLarge();
          }
        }
      }
      // Ownership guard (security): upsertDesignMeta is INSERT ... ON
      // CONFLICT(id) DO UPDATE owner_id = excluded.owner_id, so a POST with an
      // id that already exists under a DIFFERENT owner would silently transfer
      // ownership to the caller. Design ids are unguessable UUIDs but they
      // leak to every share-link visitor / team member, so refuse the create
      // when the id is already owned by someone else (legitimate updates go
      // through PUT, which gates on edit access).
      const clash = await getDesign(env, body.id);
      if (clash && clash.ownerId !== owner) return forbidden();
      // The name cap (docs/specs/006-design/name-length.md): shortened here,
      // whoever the caller. A re-commit of the caller's own id compares against
      // what it already stores, so an unchanged pre-cap name is kept.
      const name = capStoredName(body.name, clash?.name ?? null, 'design');
      if (!name) return badRequest('missing id/name');
      const incomingTabs: Tab[] | null = Array.isArray(body.tabs)
        ? body.tabs.map((tab) => ({
            ...tab,
            name: capStoredName(
              tab.name,
              clash?.tabs.find((t) => t.id === tab.id)?.name ?? null,
              'tab',
            ),
          }))
        : null;
      // An id in the Trash is taken just the same (docs/specs/013-workspace/trash.md):
      // its owner hears the deleted state, anyone else the same refusal.
      const binned = clash ? null : await getTrashedDesignMeta(env, body.id);
      if (binned) return binned.ownerId === owner ? designTrashed() : forbidden();
      if (typeof body.presentation === 'string' && body.presentation.length > MAX_DECK_LEN) {
        return badRequest('presentation too large');
      }
      // Where the design is filed, decided before the write and written by it
      // (docs/specs/013-workspace/folders.md "Placement on create"). An invalid placement refuses
      // the create by name; it never files the design somewhere else. A re-commit of the
      // caller's own id keeps the placement it already has.
      let placement = { teamId: clash?.teamId ?? null, folderId: clash?.folderId ?? null };
      if (clash) {
        logPlacementSkipped();
      } else {
        const outcome = await resolvePlacement(
          requested,
          { ownerId: owner, verifiedUserId: ctx.verifiedUserId },
          placementLookups(env),
          intent.intent,
        );
        if (!outcome.ok) {
          logPlacementRejected(outcome.rejection, placementScope(requested.teamId));
          return placementRejected(outcome.rejection);
        }
        for (const skip of outcome.skipped) logDefaultSkipped(skip);
        logPlacementResolved(outcome.placement, outcome);
        placement = outcome.placement;
      }
      // A seeded tab whose id another design holds is created under a fresh
      // id, never upserted over it: that is how a synced-back offline copy of a
      // shared tab forks (docs/specs/006-design/offline-mode.md), and why a
      // create can't rewrite someone else's tab by naming its id.
      const seeded = incomingTabs
        ? forkTakenTabIds(
            incomingTabs,
            typeof body.presentation === 'string' ? body.presentation : null,
            await tabIdsHeldElsewhere(
              env,
              body.id,
              incomingTabs.map((t) => t.id),
            ),
          )
        : null;
      // Only a genuine create takes the body's dates: a re-commit keeps the stored created date
      // (the upsert never rewrites it) and is modified now.
      const savedAt = clash ? Date.now() : dates.savedAt;
      // Design meta first so the FK in tabs can resolve.
      await upsertDesignMeta(env, {
        id: body.id,
        ownerId: owner,
        name,
        shareable: body.shareable ?? false,
        shareCode: body.shareCode ?? null,
        folderId: placement.folderId,
        teamId: placement.teamId,
        // Usually none. An Offline Mode sync carries the deck it built
        // offline (docs/specs/006-design/offline-mode.md), which would otherwise be lost with the local copy.
        presentation:
          seeded?.presentation ??
          (typeof body.presentation === 'string' ? body.presentation : null),
        // Provenance (docs/specs/013-workspace/folders.md): only the closed set of generated sources
        // is accepted; anything else (or absent) is a user-made design.
        source: isDesignSource(body.source) ? body.source : null,
        savedAt,
        createdAt: dates.createdAt,
        // The creation intent, recorded once (docs/specs/013-workspace/default-folders.md
        // "Recorded intent"); null without one. A re-commit's upsert never rewrites it.
        opensIn: intent.intent?.mode ?? null,
        tabKind: intent.intent?.tabKind ?? null,
      });
      // Seed tabs if the caller provided them. The live app's
      // welcome flow uses this when it commits a fresh design
      // id — it ships the templated tab inline so the very
      // first per-tab fetch already has data.
      if (seeded) {
        try {
          await seedTabs(env, body.id, seeded.tabs, savedAt);
        } catch (error) {
          if (error instanceof TabTooLargeError) return payloadTooLarge();
          throw error;
        }
      }
      const liveDoc = await getDesign(env, body.id);
      // docs/specs/013-workspace/timeline.md §4.2: only a GENUINE create earns a timeline event. A
      // POST that resolved to an existing row is the editor re-committing
      // an id it already owns, and "Diagram Created" twice for one
      // design is a lie the feed can't walk back.
      if (liveDoc && !clash) {
        // A sync (docs/specs/006-design/offline-mode.md) is a POST like any other, so the editor declares it:
        // undeclared, moving a design from this browser INTO the account was
        // reported as a design being created for the first time.
        const conversion = readDesignConversion(request.headers.get(DESIGN_CONVERSION_HEADER));
        if (conversion === 'sync') {
          ctx.waitUntil?.(recordDesignSynced(env, liveDoc, owner));
        } else {
          // Making it is a use of it for its maker, unless the create said not (a bulk import):
          // docs/specs/013-workspace/explorer-home.md "Making a design".
          console.info(`home: making doc=${liveDoc.id} marked=${making.markUsed}`);
          ctx.waitUntil?.(
            recordDesignCreated(env, liveDoc, owner, { markUsed: making.markUsed }),
          );
        }
      }
      // docs/specs/014-identity/transactional-email.md (#6): on a genuine create (no prior row), check for a design
      // milestone. Count + send run in the background, off the response path.
      if (emailEnabled(env) && !clash) {
        ctx.waitUntil?.(
          countDesignsByOwner(env, owner).then((count) => notifyMilestone(env, owner, count)),
        );
      }
      return json({ design: liveDoc }, { status: 201 });
    }
  }

  // /api/designs/<id>
  if (segments.length === 3) {
    const id = segments[2]!;
    if (request.method === 'GET') {
      // Read access (docs/specs/013-workspace/team-shared-designs.md): the owner, a valid share-code visitor,
      // OR a joined member of the design's team — the same gate the
      // tab-content read below uses, so a team member can open a team
      // design by raw id (not just via a share link). A miss returns
      // 404 (not 403) so a guessed UUID can't probe existence.
      const view = parseViewQuery(new URL(request.url), 'design');
      if (view instanceof Response) return view;
      const d = await getDesign(env, id);
      if (!d) return missingDesign(ctx, id);
      const grant = await gateGrant(ctx, id, d.ownerId, d.teamId);
      // Redacted for every non-owner, exactly as the share-code resolver
      // does (docs/specs/014-identity/auth-and-guest-access.md): the gate above admits any valid share code, view
      // or edit, so this is the same audience — and a guest owner's id IS
      // their credential. This door was returning it intact while the
      // share door blanked it. See redact-design.ts.
      // A tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) sees the other tabs locked.
      if (!grant) return notFound();
      const reader = redactDesignForReader(d, ctx.resolveOwner());
      const liveDoc = redactDesignForScope(reader, grant.tabScope);
      // The overview view (docs/specs/024-agents/design-views.md), after the same gate and scope.
      if (view) return answerOverview(ctx, view, liveDoc, grant.tabScope);
      return json({ design: liveDoc });
    }
    if (request.method === 'PUT') {
      // Metadata-only PUT now that tabs live in their own table.
      // Body: { name?, tabIds?, tabs? } — name renames the design;
      // `tabs` (preferred, docs/specs/006-design/tab-folders.md) reorders AND sets each tab's
      // per-design folder; `tabIds` is the legacy folder-less shape,
      // still accepted for older clients. All optional, at least one
      // must be present.
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read as {
        name?: string;
        tabIds?: unknown;
        tabs?: unknown;
        // Slide deck (docs/specs/012-collaboration/presentation-mode.md): serialised StoredPresentation, or null to
        // clear. Absent leaves the stored deck alone, so an ordinary rename
        // can never wipe it.
        presentation?: string | null;
      };
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const existing = await getDesign(env, id);
      // Unknown id: 404. This PUT used to create-on-first-write (the legacy
      // localStorage-sync model), which let any stray meta write mint a
      // permanent zero-tab ghost row, e.g. a client path that missed the
      // Offline Mode dispatch (docs/specs/006-design/offline-mode.md) writing an offline design's id to
      // the server. Designs are only ever created via POST /designs now.
      if (!existing) return missingDesign(ctx, id);
      const now = Date.now();
      const ownerId = existing.ownerId;
      // Anyone with the design id could previously rewrite it.
      // We now gate on canEditDesign so only the owner or an
      // edit-role share visitor can touch metadata.
      const allowed = await gateEdit(ctx, id, ownerId, existing.teamId);
      if (!allowed) return forbidden();
      // The tab order, read whole before anything is written: one malformed entry refuses the request, rename and
      // all. Prefer the folder-carrying `tabs` shape; fall back to the legacy `tabIds` (treated as loose) so older
      // clients keep working.
      const order = Array.isArray(body.tabs)
        ? readReorderEntries(body.tabs)
        : Array.isArray(body.tabIds)
          ? readReorderEntries(body.tabIds)
          : undefined;
      if (order === null) return badRequest('invalid tabs');
      // A rename meets the name cap (docs/specs/006-design/name-length.md); a
      // name echoed back unchanged (a reorder) is kept even if it predates it.
      const name =
        typeof body.name === 'string'
          ? capStoredName(body.name, existing.name, 'design')
          : existing.name;
      if (!name) return badRequest('missing name');
      await upsertDesignMeta(env, {
        id,
        ownerId,
        name,
        shareable: existing.shareable,
        shareCode: existing.shareCode ?? null,
        folderId: existing.folderId ?? null,
        teamId: existing.teamId ?? null,
        // Preserve provenance (the upsert never rewrites it anyway, but
        // pass the existing value so the DTO is complete).
        source: existing.source ?? null,
        // The deck has its own write below; the meta upsert never touches it.
        presentation: existing.presentation ?? null,
        savedAt: now,
        createdAt: existing.createdAt,
      });
      // Only when the caller actually sent the field: `undefined` means "not
      // my business", which is what every existing client sends.
      if (body.presentation !== undefined) {
        if (typeof body.presentation === 'string' && body.presentation.length > MAX_DECK_LEN) {
          return badRequest('presentation too large');
        }
        await setDesignPresentation(env, id, body.presentation);
      }
      if (order) await reorderTabs(env, id, order);
      const liveDoc = await getDesign(env, id);
      // An agent's rename reaches the open editors (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab
      // renames"); an editor sends its own rename to the room itself.
      if (ctx.token && liveDoc && name !== existing.name)
        ctx.waitUntil?.(relayDesignRename(env, id, liveDoc.name, liveDoc.tabs));
      // A rename is not a timeline moment (docs/specs/013-workspace/timeline.md §4.2): the feed reads
      // every design's CURRENT name instead, so older entries follow it.
      // Redacted like the GET: an edit-role share visitor passes gateEdit, and
      // a guest owner's id is a credential (see redact-design.ts).
      return json({ design: liveDoc ? redactDesignForReader(liveDoc, owner) : liveDoc });
    }
    if (request.method === 'DELETE') {
      // Trash, permanent delete and Take Offline: design-delete-route.ts
      // (docs/specs/013-workspace/trash.md).
      return handleDesignDelete(ctx, id);
    }
  }

  // /api/designs/<id>/copy — duplicate this design into the
  // caller's own files. Accepted from (a) the owner — same as
  // any other "duplicate" path; (b) a visitor with an active
  // `shared_with` row for the source; (c) a visitor providing
  // a valid X-Share-Code for the source. Skips share_links on the
  // copy by design (docs/specs/014-identity/auth-and-guest-access.md) so
  // the new design reads as the visitor's own clean workspace.
  if (segments.length === 4 && segments[3] === 'copy') {
    const id = segments[2]!;
    if (request.method === 'POST') {
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const source = await getDesign(env, id);
      if (!source) return missingDesign(ctx, id);
      // Authorisation: any of (a) owner, (b) holder of any
      // share code (view or edit) for this design, (c)
      // visitor with an active shared_with row for the source.
      // The owner + share-code legs are exactly canReadDesign
      // (view-role visitors can fork their own copy, so this
      // is a read check, not an edit check). The third leg is
      // copy-specific so it stays inline.
      //
      // Either way a tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) copies their tab
      // only: the share-code leg carries the link's scope, the shared_with
      // leg the scope recorded on their last visit.
      let scope: { tabScope: string | null } | null = await gateGrant(
        ctx,
        id,
        source.ownerId,
        source.teamId,
      );
      if (!scope) {
        const sharedRow = (await listSharedWith(env, owner)).find((s) => s.id === id);
        // A past visit is no way round the design's share password
        // (docs/specs/013-workspace/share-password.md): it must be given here as on every share-link read.
        if (sharedRow && (await sharePasswordOk(env, id, sharePasswordOf(request))))
          scope = { tabScope: sharedRow.tabId };
      }
      if (!scope) return forbidden();
      // A body is optional here, and a JSON `null` is as good as none.
      const body = ((await request.json().catch(() => null)) ?? {}) as {
        name?: unknown;
      };
      const newId = crypto.randomUUID();
      // The copy's name meets the name cap (docs/specs/006-design/name-length.md),
      // including the default, which a long source name pushes past it.
      const requested =
        typeof body.name === 'string' ? capStoredName(body.name, null, 'design') : '';
      const newName = requested || capStoredName(`Copy of ${source.name}`, null, 'design');
      const copy = await copyDesign(
        env,
        id,
        newId,
        owner,
        newName,
        scope.tabScope,
        // Anyone but the owner copies the comments as the tab read serves them to them.
        owner === source.ownerId ? null : owner,
      );
      if (!copy) return notFound();
      // A copy is one design made on purpose: always a use (docs/specs/015-api/api.md "Marking a
      // design used").
      ctx.waitUntil?.(recordDesignDuplicated(env, copy, source.name, owner, { markUsed: true }));
      // A copy taken by someone who came in through a share link is news the
      // owner wants: their shared design was worth forking.
      //
      // Same gate as the visitor-open event, for the same reason: the copy
      // route's read check admits joined team members, who present no share
      // code, and telling an owner that a teammate duplicating a team-library
      // design was "copied by a visitor" is simply untrue.
      if (owner !== source.ownerId && shareCodeOf(request) !== null) {
        ctx.waitUntil?.(
          getParticipant(env, owner).then((p) =>
            recordVisitorCopied(env, source, owner, p?.name ?? null),
          ),
        );
      }
      return json({ design: copy }, { status: 201 });
    }
  }

  // /api/designs/<id>/folder — placement (docs/specs/013-workspace/folders.md + docs/specs/013-workspace/team-shared-designs.md); the
  // scope-change policy lives in design-placement-route.ts.
  {
    const placementResp = await handleDesignPlacement(ctx);
    if (placementResp) return placementResp;
  }

  // /api/designs/<id>/shared-tabs — what a delete leaves behind in other
  // designs (docs/specs/006-design/tab-design-many-to-many.md).
  {
    const sharedTabsResp = await handleDesignSharedTabs(ctx);
    if (sharedTabsResp) return sharedTabsResp;
  }

  // /api/designs/<id>/thumbnail — cached SVG snapshot (docs/specs/006-design/design-snapshots.md). Read-
  // gated exactly like GET /api/designs/<id>: the owner, a joined team
  // member, or a valid share-code visitor. A native <img> can't send
  // auth headers, so the live app fetches this with headers and wraps
  // the bytes in a blob URL; a miss (no design, no read access, no R2
  // binding, empty design) is a 404 the row turns into its icon.
  if (segments.length === 4 && segments[3] === 'thumbnail') {
    const id = segments[2]!;
    if (request.method === 'GET') {
      // One query for the gate AND the cache-freshness check: this runs for
      // every preview in the Explorer grid, so its D1 round trips are the
      // floor on how fast a card can paint.
      const d = await getDesignThumbMeta(env, id);
      if (!d) return notFound();
      const grant = await gateGrant(ctx, id, d.ownerId, d.teamId);
      if (!grant) return notFound();
      // A tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) gets their tab, never the
      // first-tab snapshot.
      const svg = await designImageSvg(env, d, grant.tabScope, { defer: ctx.waitUntil });
      // Nothing drawn (or no snapshot store). Past the gate, so this says
      // nothing about access, and the URL carries `?v=<savedAt>`: the answer
      // cannot change until the design does, so let the browser keep it
      // instead of re-asking on every Explorer visit.
      if (svg == null) {
        return json(
          { error: 'not_found' },
          { status: 404, headers: { 'Cache-Control': 'private, max-age=86400' } },
        );
      }
      // The client cache-busts via a `?v=<savedAt>` query param, so a
      // long private max-age is safe: a changed design changes the URL.
      return svgImage(svg, 'private, max-age=86400');
    }
  }

  const subResp = await handleDesignSubresources(ctx);
  if (subResp) return subResp;

  // Realtime-room admission (docs/specs/015-api/api.md): the one-time WS ticket mint +
  // the Durable Object upgrade — see design-room-routes.ts.
  const roomResp = await handleDesignRoomRoutes(ctx);
  if (roomResp) return roomResp;

  return notFound();
}
