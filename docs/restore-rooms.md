# Restoring rooms after a bad deploy

Every product's content lives in SQLite-backed Durable Objects, and Cloudflare keeps 30 days of point-in-time
recovery for each of them. This runbook winds one room, or many, back to a moment with each product api's restore door
([Restoring rooms](../liveworkspace/docs/specs/002-architecture/room-restore.md) is the spec). It works the same on
upstream's production and staging and on a self-hosted copy.

**Restoring is destructive.** Every write to a restored room after the moment is gone, whoever made it. The door
answers an undo bookmark for each room: keep the answers until you are sure.

D1 and R2 are not covered here: D1 has `wrangler d1 time-travel` and `wrangler d1 export`, and R2 buckets can be
copied. The index's rows (an item's name, folder, sharing, Trash) live in D1, not in the room, so a room's restore
leaves them as they are now.

## What you need

- The api Worker's address, for example `https://www.livediagram.app` (the door is `/api/internal/restore` on it).
- Its `OPERATOR_KEY`. Set one once per api Worker and environment, from a password manager, never in a file:

  ```sh
  cd livediagram/apps/api
  corepack pnpm exec wrangler secret put OPERATOR_KEY              # production
  corepack pnpm exec wrangler secret put OPERATOR_KEY --env staging
  ```

  The same for `liveplanner`, `livedocuments`, `livedesign`, `livehuddle` and `liveknowledge`. Without the secret the
  door is a 404.

- The moment to go back to, from the deploy's time in the Actions run or `wrangler deployments list`: a minute
  before the bad deploy went live is usual. Times are UTC; ISO 8601 (`2026-11-22T14:05:00Z`) or milliseconds.

| App           | Classes                       | A room's name                    |
| ------------- | ----------------------------- | -------------------------------- |
| livediagram   | `DocumentRoom`, `PersonStore` | the canvas's id, the person's id |
| livehuddle    | `DocumentRoom`, `PersonStore` | the Space's id, the person's id  |
| liveplanner   | `PlanRoom`                    | the plan's id                    |
| livedocuments | `DocumentRoom`                | the document's id                |
| livedesign    | `DesignRoom`                  | the design's id                  |
| liveknowledge | `DocumentRoom`                | the Knowledgebase's id           |

An item's id is in the editor's address when it is open, and in the index's `items` table (`id`, with `app`).

## One room

```sh
export API=https://www.livediagram.app KEY='<OPERATOR_KEY>'
# 1. A dry run: finds the bookmark, changes nothing.
curl -sS -X POST "$API/api/internal/restore" -H "Authorization: Bearer $KEY" \
  -d '{"class":"DocumentRoom","name":"<id>","at":"2026-11-22T14:05:00Z","dryRun":true}'
# 2. The restore.
curl -sS -X POST "$API/api/internal/restore" -H "Authorization: Bearer $KEY" \
  -d '{"class":"DocumentRoom","name":"<id>","at":"2026-11-22T14:05:00Z"}'
```

The answer lists the room with `ok: true`, the `bookmark` it went back to and the `undo` bookmark. Everyone in the
room is disconnected and their editor reloads onto the restored content. To undo the restore:

```sh
curl -sS -X POST "$API/api/internal/restore" -H "Authorization: Bearer $KEY" \
  -d '{"class":"DocumentRoom","name":"<id>","bookmark":"<undo>"}'
```

## Every room a bad deploy touched

A call takes up to 20 `names` and restores them four at a time. Only rooms written after the moment need restoring,
and the index knows which items changed since: list them from its D1 (read only), then page through in twenties.

```sh
cd liveworkspace/apps/index
AT_MS=$(node -e 'console.log(Date.parse("2026-11-22T14:05:00Z"))')
corepack pnpm exec wrangler d1 execute liveworkspace-index --remote --json \
  --command "SELECT id FROM items WHERE app = 'livediagram' AND updated_at >= $AT_MS" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const r of JSON.parse(s)[0].results)console.log(r.id)})' \
  > ~/restore-ids.txt
wc -l ~/restore-ids.txt
```

(`--env staging` and `liveworkspace-index-staging` for staging.) `updated_at` moves on most writes but not all (a
move between folders does not), so for a broad bad deploy drop the `updated_at` filter and take every item of the
app. Then restore them, a dry run first, keeping every answer:

```sh
split -l 20 ~/restore-ids.txt ~/restore-batch-
for f in ~/restore-batch-*; do
  names=$(node -e 'console.log(JSON.stringify(require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n")))' "$f")
  curl -sS -X POST "$API/api/internal/restore" -H "Authorization: Bearer $KEY" \
    -d "{\"class\":\"DocumentRoom\",\"names\":$names,\"at\":\"2026-11-22T14:05:00Z\"}" >> ~/restore-answers.jsonl
  echo >> ~/restore-answers.jsonl
done
grep -c '"ok":false' ~/restore-answers.jsonl
```

Add `"dryRun":true` to the body for the first pass. A room answered `restore_failed` with a `restart:` message is
set to restore at its next start; send its name again. For people's stores (livediagram and livehuddle
`PersonStore`), the names are person ids (`user_…` for an account, `guest_…` for a guest), from the accounts Worker's D1.

## What the door answers

| Status | Meaning                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------- |
| 200    | every room restored (or found, on a dry run)                                                       |
| 400    | the body was refused; `error` names the field (`unknown_class`, `at_too_old`, `too_many_rooms`, …) |
| 401    | the Bearer is not the `OPERATOR_KEY`                                                               |
| 404    | no `OPERATOR_KEY` is set on this Worker                                                            |
| 501    | the runtime keeps no PITR (`pitr_unavailable`): `wrangler dev` and local workerd never do          |
| 502    | a room failed another way (`restore_failed`, with the runtime's message)                           |

Each restore is logged in the Worker's logs as `[room-restore]` with the room, the moment, the bookmark and the undo.

## Checking a Worker's restore

Once per api Worker on staging after setting the key, to see the whole round trip work:

1. Open a new item in that app on staging, add something to it (a box labelled `before`), wait a minute and note the
   time, then wait another minute and change it (`after`).
2. Dry run the restore of that item's id to the noted time: `200`, a bookmark.
3. Restore it: `200`. The open editor reloads and shows `before`; `after` is gone.
4. Undo with the answered `undo` bookmark: `200`, and `after` is back.

## After a restore

- Tell the people whose items were restored: their edits after the moment are gone.
- Previews, the Explorer's names and sharing come from the index, not the room, and catch up on the item's next save.
- Pictures uploaded after the moment stay in the media service until its own sweep removes the ones nothing places.
