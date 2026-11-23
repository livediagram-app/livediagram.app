# Send to Plan: blueprint

Derived from [send-to-plan.md](../send-to-plan.md). The spec decides; this file adds engineering precision. Nothing
here is a new Worker, queue or binding: the apps already reach the index over `INDEX`, the index already calls each
app's internal doors with the app's key, and the person's send counts on `KIT_RUN_LIMITER` under a key of its own. The
index gains one D1 migration (`0030_plan_sends.sql`).

## Flow

```
source app's editor ── POST /api/index/items/:plan/plan-sends {board, column, cards[], again?} ─▶ index (person)
                                                         │ account? limiter? plan: loadItem(edit, whole item)
                                                         │ each source: loadItem(view) as the person
                                                         │ same place, same plan, card not in the Trash? 409
                                                         │ mintGrant(person, plan, edit); each card's link built
                                                         ▼
          liveplanner ◀── POST /api/internal/items/:plan/plan-send (index key, X-Index-Grant)
             grantWrites: sub = person, item, edit, whole item, not trashed
             the room makes the cards as the person (one insert, history as theirs, sentFrom on each)
                                                         │ {cards: [{id, title, column, done}]}
                                                         ▼
                                              index inserts one plan_sends row per place → 201 {sends}

liveplanner room: an `items` op touching a card with sentFrom ── 1.5 s ──▶ POST /app/items/:plan/plan-cards
   index: UPDATE … RETURNING the sources whose rows changed ──▶ each source app's
   POST /api/internal/items/:source/source-changed {app: liveplanner, itemId: plan, sheetIds: [], cards}
   the source's room broadcasts `source-changed`; each open editor reads GET /items/:source/plan-sends again
```

## Wire (`@liveworkspace/index-client`, src/plan-sends.ts)

| Shape                | Fields                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `PlanSendKind`       | `'element' \| 'text' \| 'thread' \| 'action'`                                                                           |
| `PlanSendPlace`      | `app`, `itemId`, `kind`, `tabId`, `elementId`, `part` (each `string \| null`), `label` (a tab's or page's name), `text` |
| `PlanSendCardInput`  | `title`, `assignee?` (a plan person's name), `due?` (`YYYY-MM-DD`), `checklist?` (row texts), `places` (1 to 50)        |
| `PlanSendAsk`        | `board` (an element id), `column` (a column's name), `cards` (1 to 20), `again?`                                        |
| `PlanSend`           | `id`, `ref`, `kind`, `plan: {id, title}`, `card: {id, title, column, done}`, `link` (the card), `at`                    |
| `PlanSendsRead`      | `{sends: PlanSend[]}`, newest first, only those whose plan the reader can open                                          |
| `PlanCardChange`     | `id`, `title`, `column`, `done`, `gone` (in the Trash or deleted)                                                       |
| `PlanSendDoorCall`   | `person`, `board`, `column`, `cards: {title, description, assignee?, due?, checklist?, sentFrom}[]`                     |
| `PlanSendDoorAnswer` | `{ok: true, cards: {id, title, column, done}[]}` or `{ok: false, code, reason}`                                         |
| `SentFrom`           | `app`, `itemId`, `title`, `kind`, `label`, `text`, `link`: the card's `sentFrom` field                                  |

- `planSendRef(place)` is `kind:tab:element:part`, each empty when null. `textPart(words)` is the first 12 hex
  characters of a 32-bit FNV-1a of the words, lower-cased and spaces folded.
- `readPlanSendAsk`, `readPlanCardChanges`, `readSentFrom` check a body; anything over a cap or of the wrong type is
  null.
- `SourceChange` gains `cards?: string[]` (at most `PLAN_CARDS_CHANGED_MAX`); `sheetIds` may then be empty.
  `readSourceChange` takes a change with either.
- Constants as the spec's Limits table, plus `PLAN_SEND_TITLE_MAX` 200, `PLAN_SEND_TEXT_MAX` 2,000,
  `PLAN_SEND_LABEL_MAX` 120.
- `IndexClient.sendToPlan(planId, ask)`, `IndexClient.planSends(sourceId, share?)`,
  `IndexClient.newPlanForSend(name)`, `IndexAppClient.planCardsChanged(planId, cards)`,
  `IndexAppClient.recordPlanSends(planId, person, cards)` (an agent's card with `sentFrom`).

## The index (liveworkspace/apps/index)

```
src/plan-sends.ts         POST /items/:id/plan-sends (a send), GET /items/:id/plan-sends (a source's), POST /plan-sends/plans
src/plan-send-rows.ts     the rows: insert, the source's read, the changes, the agents' record
migrations/0030_plan_sends.sql
```

| Column             | Holds                                                       |
| ------------------ | ----------------------------------------------------------- |
| `id`               | `ps_` and 20 random letters                                 |
| `source_id`        | the source item (`REFERENCES items (id) ON DELETE CASCADE`) |
| `ref`              | the place (`planSendRef`)                                   |
| `kind`             | the place's kind                                            |
| `plan_id`          | the plan (`REFERENCES items (id) ON DELETE CASCADE`)        |
| `card_id`          | the card                                                    |
| `card_title`       | as the plan last said, cut to 200                           |
| `column_name`      | as the plan last said, cut to 120                           |
| `done`, `gone`     | 0 or 1                                                      |
| `at`, `updated_at` | epoch ms                                                    |

Indexes: `(source_id, at DESC)` for a source's read, `(plan_id, card_id)` for the changes and a send's duplicate check.

- **A send**: the person is an account in person (not a delegate, the Drive mirror or an export); the limiter; the
  ask read; the plan `loadItem(…, 'edit')` with `access.tabId === null`, of app liveplanner, live; every place's source
  `loadItem(…, 'view')` (each distinct source once); a source holding `PLAN_SENDS_PER_SOURCE_MAX` is refused
  (`source_full`); a place with a live send to this plan and no `again` is 409 `already_sent` with `{send}`. The grant
  as automation-steps.ts mints one; the call `callAppForJson(env, 'liveplanner', '/items/:id/plan-send', call,
APP_CALL_TIMEOUT_MS, {X-Index-Grant})`. A 403 or 404 is `no_access`; a refusal answer is 422 with its code.
- **A source's read**: `loadItem(source, 'view')` with the caller's share; the newest `PLAN_SEND_READ_MAX` rows not
  gone; each distinct plan (at most `PLAN_SEND_PLANS_CHECKED_MAX`, newest first) checked with `loadItem(plan, 'view')`
  for the caller without a share code; rows of a plan that refuses, or past the cap, are left out. A guest reads none.
- **The changes**: `POST /app/items/:id/plan-cards`, liveplanner's key, the plan the app's; one
  `UPDATE plan_sends SET … WHERE plan_id = ? AND card_id = ? AND (differs) RETURNING source_id` a card, batched; the
  changed sources' apps read in one statement; each told through `callApp(…, '/items/:source/source-changed', …)`,
  `SOURCE_SIGNAL_CONCURRENCY` at a time, at most `PLAN_SEND_SOURCES_SIGNAL_MAX`.
- **The agents' record**: `POST /app/items/:id/plan-sends`, liveplanner's key, `{person, cards: [{id, title, column,
done, sentFrom}]}`: each source checked as the person (`view`); recorded only where they can read it.
- **New Plan**: `POST /plan-sends/plans {name}`: an account in person, the limiter, then liveplanner's template door
  (`kanban`, `folderId` null) as a kit part is made; answers `{item}`.

## The door (`@liveworkspace/index-app`, src/plan-send-door.ts)

`handleInternalItems` serves `POST /api/internal/items/:id/plan-send` with the index's key, reads the call
(`readPlanSendDoorCall`), checks the grant with the app's `verifyGrant` and `grantWrites(claims, call.person, id)`
(automation-step-door.ts), then hands the app's `planSend(itemId, call, claims)` the call. A refused grant is 403
`grant_refused`; a throw is `{ok: false, code: 'failed'}`.

## liveplanner

| File                                              | Role                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/items/src/sent-from.ts`                 | `SENT_FROM_FIELD` (`sentFrom`), `readSentFrom`; the store keeps it as any unknown field |
| `apps/api/src/plan-room/plan-send-door.ts`        | The door's handler: the cards made as the person, in one insert, history theirs         |
| `apps/api/src/plan-room/sent-cards.ts`            | The room's watch on sent cards and the gathered change call (as sheet-watchers.ts)      |
| `apps/api/src/routes/item-routes.ts`              | A create carrying `sentFrom` (an agent's) recorded through `recordPlanSends`            |
| `apps/editor/components/plan/ItemPanelLayout.tsx` | The Sent From row in the card's footer                                                  |

The room's `broadcastOrderedSystemOp` hands every `items` op to `SentCards.changed(op)`: a card upserted with
`sentFrom` is noted (`sent_cards (card_id)` in the room's SQL), and any noted card upserted or removed is gathered; one
flush after `PLAN_CARDS_SETTLE_MS` reads the plan's boards once (`doneStatusesOf`, `cardPlacesOf`) and sends the changes.
A plan with no sent card pays one indexed probe a changed card.

## The editors (`@liveworkspace/workbench`, src/components/send-to-plan/)

```
send-words.ts          the draft from the words: title, mention, due (a tokenizer), the place's ref
send-memory.ts         the plan, board and column remembered per item (local storage, 50 kept)
send-store.ts          one store a page: the open item's sends (read once, again on a `source-changed` naming cards),
                       the request the picker is open on, the item the host binds
SendToPlanHost.tsx     mounted once by each editor: binds the item, loads the dialog on demand
SendToPlanDialog.tsx   the picker
SentChip.tsx           the chip, and SentChipFor (a place's chip from the store)
SentChipsLayer.tsx     the canvases' chips over their elements, in canvas space, counter-scaled
send-to-plan-entry.ts  the entry's words and icon every menu uses, and sendToPlanOpen(request)
```

Each editor binds its own parts: what a place's words are, its menu entries, where its chips sit (each app's spec).

## Tests

- Wire: every reader's refusals; `planSendRef` and `textPart`; `readSourceChange` with cards.
- Index: a send's every refusal (guest, delegate, no edit, tab-scoped, not a plan, no read on the source, full, already
  sent, limited), the grant's claims, the rows; the read leaving out a plan the reader cannot open and a gone card; the
  changes telling only changed sources; the agents' record refusing a source the person cannot read; New Plan.
- Door: a grant for another item, another person, a lower level, a tab-scoped grant, no grant: each refused.
- liveplanner: the cards made as the person with `sentFrom`, the board gone, the plan full; the room's gathered call;
  the agents' create recorded; the Sent From row.
- Editors: the words (titles, mentions, dates, a 50,000-character worst case in a CPU budget), the memory, the store's
  reads and its signal, the picker's flow and its keyboard, the chip's states, each app's entries and its roles.
