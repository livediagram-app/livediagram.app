# liveworkspace.app: blueprint

Derived from [site.md](../site.md) and [site-switcher.md](../site-switcher.md). The spec decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md). Paths are relative to the repository root.

## Domain and naming

| Term          | Identifier                         | Meaning                                             |
| ------------- | ---------------------------------- | --------------------------------------------------- |
| Site          | `@liveworkspace/site`              | A static Next.js export, served as Worker assets    |
| Explorer page | `/explorer/*`                      | The One Explorer, also served on each app's address |
| Sign-in pages | `/sign-in`, `/sign-up`, `/consent` | Accounts' pages, drawn by the site                  |
| Site switcher | `@liveworkspace/sites`             | The list of every site, in every header             |

## Interfaces and contracts

The site has no server code: every page is static and calls the services on its own origin.

## Security and trust

No secrets: the site's Worker serves assets only. Pages read the session through accounts' routes.

## Performance and limits

Every page is prebuilt; first-load JavaScript is the cost to watch (each page's budget is in the products' perf
rules).

## Presentation and UX

The pages, their layout and their states are in [site.md](../site.md); the shared components come from
`@liveworkspace/explorer`, `@liveworkspace/settings-ui` and `@liveworkspace/account-menu`.

## Pages

| Address                     | File                                                            | Role                                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/account`                  | `liveworkspace/apps/site/app/account/page.tsx`                  |                                                                                                                                                                             |
| `/account/settings`         | `liveworkspace/apps/site/app/account/settings/page.tsx`         |                                                                                                                                                                             |
| `/account/tokens`           | `liveworkspace/apps/site/app/account/tokens/page.tsx`           |                                                                                                                                                                             |
| `/compare`                  | `liveworkspace/apps/site/app/compare/page.tsx`                  |                                                                                                                                                                             |
| `/consent`                  | `liveworkspace/apps/site/app/consent/page.tsx`                  |                                                                                                                                                                             |
| `/drive/connect`            | `liveworkspace/apps/site/app/drive/connect/page.tsx`            |                                                                                                                                                                             |
| `/drive/connected`          | `liveworkspace/apps/site/app/drive/connected/page.tsx`          |                                                                                                                                                                             |
| `/drive/open`               | `liveworkspace/apps/site/app/drive/open/page.tsx`               |                                                                                                                                                                             |
| `/explorer/activity`        | `liveworkspace/apps/site/app/explorer/activity/page.tsx`        | A retired Explorer address, kept so links already out there land somewhere real: ExplorerShell (the layout) replaces it with the Inbox (lib/explorer/host.ts).              |
| `/explorer/all`             | `liveworkspace/apps/site/app/explorer/all/page.tsx`             |                                                                                                                                                                             |
| `/explorer/dynamic`         | `liveworkspace/apps/site/app/explorer/dynamic/page.tsx`         | A retired Explorer address, kept so links already out there land somewhere real: ExplorerShell (the layout) replaces it with My Work (lib/explorer/host.ts).                |
| `/explorer/favourites`      | `liveworkspace/apps/site/app/explorer/favourites/page.tsx`      |                                                                                                                                                                             |
| `/explorer/folder`          | `liveworkspace/apps/site/app/explorer/folder/page.tsx`          |                                                                                                                                                                             |
| `/explorer/generated`       | `liveworkspace/apps/site/app/explorer/generated/page.tsx`       | A retired Explorer address, kept so links already out there land somewhere real: ExplorerShell (the layout) replaces it with Search, filtered to what AI made (lib/explore… |
| `/explorer/home`            | `liveworkspace/apps/site/app/explorer/home/page.tsx`            |                                                                                                                                                                             |
| `/explorer/images`          | `liveworkspace/apps/site/app/explorer/images/page.tsx`          |                                                                                                                                                                             |
| `/explorer/inbox`           | `liveworkspace/apps/site/app/explorer/inbox/page.tsx`           |                                                                                                                                                                             |
| `/explorer/invites`         | `liveworkspace/apps/site/app/explorer/invites/page.tsx`         | A retired Explorer address, kept so links already out there land somewhere real: ExplorerShell (the layout) replaces it with the account's Teams page (lib/explorer/host.t… |
| `/explorer/offline`         | `liveworkspace/apps/site/app/explorer/offline/page.tsx`         | A retired Explorer address, kept so links already out there land somewhere real: ExplorerShell (the layout) replaces it with the app's own view of what it keeps in this b… |
| `/explorer`                 | `liveworkspace/apps/site/app/explorer/page.tsx`                 | The Explorer's Home: ExplorerShell (the layout) renders it from the address.                                                                                                |
| `/explorer/profile`         | `liveworkspace/apps/site/app/explorer/profile/page.tsx`         | A retired Explorer address, kept so links already out there land somewhere real: ExplorerShell (the layout) replaces it with Settings, on Notifications (lib/explorer/host… |
| `/explorer/recent`          | `liveworkspace/apps/site/app/explorer/recent/page.tsx`          |                                                                                                                                                                             |
| `/explorer/search`          | `liveworkspace/apps/site/app/explorer/search/page.tsx`          |                                                                                                                                                                             |
| `/explorer/shape-libraries` | `liveworkspace/apps/site/app/explorer/shape-libraries/page.tsx` |                                                                                                                                                                             |
| `/explorer/shared`          | `liveworkspace/apps/site/app/explorer/shared/page.tsx`          |                                                                                                                                                                             |
| `/explorer/tags`            | `liveworkspace/apps/site/app/explorer/tags/page.tsx`            | A retired Explorer address, kept so links already out there land somewhere real: ExplorerShell (the layout) replaces it with Home (lib/explorer/host.ts).                   |
| `/explorer/team`            | `liveworkspace/apps/site/app/explorer/team/page.tsx`            |                                                                                                                                                                             |
| `/explorer/timeline`        | `liveworkspace/apps/site/app/explorer/timeline/page.tsx`        |                                                                                                                                                                             |
| `/explorer/trash`           | `liveworkspace/apps/site/app/explorer/trash/page.tsx`           |                                                                                                                                                                             |
| `/explorer/unsorted`        | `liveworkspace/apps/site/app/explorer/unsorted/page.tsx`        | A retired Explorer address, kept so links already out there land somewhere real: ExplorerShell (the layout) replaces it with My Work, whose root lists what is in no folde… |
| `/help/google-drive`        | `liveworkspace/apps/site/app/help/google-drive/page.tsx`        |                                                                                                                                                                             |
| `/join/decline`             | `liveworkspace/apps/site/app/join/decline/page.tsx`             |                                                                                                                                                                             |
| `/join`                     | `liveworkspace/apps/site/app/join/page.tsx`                     |                                                                                                                                                                             |
| `/licences`                 | `liveworkspace/apps/site/app/licences/page.tsx`                 |                                                                                                                                                                             |
| `/`                         | `liveworkspace/apps/site/app/page.tsx`                          |                                                                                                                                                                             |
| `/privacy`                  | `liveworkspace/apps/site/app/privacy/page.tsx`                  |                                                                                                                                                                             |
| `/robots`                   | `liveworkspace/apps/site/app/robots.ts`                         |                                                                                                                                                                             |
| `/sign-in`                  | `liveworkspace/apps/site/app/sign-in/page.tsx`                  |                                                                                                                                                                             |
| `/sign-up`                  | `liveworkspace/apps/site/app/sign-up/page.tsx`                  |                                                                                                                                                                             |
| `/sitemap`                  | `liveworkspace/apps/site/app/sitemap.ts`                        |                                                                                                                                                                             |
| `/status`                   | `liveworkspace/apps/site/app/status/page.tsx`                   |                                                                                                                                                                             |
| `/telemetry`                | `liveworkspace/apps/site/app/telemetry/page.tsx`                |                                                                                                                                                                             |
| `/terms`                    | `liveworkspace/apps/site/app/terms/page.tsx`                    |                                                                                                                                                                             |
| `/workbench/pair`           | `liveworkspace/apps/site/app/workbench/pair/page.tsx`           |                                                                                                                                                                             |

## Libraries

| File                                                      | Role                                                                                                                                                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/site/lib/account-api.ts`              | The account pages' side of the account API (liveworkspace/apps/accounts src/account-api.ts), on this same origin under /api/account: the signed-in person's teams and API …                                 |
| `liveworkspace/apps/site/lib/account-metadata.ts`         |                                                                                                                                                                                                             |
| `liveworkspace/apps/site/lib/account-redirect.ts`         | The old account pages (liveworkspace/docs/specs/010-site/site.md "Your account"): `/account`, `/account/settings…` and `/account/tokens` are no longer pages, but emails and bookmarks ca…                  |
| `liveworkspace/apps/site/lib/account-security.ts`         |                                                                                                                                                                                                             |
| `liveworkspace/apps/site/lib/account-settings.ts`         | The account's own settings on this site (liveworkspace/docs/specs/010-site/site.md "Settings", accounts.md "Settings")                                                                                      |
| `liveworkspace/apps/site/lib/accounts.ts`                 | The sign-in pages' side of the accounts API (liveworkspace/apps/accounts), which answers on this same origin under /api/auth                                                                                |
| `liveworkspace/apps/site/lib/app-settings.ts`             | The Settings panel's reach into the account's settings from this site (liveworkspace/docs/specs/010-site/site.md "Settings"): `/api/account/settings…` with the session on liveworkspace.…                  |
| `liveworkspace/apps/site/lib/apps.ts`                     | The page's own words for each app (liveworkspace/docs/specs/010-site/site.md "The apps"): what the card says beyond the shared name and pitch in @liveworkspace/sites                                       |
| `liveworkspace/apps/site/lib/drive/client.ts`             | The Drive service as this site's pages call it (liveworkspace/docs/specs/005-drive/drive.md "The service"): `/api/drive` on this origin, liveworkspace.app or an app's router, with the pe…                 |
| `liveworkspace/apps/site/lib/drive/pages.ts`              | What liveworkspace's three Drive pages decide (liveworkspace/docs/specs/005-drive/drive.md "Connecting", "Open with"), pure so every outcome is tested: /drive/connect asks for a consent …                 |
| `liveworkspace/apps/site/lib/explorer/app-session.ts`     | The app's own session, for the Explorer shown on that app's address (page-app.ts): its signed-in account from the app's API, its sign-in and sign-out, and its guest token                                  |
| `liveworkspace/apps/site/lib/explorer/daily-return.ts`    | The app's returning visitor (liveworkspace/docs/specs/008-telemetry/telemetry.md "The Explorer on liveworkspace.app"), counted by the Explorer on the app's own address the way the app's edit…             |
| `liveworkspace/apps/site/lib/explorer/host.ts`            | What liveworkspace.app hands the shared Explorer (@liveworkspace/explorer) to be its host (liveworkspace/docs/specs/010-site/site.md "The Explorer"): which app the person came from, and…                  |
| `liveworkspace/apps/site/lib/explorer/imports.tsx`        | "Import from" on liveworkspace.app's Explorer: the shared Import From host (@liveworkspace/explorer/imports), over each app's own address                                                                   |
| `liveworkspace/apps/site/lib/explorer/inbox.tsx`          | The Inbox's extras (@liveworkspace/explorer `InboxHost`): a Plan card's type glyph, from the Plan glyph set liveplanner's own Inbox draws, and the help article on actions…                                 |
| `liveworkspace/apps/site/lib/explorer/library.ts`         | The Library on liveworkspace.app's Explorer: each app's Image Gallery and Shape Libraries, read from the app's API by the workspace token (@liveworkspace/explorer's appLi…                                 |
| `liveworkspace/apps/site/lib/explorer/new-team.ts`        | After a team is made, joined, renamed, left or deleted in the Explorer (its TeamsHost's onTeamsChanged; liveworkspace/docs/specs/004-index/one-explorer.md "Teams are run in the Explorer"…                 |
| `liveworkspace/apps/site/lib/explorer/offline-moves.tsx`  | Take Offline and Sync in the Explorer on an app's own address (liveworkspace/docs/specs/004-index/one-explorer.md "The Explorer on each app's address")                                                     |
| `liveworkspace/apps/site/lib/explorer/page-app.ts`        | Where the Explorer page is being shown (liveworkspace/docs/specs/010-site/site.md "The Explorer")                                                                                                           |
| `liveworkspace/apps/site/lib/explorer/previews.tsx`       | Item previews in the Explorer (liveworkspace/docs/specs/006-media/previews.md): one address for every app's items, `/api/previews/items/<id>` on the page's own origin (liveworkspace.app'…                 |
| `liveworkspace/apps/site/lib/explorer/search.ts`          | The Search panel's own entries on the Explorer (liveworkspace/docs/specs/010-site/site.md "The Explorer", Search): the Explorer's help articles in the app's help centre, and, signed in,…                  |
| `liveworkspace/apps/site/lib/explorer/settings.ts`        | The person's synced settings the Explorer on liveworkspace.app follows (liveworkspace/docs/specs/003-accounts/accounts.md "Settings"): whether Home's banner is hidden (`homeBanner`, a commo…              |
| `liveworkspace/apps/site/lib/explorer/share.ts`           | The Share dialog's extras on liveworkspace.app (@liveworkspace/explorer `ShareHost`), for every app's items without any of the apps' code: each app says in the sites regi…                                 |
| `liveworkspace/apps/site/lib/explorer/silent.ts`          | Signing in without a click on an app's own address (liveworkspace/docs/specs/003-accounts/accounts.md "Signing in without a click"), for the Explorer served there (page-app.ts)                            |
| `liveworkspace/apps/site/lib/explorer/telemetry.ts`       | The Explorer's telemetry on liveworkspace.app (liveworkspace/docs/specs/008-telemetry/telemetry.md "The Explorer on liveworkspace.app"): the reports @liveworkspace/explorer hands its host, s…             |
| `liveworkspace/apps/site/lib/explorer/token.ts`           | Who the Explorer asks the index as (liveworkspace/docs/specs/010-site/site.md "The Explorer"): the token accounts hands this site for its session's account, or for the browser's guest (…                  |
| `liveworkspace/apps/site/lib/explorer/welcome.ts`         | Home's first run on liveworkspace.app: the starting points of the app the person came from, from that app's welcome manifest (`@<app>/templates/welcome.json`, generated f…                                 |
| `liveworkspace/apps/site/lib/legal.ts`                    | What the legal pages share (liveworkspace/docs/specs/010-site/site.md "Privacy and terms").                                                                                                                 |
| `liveworkspace/apps/site/lib/licences/apps.ts`            |                                                                                                                                                                                                             |
| `liveworkspace/apps/site/lib/licences/embedded-works.ts`  |                                                                                                                                                                                                             |
| `liveworkspace/apps/site/lib/licences/generate.ts`        | Generates liveworkspace.app's /licences data (liveworkspace/docs/specs/010-site/site.md "Licences") with the monorepo's one generator and liveworkspace's own tables                                        |
| `liveworkspace/apps/site/lib/licences/overrides.ts`       |                                                                                                                                                                                                             |
| `liveworkspace/apps/site/lib/location-search.ts`          |                                                                                                                                                                                                             |
| `liveworkspace/apps/site/lib/session.ts`                  |                                                                                                                                                                                                             |
| `liveworkspace/apps/site/lib/settings-telemetry.ts`       | Settings changed on liveworkspace.app, counted for the app they belong to (liveworkspace/docs/specs/008-telemetry/telemetry.md "The Explorer on liveworkspace.app"): each change once, where i…             |
| `liveworkspace/apps/site/lib/status/history.ts`           | The status page's stored history (liveworkspace/docs/specs/010-site/site.md "Status", liveworkspace/docs/specs/009-status/status.md): one read of the status Worker's `/api/status/history`, and what the … |
| `liveworkspace/apps/site/lib/status/probe.ts`             | Running the status page's checks (liveworkspace/docs/specs/010-site/site.md "Status") and reading them: each service's state, each group's, and the page's                                                  |
| `liveworkspace/apps/site/lib/teams.ts`                    | What the join and decline landings need (liveworkspace/docs/specs/010-site/site.md "Joining and declining"): where a team and the invitations are in the Explorer, the token a join link …                  |
| `liveworkspace/apps/site/lib/turnstile.ts`                | Cloudflare Turnstile on the sign-in pages: the one script this site loads from another origin (the Trusted Types boot in app/layout.tsx allows it)                                                          |
| `packages/sites/src/app-origins.ts`                       | Every address an app answers on, per environment (liveworkspace/docs/specs/003-accounts/accounts.md "Signing in on the app's own address")                                                                  |
| `packages/sites/src/index.ts`                             | liveworkspace's sites (liveworkspace/docs/specs/010-site/site-switcher.md): the platform first, then each app                                                                                               |
| `packages/sites/src/network.ts`                           | Visitors' addresses, for the platform's per-network limits and counts: the address a request came from, as the app's router names it when it forwarded the request, and th…                                 |
| `packages/sites/src/picture.ts`                           | A profile picture URL as it may be stored, sent to other people and drawn (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"): Google's own `picture` claim, an https URL …              |
| `packages/sites/src/workspace-proxy.ts`                   | liveworkspace pages served under an app's own address (liveworkspace/docs/specs/004-index/one-explorer.md "The Explorer on each app's address")                                                             |
| `packages/account-menu/src/AccountMenu.tsx`               |                                                                                                                                                                                                             |
| `packages/account-menu/src/AppAccountMenu.tsx`            |                                                                                                                                                                                                             |
| `packages/account-menu/src/app-account.ts`                | Who is signed in on an app's own pages (liveworkspace/docs/specs/003-accounts/accounts.md "An app's signed-in cookies"), for the marketing header's account menu                                            |
| `packages/account-menu/src/face.tsx`                      | What the account control's trigger looks like, shared by the menu (AccountMenu) and the Guest stand-in a marketing page shows before the menu's code is wanted (DeferredAc…                                 |
| `packages/account-menu/src/index.ts`                      | The account control, one for liveworkspace.app and every app, signed in or as Guest (liveworkspace/docs/specs/010-site/site.md "The header").                                                               |
| `packages/account-menu/src/initials.ts`                   |                                                                                                                                                                                                             |
| `packages/account-menu/src/placeholder.tsx`               | The account control's light entry (`/placeholder`): what a header can show without loading the menu.                                                                                                        |
| `packages/account-menu/src/site-account.tsx`              |                                                                                                                                                                                                             |
| `packages/account-menu/src/test/setup.ts`                 |                                                                                                                                                                                                             |
| `packages/settings-ui/src/AccordionSection.tsx`           | A single-open accordion section: an uppercase header with the shared disclosure ChevronIcon, and a body that eases open on a grid-rows transition (which animates from not…                                 |
| `packages/settings-ui/src/CatalogueSettingsView.tsx`      | The Settings panel's view over what it reads from the accounts API (liveworkspace/docs/specs/010-site/site.md "Settings"): one app's settings from its plain-data catalogue (liveworkspac…                  |
| `packages/settings-ui/src/SettingsCategoryList.tsx`       |                                                                                                                                                                                                             |
| `packages/settings-ui/src/SettingsCategoryPane.tsx`       |                                                                                                                                                                                                             |
| `packages/settings-ui/src/SettingsGroup.tsx`              |                                                                                                                                                                                                             |
| `packages/settings-ui/src/SettingsPanel.tsx`              |                                                                                                                                                                                                             |
| `packages/settings-ui/src/SettingsRowShell.tsx`           |                                                                                                                                                                                                             |
| `packages/settings-ui/src/SettingsView.tsx`               |                                                                                                                                                                                                             |
| `packages/settings-ui/src/account-model.tsx`              | The Settings panel's Account section (liveworkspace/docs/specs/010-site/site.md "Settings"): what belongs to the person in every app rather than to one, built once here and shown in the…                  |
| `packages/settings-ui/src/bind.ts`                        |                                                                                                                                                                                                             |
| `packages/settings-ui/src/catalogue-model.tsx`            | One app's settings as plain data (its derived catalogue, @liveworkspace/settings/catalogues/<app>, and its stored scopes) as the Settings view's model, so the Settings pa…                                 |
| `packages/settings-ui/src/cloud-sync/GoogleDriveRow.tsx`  | Google Drive's row in Settings > Account > Cloud Sync (liveworkspace/docs/specs/005-drive/drive.md "Connecting")                                                                                            |
| `packages/settings-ui/src/cloud-sync/cloud-sync-copy.ts`  | The Google Drive row's words in Settings > Account > Cloud Sync (liveworkspace/docs/specs/005-drive/drive.md "Connecting": the statuses, the problem lines, layout stability)                               |
| `packages/settings-ui/src/cloud-sync/cloud-sync-host.tsx` | Settings > Account > Cloud Sync (liveworkspace/docs/specs/005-drive/drive.md "Connecting"): a catalogue of cloud providers, one row each, Google Drive the first                                            |
| `packages/settings-ui/src/common-model.ts`                | The All view's Common group (liveworkspace/docs/specs/010-site/site.md "Settings"): every editor setting two or more apps have, once (@liveworkspace/settings/common), as the Settings vi…                  |
| `packages/settings-ui/src/device-store.ts`                | A guest's settings for the Settings panel (liveworkspace/docs/specs/010-site/site.md "Settings", "A guest"): the copy the app's editor keeps in this browser on the app's own address, re…                  |
| `packages/settings-ui/src/fold-account.ts`                | The All view shows the Account section once (liveworkspace/docs/specs/010-site/site.md "Settings", "The Account section shows once")                                                                        |
| `packages/settings-ui/src/frame.ts`                       | The Settings dialog's frame (every app's Settings and liveworkspace.app's): wide enough on desktop for the rail and a readable pane side by side (the Dialog's `3xl`, 60re…                                 |
| `packages/settings-ui/src/glyphs.tsx`                     |                                                                                                                                                                                                             |
| `packages/settings-ui/src/groups.ts`                      | Filing one source's categories under a heading of the All view (the Account section, or an app): each category and row id is prefixed with the heading's, so two apps' "Ed…                                 |
| `packages/settings-ui/src/index.ts`                       | The one Settings panel every liveworkspace app's Settings and liveworkspace.app open (SettingsPanel: this app's settings or All, each app's docs/specs/007-editor/user-pre…                                 |
| `packages/settings-ui/src/kit.tsx`                        |                                                                                                                                                                                                             |
| `packages/settings-ui/src/merge-categories.ts`            | The All view's one set of categories (liveworkspace/docs/specs/010-site/site.md "Settings", "All"): Common's and every app's categories merged by their place, the category's name under …                  |
| `packages/settings-ui/src/model.ts`                       |                                                                                                                                                                                                             |
| `packages/settings-ui/src/own-toggle.ts`                  | An editor's Account section writes its shared switches through the editor's own rows (each app's docs/specs/007-editor/user-preferences.md "This app or All")                                               |
| `packages/settings-ui/src/profile/ProfileEditor.tsx`      |                                                                                                                                                                                                             |
| `packages/settings-ui/src/profile/ProfileHeader.tsx`      |                                                                                                                                                                                                             |
| `packages/settings-ui/src/profile/SecurityRows.tsx`       |                                                                                                                                                                                                             |
| `packages/settings-ui/src/profile/profile-events.ts`      | A profile just saved in the Settings panel's Profile (liveworkspace/docs/specs/010-site/site.md "Settings", "Profile"), told to whatever on the page shows the person: an editor's own pr…                  |
| `packages/settings-ui/src/profile/profile-host.ts`        | How the Settings panel's Profile reaches the person's profile (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles"): the host loads it and saves a patch, over whatever door it has                |
| `packages/settings-ui/src/profile/profile-rows.tsx`       |                                                                                                                                                                                                             |
| `packages/settings-ui/src/request.ts`                     | How the Settings panel reaches the accounts API (liveworkspace/docs/specs/003-accounts/accounts.md "Who calls what")                                                                                        |
| `packages/settings-ui/src/rows/ChoiceRow.tsx`             |                                                                                                                                                                                                             |
| `packages/settings-ui/src/rows/SimpleRows.tsx`            |                                                                                                                                                                                                             |
| `packages/settings-ui/src/rows/SliderRow.tsx`             |                                                                                                                                                                                                             |
| `packages/settings-ui/src/rows/ToggleGroupRow.tsx`        |                                                                                                                                                                                                             |
| `packages/settings-ui/src/rows/ToggleRow.tsx`             |                                                                                                                                                                                                             |
| `packages/settings-ui/src/saver.ts`                       | Saving what the Settings panel changes over the accounts API (liveworkspace/docs/specs/010-site/site.md "Settings")                                                                                         |
| `packages/settings-ui/src/scope.tsx`                      |                                                                                                                                                                                                             |
| `packages/settings-ui/src/settings-scroll-anchor.ts`      |                                                                                                                                                                                                             |
| `packages/settings-ui/src/settings-search.ts`             |                                                                                                                                                                                                             |
| `packages/settings-ui/src/settings-view-memory.ts`        | Where the Settings dialog was left: the category open and the scroll anchor in its pane (docs/specs/007-editor/user-preferences.md, "It reopens where                                                       |
| `packages/settings-ui/src/store.ts`                       | Reading and writing the account's settings for the Settings panel (liveworkspace/docs/specs/003-accounts/accounts.md "Settings", "Who calls what"), over the accounts API wherever the panel …              |
| `packages/settings-ui/src/test/fixture.ts`                |                                                                                                                                                                                                             |
| `packages/settings-ui/src/test/kit.tsx`                   |                                                                                                                                                                                                             |
| `packages/settings-ui/src/test/setup.ts`                  |                                                                                                                                                                                                             |
| `packages/settings-ui/src/useFollowingDraft.ts`           |                                                                                                                                                                                                             |
| `packages/settings-ui/src/useSavedFlash.ts`               |                                                                                                                                                                                                             |
| `packages/settings-ui/src/useSettingsViewMemory.ts`       |                                                                                                                                                                                                             |

## Components

`apps/site/components/`, by folder (file counts, tests left out):

| Folder        | Files |
| ------------- | ----- |
| `(top level)` | 7     |
| `account`     | 4     |
| `drive`       | 5     |
| `explorer`    | 6     |
| `landing`     | 8     |
| `settings`    | 7     |
| `status`      | 5     |
| `teams`       | 3     |
| `workbench`   | 1     |

## Constants and configuration: the Worker

`liveworkspace/apps/site/wrangler.toml`, account `851be7d244b76a6557bcbe6c4ded80f5`, main ``, compatibility date `2026-05-29`.

**Production**

| Setting     | Value                                   |
| ----------- | --------------------------------------- |
| Worker name | `liveworkspace-site`                    |
| Route       | `liveworkspace.app` (custom domain)     |
| Route       | `www.liveworkspace.app` (custom domain) |
| Assets      | `./out`                                 |

**`env.staging`**

| Setting     | Value                                       |
| ----------- | ------------------------------------------- |
| Worker name | `liveworkspace-site-staging`                |
| Route       | `staging.liveworkspace.app` (custom domain) |
| Assets      | `./out`                                     |

## Constants and configuration: named constants

| Constant                      | Value                                                           | File                        |
| ----------------------------- | --------------------------------------------------------------- | --------------------------- |
| `ACCOUNT_API`                 | `'/api/account'`                                                | `account-api.ts`            |
| `ACCOUNT_PAGE_METADATA`       | `(object or list, see file)`                                    | `account-metadata.ts`       |
| `SETTINGS_CONTENTS`           | `(object or list, see file)`                                    | `account-settings.ts`       |
| `ACCOUNTS_API`                | `'/api/auth'`                                                   | `accounts.ts`               |
| `EMAIL_PATTERN`               | `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`                                  | `accounts.ts`               |
| `RETURN_PARAM`                | `'return'`                                                      | `accounts.ts`               |
| `HANDOFF_PARAM`               | `'handoff'`                                                     | `accounts.ts`               |
| `APP_COPY`                    | `(object or list, see file)`                                    | `apps.ts`                   |
| `DRIVE_SETTINGS_PARAM`        | `'profile'`                                                     | `client.ts`                 |
| `SIGNED_IN_HINTS`             | `(object or list, see file)`                                    | `app-session.ts`            |
| `LAST_APP_KEY`                | `'liveworkspace:explorer-app'`                                  | `host.ts`                   |
| `SETTINGS_PARAM`              | `'settings'`                                                    | `host.ts`                   |
| `SECTION_PARAM`               | `'section'`                                                     | `host.ts`                   |
| `NOTIFICATIONS_SETTINGS`      | `/explorer?${SETTINGS_PARAM}=notifications`                     | `host.ts`                   |
| `ENDED_PARAM`                 | `'ended'`                                                       | `host.ts`                   |
| `RETIRED_TARGETS`             | `(object or list, see file)`                                    | `host.ts`                   |
| `PREVIEW_CACHE_MAX`           | `200`                                                           | `previews.tsx`              |
| `PREVIEW_CACHE_CEILING`       | `1000`                                                          | `previews.tsx`              |
| `PREVIEW_CONCURRENCY`         | `4`                                                             | `previews.tsx`              |
| `WORKSPACE_TOKEN_URL`         | `'/api/auth/workspace-token'`                                   | `token.ts`                  |
| `LEGAL_UPDATED`               | `'25 October 2026'`                                             | `legal.ts`                  |
| `CONTACT_URL`                 | `'https://livediagram-router.liveworkspace-easing509.workers.…` | `legal.ts`                  |
| `LICENCE_APPS`                | `(object or list, see file)`                                    | `apps.ts`                   |
| `EMBEDDED_WORKS`              | `(object or list, see file)`                                    | `embedded-works.ts`         |
| `OVERRIDES`                   | `(object or list, see file)`                                    | `overrides.ts`              |
| `HISTORY_REFRESH_MS`          | `5 * 60_000`                                                    | `history.ts`                |
| `CHECK_COOLDOWN_MS`           | `30_000`                                                        | `probe.ts`                  |
| `HISTORY_MAX`                 | `30`                                                            | `probe.ts`                  |
| `OVERALL_COPY`                | `(object or list, see file)`                                    | `probe.ts`                  |
| `INVITES_PATH`                | `'/explorer/invites'`                                           | `teams.ts`                  |
| `AVATAR_TONES`                | `(object or list, see file)`                                    | `teams.ts`                  |
| `TURNSTILE_ORIGIN`            | `'https://challenges.cloudflare.com'`                           | `turnstile.ts`              |
| `STAND_INS`                   | `(object or list, see file)`                                    | `app-origins.ts`            |
| `LOCAL_PORTS`                 | `(object or list, see file)`                                    | `index.ts`                  |
| `PLATFORM_SITE`               | `(object or list, see file)`                                    | `index.ts`                  |
| `APP_SITES`                   | `(object or list, see file)`                                    | `index.ts`                  |
| `SITES`                       | `[PLATFORM_SITE, ...APP_SITES]`                                 | `index.ts`                  |
| `APP_ITEMS`                   | `(object or list, see file)`                                    | `index.ts`                  |
| `APP_NAMES`                   | `Object.keys(APP_ITEMS) as AppName[]`                           | `index.ts`                  |
| `EXPLORER_PATH`               | `'/explorer'`                                                   | `index.ts`                  |
| `EXPLORER_FROM_PARAM`         | `'from'`                                                        | `index.ts`                  |
| `TERMS_LABEL`                 | `'Terms of Use'`                                                | `index.ts`                  |
| `PROFILE_PICTURE_HOST`        | `'lh3.googleusercontent.com'`                                   | `picture.ts`                |
| `PROFILE_PICTURE_ORIGIN`      | `https://${PROFILE_PICTURE_HOST}`                               | `picture.ts`                |
| `MAX_PICTURE_URL_LEN`         | `512`                                                           | `picture.ts`                |
| `DEFAULT_PICTURE_PX`          | `96`                                                            | `picture.ts`                |
| `PRODUCTION_WORKSPACE_ORIGIN` | `'https://liveworkspace.app'`                                   | `workspace-proxy.ts`        |
| `WORKSPACE_PROXY_HEADER`      | `'X-Liveworkspace-Proxy'`                                       | `workspace-proxy.ts`        |
| `WORKSPACE_CLIENT_IP_HEADER`  | `'X-Liveworkspace-Client-IP'`                                   | `workspace-proxy.ts`        |
| `STATUS_PATH`                 | `'/status'`                                                     | `workspace-proxy.ts`        |
| `EXPLORER_ROUTE`              | `(object or list, see file)`                                    | `workspace-proxy.ts`        |
| `ACCOUNT_ROUTE`               | `(object or list, see file)`                                    | `workspace-proxy.ts`        |
| `SIGN_IN_PAGE_ROUTES`         | `(object or list, see file)`                                    | `workspace-proxy.ts`        |
| `ACCOUNTS_ON_APP_PATH`        | `'/api/workspace/auth'`                                         | `workspace-proxy.ts`        |
| `ACCOUNTS_ROUTE`              | `(object or list, see file)`                                    | `workspace-proxy.ts`        |
| `FLOW_COOKIE_MAX_AGE_SECONDS` | `900`                                                           | `workspace-proxy.ts`        |
| `FLOW_COOKIE_PREFIX`          | `'lw_flow.'`                                                    | `workspace-proxy.ts`        |
| `SITE_ASSET_PREFIX`           | `'/_liveworkspace'`                                             | `workspace-proxy.ts`        |
| `SITE_ASSETS_ROUTE`           | `(object or list, see file)`                                    | `workspace-proxy.ts`        |
| `WORKBENCH_ROUTE`             | `(object or list, see file)`                                    | `workspace-proxy.ts`        |
| `PRODUCTION_INDEX_ORIGIN`     | `'https://liveworkspace.app'`                                   | `workspace-proxy.ts`        |
| `PRODUCTION_DRIVE_ORIGIN`     | `'https://liveworkspace.app'`                                   | `workspace-proxy.ts`        |
| `DRIVE_PATH`                  | `'/api/drive'`                                                  | `workspace-proxy.ts`        |
| `PRODUCTION_PREVIEWS_ORIGIN`  | `'https://liveworkspace.app'`                                   | `workspace-proxy.ts`        |
| `PREVIEWS_PATH`               | `'/api/previews'`                                               | `workspace-proxy.ts`        |
| `SETTINGS_HREF`               | `'/explorer?settings=all'`                                      | `AccountMenu.tsx`           |
| `ACCOUNT_TRIGGER_CLASS`       | `'relative touch-target-y inline-flex max-w-56 cursor-pointer…` | `face.tsx`                  |
| `GUEST_LABEL`                 | `'Guest'`                                                       | `face.tsx`                  |
| `ACCOUNT_GROUP`               | `'account'`                                                     | `CatalogueSettingsView.tsx` |
| `APPS_GROUP`                  | `'apps'`                                                        | `CatalogueSettingsView.tsx` |
| `SETTINGS_CARD`               | `'rounded-xl border border-slate-200 bg-white dark:border-sla…` | `SettingsGroup.tsx`         |
| `SETTINGS_CARD_SLOT`          | `'border-t border-slate-100 first:rounded-t-xl first:border-t…` | `SettingsGroup.tsx`         |
| `SETTINGS_ROW_BUTTON`         | `'shrink-0 cursor-pointer rounded-lg border border-slate-200 …` | `SettingsRowShell.tsx`      |
| `DRIVE_ROW_REFRESH_MS`        | `5_000`                                                         | `GoogleDriveRow.tsx`        |
| `DRIVE_NOT_SYNCED_YET`        | `'Not synced yet'`                                              | `cloud-sync-copy.ts`        |
| `DRIVE_CONNECT_FAILED`        | `'Couldn’t reach Google. Check your connection and try again.'` | `cloud-sync-copy.ts`        |
| `DRIVE_CONNECT_CANCELLED`     | `'Connection cancelled. Connect whenever you’re ready.'`        | `cloud-sync-copy.ts`        |
| `DRIVE_OFFLINE`               | `'Can’t reach Google Drive. Trying again automatically.'`       | `cloud-sync-copy.ts`        |
| `DRIVE_NEEDS_RECONNECT`       | `'Google Drive needs reconnecting. Your files are safe.'`       | `cloud-sync-copy.ts`        |
| `DRIVE_NOTICE_TEXT`           | `'Moved to a Drive folder liveworkspace can’t see.'`            | `cloud-sync-copy.ts`        |
| `DRIVE_NOT_CONNECTED_TEXT`    | `'Your work from every app, copied to your Google Drive in ma…` | `cloud-sync-copy.ts`        |
| `DRIVE_SINCE_STEPS_MS`        | `[DRIVE_JUST_NOW_MS, DRIVE_UNDER_A_MINUTE_MS] as const`         | `cloud-sync-copy.ts`        |
| `CLOUD_SYNC_PROVIDERS`        | `(object or list, see file)`                                    | `cloud-sync-host.tsx`       |
| `COMMON_GROUP`                | `'common'`                                                      | `common-model.ts`           |
| `SETTINGS_DIALOG_SIZE`        | `'3xl' as const`                                                | `frame.ts`                  |
| `SETTINGS_DIALOG_CLASS`       | `'max-h-[calc(100%-2rem)] sm:h-[min(44rem,calc(100%-6rem))] s…` | `frame.ts`                  |
| `NAME_SAVE_DELAY_MS`          | `800`                                                           | `ProfileEditor.tsx`         |
| `SETTINGS_INPUT`              | `'w-full rounded-xl border border-slate-300 bg-white px-3 py-…` | `ProfileEditor.tsx`         |
| `PROFILE_SECTIONS`            | `(object or list, see file)`                                    | `profile-rows.tsx`          |
| `SETTINGS_ROW_ATTRIBUTE`      | `'data-settings-row'`                                           | `settings-scroll-anchor.ts` |
| `SETTINGS_APP_IDS`            | `Object.keys(CATALOGUES) as SettingsAppId[]`                    | `store.ts`                  |
| `TEST_KIT`                    | `(object or list, see file)`                                    | `kit.tsx`                   |

## Testing

123 test files:

- `liveworkspace/apps/site/app/not-found.test.ts`
- `liveworkspace/apps/site/app/seo-pages.test.ts`
- `liveworkspace/apps/site/app/telemetry/AllApps.test.ts`
- `liveworkspace/apps/site/app/telemetry/_shared/CardColumns.test.ts`
- `liveworkspace/apps/site/app/telemetry/_shared/LeaderTag.test.ts`
- `liveworkspace/apps/site/app/telemetry/_shared/MetricBreadcrumb.test.ts`
- `liveworkspace/apps/site/app/telemetry/_shared/MetricCloud.test.ts`
- `liveworkspace/apps/site/app/telemetry/_shared/MetricPicker.test.tsx`
- `liveworkspace/apps/site/app/telemetry/_shared/StickyWindowBar.test.tsx`
- `liveworkspace/apps/site/app/telemetry/_shared/TimingsView.test.tsx`
- `liveworkspace/apps/site/app/telemetry/_shared/appearance-colours.test.ts`
- `liveworkspace/apps/site/app/telemetry/_shared/colour-maths.test.ts`
- `liveworkspace/apps/site/app/telemetry/_shared/dashboard-maths.test.ts`
- `liveworkspace/apps/site/app/telemetry/_shared/display-logic.test.ts`
- `liveworkspace/apps/site/app/telemetry/_shared/event-vocab.test.ts`
- `liveworkspace/apps/site/app/telemetry/_shared/stack-colours.test.ts`
- `liveworkspace/apps/site/app/telemetry/_shared/tabs.test.tsx`
- `liveworkspace/apps/site/app/telemetry/_shared/timing-stats.test.ts`
- `liveworkspace/apps/site/app/telemetry/apps.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedesign/computed-emitters.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedesign/cta-funnel.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedesign/event-explanation.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedesign/metric-emitters.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedesign/metric-series.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedesign/page-views.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedesign/ranking-rules.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedesign/retired-events.test.ts`
- `liveworkspace/apps/site/app/telemetry/livediagram/computed-emitters.test.ts`
- `liveworkspace/apps/site/app/telemetry/livediagram/cta-funnel.test.ts`
- `liveworkspace/apps/site/app/telemetry/livediagram/event-explanation.test.ts`
- `liveworkspace/apps/site/app/telemetry/livediagram/metric-emitters.test.ts`
- `liveworkspace/apps/site/app/telemetry/livediagram/metric-series.test.ts`
- `liveworkspace/apps/site/app/telemetry/livediagram/page-views.test.ts`
- `liveworkspace/apps/site/app/telemetry/livediagram/ranking-rules.test.ts`
- `liveworkspace/apps/site/app/telemetry/livediagram/retired-events.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedocuments/computed-emitters.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedocuments/cta-funnel.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedocuments/event-explanation.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedocuments/metric-emitters.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedocuments/metric-series.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedocuments/page-views.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedocuments/ranking-rules.test.ts`
- `liveworkspace/apps/site/app/telemetry/livedocuments/retired-events.test.ts`
- `liveworkspace/apps/site/app/telemetry/liveplanner/cta-funnel.test.ts`
- `liveworkspace/apps/site/app/telemetry/liveplanner/event-explanation.test.ts`
- `liveworkspace/apps/site/app/telemetry/liveplanner/metric-emitters.test.ts`
- `liveworkspace/apps/site/app/telemetry/liveplanner/metric-series.test.ts`
- `liveworkspace/apps/site/app/telemetry/liveplanner/page-views.test.ts`
- `liveworkspace/apps/site/app/telemetry/liveplanner/ranking-rules.test.ts`
- `liveworkspace/apps/site/app/telemetry/liveplanner/retired-events.test.ts`
- `liveworkspace/apps/site/app/telemetry/page.test.tsx`
- `liveworkspace/apps/site/app/telemetry/platform-emitters.test.ts`
- `liveworkspace/apps/site/appearance-guard.test.ts`
- `liveworkspace/apps/site/asset-prefix.test.ts`
- `liveworkspace/apps/site/components/drive/drive-switch-dialog.test.tsx`
- `liveworkspace/apps/site/components/settings/site-settings-dialog.test.tsx`
- `liveworkspace/apps/site/components/status/StatusBoard.test.tsx`
- `liveworkspace/apps/site/components/teams/teams-ui.test.tsx`
- `liveworkspace/apps/site/components/workbench/PairWorkbench.test.tsx`
- `liveworkspace/apps/site/e2e/trusted-types.spec.ts`
- `liveworkspace/apps/site/lib/account-redirect.test.ts`
- `liveworkspace/apps/site/lib/account-settings.test.ts`
- `liveworkspace/apps/site/lib/accounts.test.ts`
- `liveworkspace/apps/site/lib/app-settings.test.ts`
- `liveworkspace/apps/site/lib/apps.test.ts`
- `liveworkspace/apps/site/lib/comparison-redirects.test.ts`
- `liveworkspace/apps/site/lib/drive/pages.test.ts`
- `liveworkspace/apps/site/lib/explorer/daily-return.test.ts`
- `liveworkspace/apps/site/lib/explorer/guest-consent.test.ts`
- `liveworkspace/apps/site/lib/explorer/host.test.ts`
- `liveworkspace/apps/site/lib/explorer/imports.test.tsx`
- `liveworkspace/apps/site/lib/explorer/inbox-local.test.ts`
- `liveworkspace/apps/site/lib/explorer/inbox.test.tsx`
- `liveworkspace/apps/site/lib/explorer/library.test.ts`
- `liveworkspace/apps/site/lib/explorer/new-team-app.test.ts`
- `liveworkspace/apps/site/lib/explorer/offline-moves.test.tsx`
- `liveworkspace/apps/site/lib/explorer/page-app.test.ts`
- `liveworkspace/apps/site/lib/explorer/platform-welcome.test.ts`
- `liveworkspace/apps/site/lib/explorer/previews.test.tsx`
- `liveworkspace/apps/site/lib/explorer/share.test.ts`
- `liveworkspace/apps/site/lib/explorer/telemetry.test.ts`
- `liveworkspace/apps/site/lib/explorer/welcome.test.ts`
- `liveworkspace/apps/site/lib/licences/licences.test.ts`
- `liveworkspace/apps/site/lib/session.test.tsx`
- `liveworkspace/apps/site/lib/settings-telemetry.test.ts`
- `liveworkspace/apps/site/lib/status/history.test.ts`
- `liveworkspace/apps/site/lib/status/no-app-status.test.ts`
- `liveworkspace/apps/site/lib/status/probe.test.ts`
- `liveworkspace/apps/site/lib/teams-redirects.test.ts`
- `liveworkspace/apps/site/lib/teams.test.ts`
- `liveworkspace/apps/site/motion-budget.test.ts`
- `liveworkspace/apps/site/optical-guard.test.ts`
- `liveworkspace/apps/site/touch-target-guard.test.ts`
- `liveworkspace/apps/site/trusted-types-guard.test.ts`
- `packages/sites/src/app-origins.test.ts`
- `packages/sites/src/explorer.test.ts`
- `packages/sites/src/index.test.ts`
- `packages/sites/src/network.test.ts`
- `packages/sites/src/picture-csp.test.ts`
- `packages/sites/src/picture.test.ts`
- `packages/sites/src/previews-proxy.test.ts`
- `packages/sites/src/status-redirect.test.ts`
- `packages/sites/src/workspace-proxy.test.ts`
- `packages/account-menu/src/AppAccountMenu.test.tsx`
- `packages/account-menu/src/initials.test.ts`
- `packages/settings-ui/src/SettingsCategoryList.test.tsx`
- `packages/settings-ui/src/SettingsPanel.test.tsx`
- `packages/settings-ui/src/SettingsView.test.tsx`
- `packages/settings-ui/src/account-model.test.tsx`
- `packages/settings-ui/src/bind.test.ts`
- `packages/settings-ui/src/catalogue-model.test.tsx`
- `packages/settings-ui/src/cloud-sync/GoogleDriveRow.test.tsx`
- `packages/settings-ui/src/cloud-sync/cloud-sync-copy.test.ts`
- `packages/settings-ui/src/device-store.test.ts`
- `packages/settings-ui/src/merge-categories.test.tsx`
- `packages/settings-ui/src/no-duplicates.test.tsx`
- `packages/settings-ui/src/profile/profile.test.tsx`
- `packages/settings-ui/src/profile/security-rows.test.tsx`
- `packages/settings-ui/src/rows.test.tsx`
- `packages/settings-ui/src/saver.test.ts`
- `packages/settings-ui/src/settings-scroll-anchor.test.ts`
- `packages/settings-ui/src/settings-search.test.ts`
- `packages/settings-ui/src/settings-view-memory.test.ts`
