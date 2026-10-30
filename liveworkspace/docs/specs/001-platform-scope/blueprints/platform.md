# The platform: blueprint

Derived from [platform.md](../platform.md). The spec decides; this file only adds engineering precision, read from the code. Defaults are cited as `PLTn`. Paths are relative to the repository root.

## Domain and naming

| Term     | Identifier                                                  | Meaning                                                                                      |
| -------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Platform | liveworkspace                                               | The services and packages every app shares, under `liveworkspace/` and `packages/`           |
| App      | `livediagram`, `liveplanner`, `livedocuments`, `livedesign` | A product, by its folder; its site is `<app>.app`                                            |
| Service  | `liveworkspace/apps/<service>`                              | A platform Worker on a path of liveworkspace.app                                             |
| Account  | `user_[A-Za-z0-9]{1,64}` (`USER_ID`)                        | A person, the same id in every app; new ones `user_` and a UUID's hex, imported ones Clerk's |
| Guest    | `guest_` and a lower-case v4 UUID (`GUEST_ID`)              | Someone without an account, the same id in every app                                         |
| Item     | an index row                                                | A document, project or design, whose content stays in its app                                |

## Behaviour and state

The platform answers for identity (accounts), placement and access (index), copies (Drive), pictures (media),
public listings (community), counts (telemetry) and health (status). An app's item content never leaves the app: the
services hold names, ids, placements and pictures, and call the app back when they need the content.

## Interfaces and contracts

Each service's contract is its own category's spec and blueprint. The shared contracts an app links are the root
`packages/@liveworkspace/*` in the table under Files.

### Who presents what

| Caller                         | Credential                                                                  | Checked by                                                 |
| ------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| A browser on liveworkspace.app | the accounts session cookie (writes same-origin only)                       | accounts; the index, Drive and community through it        |
| A browser on an app            | an access token (ES256 JWT, `aud` the app's API) or a year-long guest token | the app's API offline against `/api/auth/jwks`; the index  |
| A CLI or MCP client            | an API token (`lwt_`, or a carried-over `lvd_`)                             | accounts' `internal/tokens/verify`, cached by the app 60 s |
| A workbench frame              | a workbench session (`lvw_…`)                                               | accounts' `internal/workbench/session`, per request        |
| An app's server to accounts    | its OAuth client id and secret (HTTP Basic)                                 | accounts, by introspection, cached 5 min                   |
| An app's server to the index   | its `INDEX_KEY`, with `X-Index-Person` for a delegated call                 | the index                                                  |
| The index to an app            | the app's `INDEX_KEY` on `/api/internal/*`                                  | the app                                                    |
| accounts and the index         | `INDEX_MERGE_KEY`                                                           | each other                                                 |
| An operator                    | `ADMIN_TOKEN` (clients, bench accounts), `MIGRATION_KEY` (the move)         | accounts; each app's migration door                        |

The details are in [sessions-and-guests.md](../../003-accounts/blueprints/sessions-and-guests.md),
[oauth.md](../../003-accounts/blueprints/oauth.md), [tokens.md](../../003-accounts/blueprints/tokens.md) and
[index.md](../../004-index/blueprints/index.md).

## Security and trust

One account, one guest id and one set of keys per app per service. No service trusts a browser's word for who it
is: a browser presents an accounts token or a guest token, an app's server its key. The apps tell an account from a guest by the
`user_` prefix (each app's `media.ts` names a guest's media owner through `mediaGuestOwner`, an account's as itself),
which is why new accounts keep it.

## Performance and limits

Each service's blueprint holds its own measured budgets.

## Files

The platform's workspace packages. The services live in `liveworkspace/apps/`; what an app links to reach them lives
in the root `packages/` (so the products can depend on it) or, when only the platform uses it, in
`liveworkspace/packages/`.

| Folder                          | Package                            | What it is                                                                                                                                                                                                                        |
| ------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts`   | `@liveworkspace/accounts`          | The accounts Worker: Better Auth, OAuth, guests, teams, tokens, settings, profiles, email, workbench                                                                                                                              |
| `liveworkspace/apps/index`      | `@liveworkspace/index-service`     | The index Worker and its D1 migrations                                                                                                                                                                                            |
| `liveworkspace/apps/drive`      | `@liveworkspace/drive-service`     | The Google Drive mirror Worker and its `DriveMirror` Durable Object                                                                                                                                                               |
| `liveworkspace/apps/media`      | `@liveworkspace/media-service`     | The media Worker (images, previews), its D1 migrations and R2 bucket                                                                                                                                                              |
| `liveworkspace/apps/community`  | `@liveworkspace/community-service` | The Community Worker and its D1 migrations                                                                                                                                                                                        |
| `liveworkspace/apps/telemetry`  | `@liveworkspace/telemetry-service` | The telemetry Worker and its D1 migrations                                                                                                                                                                                        |
| `liveworkspace/apps/status`     | `@liveworkspace/status-service`    | The hourly status checks and their read API                                                                                                                                                                                       |
| `liveworkspace/apps/site`       | `@liveworkspace/site`              | liveworkspace.app's static Next.js export                                                                                                                                                                                         |
| `liveworkspace/apps/migrate`    | `@liveworkspace/migrate`           | The one-off migration command, run from a laptop, never deployed                                                                                                                                                                  |
| `liveworkspace/packages/status` | `@liveworkspace/status`            | The status checks' list, judge and wire shapes, shared by the Worker and the page                                                                                                                                                 |
| `packages/auth-client`          | `@liveworkspace/auth-client`       | An app's side of accounts: the OAuth flow, the token check, silent sign-in, account reads                                                                                                                                         |
| `packages/api-kit`              | `@liveworkspace/api-kit`           | Helpers every api shares: the API token's shape, OAuth codes, client addresses, bodies                                                                                                                                            |
| `packages/index-client`         | `@liveworkspace/index-client`      | The index's shared contract and a client for it                                                                                                                                                                                   |
| `packages/index-app`            | `@liveworkspace/index-app`         | The server side every app on the index shares: its internal doors, the migration door                                                                                                                                             |
| `packages/explorer`             | `@liveworkspace/explorer`          | The One Explorer UI, rendered by the site and every app                                                                                                                                                                           |
| `packages/drive`                | `@liveworkspace/drive`             | The Drive mirror's contract: file formats, wire shapes, the client, the planner                                                                                                                                                   |
| `packages/fake-google`          | `@liveworkspace/fake-google`       | An in-memory Google Drive API for the mirror's tests                                                                                                                                                                              |
| `packages/media`                | `@liveworkspace/media`             | The media service's contract: apps, upload limits, sniffing, guest owners, a client                                                                                                                                               |
| `packages/community`            | `@liveworkspace/community`         | The Community's contract: vocabulary, limits, search, a client                                                                                                                                                                    |
| `packages/telemetry`            | `@liveworkspace/telemetry`         | The telemetry contract: apps, the batching engine, the server sender, the summary                                                                                                                                                 |
| `packages/telemetry-client`     | `@liveworkspace/telemetry-client`  | The browser side of telemetry: opt-out, error tracking, timings, page hide                                                                                                                                                        |
| `packages/email`                | `@liveworkspace/email`             | Every email's sending, through Cloudflare Email Service's `send_email`                                                                                                                                                            |
| `packages/settings`             | `@liveworkspace/settings`          | The settings catalogue: account, device and presence settings                                                                                                                                                                     |
| `packages/settings-ui`          | `@liveworkspace/settings-ui`       | The one Settings panel                                                                                                                                                                                                            |
| `packages/account-menu`         | `@liveworkspace/account-menu`      | The account control, signed in or as Guest                                                                                                                                                                                        |
| `packages/sites`                | `@liveworkspace/sites`             | Every site's address, app origins, the network helpers and the routers' workspace proxy; `./security`: the public repository, the advisory form and `securityTxt` ([vulnerability-disclosure.md](../vulnerability-disclosure.md)) |
| `packages/migration`            | `@liveworkspace/migration`         | The migration's contract and the old-document splitter                                                                                                                                                                            |

## Testing

Each service and package carries its own suite, listed in its blueprint. `liveworkspace/apps/accounts/src/ids.test.ts`
pins the id shapes. `packages/sites/src/security.test.ts` pins every site's security.txt, its Expires window, each
site's route using the shared builder, and every advisory link in a tracked file to `SECURITY_ADVISORY_URL`.

## Defaults ledger

- `PLT1`: new account ids keep Clerk's `user_` prefix, so imported and new accounts share one shape.
