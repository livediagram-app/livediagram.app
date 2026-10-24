# The index

The index is the One Explorer's service: one Worker at **liveworkspace.app/api/index**, with its own D1
database, holding where every Canvas, Plan, Document and Design is and who can reach it. It keeps
everything about an item except its content: title, owner, team, folder, favourites, Trash
state, opens and use days, share links and passwords, Shared with me, placement defaults, what the Inbox
needs about comments and actions, and the Timeline. The content stays in each item's Durable Object in its app.

The plan is [one-explorer.md](one-explorer.md). The calls, types and tokens are
[one-explorer-contracts.md](one-explorer-contracts.md), and `@liveworkspace/index-client`
(`packages/index-client`) holds them as code: the types, a client for browsers and apps' servers, and
`createGrantVerifier` for apps.

```
apps/index/src/index.ts       routing, and the crons (daily, and every 15 minutes)
apps/index/src/auth.ts        people (access and guest tokens), link visitors, app keys, the merge key
apps/index/src/access.ts      the access rule: owner, joined team member, or a live link (+ password)
apps/index/src/grants.ts      ES256 grants and the public keys at /jwks
apps/index/src/lists.ts       the Explorer's lists, one indexed and keyset-paged query each
apps/index/src/items.ts       items: make, read, rename, move, Trash, copy, open, grant
apps/index/src/sharing.ts     share links, passwords, what a link opens, Shared with me
apps/index/src/personal.ts    favourites, Hide from Recent, placement defaults (folders.ts: folders)
apps/index/src/app-routes.ts  what an item pushes: its summary, each tab's comments and actions, its edits
apps/index/src/inbox.ts       the Inbox query
apps/index/src/timeline.ts    the Timeline: recording events, and a person's feed
apps/index/src/purge.ts       purging, tombstones and the daily sweep
apps/index/src/merge.ts       a guest becoming an account
apps/index/src/account-purge.ts  a closed account's purge, and the 15-minute cron
```

## Who calls it

- **A browser**, through its own app's router (`/api/index/*` on the app's origin is forwarded here), with
  an accounts access token or a guest token as `Authorization: Bearer`. Both are checked offline against
  accounts' keys (`${ACCOUNTS_URL}/api/auth/jwks`), and the token's `aud` must be one of
  `INDEX_AUDIENCES`. Team membership is the token's `teams` claim; the index keeps no copy of teams.
- **A link visitor**, with `X-Share-Code` (and `X-Share-Password` when the item has one), with or without
  a token.
- **An app's server acting for an account** it checked itself (an API token's), with its key, `X-Index-App`,
  `X-Index-Person` and `X-Index-Teams`: that account on the person routes, for the app's own items only
  (`auth.ts` `delegatedPersonOf`, `delegate.test.ts`).
- **An app's server**, with `Authorization: Bearer <INDEX_KEY>` and `X-Index-App: <app>`, to push an
  item's summary and its comments and actions. The index calls the app back with the same key, at
  `${APP_ORIGIN_<APP>}/api/internal/items/:id` (purge), `…/copy-to/:to` (copy) and `…/revoke`.
- **Accounts**, with `MERGE_KEY`, at `POST /api/index/internal/merge` (a guest signing in) and
  `POST /api/index/internal/purge-person` (an account closing).

## Decisions the contract left open

- The `team` list filter takes a team id or `personal`; without it, a list holds the person's own items
  and every joined team's. Lists sort by `updatedAt` (Recent by last opened, Shared with me by when it was
  last opened through its link).
- `POST /folders` takes an optional client-made `id`, as the apps' Explorers mint them
  today; 409 `folder_exists` is that id taken. `GET /folders` is paged like every list.
- Moving an item out of a team makes it the mover's own. Moving it into or out of a team drops its folder
  (the folder belonged to the old scope).
- `DELETE /items/:id?reason=empty` trashes with `trashReason: 'empty'`. The index's own daily empty clean-up
  (purge.ts `sweepEmpty`, one-explorer-contracts.md "The empty clean-up") moves every app's empty items, from
  the summary's `hasContent`, so no app runs a sweep of its own.
- A link editor may rename an item but not move, share, trash or purge it. A copy needs a person to own
  it; a copy through a link lands in the person's root, and the app is told the link's tab so a
  tab-scoped link copies only that tab.
- A person who reaches an item only through a link they opened before (Shared with me) still needs the
  item's password when it has one.
- Emptying the Trash purges up to 1,000 items per call; the rest wait for another call or the daily run.

## Secrets and settings

| Name                | What                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `INDEX_KEY_<APP>`   | secret, per app (`LIVEDIAGRAM`, `LIVEPLANNER`, `LIVEDOCUMENTS`, `LIVEDESIGN`); the app's `INDEX_KEY`                     |
| `GRANT_SIGNING_KEY` | secret: the private ES256 JWK, with its `kid`. Development makes one per isolate if unset                                |
| `MERGE_KEY`         | secret: accounts' `INDEX_MERGE_KEY`                                                                                      |
| `ACCOUNTS_URL`      | var: the accounts origin; tokens are checked as `${ACCOUNTS_URL}/api/auth`, grants issued as `${ACCOUNTS_URL}/api/index` |
| `INDEX_AUDIENCES`   | var: every app's API resource, comma-separated                                                                           |
| `APP_ORIGIN_<APP>`  | var: where each app's internal routes are                                                                                |
| `INDEX_ENABLED`     | var: `off` answers every route as missing                                                                                |

Without `GRANT_SIGNING_KEY` outside development, `/jwks` and grants answer 503 `grants_unavailable`, and
nothing can be made (there would be no grant to open it with).

To make a signing key (Node 22):

```sh
node -e "crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign']).then(k=>crypto.subtle.exportKey('jwk',k.privateKey)).then(j=>console.log(JSON.stringify({...j,kid:'grant-'+new Date().toISOString().slice(0,10)})))"
```

Rotating it: put the new one. Apps' verifiers refetch `/jwks` on an unknown `kid`; grants signed with the
old key stop checking, and editors fetch a fresh one (they renew every ten minutes anyway).

## Performance

Every list is one query, keyset-paged (`limit` ≤ 200), driven by an index that starts with the person
(their scopes, opens, favourites or shared rows) or one folder, never a scan of `items`; decorating a page
for the person (favourite, last opened, link access) is one D1 batch. `lists.test.ts` pins each
list's query plan and times 2,000 of a person's items among 20,000 others' (each page a few
milliseconds). Opens are written at most once a minute per person and item, in memory and in SQL. Comment
pushes go in through `json_each`, one statement per table. Most Used rides Recent's first page as one more
query on `use_days`' person index (`most-used.test.ts`: 14 ms beside 100,000 other rows). A Timeline page is
one statement reading one index range of at most `limit + 1` rows per scope the person has (their own, and
each team's), never the whole feed (`timeline.test.ts`: two pages from 10,000 of a person's events among
100,000 others in about 15 ms); an event is recorded in the batch of the change it is about, two or three
statements more. Each list sorts the person's matching rows to
page them, so a page's cost grows with what that person holds (a few milliseconds at 2,000).

## Running it locally

```sh
cd liveworkspace/apps/index
cp .dev.vars.example .dev.vars
corepack pnpm db:migrate:local
corepack pnpm dev                     # the API, http://localhost:8793/api/index
```

`corepack pnpm dev:workspace` from the repo root runs it with the other liveworkspace APIs, and
`corepack pnpm dev:index` runs it alone. Each app's router forwards `/api/index/*` to
`http://localhost:8793`, and its api Worker pushes with `INDEX_KEY=dev-<app>-index-key`. Tokens are checked
against the local accounts Worker (`http://localhost:3000`), for the local apps' resource
`http://localhost/api`.

## First deploy

Production `liveworkspace-index` and staging `liveworkspace-index-staging`, on the liveworkspace
Cloudflare account.

1. Create the databases and put their ids in `wrangler.toml` (they are placeholders):
   `wrangler d1 create liveworkspace-index` and `wrangler d1 create liveworkspace-index-staging`.
2. Apply the migrations: `corepack pnpm db:migrate:remote` (add `--env staging` for staging).
3. Put the secrets, each with `wrangler secret put` (and `--env staging`): `GRANT_SIGNING_KEY` (made as
   above, a different one per environment), `MERGE_KEY` (the same value as accounts' `INDEX_MERGE_KEY`),
   and `INDEX_KEY_<APP>` for each app (the same value as that app's `INDEX_KEY`).
4. Check the staging app origins and API resources in `wrangler.toml` against each app's staging deploy.
5. `wrangler deploy` (and `--env staging`). The daily cron purges the Trash and retries missed purges;
   the 15-minute one finishes closed accounts' purges and tells the apps what was purged.
