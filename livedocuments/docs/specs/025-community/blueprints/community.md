# Community blueprint

How livedocuments builds [Community](../community.md). The listings are liveworkspace's Community service's
([liveworkspace's Community](../../../../../liveworkspace/docs/specs/007-community/community.md) and its blueprint); the
shared pieces are `@liveworkspace/community-ui` (the card, the Share tab, the Public badge, the links) and
`@liveworkspace/explorer` (`ShareDialogWithCommunity`). This blueprint covers livedocuments's binding of them: the
browser side below, and the api's routes, which its own sections add.

## 0. Where each part lives

| File                                                                                                  | What it holds                                                                                                                         |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/editor/lib/api/community.ts`                                                                    | The owner client (read, publish or Edit Listing, remove) over `/api/documents/<id>/community`, and the service's facets read          |
| `apps/editor/lib/community-share-host.tsx`                                                            | `livedocumentsCommunityClient`, `livedocumentsCommunityHost` (the tab's `CommunityShareHost`), `trackCommunity`, `communityThumbnail` |
| `apps/editor/lib/community-state-store.ts`                                                            | `useCommunityState(documentId)` / `setCommunityState`: the open document's post state, seeded from the load                           |
| `apps/editor/lib/community-public.ts`                                                                 | `documentIsPublic`: whether the header reads Public                                                                                   |
| `apps/editor/lib/explorer-community-host.ts`                                                          | `explorerCommunity(account, communityOn)`: the Explorer's `ShareHost.community(item)`                                                 |
| `apps/editor/components/dialogs/community/ShareDialogWithCommunity.tsx`                               | The editor's Share dialog with the Community tab, loaded with the dialog (`EditorTabDialogs.tsx`)                                     |
| `apps/editor/components/chrome/CommunityBar.tsx`                                                      | The Community bar on a community link's view, loaded only then (`EditorView.tsx`)                                                     |
| `apps/editor/components/chrome/share-states.tsx`, `SharedBadge.tsx`, `VisibilityLegend.tsx`           | The `community` share state (Public), from `@liveworkspace/community-ui/badge`                                                        |
| `apps/editor/hooks/canvas/useAutoCopyParam.ts`                                                        | `?copy=1`: the Community's Make a Copy                                                                                                |
| `apps/editor/app/document/[id]/editor-realtime.ts`                                                    | `CommunitySession` (`sessionCommunity`): the post a community link opened, and the author's own document id                           |
| `apps/editor/lib/api/share.ts`                                                                        | `apiLoadShared` asks `GET /api/share/<code>` for the post; `readCommunityShareInfo`                                                   |
| `packages/ui/src/ProductNav.tsx`, `SiteFooter.tsx`, `packages/ui/src/community/CommunityHelpLink.tsx` | The links: the Explorer footer's, the site footer's, and the help deep links bound to this site's telemetry                           |
| `packages/help-registry/src/community.ts`                                                             | `COMMUNITY_HELP`, every app's (`@liveworkspace/help-registry/community`)                                                              |
| `apps/router/src/index.ts`                                                                            | `/community*` to the Community app, stripped                                                                                          |

## 1. Domain and naming

As the spec's Terms. A **community link** is the view link a post owns; a **Community session** is an editor session
opened through one (`sessionCommunity`, null otherwise). Its `ownDocumentId` is the document's id when the viewer is
its author, else null. The tab's words are `COMMUNITY_APP_WORDS['livedocuments.app']`: "document", "documents", and
the card picture is the "first page".

## 2. Constants and configuration

- `NEXT_PUBLIC_COMMUNITY_API` (the editor's `.env.example`): the Community service's base, production's when unset.
- The router's `COMMUNITY` binding (`livedocuments-community`, staging `livedocuments-community-staging`), locally
  `COMMUNITY_ORIGIN = "http://127.0.0.1:3305"` (D1).
- `COMMUNITY_HOME_PATH` (`/community/`), `communityPostPath(id)` from `@livedocuments/api-schema`.

## 3. Data and persistence

The browser keeps nothing of its own: the post state comes with the document (`LiveDoc.communityState`), and
`setCommunityState` updates it when the tab publishes or removes. An Explorer row reads Public from the index
summary's `public: true`.

## 4. Interfaces and contracts

What the editor asks of the api:

- `GET /api/documents/<id>/community` (owner, signed in): `{ post: CommunityOwnPost | null }`.
- `PUT /api/documents/<id>/community` with `CommunityPostInput`: publishes, or saves an Edit Listing; answers the post.
- `DELETE /api/documents/<id>/community`: removes it.
- `GET /api/share/<code>`: `{ community?: { postId, author: { name, color, picture } } }`, asked only when the grant is
  a view over every tab (D2). A missing or malformed field opens the link as an ordinary view link.
- `GET /api/capabilities`: `communityEnabled` (absent reads as on).
- `LiveDoc.communityState`: `'listed' | 'hidden' | null` for the owner's own post.
- Refusals carry a `code` the tab words (`communityCodeMessage`): `sign_in_required`, `team_document`,
  `share_password_set`, `empty_document`, `post_limit`, `already_published`, `post_hidden`, `invalid_title`,
  `invalid_description`, `invalid_category`, `invalid_tags`, and `community_published` on a password set while listed.

liveworkspace.app's Explorer reaches the same owner route at `APP_ITEMS.livedocuments.share.communityPath`
(`/api/documents/:id/community`) with the workspace token.

## 5. Behaviour and state

1. **Load.** `seed-fetched-document.ts` sets the document's post state. The header asks `useCommunityEnabled` only
   while that state is `listed` and the app's chrome shows, so other opens make no request.
2. **Community link.** `apiLoadShared` resolves the grant; for a view grant over every tab it reads `GET
/api/share/<code>` beside the document. `resolveDocumentSession` then opens it as a view with no owner, the author
   included, and `useIdentityBootstrap` sets `sessionCommunity`, skips the name prompt and the Shared with you entry.
3. **A Community session** never joins the room (`useRoomConnection` `enabled` is false), opens and adds no comments
   (`useEditorComments` `commentsOff`), draws no comment badges (`CommentBadgesContext`), shows the Community bar in
   place of the header's Make a Copy, and reads Public.
4. **Make a Copy.** The bar copies through the link, as any view link copies. `?copy=1` (the Community post page's
   Make a Copy) copies once after hydration and leaves the address bar; only on a Community link opened by someone
   other than its author, so a crafted link copies nothing.
5. **The Share tab.** `ShareDialogWithCommunity` binds `useCommunityShareTab` with the owner, the document's name,
   whether the viewer is signed in, the participant as author, and whether the first tab is empty; switched off, the
   tab is not offered. The Explorer's tab is `explorerCommunity`, for an account's own personal documents.
6. **liveworkspace.app.** `COMMUNITY_SHARE_APPS` lists every app with a `communityPath` and a Community;
   `useCommunityAppsOn` asks an app's capabilities the first time one of its items is shared (D3).
7. **Links.** The Explorer footer's `ProductNavLinks` carries Community while it is on; the site footer's
   `CommunityFooterLink` asks once it nears the viewport; both vanish when it is off.

## 6. Errors and edge cases

- The share read fails or says nothing: the link opens as an ordinary view link (the api still serves it without
  comments when it is a community one).
- A team document, a guest, or someone else's document: no tab (spec "Publishing").
- The Community switched off: no tab, no Public badge, no links (D4 until it answers).

## 7. Security and trust

The editor never decides what a community link may do: the api grants it a content-only pass. `?copy=1` copies only on
a Community link and never for its author. The owner routes are called with the owner's identity alone.

## 8. Performance and limits

The tab, the publish dialog and the Community bar are lazy (`next/dynamic`); the header's Public pill reads
`@liveworkspace/community-ui/badge`, a few constants. Capabilities are asked once per page per base
(`fetchCommunityEnabled`), and only where a listed post, an account's Explorer or a footer needs it.

## 9. Presentation and UX

- **Community bar**: under the header, "Shared to the Community by <author>" with the author badge, **Back to
  Community**, and **Make a Copy** (Copying while it runs) or, for the author, **Edit Your Document**.
- **Public**: the header's share state and the Explorer rows, winning over everything but offline; the visibility
  legend shows the four-stop ladder with Everyone.
- The Share tab's copy is the shared tab's, in livedocuments's words (section 1).

## 10. Accessibility

The bar is a `region` named Community; its actions are a link and a button with visible labels. The Public pill keeps
the share states' text label beside its glyph.

## 11. Web Experience

The bar wraps on a narrow screen (actions below the author line). Back to Community and Edit Your Document are plain
links, so they open in a new tab with the usual gestures.

## 12. Observability

`Community·Shared|Changed·<Category>` and `Community·Removed·Post` (`trackCommunity`, listed in
`apps/editor/lib/telemetry-manifest.ts`); the help deep links send `UI·Opened·<article id>` (the site's computed
emitters list both ids).

## 13. Testing

- `apps/editor/lib/api/community.test.ts`: the owner client, words and the first-page refusal.
- `apps/editor/app/document/[id]/editor-page-helpers.test.ts`: a community link opens as a view with no owner.
- `apps/editor/hooks/canvas/useAutoCopyParam.test.tsx`: copies once, only on a Community link.
- `apps/router/src/index.test.ts`: `/community*` forwarded and stripped.
- `apps/help/lib/community-help.test.ts`: `COMMUNITY_HELP` names registered articles; the ui-labels check reads
  `@liveworkspace/community-ui`.
- liveworkspace.app: `liveworkspace/apps/site/lib/explorer/share.test.ts` and `community-apps.test.tsx`.

## 14. Defaults ledger

[DEFAULTS.md](./DEFAULTS.md).

## 15. Assets and external resources

None of its own: the card picture is liveworkspace's previews', the author picture the account's.

## 16. The api

On the shared app side (`@liveworkspace/community/app`, liveworkspace's blueprint), bound to livedocuments:

| File                                                                                    | What it holds                                                                                                                                                                |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/community-service.ts`                                                     | `COMMUNITY_APP = 'livedocuments.app'`, `communityService` (`communityAppClient`), `communityOn`                                                                              |
| `apps/api/src/document-room/community-post.ts`                                          | The room's post bound to its SQLite, the index (as the author) and the participants: read, author, `checkCommunityPost`, `leaveCommunity`                                    |
| `apps/api/src/document-room/document-schema.ts`                                         | Step V4: `community_post` (`COMMUNITY_POST_TABLE`) and its three outbox triggers, so the index hears when a post is listed or not                                            |
| `apps/api/src/document-room/document-outbox.ts`, `apps/api/src/db/content-summary.ts`   | `communityListed` read beside the summary; `public: true` on the index summary while listed                                                                                  |
| `apps/api/src/document-room/document-room.ts`                                           | `community()`, `communityListing(code)`, `communityPostTitle(code)`; the check on the alarm every `COMMUNITY_CHECK_MS` and right after a write; `purge` leaves the Community |
| `apps/api/src/routes/community-owner-routes.ts`, `apps/api/src/routes/community.ts`     | `answerCommunityOwner` (something to show: `firstPageHasElements` in `apps/api/src/thumbnail.ts`), `answerCommunityMine`                                                     |
| `apps/api/src/routes/context.ts`                                                        | `COMMUNITY_CONTENT`: a community link opens only the document read and the tab read, as a Viewer of every tab                                                                |
| `apps/api/src/redact-document.ts`                                                       | `redactDocumentForCommunity`: no owner name, colour, folder or origin; slides without presenter notes                                                                        |
| `apps/api/src/routes/share.ts`                                                          | The resolve: a community link answers `role: 'view'`, `tabId: null` and the post, or 404 while it is not public                                                              |
| `apps/api/src/routes/document-room-routes.ts`                                           | `community_link` (403) on the room ticket and the socket                                                                                                                     |
| `apps/api/src/routes/document-index-routes.ts`, `apps/api/src/routes/internal-items.ts` | A copy through the link named after the post and counted once per copier (`countCopy`); account deletion and merges forget and move copiers                                  |

`COMMUNITY_KEY` is a Worker secret and `COMMUNITY_URL` a hosted var (`apps/api/hosted-vars.json`). Without the key,
`communityOn` is false: the capabilities report it off, the owner routes and My Shares answer 404, and no check calls
out.

Tests: `apps/api/src/routes/community-routes.test.ts` runs the routes against the real service
(`apps/api/src/test-community-service.ts`): the publish guards (guest, password, team, a category of another app, an
empty or off-page first page), Edit Listing, remove, My Shares, the check (Trash, team, link gone, change of hands),
the off switch, the resolve, the redacted read, the refused room, the drawing, and the counted copy named after the
post. `apps/api/src/redact-document.test.ts` pins the presenter notes.

## 17. The Community pages

`apps/community` is a thin shell on `@liveworkspace/community-site`, on port 3305 locally:

| File                                                                                               | What it holds                                                                                                              |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/community/lib/community-site.tsx`                                                            | The `CommunitySite` binding: `livedocuments.app`, its words, `/api`, `COMMUNITY_KEY_STORAGE`, `signedInHintOf`, its routes |
| `apps/community/lib/telemetry.ts`                                                                  | `communityTelemetry`, literal `siteTrack` calls the dashboard reads                                                        |
| `apps/community/app/layout.tsx`, `apps/community/app/page.tsx`, `apps/community/app/post/page.tsx` | The header (`ctaSurface="Community"`), footer, boot scripts and metadata; the gallery and post pages                       |
| `apps/community/worker/index.ts`                                                                   | `createCommunityWorker({ app: 'livedocuments.app', siteUrl, product: 'livedocuments' })`, its only export                  |
| `apps/marketing/components/CommunityShowcase.tsx`                                                  | The landing section, lazy below the template gallery, hidden while the Community is off or has nothing featured            |
