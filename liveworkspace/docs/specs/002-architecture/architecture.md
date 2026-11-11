# Architecture

How the platform's services fit together. Each service's own spec says what it does; this one says where it runs,
how it is reached, and how it ships.

## One origin

Every service is a Cloudflare Worker on a path route of liveworkspace.app (`staging.liveworkspace.app` for staging).
Path routes win over the site's custom domain, so Cloudflare sends each service its paths and the static site
everything else:

| Path                                                     | Worker                    | Spec                                              |
| -------------------------------------------------------- | ------------------------- | ------------------------------------------------- |
| `/api/auth/*`, `/api/account/*`, the two `/.well-known/` | accounts                  | [sign-in.md](../003-accounts/sign-in.md)          |
| `/api/index*`                                            | index                     | [index-service.md](../004-index/index-service.md) |
| `/api/drive*`                                            | drive                     | [drive.md](../005-drive/drive.md)                 |
| `/api/media*`, `/api/previews*`                          | media                     | [media.md](../006-media/media.md)                 |
| `/api/community*`                                        | community                 | [community.md](../007-community/community.md)     |
| `/api/telemetry*`                                        | telemetry                 | [telemetry.md](../008-telemetry/telemetry.md)     |
| `/api/status*`                                           | status                    | [status.md](../009-status/status.md)              |
| everything else                                          | site (static assets only) | [site.md](../010-site/site.md)                    |

The site's pages therefore call `/api/…` on their own origin, with no cross-site requests and no CORS.

## On an app's address

Each app's router (`<app>/apps/router`) puts the platform's pages and the calls they make on the app's own address,
through one shared helper, `@liveworkspace/sites/workspace-proxy`, so all four routers forward the same paths the
same way: the Explorer (`/explorer/*` and the site's assets under `/_liveworkspace`), the sign-in pages
(`/sign-in`, `/sign-up`, `/consent`, and `/api/workspace/auth` to `/api/auth`), the account API
(`/api/workspace/account` to `/api/account`), workbench pairing (`/api/workbench` to `/api/account/workbench`),
the index (`/api/index`), Drive (`/api/drive`), previews (`/api/previews` and the share-link picture doors), and the
old `/status` page to liveworkspace.app's. The Explorer's, the index's and Drive's forwards drop the app's cookies,
and forwards carry the visitor's address in `X-Liveworkspace-Client-IP`. The forwards to accounts and the index also
carry `X-Liveworkspace-Proxy-Secret`, the secret `WORKSPACE_PROXY_SECRET` the routers share with those two Workers:
they are publicly routed, so a named address counts as the visitor's only beside it, and a request without it is
counted by its own connection. Each router names its environment's platform with `WORKSPACE_ORIGIN`.

## Who calls whom

- **A browser** calls a service with an accounts access token or a guest token as `Authorization: Bearer`, checked
  offline against accounts' keys (`/api/auth/jwks`).
- **An app's server** calls a service with its key for that service (`INDEX_KEY`, `MEDIA_KEY`, `COMMUNITY_KEY`,
  `TELEMETRY_KEY`), over HTTPS. Each service holds one secret per app (`<SERVICE>_KEY_<APP>`).
- **A service calls another** over a service binding where both are platform Workers (accounts to the index,
  telemetry and Drive; the index to Drive; Drive and media to the index; status to livediagram's router and MCP).
- **The index, Drive and the Community call an app back** at the app's internal routes (`/api/internal/items/…`): the
  index with the app's `INDEX_KEY` to copy and purge, Drive with the app's `DRIVE_KEY` to export and import, and the
  Community's sweep with the app's `COMMUNITY_KEY` to ask where its posts' items stand
  ([community.md](../007-community/community.md#the-sweep)).

## When a request fails

Every Worker that owns storage (each service above but the site, and each app's api) answers a request that throws
itself, at any step from resolving who is calling to the route's own work, never leaving it to the runtime's bare
error page. One shared guard does it, `@liveworkspace/api-kit/request-failure`.

- **The storage is unavailable: `503 storage_unavailable`** with `Retry-After: 5`. It is the storage failing on its
  own side, not the request: D1 (an internal error, a lost connection, an overloaded or reset database, a storage
  timeout), or a Durable Object's infrastructure (an error it marks retryable or overloaded). The same call succeeds
  once the storage recovers, so the caller retries. Logged as `[d1] unavailable route=<route words>` or
  `[durable-object] unavailable route=<route words>` with the error.
- **Anything else: `500 internal_error`**, logged as `api error route=<route words>` with the error. A D1 error that
  names the query (a constraint, a type, SQL) and an error a Durable Object's own code threw are bugs, so they land
  here too. An app's api also counts it as a crash in its telemetry; the services only log it.
- Neither body echoes the error's text. The route words are the method and the path's known words, never an id.
- The answer carries the Worker's usual headers, CORS included where its routes have them.

## A Durable Object's alarm

A Durable Object has one alarm, and each one that re-arms it from a time it worked out (every app's room, the index's
webhook dispatcher, the Drive mirror) sets it through one shared rule, `@liveworkspace/api-kit/room-alarm`:

- **Never in the past.** The alarm goes at the earliest time due, but never sooner than a second from now
  (`roomAlarmAt`). A time already due, or one stuck in the past by a bug, waits that second rather than firing at
  once. Unfloored, such a time fired the alarm back to back, about 20 times a second, for as long as it stayed stuck
  (a closed socket's lapsed grant cost about 2.2 million billed alarms in a week); floored, the worst any such bug
  can do is one alarm a second per object.
- **Nothing people see waits on it.** What an alarm does (pushes to the index, a shared tab's copies, a Community
  check, upkeep, a lapsed grant's close, an agent's expiry, a webhook's send, a Drive pass) is already on a wait of
  seconds or more; a second more on a time that was already due changes nothing anyone can tell.
- **No write for an alarm already set.** An app's room arms its alarm on many writes, and an alarm set again at the
  same time is a storage write for nothing. The room remembers the time it last set while it is in memory and skips
  setting the same one, or deleting an alarm it already deleted (`armRoomAlarm`). A room woken from hibernation
  remembers nothing, so its first arm always writes. A room's purge deletes its alarm through the same helper
  (`disarmRoomAlarm`), which forgets the time too, so the next arm after a purge always writes.
- A request that asks for work now (a webhook queued, a Drive check or connect, an export started) still sets the
  alarm for now: it runs once per request, never in a loop. A data export's next chunk is set at once too: each chunk
  works up to 20 s, so a second's floor would only slow every export.

## A room's collaboration ledger

Every app's room keeps a collaboration ledger (each product's `docs/specs/012-collaboration/collab-race-hardening.md`):
the latest answer, tick, comment event or dot it sequenced, one storage key per element, which a whole-tab save is
merged with so a stale snapshot can't erase a change the room has seen. What an entry holds and how a save merges it
is each product's own pure module; how the entries are stored, read and kept is one shared store,
`@liveworkspace/api-kit/room-ledger-store`, so the five rooms can't drift:

- **Each entry knows when it last changed.** The store stamps every entry it writes with the room seq and the time of
  the op that last changed it. The stamp never leaves the room: a read hands the product's module the entry as it
  recorded it.
- **A save reads only what can change it.** A save's merge applies only what its saver hadn't seen (a seq past the
  cursor it sent), so the room hands it only the entries changed after that cursor, plus every entry changed in the
  last day (`LEDGER_RECENT_MS`): those may still hold something a save uses whatever its cursor, an idea card a
  stale snapshot lacks or the name a comment was posted under before its author's own save lands. An entry the saver
  had seen a day or more ago can change nothing in its save. Before, every save read and shipped every entry the
  tab ever had, so a long-lived workshop tab dragged months of comment text through each autosave. A read with no
  cursor (a Participant's answers, which take every answer the room holds) still reads the whole tab.
- **A save finds those entries without reading the rest.** The store keeps an index of each tab's entries by the seq
  that last changed them, and notes the room's seq about once an hour, so a save walks only the index rows after its
  cursor or after the room's seq a day ago, whichever is lower, and reads just those entries. Before, the room read
  every entry the tab held on each autosave to pick out the few it shipped: on a busy board, 1,000 entries read to
  ship 10. A room indexes the entries written before the index in its first upkeep; until then, and in a room's first
  day, a save reads the whole tab as before.
- **An entry nobody has touched for 30 days goes** (`LEDGER_RETENTION_MS`, the Trash's and the changesets' 30 days),
  once a day in the room's upkeep: whatever it protected reached the store long ago, through the saves of everyone
  who saw it. Two kinds stay while their tab lives, because their merge needs every op of the round: an entry the
  product names as accumulating (a vote's dots, an idea box's cards). A tab the room no longer stores loses those
  too, once they are 30 days old. An entry from before stamps is stamped at its first upkeep and ages from there.
- **Residual, stated plainly:** a save whose cursor is older than the oldest entry the upkeep cut (a socket that
  reopened after more than 30 days away and saved before its catch-up arrived) no longer has the cut entries
  re-applied, the same as a save past the changesets' retention. The room logs it (`[ledger] stale cursor`).

A save can also say what it changed by id, for the lists several people grow at once whose ops never pass through the
ledger (a tab's pages, an article's blocks): the `X-Save-Changes` request header
(`@liveworkspace/api-schema/tab-save-changes`, URI-encoded JSON under 8,000 characters), which the product's api
applies over the tab it has stored instead of storing the whole tab as sent. A header, not a body field, so an api
from before it ignores it. Its steps are `@liveworkspace/model-core/id-list-steps` (`diffIdList`, `applyIdListSteps`),
the same steps an op carries to a receiver, so the store and every screen end with the same list. What a product sends
in it is its own (each product's `collab-race-hardening.md` "A save is merged with the stored tab").

## Environments and the account

Two environments, production and staging, each a `wrangler.toml` environment with its own Worker name (`-staging`),
routes, D1 databases and R2 buckets. Every Worker, the platform's and every app's, runs on the liveworkspace
Cloudflare account (`851be7d244b76a6557bcbe6c4ded80f5`), which each `wrangler.toml` pins as `account_id`.

## Deploys

CI deploys every Worker ([docs/ci.md](../../../../docs/ci.md#deploys) at the repository root): staging follows
`main`, production is a manual gate that ships what staging runs, and only the Workers a change reaches are rebuilt.
The services and apis deploy first, each applying its D1 migrations before its code; then the sites and MCP Workers;
then the routers. No one applies a remote migration or deploys by hand. Secrets are set once per Worker and
environment with `wrangler secret put` and survive every deploy; each service's spec lists its own.

## Locally

`corepack pnpm dev:workspace` runs the site and every service, each on a fixed port, and the site's dev server
forwards each service's paths, so `http://localhost:3000` works as liveworkspace.app does
([README](../../../README.md#local-development)). The site takes 3000, the first port of liveworkspace's block (the
root AGENTS.md); the Workers keep their own ports (8787 and up, 3010 and 3011). Each app has a block of its own:
livediagram 3100, liveplanner 3200, livedocuments 3300, livedesign 3400 and livehuddle 3500.

## Shared code

Code two or more products need lives once, in `packages/` as `@liveworkspace/*`, each module a subpath
([docs/structure.md](../../../../docs/structure.md)). A product keeps what is its own (its element model, its
vocabulary, its copy) and, where its package's surface must stay stable, a one-line `export * from
'@liveworkspace/…'` binding. A new copy of a source file across two or more products is refused in CI, and the
copies the products still hold may only become fewer ([docs/ci.md](../../../../docs/ci.md#copies-across-products)).
Each product's router reads one set of caching rules, `@liveworkspace/sites/cache-policy`.

### The shared element model

Each product's element union (`Element`, `BoxedElement`, `ShapeElement`, `ArrowElement`) differs: its kinds, its
shape kinds, its fields. Code that reads elements the same way in two or more products lives once in
`@liveworkspace/element-model`, written against a structural model that every product's union is assignable to:

- **The shared types** (`element-model/element`) name only the fields the shared modules read, each as widely as any
  product stores it: a shape's kind is any string, the boxed kinds are every product's (a product holds a subset), an
  arrow's pinned end may carry an entity `field`. A product's own union stays in its model package, exact and unchanged.
- **Reading** functions take the shared types. **Functions that hand elements back** are generic over them
  (`<E extends Element>(elements: E[]) => E[]`), so a caller keeps its product's precise type and no caller changes.
- **`isBoxed`** in the shared model is the union of every product's boxed kinds, so on any element a product holds it
  answers as that product's own `isBoxed` does.
- Each moved module is a subpath (`@liveworkspace/element-model/<module>`), and each product keeps a one-line binding
  at the module's old path, so its index and its importers did not change and an app bundles only what it imports.
- What still differs per product (its union and factories, its parsers and stored-data migrations that name its
  kinds, its vocabulary) stays in its model package. Where a product's copy differed only in an entry for a kind it
  does not have, it took the entry and moved; nothing a product draws or stores changed shape.
- **Drift is settled before a module moves.** Where the copies differ, each difference is one of three: a fix or
  improvement one product got and the others did not, which every product then takes (a product change, written in
  that product's specs first); a real product difference, which the shared module takes as data rather than by asking
  which product it is in; or wording, which is made one. A kind table (a shape's drawn geometry, its outline, its
  anchors) holds every product's kinds, each product naming the kinds it holds where it lists them
  (`SHAPE_GEOMETRY_KINDS` in its `shape-kind.ts`); a module that mixes shared rules with a product's own is split on
  cohesion (the colour maths is shared, each product's element defaults stay in its `colors.ts`).
- The element defaults are one table too (`element-model/element-colours`: the colours, padding and alignment an
  element has when it stores none, and which colour, border and icon controls it offers, for every product's kinds).
  Each product's `colors.ts` binds the colour maths and the defaults; a product with a look of its own wraps them in
  the same file (livediagram's retired pieces paint as placeholders first), and the kinds that draw a face of their
  own reach the inline-icon rules as a passed-in predicate (`ownFace`). livehuddle keeps its own `colors.ts`.
- The shared model's own tests build their elements with product-neutral builders
  (`element-model/testing/elements`: a shape at its kind's usual size, a text, a table, arrows), so a product's test
  of a moved module moves with it. A product's test that reads that product's validator, renderer or factories with
  their own extras stays in the product and runs through its binding.
- A generic shared type a product reads under its own union is bound in that product's index
  (`ElementGrid = ElementGrid<Element>`, `ElementIndex = ElementIndex<Element>`), and its modules import it from there.
- A product's own extra on a shared module sits beside its binding, in the same file: the binding re-exports the
  shared module and the product adds or wraps what is its own (livediagram's retired pieces in `isSelfDrawingShape`,
  liveplanner's Sheet charts beside `containment`). The shared module never asks which product it is in.
- A shared rule that reads a list each product keeps for itself takes the list as data, and the product binds it at
  the module's old path: the element fingerprint is the shared `fingerprintsFor(liveFields)` over each product's
  `LIVE_ELEMENT_FIELDS`, so the fields an agent's changeset ignores stay the ones that product's undo keeps. A limit
  every product holds the same way lives with the shared code that needs it (the table helpers' sizes), and each
  product's validator reads it from there.
- A shared module over a product's own record (a comment, a table cell's style) is generic over it, naming only the
  fields it reads (`threadWithComment<C extends { id: string }>`, the table helpers over `TableGrid`), so each product
  keeps its own types and gets them back.
- Editor code the same in three or more editors, and naming no product, lives once in `@liveworkspace/workbench`,
  which reads the shared element model where it needs element code; each editor keeps a one-line binding at the old
  path.
- Editor code that differs from its copies only by one product fact (a storage key, the product's theme lookup, a
  product's own union) moves too, and the fact stays in the editor: the shared module takes it, as a factory the
  editor's file at the old path binds with its own value (`laserConfigStorage('<product>:v2:laser-config')`), a hook
  handed the value the product resolves (`useEditorAccentStroke(accent)`), or constants each product's own type takes
  as they are (`SEASONAL_LOOKS` as each editor's `TabLook`). The shared module never imports a product.
- `@liveworkspace/model-core` stays the vocabulary below it, with nothing of an element union.

## Adding an app

An app joins by registering its OAuth client and API resource with accounts
([sign-in.md](../003-accounts/sign-in.md#registering-an-app)), adding itself to each service's app list and key, and
wiring its router and api to the shared packages ([integrating-an-app.md](integrating-an-app.md)).
