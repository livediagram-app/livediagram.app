# Write It Up: blueprint

Derived from [Write It Up](../write-up.md).

## Files

| File                                                    | Holds                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/index-client/src/write-up.ts`                 | `WriteUpTarget`, `WriteUpAsk`, `WriteUpAnswer`, `readWriteUpAsk`, `writeUpBody`, the caps |
| `packages/index-client/src/client.ts`                   | `IndexClient.writeUpTarget(itemId)`, `IndexClient.writeUp(itemId, ask)`                   |
| `liveworkspace/apps/index/src/write-up.ts`              | `handleWriteUp`: the GET and the POST                                                     |
| `liveworkspace/apps/index/src/knowledgebase-default.ts` | `defaultKnowledgebase(env, item, person, {own})`, shared with a call's summary            |

## Routes

- `GET /items/:id/write-up`: `account(ctx)` (401 without a person, 403 for a delegate or a guest); `loadItem(edit)` on the
  item (404, or 403 for a reader without Edit); a liveknowledge item answers `{knowledgebase: null}`; else
  `defaultKnowledgebase(..., {own: true})`.
- `POST /items/:id/write-up`: the same checks, a trashed item 404, `overRunLimit('write-up:<person>')`,
  `readWriteUpAsk` (400), the knowledgebase row a liveknowledge item and not the item itself (400), then
  `takeTargetedStep` with `{author, rule: {id: 'write-up', name: 'Write It Up'}, from: {title, url: itemLink}, chain:
{id: 'wu_<20 hex>', hops: 0, rules: []}, app, sourceId, ruleKey: '<app>:<id>:write-up'}` and a `kb_page` step. Not
  answered or no link: 422 `{error: 'write_up_refused', code, reason}` (`IndexError.detail` carries it). Else 201.

## Errors

`write_up_refused` joins `INDEX_ERRORS` and the detailed refusals (`DETAILED` in index-error.ts).

## Tests

| What                                                                            | Where                                             |
| ------------------------------------------------------------------------------- | ------------------------------------------------- |
| Default knowledgebase (team, own, none, not itself), access, the door, refusals | `liveworkspace/apps/index/src/write-up.test.ts`   |
| The body's checks and cut                                                       | `packages/index-client/src/write-up.test.ts`      |
| A call's summary default unchanged                                              | `liveworkspace/apps/index/src/item-calls.test.ts` |
