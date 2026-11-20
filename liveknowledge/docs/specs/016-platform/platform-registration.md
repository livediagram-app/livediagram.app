# Platform registration

Status: **registered in code, not deployed** (2026-11-20). The owner-only steps at the end come first.

What makes liveknowledge a liveworkspace app: one account, the One Explorer, media, telemetry, the site switcher, the
Community, the Drive mirror, Download Your Data, status checks, CI, and its own domain. liveknowledge reuses every
platform capability and adds no service of its own. Its item is a **Knowledgebase** (plural **Knowledgebases**, one
word); what is inside one is a **page**; its API keeps `document` (`apiNoun: 'document'`, `/api/documents/…`), as the
fork's code does.

liveknowledge was registered **listed, never held**: every list a person sees names it from the start (the site
switcher, liveworkspace.app's front door, the Explorer, the Settings panel, the status page, the sign-in email). Only
its CI group is held, so none of its Workers deploy before the owner's steps exist.

**Specs first.** Registering an app changes platform code under `packages/` and `liveworkspace/`, which is a platform
change: it updated [liveworkspace/docs/specs](../../../../liveworkspace/docs/specs/README.md) first, then the code
(root AGENTS.md).

## The platform specs that changed

| Platform spec                                                                              | What changed                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Platform](../../../../liveworkspace/docs/specs/001-platform-scope/platform.md)            | liveknowledge joins the list of apps, six now                                                                                                                                                    |
| [Architecture](../../../../liveworkspace/docs/specs/002-architecture/architecture.md)      | The sixth app's port block; [Integrating an app](../../../../liveworkspace/docs/specs/002-architecture/integrating-an-app.md) says how it was registered                                         |
| [Sign-in](../../../../liveworkspace/docs/specs/003-accounts/sign-in.md#registering-an-app) | Its local client; its API in `RESOURCES`; the "one account signs you in to ..." line names it                                                                                                    |
| [Index](../../../../liveworkspace/docs/specs/004-index/one-explorer.md)                    | `liveknowledge` in the index's apps, its kind `knowledgebase`, its hero kinds and its **Tree** backdrop; the [items rebuild](../../../../liveworkspace/docs/specs/004-index/blueprints/items.md) |
| [Media](../../../../liveworkspace/docs/specs/006-media/media.md)                           | liveknowledge among the apps that upload images                                                                                                                                                  |
| [Telemetry](../../../../liveworkspace/docs/specs/008-telemetry/telemetry.md#adding-an-app) | Its vocabulary, key and dashboard, started from livedocuments'                                                                                                                                   |
| [Status](../../../../liveworkspace/docs/specs/009-status/status.md)                        | Its six checks, the MCP one included                                                                                                                                                             |
| [Site switcher](../../../../liveworkspace/docs/specs/010-site/site-switcher.md)            | One row: its name, URL, pitch and colours; [the site](../../../../liveworkspace/docs/specs/010-site/site.md) gains its front-door section and its place round the hub                            |
| [Workbench](../../../../liveworkspace/docs/specs/011-workbench/workbench.md)               | Nothing: liveknowledge has a CLI, so it pairs workbenches as every app but livehuddle does                                                                                                       |
| [Community](../../../../liveworkspace/docs/specs/007-community/community.md#adding-an-app) | `liveknowledge.app` in `COMMUNITY_APPS` with its categories (below)                                                                                                                              |
| [Drive](../../../../liveworkspace/docs/specs/005-drive/drive.md)                           | A Knowledgebase as a `.liveknowledge` file (`application/vnd.liveknowledge+json`, its `liveknowledge.document` envelope)                                                                         |
| [Data export](../../../../liveworkspace/docs/specs/003-accounts/data-export.md)            | A `liveknowledge/` folder in the zip                                                                                                                                                             |
| [Help centre](../../../../liveworkspace/docs/specs/017-help/help-centre.md#liveknowledge)  | Not a scope yet: an interim slice (below)                                                                                                                                                        |

## Registration, by service

Code locations as on the registration branch.

1. **Sites.** `packages/sites/src/index.ts`: `SiteId`, `LOCAL_PORTS` (`'liveknowledge.app': 3600`), an `APP_SITES`
   row (pitch "A team knowledgebase, for people and for AI"), `AppName` and its `AppItems` (noun **Knowledgebase**,
   `apiNoun: 'document'`, livedocuments' addresses, Offline at `/explorer/offline` with its conversions, the Image
   Gallery, walkthroughs, no Shape Libraries, the Community's `communityPath`). `workspace-proxy.ts`:
   `APP_BARE_HOSTS`.
2. **Brand.** `packages/brand/src/apps.ts` (`BrandApp`, word `knowledge`) and this product's
   `packages/tailwind-config/theme.css` (see [Brand](#brand)).
3. **Accounts.** `liveworkspace/apps/accounts/src/resources.ts` (production and staging API resources), `clients.ts`,
   `email.ts` (the sign-in email's list of apps), `data-export/email.ts`, `telemetry.ts` and `env.ts`
   (`TELEMETRY_KEY_LIVEKNOWLEDGE`), `scripts/local-clients.ts` (`local-liveknowledge`, port 3600) and
   `scripts/map-clients.ts`. A D1 migration, `migrations/0024_liveknowledge.sql`, rebuilds the four tables whose CHECK
   names the apps (`oauth_client_app`, `account_app`, `email_lifecycle`, `push_device`), exactly as
   `0018_livehuddle.sql` did.
4. **Index.** `packages/index-client/src/constants.ts` (`APPS`, `KINDS` with `knowledgebase`, every link level, Editor
   the default), the index Worker's `env.ts`, `wrangler.toml` (its origins, its API in `INDEX_AUDIENCES`) and
   `.dev.vars.example`. A D1 migration, `migrations/0026_items_liveknowledge.sql`, rebuilds `items` and the seventeen
   tables that reference it, so `items.app` takes `liveknowledge` and `items.kind` takes `knowledgebase`
   ([Rebuilding items](../../../../liveworkspace/docs/specs/004-index/blueprints/items.md#rebuilding-items)). It
   rewrites every row of eighteen tables in one transaction: **rehearse it on a copy of production before it
   deploys** (owner only, below).
5. **Media.** `packages/media/src/apps.ts`, and the media Worker's `env.ts`, `wrangler.toml` and `.dev.vars.example`.
6. **Telemetry.** `packages/telemetry/src/apps.ts` (`TELEMETRY_APPS`, `TELEMETRY_APP_ORIGINS`), the telemetry
   Worker's vocabulary (`@liveknowledge/api-schema`, the fork's, so livedocuments' events today) and env, and its
   dashboard under the site's `/telemetry` (`liveworkspace/apps/site/app/telemetry/liveknowledge/`, started from
   livedocuments').
7. **Settings.** `packages/settings/src/device.ts` (`keysFor('liveknowledge')`), `push.ts`, its catalogue
   (`packages/settings/src/catalogues/liveknowledge.ts`, livedocuments' until the editor's own
   settings-site-catalogue test writes it again) and the Settings panel's lists in `packages/settings-ui`.
8. **Status.** `liveworkspace/packages/status/src/services.ts`: its MCP Worker's port in `MCP_DEV_PORTS` (9288), so
   its group has six checks.
9. **Drive.** `packages/drive/src/formats.ts` (`APP_FILE_FORMATS.liveknowledge`), and the drive Worker's env
   (`DRIVE_KEY_LIVEKNOWLEDGE`, `APP_ORIGIN_LIVEKNOWLEDGE`) and `wrangler.toml`.
10. **Community.** `packages/community/src` (`COMMUNITY_APPS`, `COMMUNITY_APP_CATEGORIES['liveknowledge.app']`), the
    Community Worker's env (`COMMUNITY_KEY_LIVEKNOWLEDGE`), and the Share dialog's words in `packages/community-ui`
    (knowledgebase, knowledgebases).
11. **Data export.** The export Worker's env (`DATA_EXPORT_KEY_LIVEKNOWLEDGE`, `APP_ORIGIN_LIVEKNOWLEDGE`) and
    `files.ts` (its folder, its extension, the README's lists).
12. **The Explorer and the editors' shared chrome.** `packages/explorer` (the kind's words, the hero's four kinds, the
    **Tree** backdrop), `packages/workbench` (the start header's tree band and title mark, Connect File's fan of
    logos, the Delete Account dialog's list), `packages/help-site` (the art's app and sample names).
13. **liveworkspace.app.** `liveworkspace/apps/site`: the front door (its section and **Team Handbook** window, its
    place in the hub's hexagon, its Explorer card), the privacy policy and terms, the manifest and description, the
    Explorer's and the Community's colours, its appearance key, its signed-in hint, its welcome and its telemetry
    dashboard.
14. **Also.** `packages/api-schema` (`TabConnectionApp`), `packages/mcp-kit` (the reserved client names),
    `packages/next-config` (`DEV_ORIGINS`).

### Brand

Lime into green. The ramp is Tailwind's lime to brand-500, then a step deeper, as lime runs much lighter than sky at
the same step (white on lime-600 is 3.1:1):

| Step | Hex       |     | Step | Hex       |
| ---- | --------- | --- | ---- | --------- |
| 50   | `#f7fee7` |     | 500  | `#84cc16` |
| 100  | `#ecfccb` |     | 600  | `#4d7c0f` |
| 200  | `#d9f99d` |     | 700  | `#3f6212` |
| 300  | `#bef264` |     | 800  | `#365314` |
| 400  | `#a3e635` |     | 900  | `#2b4310` |
|      |           |     | 950  | `#1a2e05` |

White on brand-600 is 5.0:1 (4.6:1 on slate-100 and brand-100) and on brand-700 7.1:1, measured. The lockup's accent
is `#4d7c0f` on light and `#a3e635` on dark. The dark (Steel) ramp holds the accent at Steel's saturation and
luminance (white on its 600 6.0:1, its 400 on slate-900 8.2:1); Midnight is the light ramp a step deeper from 600.
The prism runs lime into green (`#65a30d` into `#16a34a` on light, `#84cc16` into `#22c55e` on dark).
`packages/brand/src/apps.test.ts` keeps `BRAND_APPS.liveknowledge.ramp` and this product's theme equal.

Still amber, from the fork, and not part of the registration: `packages/ui/hero-band.css`,
`packages/ui/src/social-card.tsx` and `packages/ui/src/PageBuildAnimation.tsx`.

### Community

Categories, in the shape every app's take (`id`: Label), then Something Else: `engineering`: Engineering,
`handbooks`: Handbooks, `onboarding`: Onboarding, `product`: Product, `support`: Support. The Community files a post
under the app's Start With template categories, so `packages/templates/src/template-categories.ts` has to become
these five (its `community-categories.test.ts` fails until it does), and each product's generated OpenAPI schema
gains the two new ids (`engineering`, `handbooks`) the next time it is generated.

### Help centre

liveknowledge is **not a help scope yet**. Its editor, CLI and MCP read an interim slice
(`packages/help-registry/src/slice/liveknowledge.ts`): livedocuments' articles and categories under liveknowledge's
name. `liveknowledge.app/help` is answered from All Apps, whose pages name livedocuments. Becoming a scope is listed
in [the help centre spec](../../../../liveworkspace/docs/specs/017-help/help-centre.md#liveknowledge).

## Port block 3600 to 3699

In the root AGENTS.md table (`liveknowledge | 3600 onward`). As in every product, the router takes the first port,
**3600**, and the other Next.js apps the next ones (the editor 3601, marketing 3602).

Wrangler's own ports sit outside the 36xx block, one range per product: liveknowledge takes **9287** for the api,
**9288** for the MCP, and inspector ports **9730** onward.

## CI

- **A group** in `.github/scripts/ci-plan.mjs`: `liveknowledge`, folder `liveknowledge/`, editor
  `@liveknowledge/editor` (sharded), its CLI packed. The root-files pattern that reaches everything names it.
- **Held** (`held: true`): the group runs only when a change touches `liveknowledge/` itself or everything runs, and
  **none of its Workers deploy**. This is the one hold: a deploy before the owner's steps below would fail on a
  domain, KV namespaces and secrets that do not exist. Lifting it is deleting that line.
- **The lists**: `coverage-report.mjs`, `coverage-floors.json` (livedocuments' floors, the fork's own at the fork),
  `cpu-budget-guard.mjs`, `duplicate-guard.mjs` with its baseline (the fork's byte-identical copies of livedocuments,
  the one time that list grows), `file-size-baseline.txt` (the fork's copies of files already listed), `e2e.yml`,
  `turbo.json` (the global dependencies, the site's and the marketing build's inputs) and docs/ci.md's table.

## Deploys

Through CI only, never by hand (docs/ci.md "Deploys"), to the liveworkspace Cloudflare account every `wrangler.toml`
pins, once the hold lifts:

- First tier: `liveknowledge-api` (Durable Objects and their migrations; no D1).
- Second tier: `liveknowledge-editor`, `liveknowledge-marketing`, `liveknowledge-mcp`.
- Third tier: `liveknowledge-router`.

Staging is `staging.liveknowledge.app`; production is `www.liveknowledge.app`, with the bare domain redirecting to
`www.` as every product's does.

The platform's own Workers deploy with the registration, hold or no hold: accounts and the index apply their
migrations then.

## DNS, domain, secrets and billing (owner only)

None of these can be done by an agent.

- **Rehearse the index rebuild** before the registration deploys:
  `wrangler d1 export liveworkspace-index --remote --output prod.sql` (it only reads), then
  `node scripts/items-rebuild-counts.ts rehearse prod.sql` in `liveworkspace/apps/index`. It prints the time the
  rebuild takes on the real data; one that runs far past 30 seconds is the sign to split it first.
- **Domain:** register `liveknowledge.app` and add it as a zone on the liveworkspace Cloudflare account, so the
  router's custom domains (`liveknowledge.app`, `www.liveknowledge.app`, `staging.liveknowledge.app`) and the MCP's
  (`mcp.liveknowledge.app`) can attach.
- **Accounts client:** run `register-client.ts` per environment and set `ACCOUNTS_CLIENT_SECRET` on the api Worker.
- **Index, media, telemetry, drive, Community and data export keys:** one value each, set on the service
  (`INDEX_KEY_LIVEKNOWLEDGE`, `MEDIA_KEY_LIVEKNOWLEDGE`, `TELEMETRY_KEY_LIVEKNOWLEDGE` on the telemetry Worker and on
  accounts, `DRIVE_KEY_LIVEKNOWLEDGE`, `COMMUNITY_KEY_LIVEKNOWLEDGE`, `DATA_EXPORT_KEY_LIVEKNOWLEDGE`) and on
  liveknowledge's api under the name it reads (`INDEX_KEY`, `MEDIA_KEY`, `TELEMETRY_KEY`, `DRIVE_KEY`,
  `COMMUNITY_KEY`, `DATA_EXPORT_KEY`), production and staging.
- **`AI_KEY_SECRET`** on liveknowledge's api, production and staging (`wrangler secret put AI_KEY_SECRET`, a fresh
  `openssl rand -hex 32` each): what the knowledgebases' Claude API keys are sealed under
  ([Search and Ask](../030-knowledgebase/search-and-ask.md) "Ask"). Until it is set, no key can be stored and Ask
  answers `ask_unavailable`; nothing else waits on it. It is never rotated casually: a new value makes every stored
  key unreadable, and each team sets its key again.
- **Google:** `application/vnd.liveknowledge+json` (`.liveknowledge`) added to the Google Cloud project's Drive UI
  MIME types, and the new domain among the Google sign-in origins.
- **KV namespaces** for the MCP Worker's OAuth state, production and staging, replacing the ids the fork carries in
  `apps/mcp/wrangler.toml`.
- **Any third-party keys** the fork carries over (Turnstile), added for the new domain.
- **The MCP registry and the CLI's npm package**, when it is ready to be found.
- **Then lift the hold** (`held: true` in `ci-plan.mjs`), so its Workers deploy and its suites run like any
  product's.
- **Billing:** Durable Object requests and duration, and KV, for a sixth product on the account's Workers paid plan.

## What the fork still has to change

Found while registering, and outside the registration:

- **Auth cookies** (done). liveknowledge's cookies carry the `lkb_` prefix (`lkb_signed_in` in
  `packages/api-schema/src/signed-in-hint.ts`, `lkb_refresh` and `lkb_pkce` in `apps/api/src/routes/auth.ts`), so
  it and livedocuments (`ldoc_`) no longer sign each other out on localhost, where cookies ignore the port.
- **The migration door** (done). liveknowledge was never part of the historical livediagram.app, so its api has no
  migration door, no `MIGRATION_KEY` and no dependency on `packages/migration`.
- **Template categories**, as under [Community](#community).
