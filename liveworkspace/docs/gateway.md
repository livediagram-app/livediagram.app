# The gateway (until liveworkspace.app is on this account)

liveworkspace.app is one origin made of seven Workers on path routes of the `liveworkspace.app` zone
([site.md](site.md)). Until that zone moves to the liveworkspace Cloudflare account
(`851be7d244b76a6557bcbe6c4ded80f5`), there is nothing to put those routes on, so liveworkspace answers on a
stand-in origin instead: one **gateway** Worker on `workers.dev` that does what the zone's routes do.

| Environment | Origin                                                                      | Worker                          |
| ----------- | --------------------------------------------------------------------------- | ------------------------------- |
| Production  | `https://liveworkspace-gateway.liveworkspace-easing509.workers.dev`         | `liveworkspace-gateway`         |
| Staging     | `https://liveworkspace-gateway-staging.liveworkspace-easing509.workers.dev` | `liveworkspace-gateway-staging` |

## What it does

`apps/gateway` forwards each request, unchanged, to the Worker the zone would have routed it to, over a
service binding. Its table is the zone's routes, most specific first:

| Path                                                                                                              | Worker    |
| ----------------------------------------------------------------------------------------------------------------- | --------- |
| `/api/auth/*`, `/api/account/*`, `/.well-known/openid-configuration*`, `/.well-known/oauth-authorization-server*` | accounts  |
| `/api/index*`                                                                                                     | index     |
| `/api/media*`, `/api/previews*`                                                                                   | media     |
| `/api/telemetry*`                                                                                                 | telemetry |
| `/api/community*`                                                                                                 | community |
| `/api/status*`                                                                                                    | status    |
| `/api/drive*` (once its binding is on, [drive.md](drive.md))                                                      | drive     |
| everything else                                                                                                   | site      |

So liveworkspace stays one origin: the pages still call `/api/auth/…` same-origin, sign-in cookies are the
gateway host's, and the accounts Worker's issuer is `<gateway>/api/auth`. The gateway holds no logic and no
state; the seven Workers behind it are not on `workers.dev` themselves.

## Where the origin is written

Everywhere liveworkspace's origin is written in code and configuration (Worker vars, hosted profiles, the
shared packages' defaults, the apps' fallbacks and links), it is the gateway's: `https://liveworkspace.app`
reads as the production gateway, `https://staging.liveworkspace.app` as the staging one. Docs and specs keep
naming liveworkspace.app, which is still where liveworkspace lives. The seven Workers' `liveworkspace.app`
routes are left out of their `wrangler.toml` (each marks the spot), since a deploy fails on a zone the
account does not have.

## When liveworkspace.app moves

1. Add the `liveworkspace.app` zone to the account.
2. Put the routes back in the seven `wrangler.toml` files, where each marks them.
3. Replace the gateway origins with `https://liveworkspace.app` and `https://staging.liveworkspace.app`
   again, in the same files (search for `liveworkspace-gateway`).
4. Redeploy liveworkspace, then every app (their builds carry the origin), and re-point each app's
   accounts client registration and its `ACCOUNTS_URL` / `API_RESOURCE` secrets at liveworkspace.app.
5. Give the status Worker the `global_fetch_strictly_public` compatibility flag and drop its `PLATFORM` binding to
   the gateway, so its checks of liveworkspace.app go out and come back in through the zone's routes
   ([status.md](status.md#where-the-checks-go)).
6. In the `liveworkspace` Google Cloud project ([drive.md](drive.md#google)): point the Branding links (home,
   privacy, terms) and the Drive UI integration's Open URL at `https://liveworkspace.app`, and add
   `https://staging.liveworkspace.app` to the client's JavaScript origins, with its `/api/auth/callback/google`
   and `/drive/connected` as redirect URIs. liveworkspace.app's own are listed already.
7. Delete `apps/gateway`, its two Workers and this page.

Every Worker behind the gateway (and livediagram's, on its own stand-ins) carries the `global_fetch_strictly_public`
compatibility flag: without it a Worker's `fetch()` to another Worker's workers.dev address on this account fails with
Cloudflare's error 1042. It can stay once the domains move; it is harmless on a custom domain.
