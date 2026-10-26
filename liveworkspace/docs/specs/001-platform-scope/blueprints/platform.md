# The platform: blueprint

Derived from [platform.md](../platform.md). The spec decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md). Paths are relative to the repository root.

## Domain and naming

| Term     | Identifier                                                  | Meaning                                                                            |
| -------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Platform | liveworkspace                                               | The services and packages every app shares, under `liveworkspace/` and `packages/` |
| App      | `livediagram`, `liveplanner`, `livedocuments`, `livedesign` | A product, by its folder; its site is `<app>.app`                                  |
| Service  | `liveworkspace/apps/<service>`                              | A platform Worker on a path of liveworkspace.app                                   |
| Account  | `user_…`                                                    | A person, the same id in every app                                                 |
| Guest    | `guest_<uuid>`                                              | Someone without an account, the same id in every app                               |
| Item     | an index row                                                | A document, project or design, whose content stays in its app                      |

## Behaviour and state

The platform answers for identity (accounts), placement and access (index), copies (Drive), pictures (media),
public listings (community), counts (telemetry) and health (status). An app's item content never leaves the app: the
services hold names, ids, placements and pictures, and call the app back when they need the content.

## Interfaces and contracts

Each service's contract is its own category's spec and blueprint. The shared contracts an app links are the root
`packages/@liveworkspace/*` in the table under Files.

## Security and trust

One account, one guest id and one set of keys per app per service. No service trusts a browser's word for who it
is: a browser presents an accounts token or a guest token, an app's server its key.

## Performance and limits

Each service's blueprint holds its own measured budgets.

## Files

The platform's workspace packages. The services live in `liveworkspace/apps/`; what an app links to reach them lives
in the root `packages/` (so the products can depend on it) or, when only the platform uses it, in
`liveworkspace/packages/`.

| Folder                          | Package                            | What it is                                                                                           |
| ------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts`   | `@liveworkspace/accounts`          | The accounts Worker: Better Auth, OAuth, guests, teams, tokens, settings, profiles, email, workbench |
| `liveworkspace/apps/index`      | `@liveworkspace/index-service`     | The index Worker and its D1 migrations                                                               |
| `liveworkspace/apps/drive`      | `@liveworkspace/drive-service`     | The Google Drive mirror Worker and its `DriveMirror` Durable Object                                  |
| `liveworkspace/apps/media`      | `@liveworkspace/media-service`     | The media Worker (images, previews), its D1 migrations and R2 bucket                                 |
| `liveworkspace/apps/community`  | `@liveworkspace/community-service` | The Community Worker and its D1 migrations                                                           |
| `liveworkspace/apps/telemetry`  | `@liveworkspace/telemetry-service` | The telemetry Worker and its D1 migrations                                                           |
| `liveworkspace/apps/status`     | `@liveworkspace/status-service`    | The hourly status checks and their read API                                                          |
| `liveworkspace/apps/site`       | `@liveworkspace/site`              | liveworkspace.app's static Next.js export                                                            |
| `liveworkspace/apps/migrate`    | `@liveworkspace/migrate`           | The one-off migration command, run from a laptop, never deployed                                     |
| `liveworkspace/packages/status` | `@liveworkspace/status`            | The status checks' list, judge and wire shapes, shared by the Worker and the page                    |
| `packages/auth-client`          | `@liveworkspace/auth-client`       | An app's side of accounts: the OAuth flow, the token check, silent sign-in, account reads            |
| `packages/api-kit`              | `@liveworkspace/api-kit`           | Helpers every api shares: the API token's shape, OAuth codes, client addresses, bodies               |
| `packages/index-client`         | `@liveworkspace/index-client`      | The index's shared contract and a client for it                                                      |
| `packages/index-app`            | `@liveworkspace/index-app`         | The server side every app on the index shares: its internal doors, the migration door                |
| `packages/explorer`             | `@liveworkspace/explorer`          | The One Explorer UI, rendered by the site and every app                                              |
| `packages/drive`                | `@liveworkspace/drive`             | The Drive mirror's contract: file formats, wire shapes, the client, the planner                      |
| `packages/fake-google`          | `@liveworkspace/fake-google`       | An in-memory Google Drive API for the mirror's tests                                                 |
| `packages/media`                | `@liveworkspace/media`             | The media service's contract: apps, upload limits, sniffing, guest owners, a client                  |
| `packages/community`            | `@liveworkspace/community`         | The Community's contract: vocabulary, limits, search, a client                                       |
| `packages/telemetry`            | `@liveworkspace/telemetry`         | The telemetry contract: apps, the batching engine, the server sender, the summary                    |
| `packages/telemetry-client`     | `@liveworkspace/telemetry-client`  | The browser side of telemetry: opt-out, error tracking, timings, page hide                           |
| `packages/email`                | `@liveworkspace/email`             | Every email's sending, through Cloudflare Email Service's `send_email`                               |
| `packages/settings`             | `@liveworkspace/settings`          | The settings catalogue: account, device and presence settings                                        |
| `packages/settings-ui`          | `@liveworkspace/settings-ui`       | The one Settings panel                                                                               |
| `packages/account-menu`         | `@liveworkspace/account-menu`      | The account control, signed in or as Guest                                                           |
| `packages/sites`                | `@liveworkspace/sites`             | Every site's address, app origins, the network helpers and the routers' workspace proxy              |
| `packages/migration`            | `@liveworkspace/migration`         | The migration's contract and the old-document splitter                                               |
