# Community blueprint

How livedesign builds [Community](../community.md). The listings are liveworkspace's Community service's
([liveworkspace's Community](../../../../../liveworkspace/docs/specs/007-community/community.md) and its blueprint); the
shared pieces are `@liveworkspace/community-ui` (the card, the Share tab, the Public badge, the links, the landing
section), `@liveworkspace/community-site` (the Community pages and their Worker), `@liveworkspace/community/app` (the
api's side) and `@liveworkspace/explorer` (`ShareDialogWithCommunity`). This blueprint covers livedesign's binding of
them: the browser side, the api's routes and the Community pages, each in its own sections. livedocuments' blueprint
([its 025 blueprints](../../../../../livedocuments/docs/specs/025-community/blueprints/community.md)) is the same binding
in its words; where the two differ, this one says so.

## 0. Where each part lives

| File                                                                                                  | What it holds                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `apps/live/lib/api/community.ts`                                                                      | The owner client (read, publish or Edit Listing, remove) over `/api/designs/<id>/community`, and the service's facets read      |
| `apps/live/lib/community-share-host.tsx`                                                              | `livedesignCommunityClient`, `livedesignCommunityHost` (the tab's `CommunityShareHost`), `trackCommunity`, `communityThumbnail` |
| `apps/live/lib/community-state-store.ts`                                                              | `useCommunityState(designId)` / `setCommunityState`: the open design's post state, seeded from the load                         |
| `apps/live/lib/community-public.ts`                                                                   | `designIsPublic`: whether the header reads Public                                                                               |
| `apps/live/lib/explorer-community-host.ts`                                                            | `explorerCommunity(account, communityOn)`: the Explorer's `ShareHost.community(item)`                                           |
| `apps/live/components/dialogs/community/ShareDialogWithCommunity.tsx`                                 | The live app's Share dialog with the Community tab, loaded with the dialog (`EditorTabDialogs.tsx`)                             |
| `apps/live/components/chrome/CommunityBar.tsx`                                                        | The Community bar on a community link's view, loaded only then (`app/design/[id]/EditorView.tsx`)                               |
| `apps/live/components/chrome/share-states.tsx`, `SharedBadge.tsx`, `VisibilityLegend.tsx`             | The `community` share state (Public), from `@liveworkspace/community-ui/badge`                                                  |
| `apps/live/hooks/canvas/useAutoCopyParam.ts`                                                          | `?copy=1`: the Community's Make a Copy                                                                                          |
| `apps/live/app/design/[id]/editor-realtime.ts`                                                        | `CommunitySession` (`sessionCommunity`): the post a community link opened, and the author's own design id                       |
| `apps/live/app/design/[id]/seed-fetched-design.ts`                                                    | Seeds the post state from the design read (`LiveDoc.communityState`)                                                            |
| `apps/live/lib/api/share.ts`                                                                          | `apiLoadShared` asks `GET /api/share/<code>` for the post; `readCommunityShareInfo`                                             |
| `packages/ui/src/ProductNav.tsx`, `SiteFooter.tsx`, `packages/ui/src/community/CommunityHelpLink.tsx` | The links: the Explorer footer's, the site footer's, and the help deep links bound to this site's telemetry                     |
| `packages/help-registry/src/community.ts`                                                             | `COMMUNITY_HELP`, every app's (`@liveworkspace/help-registry/community`)                                                        |
| `apps/router/src/index.ts`                                                                            | `/community*` to the Community app, stripped                                                                                    |
| `apps/community/**`                                                                                   | The Community pages (section 17)                                                                                                |
| `apps/marketing/components/CommunityShowcase.tsx`                                                     | The landing section (section 17)                                                                                                |

## 1. Domain and naming

As the spec's Terms. A **community link** is the view link a post owns; a **Community session** is a live app session
opened through one (`sessionCommunity`, null otherwise). Its `ownDesignId` is the design's id when the viewer is its
author, else null. The tab's words are `COMMUNITY_APP_WORDS['livedesign.app']`: "design", "designs", and the card
picture is the "first page" (D5). The categories are livedesign's own (`COMMUNITY_CATEGORIES` in
`@livedesign/api-schema`, from `communityCategories('livedesign.app')`), as the spec's table lists them.

## 2. Constants and configuration

- `NEXT_PUBLIC_COMMUNITY_API` (the live app's and the Community pages' `.env.example`): the Community service's base,
  production's when unset.
- The router's `COMMUNITY` binding (`livedesign-community`, staging `livedesign-community-staging`), locally
  `COMMUNITY_ORIGIN = "http://127.0.0.1:3405"` (D1).
- `COMMUNITY_HOME_PATH` (`/community/`), `communityPostPath(id)`, `communityImagePath(id)` and
  `COMMUNITY_KEY_STORAGE` from `@livedesign/api-schema` (`community-paths.ts`, which loads none of the categories or
  validation).
- The api Worker: `COMMUNITY_KEY` (a secret, the service's `COMMUNITY_KEY_LIVEDESIGN`), `COMMUNITY_URL` (a hosted var,
  `apps/api/hosted-vars.json`, production's and staging's), `COMMUNITY_ENABLED` (the off switch). Local values are in
  `apps/api/.env.example`; `wrangler.toml` says where each lives.

## 3. Data and persistence

The browser keeps nothing of its own: the post state comes with the design (`LiveDoc.communityState`), and
`setCommunityState` updates it when the tab publishes or removes. An Explorer row reads Public from the index
summary's `public: true`.

The api keeps one row per design in the design's own SQLite: `community_post` (`COMMUNITY_POST_TABLE`, every app's),
added by step V4 of `design-schema.ts` with three outbox triggers, so the index hears whenever a post becomes listed
or stops being so. The post itself (title, description, tags, likes, copies, reports) is the service's.

## 4. Interfaces and contracts

What the live app asks of the api:

- `GET /api/designs/<id>/community` (owner, signed in): `{ post: CommunityOwnPost | null }`.
- `PUT /api/designs/<id>/community` with `CommunityPostInput`: publishes, or saves an Edit Listing; answers the post.
- `DELETE /api/designs/<id>/community`: removes it.
- `GET /api/community/mine`: My Shares, for the Community pages.
- `GET /api/share/<code>`: `{ design, role, tabId, community?: { postId, author: { name, color, picture } } }`, asked
  only when the grant is a view over every tab (D2). A missing or malformed field opens the link as an ordinary view
  link.
- `GET /api/capabilities`: `communityEnabled` (absent reads as on).
- `LiveDoc.communityState`: `'listed' | 'hidden' | null` for the owner's own post; null for every other reader.
- Refusals carry a `code` the tab words (`communityCodeMessage`): `sign_in_required`, `team_document`,
  `share_password_set`, `empty_document`, `post_limit`, `already_published`, `post_hidden`, `invalid_title`,
  `invalid_description`, `invalid_category`, `invalid_tags`, and `community_published` on a password set while listed.
  The codes are the shared contract's, the same in every app.

liveworkspace.app's Explorer reaches the same owner route at `APP_ITEMS.livedesign.share.communityPath`
(`/api/designs/:id/community`) with the workspace token. A workbench session never does: `designs/:p/community/**` is
among its closed doors (`@livedesign/api-schema` `workbench.ts`).

## 5. Behaviour and state

1. **Load.** `seed-fetched-design.ts` sets the design's post state. The header asks `useCommunityEnabled` only while
   that state is `listed` and the app's chrome shows, so other opens make no request.
2. **Community link.** `apiLoadShared` resolves the grant; for a view grant over every tab it reads
   `GET /api/share/<code>` beside the design. The session then opens it as a view with no owner, the author included,
   and `useIdentityBootstrap` sets `sessionCommunity`, skips the name prompt and the Shared with you entry.
3. **A Community session** never joins the room (`useRoomConnection` `enabled` is false), opens and adds no comments,
   draws no comment badges, shows the Community bar in place of the header's Make a Copy, and reads Public. Its photo
   pages load their pixels through the photo blob read, which the link opens (D7).
4. **Make a Copy.** The bar copies through the link, as any view link copies. `?copy=1` (the Community post page's
   Make a Copy) copies once after hydration and leaves the address bar; only on a Community link opened by someone
   other than its author, so a crafted link copies nothing.
5. **The Share tab.** `ShareDialogWithCommunity` binds `useCommunityShareTab` with the owner, the design's name,
   whether the viewer is signed in, the participant as author, and whether the first tab's first page is empty (no
   element and no photo); switched off, the tab is not offered. The Explorer's tab is `explorerCommunity`, for an
   account's own personal designs.
6. **liveworkspace.app.** `COMMUNITY_SHARE_APPS` lists every app with a `communityPath` and a Community;
   `useCommunityAppsOn` asks an app's capabilities the first time one of its items is shared (D3).
7. **Links.** The Explorer footer's `ProductNavLinks` carries Community while it is on; the site footer's
   `CommunityFooterLink` asks once it nears the viewport; both vanish when it is off.

## 6. Errors and edge cases

- The share read fails or says nothing: the link opens as an ordinary view link (the api still serves it without
  comments when it is a community one).
- A team design, a guest, or someone else's design: no tab (spec "Publishing").
- The Community switched off: no tab, no Public badge, no links (D4 until it answers).
- A first page that is only a photo page with a picture is something to show; a photo page whose picture holds no
  layer is not (D6). A first tab that does not parse, or no tab at all, is nothing to show.

## 7. Security and trust

The live app never decides what a community link may do: the api grants it a content-only pass. `?copy=1` copies only
on a Community link and never for its author. The owner routes are called with the owner's identity alone. Sections 16
and 16.1 set what the pass opens and what it redacts.

## 8. Performance and limits

The tab, the publish dialog and the Community bar are lazy (`next/dynamic`); the header's Public pill reads
`@liveworkspace/community-ui/badge`, a few constants. Capabilities are asked once per page per base
(`fetchCommunityEnabled`), and only where a listed post, an account's Explorer or a footer needs it.

On the api, the design read adds one SQLite row read for the owner (`readOwnerCommunityState`) and the room reads the
`community_post` row once per routed request (`communityOf`), both inside the design's own Durable Object. A publish's
"something to show" parses the first tab once, never renders it. The check runs every `COMMUNITY_CHECK_MS` on the
room's one alarm, only for a design with a post.

## 9. Presentation and UX

- **Community bar**: under the header, "Shared to the Community by <author>" with the author badge, **Back to
  Community**, and **Make a Copy** (Copying while it runs) or, for the author, **Edit Your Design**.
- **Public**: the header's share state and the Explorer rows, winning over everything but This Browser; the visibility
  legend shows the ladder with Everyone.
- The Share tab's copy is the shared tab's, in livedesign's words (section 1).

## 10. Accessibility

The bar is a `region` named Community; its actions are a link and a button with visible labels. The Public pill keeps
the share states' text label beside its glyph.

## 11. Web Experience

The bar wraps on a narrow screen (actions below the author line, the avatar never shrinking). Back to Community and
Edit Your Design are plain links, so they open in a new tab with the usual gestures.

## 12. Observability

`Community·Shared|Changed·<Category>` and `Community·Removed·Post` (`trackCommunity`, listed in
`apps/live/lib/telemetry-manifest.ts`); the gallery's events from the Community pages (section 17); the help deep
links send `UI·Opened·<article id>`. The vocabulary is `@livedesign/api-schema`'s: the `Community` category, the
`Liked`, `Unliked` and `Reported` actions, the `community` api route resource, the `Community` page-view app and Web
Vitals app, and the `Community` CTA surface (`/community`, header slots only, [the landing funnel](../../019-marketing/landing-funnel.md)).

## 13. Testing

- `apps/live/lib/api/community.test.ts`: the owner client, words and the first-page refusal.
- `apps/live/app/design/[id]/editor-page-helpers.test.ts`: a community link opens as a view with no owner.
- `apps/live/hooks/canvas/useAutoCopyParam.test.tsx`: copies once, only on a Community link.
- `apps/router/src/index.test.ts`: `/community*` forwarded and stripped.
- `apps/help/lib/community-help.test.ts`: `COMMUNITY_HELP` names registered articles.
- `packages/api-schema/src/cta-sources.test.ts`: the `Community` surface and `/community` path.
- The api's tests (section 16).
- liveworkspace.app: `liveworkspace/apps/site/lib/explorer/share.test.ts` and `community-apps.test.tsx`.

## 14. Defaults ledger

[DEFAULTS.md](./DEFAULTS.md).

## 15. Assets and external resources

None of its own: the card picture is liveworkspace's previews', the author picture the account's.

## 16. The api

On the shared app side (`@liveworkspace/community/app`, liveworkspace's blueprint), bound to livedesign:

| File                                                                                  | What it holds                                                                                                                                                                |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/community-service.ts`                                                   | `COMMUNITY_APP = 'livedesign.app'`, `communityService` (`communityAppClient`), `communityOn`                                                                                 |
| `apps/api/src/design-room/community-post.ts`                                          | The room's post bound to its SQLite, the index (as the author) and the participants: read, owner state, author, `checkCommunityPost`, `leaveCommunity`                       |
| `apps/api/src/design-room/design-schema.ts`                                           | Step V4: `community_post` (`COMMUNITY_POST_TABLE`) and its three outbox triggers, so the index hears when a post is listed or not                                            |
| `apps/api/src/design-room/design-outbox.ts`, `apps/api/src/db/content-summary.ts`     | `communityListed` read beside the summary; `public: true` on the index summary while listed                                                                                  |
| `apps/api/src/design-room/design-room.ts`                                             | `community()`, `communityListing(code)`, `communityPostTitle(code)`; the check on the alarm every `COMMUNITY_CHECK_MS` and right after a write; `purge` leaves the Community |
| `apps/api/src/design-room/design-content.ts`                                          | `exportDesignCopy(..., community)`: a copy through the link carries each tab through `redactTabDataForCommunity`                                                             |
| `apps/api/src/routes/community-owner-routes.ts`, `apps/api/src/routes/community.ts`   | `answerCommunityOwner` (something to show: `firstPageHasSomethingToShow` in `apps/api/src/thumbnail.ts`), `answerCommunityMine`                                              |
| `apps/api/src/routes/context.ts`                                                      | `COMMUNITY_CONTENT`: a community link opens only the doors that pass it, as a Viewer of every tab; `gateRead` takes it too                                                   |
| `apps/api/src/redact-design.ts`                                                       | `redactDesignForCommunity`: no owner name, colour, folder or origin; `redactDesignForReader` nulls `communityState` for anyone but the owner                                 |
| `apps/api/src/routes/share.ts`                                                        | The resolve: a community link answers `role: 'view'`, `tabId: null` and the post, or 404 while it is not public                                                              |
| `apps/api/src/routes/design-room-routes.ts`                                           | `community_link` (403) on the room ticket and the socket                                                                                                                     |
| `apps/api/src/routes/design-index-routes.ts`, `apps/api/src/routes/internal-items.ts` | A copy through the link named after the post and counted once per copier (`countCopy`); account deletion and merges forget and move copiers                                  |
| `apps/api/src/thumbnail.ts`                                                           | `drawDesign(..., { community })`: the card and per-tab images drawn from the redacted tab                                                                                    |

`COMMUNITY_KEY` is a Worker secret and `COMMUNITY_URL` a hosted var. Without the key, `communityOn` is false: the
capabilities report it off, the owner routes and My Shares answer 404, and no check calls out.

### 16.1 What a community link opens

A content-only pass (spec "Viewing a post's design"). The doors that pass `COMMUNITY_CONTENT`:

- the design read (`GET /api/designs/<id>`, and its overview view), redacted by `redactDesignForCommunity` on top of
  the reader redaction;
- the tab read (`GET /api/designs/<id>/tabs/<tabId>`, and its views), each tab through `redactTabForCommunity`:
  comment threads dropped, actions without who they are assigned to and by;
- the photo blob read (`GET /api/designs/<id>/tabs/<tabId>/photo-blobs/<blobId>`): a photo's pixels are the design's
  content, as an image element's bytes are (D7). livedocuments has no photos, so no such door.

The image bytes (`/api/images/...`) and the copy route check the link through the index's grant, as for any view
link; the copy and the drawing redact. Every other door, including any added later, answers as if there were no grant.
livedesign has no slide deck, so there are no presenter notes to drop (livedocuments drops them).

### 16.2 Tests

`apps/api/src/routes/community-routes.test.ts` runs the routes against the real service
(`apps/api/src/test-community-service.ts`): the publish guards (guest, password, team, a category of another app, an
empty or off-page first page, a first page that is only a photo, an empty picture, a tab that does not parse, no tab),
Edit Listing, remove, My Shares, the owner's `communityState`, the check (Trash, team, link gone, change of hands), the
off switch, the resolve, the redacted read, the refused room, the photo blob read and the refused upload, the drawing,
and the counted copy named after the post. `apps/api/src/redact-design.test.ts` pins the redaction and that
`communityState` reaches the owner alone.

## 17. The Community pages

`apps/community` is a thin shell on `@liveworkspace/community-site`, on port 3405 locally (D1):

| File                                                                                               | What it holds                                                                                                           |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/community/lib/community-site.tsx`                                                            | The `CommunitySite` binding: `livedesign.app`, its words, `/api`, `COMMUNITY_KEY_STORAGE`, `signedInHintOf`, its routes |
| `apps/community/lib/telemetry.ts`                                                                  | `communityTelemetry`, literal `siteTrack` calls the dashboard reads                                                     |
| `apps/community/app/layout.tsx`, `apps/community/app/page.tsx`, `apps/community/app/post/page.tsx` | The header (`ctaSurface="Community"`), footer, boot scripts and metadata; the gallery and post pages                    |
| `apps/community/worker/index.ts`                                                                   | `createCommunityWorker({ app: 'livedesign.app', siteUrl, product: 'livedesign' })`, its only export                     |
| `apps/marketing/components/CommunityShowcase.tsx`                                                  | The landing section, lazy below the template gallery, hidden while the Community is off or has nothing featured         |

The binding's routes: **Open Design** opens the design through its community link (`/design/shared?<share query>`,
the live app's share path), **Make a Copy** the same with `&copy=1`, and the author's **Edit Your Design**
`/design/<id>`. The marketing sitemap lists `/community/`.
