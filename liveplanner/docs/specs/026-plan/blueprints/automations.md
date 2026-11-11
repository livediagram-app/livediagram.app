# Automations blueprint

Derived from [Automations](../automations.md). Phase 1 (#711).

## Domain and naming

| Spec term           | Identifier                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------- |
| rule                | `AutomationRule` / `AutomationRuleBody` (`packages/items/src/automation/types.ts`)           |
| trigger             | `AutomationTrigger` (`kind`: `card_created`, `form_response`, `card_moved`, `field_changed`, |
|                     | `comment_added`, `manual`)                                                                   |
| condition           | `AutomationCondition` (`type`, `column`, `field`, `who`, `saved_filter`)                     |
| step / action       | `AutomationStep` / `AutomationAction`; If / Else is the step `{ kind: 'if' }`                |
| run                 | `AutomationRun` (`result`: `done`, `no_match`, `skipped`, `failed`)                          |
| value               | `{{…}}` placeholders, `packages/items/src/automation/values.ts`                              |
| Automation (person) | `automationPerson(ruleName)`: `{ id: 'automation', name: <rule name>, color: '#7c3aed' }`    |
| history tag         | `ItemHistoryTag` gains `'automation'`                                                        |
| a waiting trigger   | `AutomationEvent` (`packages/items/src/automation/matches.ts`, queued by the api)            |

## Files

```
packages/items/src/automation/
  types.ts            the shapes and limits (written first; the contract both sides build on)
  validate.ts         readRuleBody(v) → { body } | { error, path, message }: every limit, every kind, values known;
                      ruleNameTaken / freeRuleName for names (what the plan lacks is attention.ts's, never a refusal)
  outline.ts          AutomationOutline { types, statuses, people, savedFilters, formTabs }: the plan as rules read it
  attention.ts        ruleNeeds(rule, outline) → string[]: what a rule names that the plan lacks
  values.ts           VALUE_NAMES, valuesIn(text), fillValues(text, ctx) and the {{now ± Nd}} day maths, in the
                      rule's time zone
  conditions.ts       holds(condition, ctx) → { ok, text }: one condition, with the line the Run Log shows
  matches.ts          AutomationEvent; eventOfWrite(before, after, changes, source) → the event a landed write makes
                      (or null); triggerMatches(trigger, event, ruleId) → boolean; TRIGGER_EVENT_KINDS
  plan-actions.ts     planActions(steps, ctx) → { patch, comments, created, emails, lines } | { failed, lines }:
                      the pure run: walks steps and If / Else, folds every change to the triggering card into ONE
                      patch (set / clear, in order), marks "Already so", never touches storage
  sentence.ts         ruleSentence(rule, outline) → chips[]: the Rules list's "When Card Moved to Done then …"
  index.ts            re-exports; packages/items/src/index.ts exports './automation'
  *.test.ts           one per module; 100% branches (the package's thresholds)

packages/api-schema/src/automations.ts
                      AutomationsListResponse { rules: (AutomationRule & { stats, needs: string[] })[],
                        runsToday: number, runsPerDay: number },
                      AutomationRunsResponse { runs: AutomationRun[] }, AutomationRunResponse { run: AutomationRun },
                      AutomationRunResponse { run: AutomationRun }, error codes below

apps/api/src/plan-room/automations/
  automation-schema.ts   the tables (below): the plan schema's step V18 (plan-schema.ts)
  automation-store.ts    rules CRUD on the room's SQL; an in-memory `kinds: Set<kind>` of the kinds some rule that is
                         on listens for, rebuilt on every rule write and on wake (the hot-path check)
  automation-queue.ts    eventsOfWrites + enqueueStatement (appendItemHistory adds it to its own batch),
                         enqueueComment (the thread routes); AutomationSchedule (at / queued / due / restore / next /
                         done) as RepeatSchedule; PlanAutomations, the room's `automations` and its env's AUTOMATIONS
  automation-plan.ts     readAutomationPlan: the AutomationOutline, the plan's name and the account ids behind its
                         people's hashed ids (owner, joined team members, known_people), once per wake or request
  plan-room-automations.ts  the room's alarm step (runAutomations) and what a run needs from the room
  automation-copy.ts     the rules in a copy and in the plan's file
  automation-runner.ts   one event against every rule it matches: run id, budget, chain, conditions, planActions,
                         then the writes (below), the Run Log row, the failure count and pausing
  automation-writes.ts   applies a planned run: one items patch for the triggering card via the shared write
                         loop with `by: automationPerson(name)` and tag 'automation'; a thread via the card-thread
                         store with Automation as author; Create Card via makeItem + insertItems; emails via the
                         notifier's send (opt-outs honoured, account people only)
  automation-log.ts      Run Log insert and trim (2,000 runs and 500 No Matches, 30 days), the stats query, today's count

apps/api/src/routes/automation-routes.ts   the routes below, dispatched from project-subresource-routes.ts
apps/api/src/routes/automation-source.ts   writeSource(ctx) (who made a route's write, worked out only when a rule
                                           hears it) and queueComment

apps/api/src/routes/automation-routes.ts   the routes below; gate: whole-plan edit, signed-in person, no API token
apps/editor/components/automations/
  AutomationsButton.tsx       the footer button (in ChromeControls between Search and Settings), amber dot
  AutomationsDialog.tsx       the screen: tabs, meter, Rules and Run Log views, phone sheet
  RulesList.tsx, RuleRow.tsx, RulesEmpty.tsx
  RunLog.tsx, RunRow.tsx
  RuleBuilder.tsx             breadcrumb bar, step cards, add buttons, Rule Details accordion, Discard Changes?
  StepCard.tsx, StepPanel.tsx, step-panels/*.tsx   one panel per trigger, condition and action kind
  ValueInsert.tsx             Insert a Value chips and the chip-rendered text field
  TestOnCard.tsx              the card finder and the dry-run result
  RunRuleMenu.tsx             the card ⋯ menu's Run Rule submenu
  use-automations.ts          fetch, mutate and cache the list for the open plan
  automations-client.ts       the routes, typed with api-schema
```

## Storage (the plan's own SQLite)

```sql
CREATE TABLE automation_rules (
  id TEXT PRIMARY KEY, body TEXT NOT NULL,            -- AutomationRule JSON
  enabled INTEGER NOT NULL, position INTEGER NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0);
CREATE TABLE automation_queue (
  id INTEGER PRIMARY KEY, event TEXT NOT NULL, at INTEGER NOT NULL);  -- rowid order, no AUTOINCREMENT
CREATE TABLE automation_runs (
  id TEXT PRIMARY KEY,                                 -- runId(event.id, rule.id): INSERT OR IGNORE = never twice
  rule_id TEXT NOT NULL, at INTEGER NOT NULL, result TEXT NOT NULL, body TEXT NOT NULL);
CREATE INDEX automation_runs_at ON automation_runs (at);
CREATE INDEX automation_runs_rule ON automation_runs (rule_id, at);
CREATE INDEX automation_runs_result ON automation_runs (result, at);   -- the two trims
```

The day's count is `SELECT COUNT(*) FROM automation_runs WHERE at >= <UTC midnight> AND result != 'no_match'`, indexed, so the budget needs no
table of its own. A plan never given a rule has empty tables and `onKinds` empty.

## The event

```ts
type AutomationEvent = {
  id: string; // `${cardId}:${card.rev}` for a card write; `c:${commentId}`; `m:${nonce}`
  kind: 'created' | 'moved' | 'changed' | 'comment' | 'manual';
  cardId: string;
  from?: string;
  to?: string; // statuses, for moved
  fields?: string[]; // changed field ids, for changed (a moved write can also be changed)
  form?: string; // the Form tab, when the history tag was 'form'
  by: ItemPerson;
  role: 'editor' | 'participant' | 'agent' | 'automation' | 'system';
  rule?: string;
  chain?: number; // set when by is Automation: the rule that made it and the chain length
  ruleId?: string; // manual: the one rule to run
};
```

- `appendItemHistory` (db/item-history.ts) takes a fifth argument, `source` (`{ role, rule, chain, form }`; `role`
  may be a function, called only when an event is built), and adds ONE insert to its own batch: it builds events from
  `historyChangesOf(before, after)` (created / moved / changed), skips the Trash and archive moves, and queues them
  **only when `kinds` holds a matching kind** (the hot-path cost for a plan with no rule that is on is one Set
  lookup and no statement). The insert is `INSERT … SELECT … FROM json_each(?) LIMIT MAX(0, 500 - COUNT(*))`, so the
  cap needs no read; its `meta.changes` says how many were dropped. A write with no `role` takes it from its tag
  (`ai` agent, `automation` automation, `form` / `repeat` system, else editor); `system` (a form response, a
  Repeat) is never an Editor, a Participant or an agent to Who Did It. A tag of `'automation'` carries the rule and chain from the write's context; a write
  whose rule has `chain: false` enqueues nothing but records the Skipped line for rules it would have met (runner).
- The comment write (card-thread-store / comment routes) enqueues `comment` for a new thread or reply whose author is
  not Automation.
- `POST …/automations/:ruleId/run` enqueues nothing: it runs at once and answers the run.
- Queue past `AUTOMATION_QUEUE_MAX`: the new events are dropped and one Skipped Run Log row says so (once per wake).
- After enqueueing, the room's schedule asks for a wake now (`noteWrite`), as Repeats do; the alarm drains up to
  25 events per wake, then asks again in 1 s while more wait.

## The run (automation-runner.ts)

For each event, for each rule that is on, in `position` order, whose trigger matches:

1. Budget: today's count (read once per wake) ≥ `AUTOMATION_RUNS_PER_DAY` → drop (no row; the meter says why).
2. `runId = sha256(event.id + ':' + rule.id)` (@liveworkspace/model-core sha256); `INSERT OR IGNORE` the run row as
   `pending`. Not inserted means it ran already: skip.
3. Chain: the event's `rule === rule.id` → nothing (never its own changes). Event by Automation from a rule with
   `chain: false`, or `chain >= AUTOMATION_CHAIN_MAX` → **skipped** with its reason, only if the conditions hold.
4. Read the card; gone or trashed → **no_match** "The card is gone".
5. Conditions (`holds`), all must hold, else **no_match** with the lines.
6. `planActions` → the writes (automation-writes.ts), each with `{ rule, chain: (event.chain ?? 0) + 1 }` on the
   write context so the events they cause carry it.
7. The row is updated to its result, steps and `tookMs`; `failures` set to 0 on done, +1 on failed, and at
   `AUTOMATION_FAILURES_TO_PAUSE` the rule is turned off with `paused`.

A run never throws out of the wake: an unexpected error is a **failed** run with "Something went wrong" and the
error logged.

## Routes (inside the plan's room, `/api/projects/:id/automations`)

| Route                                   | Body / answer                                                  | Errors                              |
| --------------------------------------- | -------------------------------------------------------------- | ----------------------------------- |
| `GET    /automations`                   | → `AutomationsListResponse`                                    | 403 `automations_need_editor`       |
| `POST   /automations`                   | `AutomationRuleBody` → `{ rule }` (off until it has a trigger  | 400 `automation_invalid` + `path`,  |
|                                         | and an action; else on)                                        | `automation_value_unknown`,         |
|                                         |                                                                | 409 `automation_name_taken`,        |
|                                         |                                                                | 409 `automation_rules_full`         |
| `PUT    /automations/:ruleId`           | `AutomationRuleBody` → `{ rule }`                              | as POST, 404 `automation_not_found` |
| `POST   /automations/:ruleId/toggle`    | `{ enabled }` → `{ rule }` (on clears `paused`, `failures`)    | 404                                 |
| `POST   /automations/:ruleId/duplicate` | → `{ rule }` ("<name> copy", off)                              | 404, 409 full                       |
| `DELETE /automations/:ruleId`           | → 204 (its runs stay in the log until they age out)            | 404                                 |
| `POST   /automations/order`             | `{ ids }` → 204                                                | 400                                 |
| `POST   /automations/test`              | `{ rule: AutomationRuleBody, item }` → `AutomationRunResponse` | 400, 404 `item_not_found`           |
| `POST   /automations/:ruleId/run`       | `{ item }` → `AutomationRunResponse` (manual rules only)       | 404, 409 `automation_not_manual`    |
| `GET    /automations/runs`              | `?rule&result&since&limit≤200` → `AutomationRunsResponse`      | 403                                 |

Gate on every route: `gateEdit` for the whole plan, a signed-in caller, no API token, not a tab-scoped link
(403 `automations_need_editor`). A Browser Storage plan never calls them. An unknown path under `/automations` is
not routed (the OpenAPI drift probe's clean 404), and every route is in the OpenAPI manifest under the tag
**Automations**. Run Rule past the day's budget answers 429 `automation_budget_spent` and runs nothing.

## As built (Phase 1 api)

- `planActions` answers `{ patch, comments, created, emails, lines }` or `{ failed, lines, done }` (no `ok` field); the
  patch holds only what differs from the card as it was (a Flag then Unflag writes nothing).
- A rule's comment carries `automation: { ruleId, rule }` on the Comment (@liveplanner/project comments.ts), by
  `authorId: 'automation'`, `authorName: 'Automation'`; it is written through the thread store, never the routes,
  so it starts no Comment Added rule.
- Send Email resolves the recipient's account by hashing the owner, the team's joined members and `known_people`,
  and honours the **assigned actions** email setting (`notifyActionAssigned`); a name typed onto a card has no
  account and gets nothing. The template is `automationEmail` (`EmailKind` 'AutomationEmail').
- Create Card needs a card type from the plan's catalogue: a plan whose types are not chosen fails the run with
  "Card type <id> is gone".
- The day's budget counts done, failed and skipped runs; a No Match is logged and never counted. The trim keeps the
  newest 2,000 of those and, apart from them, the newest 500 No Match rows, so a rule that matches nothing on every
  save never pushes a real run out of the log.
- `planActions`' failed answer carries `done`, the writes of the steps before the failed one; the runner applies
  them, then logs the run **Failed**. A refusal from the card store itself (a Calculated field, a required field
  emptied, the plan full on Create Card) fails at its write: the card's one patch lands first, then the card it makes,
  then its threads, so what was written before the refused write stays.
- Copies: a whole-plan copy that does not come through a link (its owner's or team's Duplicate) keeps the rules; a
  copy through a share link, of one tab, or of a Community post takes none, since the rules are an Editor's of the
  whole plan to see. The plan's file (`liveplanner.project`, the Drive mirror) carries `automations`; a file read
  into a new plan brings each back under a fresh id, off, checked by readRuleBody.
- Tables hold no `plan_id`: each plan's SQLite is its own.

## Phase 2 (Work Item #712)

### Shapes (packages/items/src/automation/types.ts)

```ts
type AutomationTrigger = … // Phase 1's, plus:
  | { kind: 'scheduled'; every: 'day' | 'weekday' | 'week' | 'month'; days?: number[]; // week: 0 Sun … 6 Sat
      dayOfMonth?: number; at: string } // month: 1 to 31; at: 'HH:MM', minutes 00/15/30/45
  | { kind: 'due_in'; days: number; at: string } // 1 to 30
  | { kind: 'overdue'; at: string };
type AutomationAssignee = … | { rotate: string[] }; // 2 to 10 person ids
type AutomationOutgoing = { kind: 'notify'; via: 'webhook' | 'slack' | 'teams'; webhook: string; text: string };
type AutomationRelated =
  | { kind: 'linked'; field?: string } | { kind: 'blocked_by' } | { kind: 'blocking' } | { kind: 'children' }
  | { kind: 'saved_filter'; tab: string; filter: string };
type AutomationBranch = { kind: 'for'; related: AutomationRelated; conditions: AutomationCondition[];
  then: AutomationAction[] }; // no if, for, create_card or notify inside
type AutomationStep = AutomationAction | AutomationOutgoing | IfStep | AutomationBranch;
```

New limits beside Phase 1's: `AUTOMATION_TIME_CARDS_MAX = 100`, `AUTOMATION_BRANCH_CARDS_MAX = 100`,
`AUTOMATION_BRANCH_ACTIONS_MAX = 10`, `AUTOMATION_OUTGOING_MAX = 5`, `AUTOMATION_ROTATE_MIN = 2`, `…_MAX = 10`,
`AUTOMATION_LATE_MAX_MS = 24 h`. `validate.ts` refuses Who Did It conditions and `{ trigger: true }` assignees and
recipients on a time trigger (`automation_condition_unsupported`), a branch's forbidden steps
(`automation_step_unsupported`), more than 5 notify steps, and a minute off the quarter hour. New values:
`{{trigger.title}}`, `{{trigger.key}}`, `{{trigger.url}}` (only inside a branch; elsewhere unknown).

Pure parts, each with its own tests: `schedule.ts` (`nextMoment(trigger, timeZone, after)` and
`latestMissed(trigger, timeZone, since, now)`, both through `Intl.DateTimeFormat` with the clock-change rules of the
spec, shared with card-repeats' local-day helpers rather than a copy), `related.ts` (`relatedCards(card, related,
items, ctx)`, capped and sorted by number), `templates.ts` (the 8 templates as `AutomationRuleBody` builders over a
plan outline, filling by role, returning the steps left to pick).

### Storage (plan schema V19)

```sql
CREATE TABLE automation_schedule (rule_id TEXT PRIMARY KEY, next_at INTEGER NOT NULL);  -- time triggers only
CREATE INDEX automation_schedule_next ON automation_schedule (next_at);
ALTER TABLE automation_rules ADD COLUMN turn INTEGER NOT NULL DEFAULT 0;              -- Assign in turn's place
```

- Saving, turning on or resuming a time-trigger rule upserts its `next_at = nextMoment(now)`; turning it off,
  deleting it or changing its trigger to a card one deletes the row.
- The room's alarm (plan-room-wiring's one schedule, as Repeats and the outbox share it) asks
  `MIN(next_at)` beside its other times: one indexed read, none when the table is empty.

### The wake

- Due rows (`next_at <= now`): for each, `latestMissed` gives the one moment to run (older than
  `AUTOMATION_LATE_MAX_MS` is dropped). The rule reads the plan's cards once per wake (shared by every due rule),
  keeps those its trigger and conditions match (`due_in`: due = local day + days; `overdue`: due before the local day
  and status not a done column), sorts by due date then number, takes 100, and enqueues one event per card with id
  `t:${ruleId}:${localDay}:${at}:${cardId}` (scheduled) or `d:${ruleId}:${cardId}:${due}` (due_in, overdue), so
  `runId` makes each once ever. Past 100, one Skipped line says how many waited. Then `next_at = nextMoment(now)`.
- The event's `kind` is `time`, its `by` `automationPerson(rule.name)`, its `role` `system`, its `ruleId` the rule:
  the runner runs only that rule for it, skipping the trigger match (the scan did it) but not the conditions (a card
  changed since is checked again).
- Worst case, timed by a perf test: 2,000 cards (ITEMS_MAX) and 50 time-trigger rules due at once, inside the
  wake's CPU budget (the test's limit 1,500 ms, as Phase 1's).

### Runner additions

- **Branches**: `relatedCards` per branch, then each related card's conditions and actions through the same
  `planActions`, one write per card. The run's lines gain `{ kind: 'branch'; text; ok; cards: number }`.
- **Rotate**: the run takes `turn % people.length` (skipping people who left), and on a done run writes `turn + 1`
  in the batch that records the run.
- **Notify**: after the card writes, the run's notify steps go in one `POST /app/items/:id/automation-sends`
  (index binding, the app's server credentials as card-moves uses), key `${runId}:${stepIndex}`, message filled by
  `values.ts`; each result marks its step done ("Queued for Launch Channel") or failed with the reason. The index
  unreachable is a failed step, "Couldn't reach webhooks: try again". A rule's `paused.webhook` holds the webhook id
  when it paused on a notify failure, for Fix Webhook.
- Test on a Card: branches list what they would do per related card; notify says "Would post to <name>: <text>";
  rotate names whose turn it is; time triggers run on the chosen card as at their moment.

### Editor

- Trigger panel: Scheduled (Every: Day, Weekday, Week with day chips, Month with a day; At: a quarter-hour select),
  Due In (days), Overdue; the time zone shown ("Times are Europe/London"). A time rule's row shows "Next: Mon 9:00".
- **+ For Related Cards** adds a branch card with its inset steps and its own + Add Condition / + Add Action.
- Notify panels list the plan's webhooks of their kind from `GET /api/index/items/:id/webhooks` (lazy, once per
  builder), with **Add a Webhook…** opening the existing Webhooks dialog and refreshing the list on close.
- Assign panel gains **People in Turn** (a person multi-picker, 2 to 10, order as picked).
- Templates tab and the empty state's gallery (`TemplatesGallery`, category chips, tiles); a picked template opens
  the builder unsaved with its left-to-pick steps marked.
- A Browser Storage plan's footer button opens the **Rules Run on Our Servers** panel instead of the screen.

### As built (Phase 2 engine)

What the items package and the api do, where it differs from or adds to the design above (each a decision of the
build):

- **Files.** `packages/items/src/automation/` gains `schedule.ts` (`clockMinutes`, `clockWords`, `firesOn`,
  `momentOn`, `nextMoment`, `latestMissed`; a Scheduled rule's days are a Repeat's, through `repeat.ts occursOn`),
  `related.ts` (`relatedCards`), `time-cards.ts` (`timeCards`: the scan's pure part, the event ids and the 100 cap),
  `set-value.ts` and `plan-walk.ts` (split out of `plan-actions.ts`, which re-exports the Planned* types). The moment
  of a clock time on a day is `clockMoment(day, minutes, timeZone)` in `repeat-dates.ts`, beside `dayStart`, so
  the zone sums stay in one place. The api gains `apps/api/src/plan-room/automations/automation-time.ts` (the wake's scan) and
  `apps/api/src/plan-room/automations/automation-sends.ts` (the one push). `templates.ts` is not built here: it belongs with the
  Templates gallery.
- **`AutomationOutgoing.name`** (optional, up to 80 characters): the webhook's name when the builder picked it. The
  room holds no list of the plan's webhooks, so the Run Log's "Queued for Launch Channel" and "Would post to Launch
  Channel: …" read it; the sentence prefers the outline's current name (`RuleSentenceOutline.webhooks`).
- **Event kind `time`**: `TRIGGER_EVENT_KINDS` maps the three time triggers to `['time']`, which no write builds, so
  a plan whose only rules are time rules still pays nothing on a save. `triggerMatches` hears a time event for its
  `ruleId` alone, as a manual one.
- **Refusals.** Who Did It, Assign whoever triggered and Send Email to whoever triggered are refused on a time
  trigger wherever they stand (the rule's conditions, an If's, a branch's; its actions). An If / Else holds actions
  only: an outgoing action, a branch or an If inside one is `automation_step_unsupported`, as in a branch.
  Both new codes are in `AUTOMATION_ERRORS` (400). `{{trigger.…}}` outside a branch is `automation_value_unknown`.
- **The wake.** One alarm step does the time scan, then drains the queue the scan just filled.
  `AutomationSchedule.timeAt` is `MIN(next_at)` (read on restore, after every rule write through
  `AutomationStore.onSchedule`, and after each scan); `wakeAt` is the earlier of it and the queue's, which
  `armAlarm` takes. A due rule whose cards don't fit in the queue's room now is not dropped: its row stays due and
  the scan asks again in 1 s (`AUTOMATION_TIME_RETRY_MS`), so a moment never loses cards to the 500 cap; the run ids
  make the re-scan harmless. The Skipped "Ran on 100 of 340 …" row has id `time:<rule>:<moment>` and counts toward
  the day's budget like any Skipped row. A wake that throws pushes `timeAt` a minute on, as the queue's.
- **Copies** schedule each time rule they keep on, from the copy's moment (`copiedRuleStatements`).
- **Branches.** The branch's actions count once toward the run's 20, not once per card. Its line reads "For each
  Child Card: on 3 related cards" (", failed on #12, #14" when any did; "on 100 of 340" past the cap); each related
  card's lines follow it headed by its number, and a card whose conditions don't hold gets one line naming the first
  that failed. A related card that fails keeps the writes of its steps before (as the top level does); the run goes
  on to its later steps and ends **Failed**, "Failed on #12, #14: <the first reason>". A write the card store
  refuses for a related card fails that card the same way. Linked Cards reads the card type's Card fields only;
  Cards Matching a Saved Filter leaves out the triggering card. A run reads the plan's cards only when the rule has a
  branch.
- **Assign in Turn.** Each assignment takes as many turns as it looked through (a person who left uses their turn),
  so a branch gives each related card the next person; a done run adds the turns taken (`advanceTurn`), a failed,
  unmatched or test run adds none. Test on a Card takes an optional `ruleId` (`AutomationTestRequest.ruleId`) to show
  the saved rule's turn.
- **Notify.** Sent after every card write, in one push, key `${runId}:${step}`, the card's link `cardUrl` (the
  app's own origin). A message whose filled text is blank is never sent and fails its step, "The message came out
  empty" (the index refuses a blank send, and with it the whole push). The index's reasons are shown as it words
  them. `paused.webhook` is set when the pausing failure was a webhook paused or gone, not one that was full.
  The index client's `pushAutomationSends` is declared in `automation-sends.ts` to the signature
  `packages/index-client` builds (`AutomationSend`, `AutomationSendResult`), read off the app client at run time,
  until the two branches meet; then it is that package's import.
- **`{{person}}`** reads "Automation" whenever the trigger is by Automation (a time trigger or another rule's change).
- **Needs Attention** names people in turn, a branch's saved filter and Card field, and its conditions' and
  actions' names; webhooks only when the caller passes the plan's webhook ids (`ruleNeeds(rule, outline, webhooks)`,
  the builder): the api's list does not, since the webhooks live in the index.
- **Test on a Card** of a time rule runs on the chosen card as at its moment, without checking its due date.
- **Measured** (`automations.perf.test.ts`): 2,000 cards and 50 overdue rules due at once (5 hearing every card, 45
  checking a condition that never holds): the wake's CPU time is 165 to 191 ms on an M-series Mac, against the
  1,500 ms limit.

### As built (Phase 2 editor)

What the editor does, where it differs from or adds to the Editor list above (each a decision of the build):

- **Files** (`apps/editor/components/automations/`): `StepAddButtons.tsx` (the add menus, top level and per holder),
  `step-panels/TimeTriggerPanel.tsx`, `BranchPanel.tsx`, `AssignPanel.tsx` and `OutgoingPanel.tsx`,
  `plan-webhooks.tsx` (the builder's webhooks state and context), `TemplatesGallery.tsx`, `NewRuleMenu.tsx`,
  `ScreenTabs.tsx`, `screen-clock.ts` (the minute clock and `localZone`, out of the dialog),
  `AutomationsOfflineDialog.tsx` and `use-automations-offline.ts`. `rule-draft.ts` treats an If / Else and a branch
  as one "holder" (`HolderStep`, `holderOf`, `sideOf`); a branch has no Else. `templates.ts` is in the items package,
  as designed, with `picksLeft(body, picks)`, which the builder runs on each change, so a mark goes as its step is
  filled.
- **Holders.** The `RulePart` paths are the api's (`steps.i.conditions.j`, `steps.i.then.j`) for both kinds, so a
  refusal inside a branch marks its step as one inside an If does. Add Action in a branch leaves out Create Card and
  the outgoing actions; at the top level the outgoing ones join the menu while the rule holds fewer than 5.
  Duplicate is greyed where the copy would pass a limit (`canDuplicate`).
- **Time rules.** The trigger list groups its kinds ("Something Happens to a Card", "A Time Comes Round"). Every is
  a SegmentedToggle; the week's chips run Monday first; Due In reads "Days Before It's Due". A rule saves with this
  browser's IANA zone (`timeZone`, the saver's), and the panel names it. The When card of a time rule with no
  conditions carries the one-line warning, the panel the full one. The first condition's label reads "For cards
  where". "Whoever triggered it" is left out of Assign and Send Email; an Assign added starts on the plan's first
  person. The Rules row adds "Next: Mon 9:00" (Today, Tomorrow, a weekday within six days, else the date) from
  `stats.nextAt` while the rule is on.
- **Webhooks.** The list is read once per builder, the first time an outgoing panel opens, and again when the
  Webhooks dialog it opened closes; Try Again after a failed read. A guest asks nothing (webhooks need an account).
  The dialog holds one `ItemWebhooksDialog`, for **Add a Webhook…** and **Fix Webhook** (shown when `paused.webhook`
  is set), titled with the plan's name. The step's Preview header names the webhook ("To Launch Channel").
- **Templates.** The gallery's chips are the screen's own (not saved). A template opens as the target
  `{ view: 'rule', ruleId: null, template }`, built by `templateStart` with the outline's phases
  (`PlanContextValue.statusPhases`) and named by `freeRuleName`. Telemetry is `UI · Opened · AutomationTemplate.<id>`
  (an event has no value field); the site's catalogue declares the computed type and charts it as Automation
  Templates Opened.
- **Run Log.** A branch line wears its own mark (blue, a list tree; red when it failed on a card), and the lines after
  it that start with a card number are inset under it, the number in the card's weight (`insetLines`).
- **Browser Storage.** `automationsOfflineFor` (offline, hydrated, not an embed, edit level, structure editable)
  gives the footer an `AutomationsDoorContext` door without any `AutomationsContext`, so Run Rule and the list stay
  absent. The panel is its own lazy chunk; Save to Your Account runs `syncToCloud` signed in (a failure toasts
  `syncFailureMessage` and keeps the panel), and is the sign-in link for a guest, who saves on return.
- **Labels.** The branch values' chips read Trigger Title, Trigger Number and Trigger Link
  (`AUTOMATION_BRANCH_VALUE_LABELS`).

## Editor

- `ChromeControls` takes `onOpenAutomations?` and `automationsAttention?` (the amber dot); the editor passes them
  only when `canEditWholePlan && !isOffline`. Phone: icon-only 40 px target, as Search.
- The dialog uses the shared Dialog shell and `@liveworkspace/ui` primitives (Button, Switch, Tooltip/HoverCard,
  EmptyState, MenuActionRow); colours from the theme (slate surfaces, brand violet); Title Case everywhere.
- Pickers read the plan outline the editor already holds (types, statuses by board, fields, people).
- History: `CardActivity` renders tag `'automation'` with the bolt glyph, "**Automation**" and `by.name` (the rule).
  Comments by `id === 'automation'` render the bolt avatar and the violet card. The item panel's **Set by Automation**
  chip reads the panel's loaded history.
- `ItemPanelMenu` gains **Run Rule** (submenu `RunRuleMenu`) for an Editor when a manual rule is on.

## Tests

- items: each module to 100% branches; validate refuses every limit and kind; planActions folds patches and marks
  Already so; values fill and refuse unknowns; a two-rule loop test at the pure level (chain counting).
- api: routes' role tests (Owner, team, Editor link, tab-scoped Editor, Participant, Viewer, API token); the queue
  enqueues nothing when no rule is on (count statements); exactly once under a repeated wake; the chain stops at 5;
  pausing after 10 failures; the budget; a 50-rule plan's save path timed (`automations.perf.test.ts`, CPU budget).
- editor: each component's states (empty, list, paused, needs attention, builder steps, panels, test result, run log
  rows), the footer button's role gating, the card menu.
- help: an Automations article in apps/help, its figures, the repo-paths and ui-labels tests.
