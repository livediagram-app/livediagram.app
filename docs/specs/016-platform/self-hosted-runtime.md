# Self-hosted runtime

A **self-hosted runtime** runs the whole of livediagram — the five static apps, the api, the realtime rooms, the MCP server and the scheduled sweeps — on a machine the operator controls, with **no Cloudflare account and no SaaS dependency**. It ships as a Docker Compose stack.

The hosted deployment ([Deployment](deployment.md)) keeps running on Cloudflare Workers. One source tree carries both; the difference between them is which **runtime** the runtime seam resolves to.

## Why it exists

The licence promises self-hosting end to end, and [Self-hosting](../../operations/self-hosting.md) delivers it on Cloudflare. A self-hoster who wants no third-party platform at all is not served by that path: every binding — D1, Durable Objects, R2, the Rate Limiting API, cron — is Cloudflare-proprietary.

The self-hosted runtime is that second path. It exists so the promise "anyone can self-host" holds without "on one vendor's platform".

## What it is

| Piece                                     | In the self-hosted runtime                                              | Replaces                                |
| ----------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| **App process**                           | One Node process serving the api over HTTP and the rooms over WebSocket | the `api` Worker + Durable Objects      |
| **MCP process**                           | A second Node process on its own origin                                 | the `mcp` Worker                        |
| **Database**                              | One SQLite file in WAL mode; the same migrations apply                  | D1                                      |
| **Object storage**                        | A directory on disk, or any S3-compatible endpoint                      | R2                                      |
| **Rate limits**                           | An in-process token bucket per named limiter                            | Rate Limiting bindings                  |
| **Scheduled sweeps**                      | Timers inside the app process                                           | `triggers.crons`                        |
| **Static apps**                           | The five `out/` exports served as files                                 | Workers Static Assets                   |
| **Routing and TLS**                       | Caddy: one origin, path and host routing, automatic certificates        | the `router` Worker + Cloudflare's edge |
| **Authentication**                        | Better Auth inside the app process, issuing JWTs and a JWKS             | Clerk                                   |
| **Teams, API tokens, sharing, Community** | Unchanged application code                                              | —                                       |
| **MCP OAuth**                             | Unchanged application code                                              | —                                       |

## The runtime seam

Everything the application code needs from its platform goes through one seam: a **runtime** resolves the database, the object store, the room host, the named rate limiters and the scheduler for a request.

- The Cloudflare runtime resolves them from Worker bindings.
- The Node runtime resolves them from the process: a SQLite handle, a directory, an in-process room registry, token buckets, timers.

Application code above the seam is platform-agnostic. It is written against the db / object-store / room / limiter interfaces, never against `D1Database`, `R2Bucket` or `DurableObjectNamespace`.

## Identity

The self-hosted runtime authenticates people against its own identity provider. The contract the application depends on is narrow, and is what Clerk provides today:

- a JWT in `Authorization: Bearer`, verifiable against a **JWKS URL**;
- `sub` — the owner id every document, image and team membership is keyed by;
- `email` — the only email ever trusted, used to connect pending team invites.

Teams ([Teams](../013-workspace/teams.md)), API tokens ([Public API and API tokens](../015-api/public-api-and-tokens.md)), the MCP server ([MCP server](../015-api/mcp-server.md)) and guest access ([Auth + guest access](../014-identity/auth-and-guest-access.md)) are application code and do not change. Guest mode stays always available: a self-hosted deployment with the identity provider switched off still serves the canvas.

## Data

- **One database file.** The migrations under `apps/api/migrations/` are the schema, applied in order at start-up. No second schema system for authentication tables: the identity provider's tables live in the same file, owned by their own migration set.
- **Owner ids are the identity provider's `sub`.** Moving a deployment's data between identity providers means mapping owner ids; a fresh deployment has nothing to map.
- **Backups are the operator's.** The runtime takes scheduled online snapshots of the database file and keeps them beside it; copying them off the machine is documented, not automated.

## Scale and its ceiling

A self-hosted runtime is **one app process and one SQLite writer**:

- Rooms run in the app process, so one process owns every room. A second process would need room routing and shared state, which is out of scope.
- SQLite allows one writer at a time. Reads are concurrent; writes serialise. This is sized for a team, not a public service.

The ceiling is stated, not implied: see [Self-hosted runtime blueprint](blueprints/self-hosted-runtime.md) for the sizing arithmetic and the point at which a deployment should move to the hosted one.

## What it is not

- **Not a Workers-compatible platform.** It does not run `workerd`, and it does not try to be Cloudflare at home.
- **Not a replacement for the hosted deployment.** Cloudflare stays the production path: edge caching, Durable Objects at the edge, zero-ops scaling.
- **Not multi-instance.** No horizontal scaling, no shared cache, no Redis.
- **Not a second product.** Same apps, same specs, same UI; only the runtime under the api differs.
- **Not the default.** A fork that does nothing keeps deploying to Cloudflare.

## Relationship to the hosted deployment

The seam is upstream-first: the abstraction is written so the Cloudflare deployment still works unchanged, and is expected to be merged into the mainline. The Node implementation is the second implementation of that seam.

Consequences the spec accepts:

- The Web Worker entry point (`fetch` / `scheduled`) stays the application's shape; the Node runtime adapts to it rather than the reverse.
- Platform-specific behaviour that cannot be expressed through the seam stays in the Cloudflare runtime — for example `HTMLRewriter` in link unfurling, which the Node runtime substitutes.
- Every change to the seam must keep both runtimes green, so the abstraction earns its keep rather than drifting into a fork.
