# Automations blueprint

Derived from [Automations](../automations.md) and the platform's
[Automations](../../../../../liveworkspace/docs/specs/018-automations/automations.md). The engine is the platform's
(`@liveworkspace/automations`, [item-engine.md](../../../../../liveworkspace/docs/specs/018-automations/blueprints/item-engine.md));
this blueprint is livediagram's wiring of it into the api, item by item of that blueprint's "Wiring an app", and into
the editor ("Editor", below), and the reference the other apps copy. The MCP tools and the CLI verb are later stages
and not here.

## Naming

| Word          | Means here                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------- |
| **document**  | the item rules belong to; its copy word is `itemWord: 'canvas'`, as the editor and emails say |
| **engine**    | the room's one `ItemEngine` (`room.automations`, `env.AUTOMATIONS` inside the room)           |
| **kit**       | what the room hands the engine (`documentKit(room)`)                                          |
| **put away**  | archived or in the Trash, as the index last said (`room.standing.putAway`)                    |
| **collab**    | the comment and action triggers' watch over each tab's threads (`room.collab`, `env.COLLAB`)  |
| **call site** | a place a write queues the event its rules hear                                               |

## Files

```
packages/document/src/automations/        @livediagram/document/automations (pure: a browser, a Worker)
  kinds.ts                                  KINDS (defineItemKinds), AUTOMATIONS_TELEMETRY_CATEGORY
  triggers.ts                               Poll Ended, Question Asked, Agent Made Changes; the event kinds and data keys
  values.ts                                 poll.question, poll.results, poll.answers, question; pollResultLines
packages/document/src/document-envelope.ts  `document.automations` in the file; copyDocumentEnvelope answers `tabIds`
packages/templates/src/template-catalogue.ts       automationTabTemplates, automationTabTemplateNames (createAutomationTabTemplates)
packages/api-schema/src/automations.ts      the wire types, filled in with the item engine's rule and run
packages/api-schema/src/telemetry-schema.ts the `Ran` action

apps/api/src/document-room/
  document-schema.ts                        steps 9 to 18
  document-room.ts                          `standing`, `automations`, `collab`; the doors' RPC methods
  room-content-state.ts                     restoreAutomations on wake
  room-lifecycle.ts                         the alarm's due list and run; the purge
  room-rpc.ts                               `joined`, `accessRequested`; a grant's standing; a copy's `withRules`
  room-qa-poll.ts                           Question Asked, Poll Ended
  document-outbox.ts                        the collab diff's call
  document-snapshots.ts                     `kept`, the silent revert, Snapshot Taken
  document-file.ts, document-content.ts     rules in the file and in a copy
  automations/
    document-automations.ts                 newDocumentAutomations, restoreAutomations, runDocumentAutomations, forgetAutomations
    document-kit.ts                         documentKit
    kit-outline.ts                          documentItemOutline, documentUrl, documentTabUrl
    kit-snapshots.ts                        kitSnapshots
    kit-text.ts                             documentText
    kit-add-tab.ts                          addTemplateTab
    kit-mail.ts                             kitMail, optOutDoor, optOutPage
    poll-event.ts                           pollEventData, pollEndedEvent
    test-automation-world.ts                tests only: one document's real room on node:sqlite
apps/api/src/routes/
  automation-routes.ts                      /api/documents/:id/automations[/…]: the caller, then the engine's routes
  automation-hook-route.ts                  POST /api/hooks/automations/:documentId/:ruleId
  email-optout-route.ts                     POST /api/email-optout/:documentId/:token
apps/api/src/email/email-shell.ts           automationEmailLook: the app's shell round the platform's rule email
apps/api/src/changesets/write.ts            Agent Made Changes; who made a changeset's new tab
apps/api/src/openapi/manifest.ts            itemAutomationOperations, the manifest's Automations entries
apps/api/test/workerd-automations/          the room on workerd: worker.ts, wrangler.toml, automations.workerd.test.ts
```

The standing holder, the event helpers, the collab watch, the rules file, the doors, the sends, the rule email and
the OpenAPI list are the platform's, shared with every item app: `@liveworkspace/automations/room`
(packages/automations/src/room/app/; liveworkspace/docs/specs/018-automations/blueprints/item-engine.md "Wiring an
app").

## Kinds (checklist 1)

`KINDS = defineItemKinds({ itemWord: 'canvas', collab: true, tabTemplates: true, triggers: DOCUMENT_TRIGGERS,
values: DOCUMENT_VALUES })`, exported from `@livediagram/document/automations`: its own package entry, so nothing that
only reads a document pulls the engine in. The api and (later) the editor import the same value.

| Kind             | Fields | Hears            | Flags                  | Event `data`                                    |
| ---------------- | ------ | ---------------- | ---------------------- | ----------------------------------------------- |
| `poll_ended`     | none   | `poll_ended`     |                        | `poll.question`, `poll.results`, `poll.answers` |
| `question_asked` | `tab?` | `question_asked` | `tabbed`, `personless` | `question`                                      |
| `agent_changed`  | `tab?` | `agent_changed`  | `tabbed`               | none                                            |

Values: `poll.question`, `poll.results`, `poll.answers` (under `poll_ended`) and `question` (under `question_asked`),
each filled from the event's `data`. `pollResultLines(tally)` writes each option and its count, one a line, the most
chosen first, ties in the poll's own order. Every kind's `format` shows its own `"kind"` (`undescribedKinds(KINDS)` is
empty, held by a test).

Add a Tab from a Template is the engine's shared `add_tab`. The templates it may name are
`automationTabTemplates()` (`@livediagram/templates`): the library as `GET /api/templates` lists it, `id` the
template's kind, `name` its title; `automationTabTemplateNames()` is the same as `ItemNames.templates`.

## Schema (checklist 2)

Appended to `document-schema.ts` `STEPS` after step 8 (the tab folder colour, which shipped first), never edited once
shipped:

| Step    | Makes                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------- |
| 9 to 16 | the engine's `rules`, `schedule`, `hooks`, `waiting`, `ai_drafts`, `fired`, `addresses`, `counts`     |
| 17      | the engine's `item` step: its five tables and three SQL triggers on `tabs` and `document_tabs`        |
| 18      | `automation_collab_seen (tab_id PRIMARY KEY, summary)`: each tab's threads and actions as last diffed |

`DOCUMENT_SCHEMA_VERSION` is 18. Steps 9 to 17 are `itemAutomationSchemaSteps({ links: 'document_tabs' })`, one entry
each.

## The engine in the room (checklist 3, 5, 6)

- **Made** in the room's constructor (`newDocumentAutomations`): `sql` the object's SQLite, `ready` `room.schemaReady`,
  `arm` `room.armAlarm()`, `kit` `documentKit(room)`, `putAway` `room.standing.putAway`. `env.AUTOMATIONS` is the same
  engine, for the content modules' call sites.
- **Restored** on wake, once the schema stands (`restoreContentState` → `restoreAutomations`): the rules heard, the
  queue's and the times' next wake, and the collab watch's state. A room with no schema restores nothing.
- **The alarm.** `armAlarm`'s due list gains `room.automations.schedule.wakeAt` and `room.collab.at`. `alarm` runs
  the collab baseline before the outbox's drain and `runDocumentAutomations` (`schedule.due(now)` then
  `runItemAutomations`) after the upkeep and before the live status round, so the comment triggers a drain just
  queued run in the same alarm.
- **Put away.** The index's standing push (`routes/internal-items.ts` `standing`) reaches `room.takeStanding`, which
  keeps the newest `{ putAway, at }` under the storage key `documentStanding`. Turning put away: `engine.sync()` then
  `schedule.clear()`. Coming back: a held Wait more than `AUTOMATION_LATE_MAX_MS` past its time is settled Skipped
  ("The document was archived or in the Trash when this run was due"), then `engine.restore(now)` and
  `engine.sync()`. A grant signed after the stored moment brings a put-away document back too
  (`takeGrantStanding`, called by `route`); a document that never heard a standing keeps no key and is never changed
  by a grant.
- **Purged.** After `deleteAll`: `standing.forget()`, `forgetAutomations` (`engine.clear()`, `engine.sync()`,
  `collab.forget()`).

## The kit (checklist 4)

`documentKit(room)` answers null while the room has no env or no document id.

| Binding     | Bound to                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `kinds`     | `KINDS`; `itemWord` `canvas`; `category` `Document`                                                                |
| `outline`   | `readDocumentOutline`: name, `${APP_BASE_URL}/document/<id>`, owner, tabs, `editedAt` its last save                |
|             | people: the team's joined accounts (at most `OUTLINE_PEOPLE_MAX`, 200) and the owner, by name; no address is read  |
| `tabUrl`    | the document's link with the editor's tab pin, `#t=<tabId>`                                                        |
| `snapshots` | `listSnapshots`; `takeSnapshot` (`kind: 'manual'`, `keptIds` from the door); `revertToSnapshot` with               |
|             | `documentSnapshotDoor`, the door a person's requests use                                                           |
| `text`      | the `outline` view (`@livediagram/document-views` `renderView`): one tab's, or every tab's under `# <name>`, a tab |
|             | at a time, stopped once `AI_SUMMARISE_TEXT_MAX` characters are held                                                |
| `addTab`    | `addTemplateTab`: `compileSeededTabs` (the seeded create's path) then `upsertTab` at `nextOrderIndex`, then the    |
|             | `document-meta` op as an ordered system op                                                                         |
| `mail`      | `kitMail`: null without the `EMAIL` binding                                                                        |
| `sends`     | `kitSends`: `indexAppClient(env).pushAutomationSends`, the subject passed through; null without an index           |
| `ai`        | `aiClient(env)` (the `AI` binding) and `env.AI_GATEWAY`                                                            |
| `run`       | `{}`: livediagram has no step of its own beyond the shared `add_tab`                                               |
| `values`    | absent: every value of its own is filled from the event's `data`                                                   |
| `telemetry` | `reportServerEvents(env, events)`                                                                                  |
| `hookUrl`   | `${APP_BASE_URL}/api/hooks/automations/<documentId>/<ruleId>`                                                      |
| `putAway`   | `room.standing.putAway`                                                                                            |
| `defer`     | `room.state.waitUntil`                                                                                             |

- **A rule's revert is the ordinary one.** `revertToSnapshot` takes the safety snapshot, replaces the content
  through the door, advances the generation, and the door's `afterRevert` calls `env.SNAPSHOT_REVERTED`, which
  forgets the ledger and closes every socket with `SNAPSHOT_REVERTED_CLOSE`. The door's `replaceContent` runs inside
  `silently` (a `{ silent: true }` writer window), for a rule's revert and a person's alike.
- **Add a Tab** fails with: `TAB_LIMIT_REACHED` when the document holds `RULE_TABS_MAX` (200) tabs, `TEMPLATE_GONE`
  for an id `templateKindOf` does not know, `TEMPLATE_FAILED` when the engine refuses the seed or the document is not
  started, `TAB_TOO_LARGE` past `MAX_TAB_BYTES`. A retired template's id makes its replacement.
- **Send Email.** To a person: `notifyRecipients(env, [id], 'notifyActionAssigned')`, so only a verified address and
  only while they have not turned assigned-action emails off; false (the step fails "no address to send to")
  otherwise. To a typed-in address: `automationAddressEmail` with the engine's unsubscribe links, sent with
  `List-Unsubscribe-Post` (`oneClick`). The day's 50 and the unsubscribes are the engine's. Both are kind
  `AutomationEmail`. The once-only claims and the hourly allowance of the notification emails
  (`@liveworkspace/index-app` `createNotifier`) do not apply: a rule's email is the rule's own, bounded by the
  engine's 1,000 runs a day.

## Routes (checklist 7)

`handleAutomationRoutes` (routes/automation-routes.ts) is first in `handleDocumentSubresources`. It answers null for
any path but `/api/documents/:id/automations`, `…/automations/:a` and `…/automations/:a/(toggle|duplicate|run|secret)`,
before touching storage; then 404 for a document not started, 503 `automations_unavailable` outside a room; then
`handleItemAutomationRoutes` with:

| `caller`   | From                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `editor`   | `!ctx.workbench && gateEdit(ctx, id)` with no tab, so a grant confined to one tab is refused        |
| `signedIn` | `ctx.verifiedUserId !== null && !ctx.workbench`: an account, in person or behind a token            |
| `token`    | `{ readOnly }` when `ctx.token`                                                                     |
| `person`   | `authorOf(ctx, owner)` for a signed-in Editor; "Someone" otherwise (never stored: they are refused) |
| `reader`   | `grantOn(ctx, id) !== null`: any grant, a one-tab link's included; never a Community post's link    |

The worker refuses a read-only token's writes before dispatch (403 `read_only_token`), as for every route.

Before identity, in `index.ts`:

- `segments[1] === 'hooks'` → `handleAutomationHook`: the address by one regex (404), `readItemHookCall` (405, 415,
  413), `WRITE_RATE_LIMITER` keyed `hook:<network>` (429, `Retry-After: 60`), then the room's `incomingHook`, which
  answers a document never started as a wrong secret (after the same proof work, without making its schema) and
  otherwise `answerItemHook`.
- `segments[1] === 'email-optout'` → `handleEmailOptOut`: the address (404), POST only (405), the limiter keyed
  `optout:<network>` (429), then the room's `emailOptOut` (`itemOptOut`): 200 `{ unsubscribed: true }` or 404
  `optout_not_found`. The page the email's link opens is `${APP_BASE_URL}/email-optout?d=<documentId>&t=<token>`,
  the editor's to build.

`openapi/manifest.ts` spreads the platform's fifteen operations (`itemAutomationOperations`, tag **Automations**) into `ROUTE_MANIFEST`;
`scripts/gen-openapi-schemas.mjs` names their bodies and `schemas.generated.ts` is regenerated.
`@livediagram/api-schema` re-exports the shared wire types (`@liveworkspace/api-schema/automations`) with the rule
(`AutomationRule = ItemRule`), the body, the run and the need filled in.

## Event call sites (checklist 8, 9)

Every call site goes through `queueDocumentEvent(env, event)` (or the SQL triggers), which does nothing but one Set
lookup unless a rule that is on hears the kind. Each queues in the same synchronous stretch as its write: a Durable
Object commits writes with no I/O between them as one.

| Trigger            | Where                                                              | Carries                                         |
| ------------------ | ------------------------------------------------------------------ | ----------------------------------------------- |
| Tab Added          | SQL trigger; who from `asTabWriter` in `tab-put-route.ts` (a save  | `by`, `role`, `data['tab.name']`                |
|                    | that makes its tab) and `changesets/write.ts` (a changeset's)      |                                                 |
| Tab Removed        | SQL trigger; who from `asTabWriter` round `deleteTabRow`           | `by`, `role` (`agent` for a token)              |
| Edited, Then Quiet | SQL trigger                                                        |                                                 |
| Snapshot Taken     | `serveDocumentSnapshots`, after a person's take answers 201        | `by`, `role: 'editor'`                          |
| Someone Joined     | `room-rpc.ts` `joined` (the index's `joined` notice)               | `by`, `role` from the link's level              |
| Access Requested   | `room-rpc.ts` `accessRequested` (the index's notice, by a new RPC) | `by` the requester                              |
| Comment Added and  | `CollabWatch.note`, called from `drainOutbox`'s `collab` read      | the comment's text and author; a resolve, an    |
| the other four     |                                                                    | assign or a done by whoever alone saved         |
| Poll Ended         | `room-message.ts`, before `poll.noteLifecycle` lets the poll go    | `by` the name on the ender's cursor (id empty), |
|                    |                                                                    | `role` from their level, the tally              |
| Question Asked     | `handleQaWrite`, inside the queued write, for an `add` that landed | `tab`, `data.question` (500 characters); nobody |
| Agent Made Changes | `writeChangeset`, after its batch, when a token wrote it           | `tab`, `by` the token's name, `role: 'agent'`   |

- **A person's revert is silent**, as a rule's: `documentSnapshotDoor.replaceContent` runs inside `silently`.
- **The snapshots door's `kept`** is `keptSnapshots(env)` (`keptSnapshotIds(engine.store)`).
- **Poll Ended's tally** (`pollEventData`): every option of the poll with its count (an unchosen one at 0), or for a
  free-text poll each distinct answer with its count; at most `POLL_RESULT_LINES_MAX` (50) lines and
  `POLL_RESULTS_MAX` (4,000) characters; `poll.answers` counts the answers that were not skips. No answer's key is
  read into the event.
- **The room names nobody by account**, so Poll Ended's `by.id` is empty: Who Did It by role works, by a chosen
  person never matches, and an email to "whoever started it" has nobody to send to.

### The collab diff

`CollabWatch` keeps, in `automation_collab_seen`, what the diff compares of each tab (threads as
`[elementId, resolved, commentCount]`, actions as `[elementId, actionId, status, assigneeId]`). Its states:

| State     | Means                                               | Left by                                          |
| --------- | --------------------------------------------------- | ------------------------------------------------ |
| `clear`   | no rule listens; the table is empty                 | a rule that listens is turned on → `partial`     |
| `partial` | a rule listens; some tab may lack its summary       | a baseline pass that finds no more → `ready`     |
| `ready`   | every tab the document held when last asked has one | the last listening rule goes → `clear` (emptied) |

- `rulesChanged()` runs after every rule write (the store's `onSchedule`, wrapped in the room's constructor) and
  every change of put away. It empties the table when nobody listens.
- `baseline(now)` (the alarm, before the drain) reads up to `COLLAB_BASELINE_TABS` (10) tabs with no summary and keeps
  theirs, making no event; more wait `COLLAB_BASELINE_MORE_MS` (1 s). On wake the state is `partial` when a rule
  listens (one query confirms it) and `clear` otherwise.
- `note(tabId, rows, now, sole)` (the drain): nothing unless a rule listens; the kept summary read; unchanged, no
  write; no summary kept, the summary is kept and nothing queued; else `collabEvents(before, after)` queued and the
  new summary kept. `sole` (whoever alone saved since the last drain) is asked for, one profile read, only when a
  resolve, an assign or a done was found. A tab that is gone has its row deleted.
- The diff reads the rows the Inbox's push is built from (`collabIndexRowsFromElements`), before the push's cap, so a
  thread past the cap never reads as new.
- A comment whose latest author is Automation makes no event (`collabEvents`). livediagram's rules write no comment
  today; the rule holds for the day one does.
- **Known edges.** Comment and action triggers are heard when the outbox drains: on idle, at most once a minute. A
  tab made and commented on inside one drain window has its first comment taken as its baseline, so that comment
  starts nothing.

## Files and copies (checklist 11)

- **The file.** `exportDocumentFile` passes `automations: documentRulesForFile(env)` (`rulesForFile(store.list())`);
  `documentToEnvelopeText` writes `document.automations` only when there are some, so a document with no rule exports
  byte for byte as before. `parseDocumentEnvelope` reads a list back and anything else as none.
- **An import.** `readDocumentFile` (not `keepIds`) hands `copy.automations = { rules, tabs }`, `tabs` the file's tab
  ids to the new ones (`copyDocumentEnvelope`'s `tabIds`).
- **Make a Copy.** `exportDocumentCopy(…, withRules)` adds the same from `copiedRulesOf(env, tabIdMap)`.
  `room-rpc.ts` `exportCopy` sets `withRules` unless the copy is made through a share link or a Community post's
  link: the rules are an Editor's of the whole document and may name addresses.
- **Landing.** `importDocumentCopy` appends `landedRuleStatements` to its one batch:
  `rulesFromFile(rules, KINDS, { stamp, tabs, copy: true })`, each rule inserted with `enabled = 0`. A tab the new
  document lacks, and every snapshot and connection, is left empty to pick; a rule that does not read is left
  behind (logged with the count). All off, so nothing is heard or scheduled until someone turns one on.
- **A revert** (`keepIds`) reads no rules: a snapshot puts back content, never a rule.
- **The file's version** is the document's last save, which a rule's save does not move: a mirror that already holds
  that save is answered `unchanged`, and takes the rules with the next content save.

## AI (checklist 12)

`[ai] binding = "AI"` in `wrangler.toml` and `[env.staging.ai]`; `Env.AI` and `Env.AI_GATEWAY`. Without the binding
Summarise with AI and Describe a Rule answer "AI isn't set up here".

## Telemetry (checklist 13)

`TELEMETRY_ACTIONS` gains `Ran`; the engine's types go out under `Document·Ran` through `reportServerEvents`, one
batch a wake. A rule's email counts as `Email·Sent·AutomationEmail`. The editor's own events are in "Editor" below.

## Share roles

As the spec's table, held by `routes/automation-routes.test.ts`: an Editor of the whole document, signed in, does
everything; an Editor through a one-tab link, a Participant, a Viewer, a guest on an Editor link, a link visitor
with no identity and someone with no grant get 403 `automations_need_editor` on all twelve Editor routes and change
nothing; a token lists, adds, changes, tests and runs, cannot make a secret (403) and cannot save or duplicate a rule
holding Revert to Snapshot (403 `automation_needs_a_person`); a read-only token reads the list and the Audit Trail
and is refused every write (403 `read_only_token`); the summary answers any reader and shows no address, connection
or AI ask.

## Cost

| Path                              | With no rule on                       | With a rule that hears it                           |
| --------------------------------- | ------------------------------------- | --------------------------------------------------- |
| A tab save                        | the triggers' probe of an empty table | the engine's trigger bodies (item-engine.md "Cost") |
| A call site                       | one Set lookup                        | one or two statements                               |
| The outbox's drain, a changed tab | five Set lookups                      | one read; a changed tab, a diff and one write       |
| A wake of the room                | four small reads and one storage get  | the same                                            |
| `armAlarm`                        | two field reads                       | one read when a rule hears a SQL-fed kind           |
| An access request                 | one RPC to the room                   | the same, and one insert                            |

Measured, 2026-11-20, on an Apple-silicon laptop:

- **The triggers' compile cost, on workerd** (`test/workerd-automations`, the real schema in a Durable Object,
  10,000 to 20,000 saves a round, best of three): a tab save with the engine's three triggers 16.1 µs, without them
  14.4 µs, inside the noise between runs (18.5 against 18.4 µs in another). Each save compiled afresh (its text made
  unique): 124.6 µs with, 75.5 µs without. So a Durable Object's `sql.exec` does reuse the compiled statement for a
  save, whose text never changes, and the triggers cost a save nothing it can feel while no rule is on; an object
  pays about 50 µs once per wake for the first save's compile. The triggers therefore stay as the schema step makes
  them, and are not made and dropped with the rules.
- **The api's bundle** (`wrangler deploy --dry-run`): 3,918 KiB, 1,001 KiB gzipped, with the engine in it. The engine
  and these kinds bundled alone are 174 KiB, 49 KiB gzipped: the most they add.
- **The collab diff** (`collab-watch.test.ts`, CPU time): a tab of 600 threads and 600 actions with one changed, 1.5
  ms; budget 15 ms. An unchanged tab: one read, no write.

Bounds: 200 people an outline, 200 tabs for Add a Tab, 10 tabs a baseline pass, 50 lines and 4,000 characters of
poll results, 500 characters of a question, and the engine's own (50 rules, 500 queued events, 25 events a wake).

## Tests

| File                                                               | Holds                                                             |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `packages/document/src/automations/kinds.test.ts`                  | the kinds, their words, values and refusals; no kind undescribed  |
| `packages/document/src/document-envelope.test.ts`                  | rules in the file; `tabIds`                                       |
| `packages/templates/src/template-catalogue.automation.test.ts`     | the Add a Tab list                                                |
| `apps/api/src/routes/automation-routes.test.ts`                    | the share roles, through the real gates                           |
| `apps/api/src/routes/automation-doors.test.ts`                     | the two public doors' refusals before the room                    |
| `…/automations/automation-events.test.ts`                          | every call site; nothing written with no rule on; put away; purge |
| `…/automations/automation-runs.test.ts`                            | Scheduled, revert, Add a Tab, Incoming Webhook, email, Summarise  |
| `…/automations/collab-watch.test.ts`                               | the diff, the baseline, the emptying, the CPU budget              |
| `…/automations/rules-file.test.ts`                                 | the file, an import, Make a Copy                                  |
| `…/automations/poll-event.test.ts`                                 | the tally                                                         |
| `…/automations/kit.test.ts`                                        | the outline's people, a person's email, the sends, the text       |
| `apps/api/src/email/email-shell.ts` (the platform's email.test.ts) | the two emails, in the app's shell                                |
| `apps/api/test/workerd-automations/`                               | the real room on workerd (below)                                  |

The api's tests run the room on node:sqlite (`@liveworkspace/index-app/testing` `nodeDurableState`).
`test/workerd-automations/automations.workerd.test.ts` runs the real `DocumentRoom` on workerd through wrangler's
`unstable_dev` (as `packages/api-kit/test/workerd-body` does), with nothing persisted: the schema, the triggers silent
with no rule on, a tab added and removed with who, a Scheduled rule, an Edited, Then Quiet settle, Take Snapshot and
Revert to Snapshot, an Incoming Webhook call with a good and a bad signature, and the trigger cost above.

## Editor

The platform's screen mounted in the editor, item by item of
[ui.md](../../../../../liveworkspace/docs/specs/018-automations/blueprints/ui.md) "Mounting the screen in an editor"
(steps 1, 7 to 11) and [item-ui.md](../../../../../liveworkspace/docs/specs/018-automations/blueprints/item-ui.md)
"Mounting Automations in an item editor" (in place of steps 2 to 6).

### Files

```
packages/document/src/automations/templates.ts   DOCUMENT_TEMPLATES, TEMPLATE_CATEGORIES, RETRO_TEMPLATE_ID
packages/api-schema/src/telemetry-schema.ts      the `Tested` action
packages/api-schema/src/page-views.ts            `email-optout` among LIVE_ROUTE_SEGMENTS
apps/editor/components/automations/
  document-plumbing.ts           DOCUMENT_AUTOMATIONS_CLIENT, DOCUMENT_AUTOMATIONS_PLUMBING, trackDocumentAutomations
  document-item.ts               DocumentItemContext, useDocumentItem, useDocumentItemView, peopleOf
  use-document-automations.ts    useDocumentAutomations: the scope, the gate, signedIn, the ItemView
  DocumentAutomationsHost.tsx    AutomationsHost with the plumbing, the lazy screen and gate; provides the ItemView
  DocumentAutomationsScreen.tsx  lazy: AutomationsKitProvider + AutomationsDialog over the kit
  DocumentAutomationsGate.tsx    lazy: AutomationsSyncGate with SyncGateDialog, the sign-in, the help link
  document-kit.tsx               DOCUMENT_AUTOMATIONS_KIT (defineItemAutomationsKit), the describe examples
  document-scenes.tsx            the three own triggers' vignettes
apps/editor/components/chrome/ChromeControls.tsx   the Tools row (useAutomationsToolsItem), after Search
apps/editor/app/document/[id]/EditorView.tsx       useDocumentAutomations, the host round the view
apps/editor/app/globals.css                        the package's `@source`, automation-scenes.css
apps/editor/app/email-optout/                      page.tsx and EmailOptOutView.tsx: EmailOptOutPage of automations-ui
liveworkspace/apps/site/app/telemetry/livediagram/ the Automations charts, sentences and template values
apps/editor/lib/help-articles.ts                   `automations`: `tools/automations`
```

### The plumbing (item-ui step 2)

`createItemAutomationsClient({ base: `${API_BASE}/documents/<id>/automations`, fetch: apiFetch, headers:
apiHeaders(scope.ownerId, { share: scope.shareCode, body }), expectOk, expectOkVoid })` over `lib/api/core`, so every
call carries the document's grant, the share password and the snapshot fence as every other call does. Then
`defineItemPlumbing({ itemWord: 'canvas', examples, client, track })`, examples "Snapshot it every Friday, tell
Slack when someone comments, or put a workshop board back every night."

`track` (`trackDocumentAutomations`), each event its own call:

| Event             | Sent                                       |
| ----------------- | ------------------------------------------ |
| `opened`          | `UI·Opened·Automations`                    |
| `opened_offline`  | `UI·Opened·AutomationsOffline`             |
| `opened_sign_in`  | `UI·Opened·AutomationsSignIn`              |
| `describe_opened` | `UI·Opened·AutomationDescribe`             |
| `template_opened` | `UI·Opened·AutomationTemplate.<id>`        |
| `rule_created`    | `Document·Created·AutomationRule`          |
| `draft_created`   | `Document·Created·AutomationDraft`         |
| `secret_created`  | `Document·Created·AutomationSecret`        |
| `secret_changed`  | `Document·Changed·AutomationSecret`        |
| `secret_copied`   | `Document·Copied·AutomationSecret`         |
| `rule_on`, `_off` | `Document·Toggled·AutomationOn` / `…Off`   |
| `rule_deleted`    | `Document·Deleted·AutomationRule`          |
| `rule_tested`     | `Document·Tested·AutomationRule`           |
| `rule_run`        | `Document·Ran·AutomationManual` (Run Rule) |

### The item (item-ui step 3)

`useDocumentItemView(input)` answers the `ItemView`, each part memoised on what it reads, so a canvas edit (which
gives `tabs` a new identity, the tabs' ids and names unchanged) answers the same object:

| Field          | From                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------- |
| `id`, `name`   | `documentId`; `documentName`, else "Untitled canvas"                                         |
| `tabs`         | `{ id, name }` each, memoised on a key of the ids and names                                  |
| `currentTabId` | `activeId`                                                                                   |
| `people`       | `peopleOf(self, candidates)`: the signed-in account, then the document team's joined members |
|                | (`commentMentions.candidates` with a `userId`, not pending), each once                       |
| `shareCode`    | `sessionShareCode`                                                                           |
| `signedIn`     | `accountUserId !== null`                                                                     |
| `openTab`      | `selectTab`, read through `useLatest`, so a new handler never changes the view               |

The host provides it on `DocumentItemContext`; the kit's `useItem` is `useDocumentItem`, which reads it inside the
lazy screen (the screen draws beside the editor's tree, under the host).

### The kit (item-ui steps 4 and 5)

`DOCUMENT_AUTOMATIONS_KIT = defineItemAutomationsKit({ … })`, a module constant only the lazy screen imports:

| Input             | Bound to                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `kinds`, `app`    | `KINDS`; `livediagram`                                                                                              |
| `plumbing`        | `DOCUMENT_AUTOMATIONS_PLUMBING`, the host's                                                                         |
| `useItem`         | `useDocumentItem`                                                                                                   |
| `snapshots`       | `snapshotsApi({ apiFetch, apiHeaders: apiHeaders('', { share, body }), itemUrl }).list()`'s `snapshots`             |
| `tabTemplates`    | `automationTabTemplates()` (`@livediagram/templates`)                                                               |
| `own.triggers`    | `poll_ended` (picture, no panel: "Starts when…"), `question_asked` and `agent_changed` (picture, `TabTriggerPanel`) |
| `own.tones`       | `Workshop`: orange                                                                                                  |
| `templates`       | `DOCUMENT_TEMPLATES`, `TEMPLATE_CATEGORIES`; pictures composed (`ItemTemplateScene`)                                |
| `describe`        | three examples and a placeholder for a canvas                                                                       |
| `helpButton`      | `HelpArticleLink article="automations" variant="button" label="How Rules Work"`                                     |
| `indexClient`     | the workbench's `indexClient`                                                                                       |
| `useSignInHref`   | `useAuthHrefs().signInHref`                                                                                         |
| `signatureHeader` | `WEBHOOK_SIGNATURE_HEADER`                                                                                          |

`snapshots`' `apiHeaders('')`: the screen opens only for a signed-in account, whose token `apiHeaders` sends; the
owner id only guards a guest's requests. The three vignettes are built from `scene-parts` and the item scene bits
(`PANEL`, `Board`, `Fire`, `Chip`, `Cursor`, `SparklesGlyph`), fixed sizes, CSS transitions on transform and opacity alone
through `at` and `after`, resting before and playing on hover or focus, still under reduced motion.

### The door (ui steps 7 to 9)

`useDocumentAutomations(ctx, isOffline, selectTab)` builds the gate input: `level` `can.level`, `structureReadOnly`
`isStructureReadOnly` (true for a Viewer, a Participant and a one-tab link), `offline`, `hydrated`, `embed`
`embedMode || workbench`, `signedIn` `accountUserId !== null`, `authLoaded`, and `scope` `{ ownerId:
selfParticipant.id, itemId: documentId, shareCode: sessionShareCode, tabId: sessionTabScope }` once the participant
is known. `automationsScopeFor` and `useAutomationsGate` (`ready`: the participant known; `sync` `syncToCloud`;
`badges` `Sign In`, `Sync Canvas`, memoised) answer the rest. `EditorView` wraps its tree in
`DocumentAutomationsHost`; `ChromeControls` puts `useAutomationsToolsItem()` after Search, in the Automate group.

| Who                                          | Row                        | Opens                 |
| -------------------------------------------- | -------------------------- | --------------------- |
| An Editor of the whole document, signed in   | Automations…               | the screen            |
| A guest Editor                               | Automations… `Sign In`     | the gate, Sign In     |
| An Editor on a document kept Offline         | Automations… `Sync Canvas` | the gate, Sync Canvas |
| An Editor through a one-tab link             | none                       |                       |
| A Participant, a Viewer, an embed, workbench | none                       |                       |

The gate (`DocumentAutomationsGate`) is `AutomationsSyncGate` with `item` "Canvas", the shared `SyncGateDialog` (`packages/workbench/src/components/dialogs/SyncGateDialog.tsx`) over `SyncDocumentPrompt` (its `title` and `signInHref` props), the sign-in
`authHrefWithReturn('/sign-in/', …)` and the help link.

### Unsubscribing

`app/email-optout/page.tsx` draws `EmailOptOutView`, which draws `EmailOptOutPage` of `@liveworkspace/automations-ui/EmailOptOutPage` with `app`
`livediagram`, `item` `canvas`, `param` `d` and `send` its `sendEmailOptOut(API_BASE, …)`: a POST to
`/api/email-optout/:documentId/:token`, no identity; 200 done, 404 the link doesn't work, else Try Again. `email-optout`
joins `LIVE_ROUTE_SEGMENTS`, so the router sends it to the editor.

### Performance

- **First load.** `EditorView`, its footer and `ChromeControls` reach the host, the plumbing, `document-item.ts` and
  the hook, and of the package only the door's entry, `automations-gate`, `use-automations-gate`,
  `automations-tools-item` and `item/plumbing`; never `…/item`, the screen, the kit or a picture
  (`document-automations-lazy.test.ts`). The screen and the gate load with chunks of their own the first time each
  opens.
- **Renders.** The `ItemView` keeps its identity through a canvas edit (`document-item.test.tsx`), so the open
  screen's outline and lists stay as they are while someone draws. The scope is memoised on what it reads, and the
  host's context values are the platform's, memoised on it.

### Tests

| File                                                         | Holds                                                                |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `packages/document/src/automations/templates.test.ts`        | the thirteen; each reads once picked; exactly its picks left         |
| `components/automations/document-automations-lazy.test.ts`   | the editor's first load reaches the door and `…/item/plumbing` alone |
| `components/automations/document-item.test.tsx`              | the view, its people, its identity through a canvas edit             |
| `components/automations/document-plumbing.test.ts`           | every event's call; the routes' address                              |
| `components/automations/document-automations-roles.test.tsx` | the row by share role, each gate's dialog, the scope's identity      |
| `components/automations/document-scenes.test.tsx`            | each own trigger's picture; the kit builds; the describe examples    |
| `lib/telemetry-coverage.test.ts`                             | the new pairs in the manifest                                        |

## Agents

The shared rule tools ([item-engine.md "Agents"](../../../../../liveworkspace/docs/specs/018-automations/blueprints/item-engine.md#agents))
bound in this product's agent-verbs package:

| File                                         | Holds                                                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `packages/agent-verbs/src/rules/index.ts`    | `RULE_PRODUCT` (`AGENT_PRODUCT`, `KINDS` from `@livediagram/document/automations`, `TEMPLATES`'s kinds and titles), `ruleRun` |
| `packages/agent-verbs/src/mcp/rule-tools.ts` | `mcpListRules`, `mcpChangeRules` (`createRuleTools`), in `MCP_TOOL_VERBS`                                                     |
| `packages/agent-verbs/src/rules/index.ts`    | also `ruleVerbs`, the `rule` verbs (`createRuleVerbs` over its addressing), in `VERBS`; `guide rules`                         |

`apps/mcp/src/rule-tools.ts` registers the two tools; `apps/cli` maps them to `rule ls` and `rule set` in its tool
names and names `rule` on the top help's last line. Tests: `packages/agent-verbs/src/verbs/rule.test.ts` (catalogue, format, listing, a
change round trip over the routes, the refusals, 100 rules within a CPU budget) and `apps/mcp/src/rule-tools.test.ts`.

## Copying this to another app

Follow liveworkspace/docs/specs/018-automations/blueprints/item-engine.md "Wiring an app": nearly everything is the
platform's now. What stays per app is its kinds, its outline, text and own steps in the kit, its call sites, its
gates on the routes, and its tests.
