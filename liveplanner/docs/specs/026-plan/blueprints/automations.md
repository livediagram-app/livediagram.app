# Automations blueprint

Derived from [Automations](../automations.md). Phase 1 (#711), Phase 2 (#712), and Phase 3's agent and CLI rule
tools, AI actions and Incoming Webhook trigger (#713).

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
  validate-read.ts    the reading primitives (id, ids, text, day, clock, whole) and the Refused they throw
  validate-conditions.ts
                      readTrigger / readConditions: a rule's trigger and its conditions, read the same way
  outline.ts          AutomationOutline { types, statuses, people, savedFilters, formTabs }: the plan as rules read it
  attention.ts        ruleNeeds(rule, outline) → string[]: what a rule names that the plan lacks
  values.ts           VALUE_NAMES, valuesIn(text), fillValues(text, ctx) and the {{now ± Nd}} day maths, in the
                      rule's time zone
  conditions.ts       holds(condition, ctx) → { ok, text }: one condition, with the line the Audit Trail shows
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
                         then the writes (below), the Audit Trail row, the failure count and pausing
  automation-writes.ts   applies a planned run: one items patch for the triggering card via the shared write
                         loop with `by: automationPerson(name)` and tag 'automation'; a thread via the card-thread
                         store with Automation as author; Create Card via makeItem + insertItems; emails via the
                         notifier's send (opt-outs honoured, account people only)
  automation-log.ts      Audit Trail insert and trim (2,000 runs and 500 No Matches, 30 days), the stats query, today's count

apps/api/src/routes/automation-routes.ts   the routes below, dispatched from project-subresource-routes.ts
apps/api/src/routes/automation-source.ts   writeSource(ctx) (who made a route's write, worked out only when a rule
                                           hears it) and queueComment

apps/api/src/routes/automation-routes.ts   the routes below; gate: whole-plan edit, signed-in person or their token
apps/editor/components/automations/
  AutomationsButton.tsx       the footer button (in ChromeControls between Search and Settings), amber dot
  AutomationsDialog.tsx       the screen: tabs, meter, Rules and Audit Trail views, phone sheet
  RulesList.tsx, RuleRow.tsx, RulesEmpty.tsx
  RunLog.tsx, RunRow.tsx
  RuleBuilder.tsx             breadcrumb bar, step cards, add buttons, Rule Details accordion, Discard Changes?
  StepCard.tsx, StepPanel.tsx, step-panels/*.tsx   one panel per trigger, condition and action kind
  ValueInsert.tsx             the chip-rendered text field and its Insert a Value button (ValueInsertMenu.tsx)
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
- Queue past `AUTOMATION_QUEUE_MAX`: the new events are dropped and one Skipped Audit Trail row says so (once per wake).
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

Gate on every route: `gateEdit` for the whole plan, a signed-in caller or an API token of one (Phase 3, "Agents and
the CLI" below, which also sets what a read-only token may do), never a workbench session, not a tab-scoped link
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
  room holds no list of the plan's webhooks, so the Audit Trail's "Queued for Launch Channel" and "Would post to Launch
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

- **Files**, in `apps/editor/components/automations/`: `StepAddButtons.tsx` (the add menus, top level and per
  holder), the panels `TimeTriggerPanel.tsx`, `BranchPanel.tsx`, `AssignPanel.tsx` and `OutgoingPanel.tsx` in its
  step-panels folder, `plan-webhooks.tsx` (the builder's webhooks state and context), `TemplatesGallery.tsx`,
  `NewRuleMenu.tsx`, `ScreenTabs.tsx`, `screen-clock.ts` (the minute clock and `localZone`, out of the dialog),
  `AutomationsSyncGate.tsx` and `use-automations-offline.ts`. `rule-draft.ts` treats an If / Else and a branch
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
- **Audit Trail.** A branch line wears its own mark (blue, a list tree; red when it failed on a card), and the lines after
  it that start with a card number are inset under it, the number in the card's weight (`insetLines`).
- **The gate.** `automationsGateFor` gives whoever could edit the whole plan (hydrated, not an embed, edit level,
  structure editable, no tab scope) a kind: `sync` on a plan in This Browser, `sign_in` for a guest on a server plan
  once sign-in has answered (`authLoaded`), else none; `automationsScopeFor` now also needs `signedIn`, so a guest
  never reads rules and never meets Only an Editor Can See Rules (the api's 403 for a guest, live in Phase 1). Either
  kind gives the footer an `AutomationsDoorContext` door without any `AutomationsContext`, so Run Rule and the list
  stay absent. The door opens the Share dialog's own gate, pulled out of `ShareOfflineGate` as
  `components/dialogs/SyncGateDialog.tsx` (header, `SyncProjectPrompt` with a `title`, Cancel held while syncing)
  and used by both; `AutomationsSyncGate.tsx` fills it with the spec's copy and is its own lazy chunk. Sync Plan is
  `syncToCloud`, waiting for the reader as Share's does; once synced the scope arrives and the same opening becomes
  the screen, as Share goes on to sharing. A guest's prompt offers Sign In instead (`signInHref`, a link styled as
  the Community section's Sign In to Share), back to the same page plus `?automations=1`, which the host reads on
  mount (as `?share=1`), opens the rules and drops from the address. Telemetry `UI · Opened · AutomationsOffline` or
  `AutomationsSignIn`.
- **Header band.** `HeroDialogHeader` from `@liveworkspace/ui/dialog-hero` (the platform's [dialog hero
  header](../../../../../liveworkspace/docs/specs/004-index/blueprints/dialog-hero-header.md)) with
  `automationsHeroArt` (`apps/editor/components/automations/AutomationsHeroArt.tsx`: the dot grid fading toward the
  title, the cog and looping arrow in the bottom corners, the flow as its centre piece, the bolt as its glyph). The
  art is a module constant in the dialog's own chunk, so no other bundle carries it. While the builder replaces the
  header, a visually hidden `<h2>` keeps the dialog's name.
- **Labels.** The branch values' chips read Trigger Title, Trigger Number and Trigger Link
  (`AUTOMATION_BRANCH_VALUE_LABELS`).

## Agents and the CLI (Phase 3, Work Item #713)

Derived from the spec's "Agents and the CLI" and the API token bullet of "Who may do what".

### The api door (`apps/api/src/routes/automation-routes.ts`)

`gate(ctx, projectId)` lets a caller through when all of these hold, else 403 `automations_need_editor`:

| Caller                                        | Through                                                        |
| --------------------------------------------- | -------------------------------------------------------------- |
| signed in (`accountUserId`), no token         | when `gateEdit` passes for the whole plan (as Phase 1)         |
| API token (`ctx.token`, `verifiedUserId` set) | the same `gateEdit`, as the token's account                    |
| read-only API token                           | `GET` only (the list and `/runs`); any other method 403        |
|                                               | `read_only_token`, as the worker's choke point already answers |
| workbench session (`ctx.workbench`)           | never                                                          |
| guest, link visitor with no account           | never                                                          |
| tab-scoped grant, Participant, Viewer         | never (`gateEdit` for the whole plan fails)                    |

- `Gated` gains `ai: boolean` (`!!ctx.token`). A stamp made by a token is `{ by, at, ai: true }`
  (`AutomationStamp.ai?: true`, packages/items types.ts), on `made` for create and duplicate and on `edited` for
  create, save and duplicate; toggle and order write no stamp (as Phase 1). A person's save after an agent's writes
  a stamp without `ai`.
- Run Rule's and Test on a Card's manual event is `role: 'agent'` for a token, `'editor'` otherwise, so Who Did It's
  `{ role: 'agent' }` holds for an agent's Run Rule.
- `AutomationsListResponse` gains `people: { id, name }[]` (the plan's people as rules name them,
  `readAutomationPlan(…).outline.people`, read once by the list already): what an agent needs to name a person by
  name and to word a rule's people in its sentence. The editor ignores it.
- An outgoing action still needs an Editor of the whole plan: the gate is the one door, and a token's account is
  held to it as the person is. The webhooks themselves are the index's, listed only by that account.
- The editor's builder reads "Edited by <name> (Agent)" when `edited.ai` is set (`RuleBuilder.tsx`).

### The engine (`packages/agent-verbs/src/rules/`)

```
rule-state.ts      readRulesState(api, projectId) → { list: AutomationsListResponse, plan: PlanResponse }: the two
                   reads in parallel; rulesPath(projectId); readRuns(api, projectId, { rule?, limit })
rule-outline.ts    sentenceOutlineOf(state) → RuleSentenceOutline (types, statuses, people, tabs)
rule-names.ts      namedRuleBody(body, state) → AutomationRuleBody-shaped JSON with columns, card types, fields,
                   people and Form tabs given by name turned into their ids (an id, or a name the plan lacks, kept)
rule-ref.ts        resolveRule(ref, rules) → Found<AutomationListedRule>: id, then exact name (case aside)
rule-listing.ts    listedRule(rule, outline) (the list line), listedRun(run), sentenceText(parts), ruleLine(listed)
rule-refusals.ts   ruleRefusalOf(err) → { code, message } | null: the api's code, its `path`, and the words
rule-changes.ts    applyRuleChanges(api, projectId, changes, state) → { applied, runs, refusal? }; RuleChange
index.ts           re-exports, from packages/agent-verbs/src/index.ts
```

- `listedRule`: `{ id, name, on, paused?, needsAttention?, trigger, sentence, lastRun, runsThisWeek, nextRun? }`;
  `sentence` is `ruleSentence(rule, outline)` joined, words and chips with one space; times are ISO.
- `RuleChange` = `add { rule }` | `set { rule, name?, trigger?, conditions?, steps?, chain?, timeZone? }` |
  `on|off|delete|duplicate { rule }` | `test { rule: string | body, card }` | `run { rule, card }`. `add` fills
  `conditions: []`, `steps: []`, `chain: false`, `timeZone: 'UTC'` when left out; `set` lays the given parts over the
  held rule's body. Each write answers the rule, which replaces the held one in the state, so a later change sees it.
  The cards are read (`GET …/items`) once, the first time a test or run names one.
- Applied lines: `+ rule <id> "<name>" (on|off)`, `~ rule "<name>" changed (on|off)`, `~ rule "<name>" on|off`,
  `+ rule <id> "<name>" (off, a copy of "<from>")`, `- rule "<name>"`, `? tested "<name>" on #12: <result>`,
  `> ran "<name>" on #12: <result>`, each write's line ending `, needs attention: …` when the saved rule does.
- Refusals: the api's body is read off `ApiError.body` for `path` and `message`. `automation_invalid`,
  `automation_value_unknown`, `automation_condition_unsupported` and `automation_step_unsupported` read
  "The api refused the rule at <path>: <message>." plus the code's words; the rest are words alone
  (`automations_need_editor`, `read_only_token`, `automation_name_taken`, `automation_rules_full`,
  `automation_not_found`, `automation_not_manual`, `automation_budget_spent`, `item_not_found`). Any other is
  `apiRefusalOf`'s; a 5xx throws.

### The MCP (`apps/mcp/src/rule-tools.ts`, `packages/agent-verbs/src/mcp/rule-schema.ts`)

- `mcpListRules` (read) and `mcpChangeRules` (destructive) in `packages/agent-verbs/src/verbs/mcp-tools.ts`,
  registered by `registerRuleTools(server, env)` from `apps/mcp/src/tools.ts`, after `change_card_types` in
  `MCP_TOOL_VERBS` (the order `verb-parity.test` holds the registered tools to).
- `list_rules` input `{ projectId, rule?, runs?, limit? }`; output `{ rules[], rule?, runs?, runsToday, runsPerDay,
count, url }`. `change_rules` input `{ projectId, changes[1..20] }`; output `{ applied[], runs?, url }`.
- The body's shape is a loose zod object (`name`, `trigger`, `conditions`, `steps`, `chain`, `timeZone`), its
  `.describe()` texts the whole format (`RULE_TRIGGER_FORMAT`, `RULE_CONDITIONS_FORMAT`, `RULE_STEPS_FORMAT`); the api's `readRuleBody` is the one check, so the tool
  and the api never disagree on what reads.

### The CLI (`packages/agent-verbs/src/verbs/rule.ts`)

`rule.ls`, `rule.get`, `rule.add`, `rule.set`, `rule.on`, `rule.off`, `rule.rm`, `rule.duplicate`, `rule.test`,
`rule.run`, `rule.log`, in `VERBS` after the thread verbs, the resource `rule` ("Automations rules: list, change,
test and run them") in `RESOURCES`; `add` and `set` read JSON from a file or `-` (stdin) as `type apply` does. The
CLI's `COMMAND_OF_TOOL` maps `list_rules` → `rule ls`, `change_rules` → `rule set`.

### Telemetry

`Mcp·Used·ListRules`, `Mcp·Used·ChangeRules` from `registerTool`; `Cli·Used·Rule<Verb>` from the CLI's counted
verbs. The liveworkspace site's liveplanner catalogue lists them (`liveworkspace/apps/site/app/telemetry/liveplanner/catalogue/connections.ts`
MCP_TOOL_METRICS, `liveworkspace/apps/site/app/telemetry/liveplanner/cli-commands.ts`).

### Tests

- api `automation-routes.test.ts`: every caller kind (owner, team, Editor link, token, tab Editor link, Participant,
  Viewer, guest, read-only token, Participant's token, workbench session, link visitor) against every route; a
  token's stamps carry `ai`; a token's Run Rule is an agent's to Who Did It; an outgoing action saved by a token
  whose account is an Editor of the whole plan, refused for one whose account is not.
- agent-verbs: each module to the package's thresholds (100%); `rule-listing.perf.test.ts` lists 50 rules within a
  CPU budget. **Measured**: 50 full rules (10 conditions and 20 actions each) list in 1.4 to 1.8 ms of CPU on an
  M-series Mac (the budget 20 ms), and naming a full rule's body takes 0.03 to 0.11 ms (the budget 5 ms). A call adds
  two api reads in parallel, never one a rule.
- mcp: the tool lists, annotations and telemetry suites name the two tools; a rule tools test drives both through
  a fake api.
- cli: the catalogue's examples route; a verb test per command through the fake api.

## Phase 3: AI actions (Work Item 713)

### Shapes (packages/items/src/automation/types.ts)

```ts
type AutomationAi =
  | { kind: 'ai'; task: 'summarise'; field?: string } // absent field: a comment
  | { kind: 'ai'; task: 'card_type'; set: boolean } // false: comment the suggestion
  | { kind: 'ai'; task: 'triage'; priority: boolean; labels: boolean }; // at least one true
type AutomationStep = AutomationAction | AutomationOutgoing | AutomationIf | AutomationBranch | AutomationAi;
// The step line a call made carries `ai: true` (the day's count reads it).
type AutomationStepLine = … | { kind: 'action'; ok: boolean; text: string; already?: true; ai?: true };
```

Constants beside Phase 2's: `AUTOMATION_AI_PER_DAY = 100`, `AUTOMATION_AI_STEPS_MAX = 3`,
`AUTOMATION_AI_SUMMARY_MAX = 600`, `AUTOMATION_AI_LABELS_MAX = 3`, and in `ai-steps.ts` the prompt's caps
(`AI_TITLE_MAX = 200`, `AI_DESCRIPTION_MAX = 2000`, `AI_CHECKLIST_ROWS = 20`, `AI_CHECKLIST_TEXT_MAX = 120`,
`AI_COMMENTS_MAX = 5`, `AI_COMMENT_TEXT_MAX = 400`, `AI_LIST_MAX = 50`) and output caps (`AI_MAX_TOKENS`:
summarise 300, card_type 40, triage 80). `ItemHistoryTag` gains `'automation_ai'`.

`validate.ts` reads `kind: 'ai'` through `readAiStep` (ai-steps.ts): an unknown task, a summarise field that is not an
id, card_type without a boolean `set`, triage with neither part on are `automation_invalid`; an AI step inside an If /
Else or a branch is `automation_step_unsupported` (`NOT_IN_IF`, `NOT_IN_BRANCH` gain `'ai'`); more than 3 at the top
level is `automation_invalid` at `steps`. An AI step counts as one action. `attention.ts` names a summarise field.

### Pure parts (packages/items/src/automation/ai-steps.ts)

- `planAi(step, index, walk)`: what `planActions` does for an AI step: the action counted, a `PlannedAi { step, ai,
line }` on the run (`PlannedWrites.ai`, present only when a rule has one, so every Phase 1 and 2 answer is
  unchanged), and a placeholder line the api settles.
- `aiCardInput(card, outline, comments)`: the card as sent (title, description, type and column names, checklist, the
  newest comments as the caller orders them), every part cut to its cap, empty parts left out; `planLabels(items)`: the labels the plan's cards use, most used first (ties by name), 50 at most.
- `aiRequest(task, input, lists)`: `{ messages: [system, user], response_format: { type: 'json_schema', json_schema:
{ name, schema, strict: true } }, max_tokens, temperature: 0 }`. The system message is fixed per task; the user
  message is `JSON.stringify({ card, choices })` alone.
- `readAiReply(raw)`: the reply's JSON object from any of the binding's shapes (`{ response: object | string }`,
  `{ choices: [{ message: { content } }] }`, a string), tolerating a fenced block; null when none parses.
- `aiOutcome(step, reply, ctx)`: the answer kept within the spec's bounds, as what the api writes (`{ comment, line }`
  or `{ patch, line, already }`), or `{ failed: reason }`. A summary (`plainSummary`): a string, control characters
  and markup (`<…>`, Markdown emphasis, headings, links and fences) stripped, whitespace collapsed, every link the
  card's own text lacks removed, cut at a word to 600; empty fails; into a field only a custom Text or Long Text field
  the card's type has. A card type: matched to the plan's types by name, case and spacing aside. Triage: priority one
  of `PRIORITIES` (case aside); labels matched to the plan's (case aside), deduped, the card's own skipped, 3 at most
  and within the card's 12, the rest dropped.
- `aiDryLine(step, outline, labels)`: Test on a Card's "Would …" line; `aiStepChip(step, fieldLabel)`: the
  sentence's chip (sentence.ts `stepChip` calls it).

### The api (apps/api/src/plan-room/automations/automation-ai.ts)

- `AutomationsAi = { run(model, inputs, options?) => Promise<unknown> }` is `PlanEnv.AI` (optional, the `[ai]` binding),
  `AI_GATEWAY` an optional var naming an AI Gateway (`{ gateway: { id } }` on every call).
  `AUTOMATION_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it'`, `chat_template_kwargs: { enable_thinking: false }`,
  `AUTOMATION_AI_TIMEOUT_MS = 15_000` (a race with a timer, cleared after).
- `aiToday(sql, now)`: `SELECT COUNT(*) FROM automation_runs r, json_each(r.body, '$.steps') s WHERE r.at >= <UTC
midnight> AND s.value ->> '$.ai' = 1`, read once per wake into `RunState.ai` when a rule with an AI step runs. No
  schema step: the Audit Trail keeps every run of the day (at most 1,000 counted runs, under its 2,000).
- `runAiSteps(deps, input, planned, lines, offset)`: after `applyPlannedRun` and the branches, before `sendMessages`.
  Per step: dry → the "Would …" line; no binding → `AI_NOT_SET_UP`; `state.ai >= 100` → the step's line and the
  run's reason `AI_CAPPED`, result **skipped** unless something failed (a skipped run still advances Assign in Turn,
  since its writes stand); else `state.ai += 1`, the card read again
  (`readItem`), its latest comments (`linksOfItem` home this plan, `readThreads`, newest 5 comments across them), the
  plan's labels (`listItems`, triage only), the call, `readAiReply`, the constraint, then the write:
  - summarise to a comment: `addComment(deps, rule, card, text, { ai: true })` (automation-writes.ts), the Comment
    carrying `ai: true` beside `automation`;
  - summarise to a field, card type set, triage: `patchCard(…, tag 'automation_ai')` with the run's `source`, so the
    events it causes chain as the rule's do; a patch that changes nothing is "Already so";
  - card type comment: `addComment`, "Suggested card type: Bug".
    The line is `{ kind: 'action', ok, text, ai: true }`; the first failure is the run's reason.
- Errors: `AI_NOT_SET_UP` "AI isn't set up here", `AI_FAILED` "The AI couldn't answer: try again later", `AI_SLOW`
  "The AI took too long to answer", `AI_UNREADABLE` "The AI's reply couldn't be read", `AI_CAPPED` "This plan has
  used its 100 AI steps today". Logged `[automations] ai` `{ task, ok, tookMs, reason? }`, the reason the line's own
  words (never the card's text or the model's answer).
- Telemetry: `reportServerEvent(env, 'Plan', 'Ran', 'AutomationAiSummarise' | 'AutomationAiCardType' |
'AutomationAiTriage')` per call, plus `AutomationAiFailed` on a failure after the call and `AutomationAiCapped`, each
  through `deps.defer`.
- The wake stops taking new triggers once it has run `AUTOMATION_WAKE_MS = 60_000` (wall time; three 15 s calls a run
  could otherwise hold a wake of 25 triggers for minutes); the rest wait for the next wake, at once.
- `wrangler.toml`: `[ai] binding = "AI"` and `[env.staging.ai] binding = "AI"`. Absent at run time (tests, a fork
  without it), every AI step fails "AI isn't set up here" and nothing else changes.

### Editor

- `StepAddButtons` lists **AI** after the other actions in + Add Action at the rule's top level, under its own heading
  ("AI", "100 a day per plan") with the sparkle on each row's tile (`StepTile` kind `ai`): Summarise Card, Suggest
  Card Type, Triage, left out once the rule holds 3 (`canAddAi` in rule-draft.ts) and never inside an If / Else or a
  branch. `step-defaults.ts` holds `AI_KINDS` and each one's first form (`defaultAi`).
- `apps/editor/components/automations/step-panels/AiStepPanel.tsx`: the task's panel. Summarise: **Write To** (a
  Select: A Comment, or one of the plan's custom Text and Long Text fields; a field the plan lost stays listed as gone).
  Suggest Card Type: **Then** (Comment the Suggestion, Set the Card Type). Triage: **Sets** (chip toggles Priority and
  Up to 3 Labels; the last one on can't turn off). Each ends with the "Uses AI" note (`AiCostNote`): the sparkle,
  "Uses AI: counts toward 100 a day for this plan", that its writes are by Automation and marked Generated by AI, and
  that Test on a Card asks nothing. The step's card in the rule reads its chip and "Uses AI: counts toward 100 a day".
- `RunSteps` draws a line with `ai` with the sparkle (a Tooltip, "Generated by AI"); `activity-timeline.ts` reads
  `automation_ai` as Automation and AI at once, so `CardActivity` shows the bolt author and the sparkle;
  `set-by-automation.ts` counts it as a rule's set; `comment-thread-parts` shows Generated by AI on an Automation
  comment that has `ai`.

### Tests

- items `ai-steps.test.ts`: every branch of the reader, the prompt (data never in the system message), each shape of
  reply, each constraint (injected text, made-up labels and types, links, markup, length), the dry lines; the prompt
  sizes measured for the cost table.
- api `automations-ai.test.ts` with a stand-in `env.AI`: each task end to end (writes, marks, tag, Generated by AI),
  no binding, a throwing model, a slow model (fake timers), an unreadable reply, a write refused after the call, the
  cap at 100 (counted from the Audit Trail, a failed call too), Test on a Card calling nothing, the gateway option.
  The refusals (an AI step in a branch or an If, a fourth one) are items' validate tests.
- editor `AiSteps.test.tsx`: the AI group in Add Action and its limit, each first form, each panel, the step's card
  and the sparkle line in a run; `AutomationAuthor.test.tsx` the Generated by AI mark on an AI action's comment.
- editor: the AI group in Add Action, each panel's states, the dry line, the sparkle line.

## Phase 3: Incoming Webhook (Work Item 713)

Derived from the spec's [Incoming Webhook](../automations.md#incoming-webhook). AI actions and the agent and CLI
tools are their own sections.

### Shapes (packages/items/src/automation)

```ts
type AutomationTrigger = … | { kind: 'incoming_webhook' };      // types.ts
type AutomationEventKind = … | 'incoming';                       // matches.ts; queued only by the hook route
interface AutomationEvent { …; webhook?: WebhookValues; cards?: number } // the values the rule names; how many
                                                                 // cards the call named, for the trigger line
type WebhookValues = Record<string, string | number | boolean>;  // incoming.ts, keyed by dot path
```

- `TRIGGER_EVENT_KINDS.incoming_webhook = ['incoming']`, which no write builds, so a plan whose only rules are
  incoming ones pays nothing on a save. `triggerMatches` hears an `incoming` event for its `ruleId` alone.
- `isPersonless(trigger)` (types.ts): a time trigger or `incoming_webhook`. validate.ts's person checks
  (Who Did It, `{ trigger: true }` assignees and recipients) run for every personless trigger, refusing with
  `automation_condition_unsupported` ("An incoming webhook has no person behind it to check").
- `INCOMING_WEBHOOK_PERSON = { id: 'incoming_webhook', name: 'Incoming webhook', color: AUTOMATION_COLOR }`: an
  incoming event's `by`, so `{{person}}` reads "Incoming webhook"; its `role` is `system` (never an Editor,
  Participant or agent, and nobody to assign).
- `incoming.ts` (pure): the constants `WEBHOOK_BODY_MAX = 16_384`, `WEBHOOK_CARDS_MAX = 10`,
  `WEBHOOK_CALLS_PER_MINUTE = 60`, `WEBHOOK_PATH_DEPTH_MAX = 5`, `WEBHOOK_PATH_NAME_MAX = 64`,
  `WEBHOOK_VALUE_MAX = 500`; `webhookPathOf(name)` (the segments of `webhook.<path>`, or null; a split and one
  anchored character-class test per segment, never a backtracking pattern), `webhookPathsIn(steps)` (every
  `{{webhook.…}}` the steps' text names), `webhookValues(payload, paths)` (each path read: a string cut at 500, a
  number, a boolean; anything else left out), `readHookBody(raw)` (`{ cards: number[] | null; payload }` or
  `{ error }`) and `runsWithoutCard(rule)` (no conditions; every step Create Card without `copy` or `linkField`, or
  `notify`). `incomingTriggerWords(cards)`: "Webhook received: 2 cards" / "1 card" / "no card".
- values.ts: `ValuePlace.webhook` makes `webhook.<path>` known; `ValueContext.webhook` fills it from the event's
  values (missing reads nothing); `ValueContext.cardless` makes every `card.…` value read nothing. Filling stays one
  pass, so a payload string is never read as a value. validate.ts passes `{ webhook: true }` to every text of an
  incoming rule (top level, If / Else and branch; Create Card's title too).
- sentence.ts: `AUTOMATION_TRIGGER_NAMES.incoming_webhook = 'Incoming Webhook'`; `triggerParts` reads
  `When a [Webhook Is Received]`.

### Storage (plan schema V20)

```sql
CREATE TABLE automation_hooks (
  rule_id      TEXT    PRIMARY KEY,
  hash         TEXT    NOT NULL,          -- hex SHA-256 of the whole secret, never the secret
  last4        TEXT    NOT NULL,          -- its last 4 characters, for "Ends in …Xf3k"
  made_at      INTEGER NOT NULL,
  used_at      INTEGER,                   -- the last verified call
  window_at    INTEGER NOT NULL DEFAULT 0,-- the rate limit's minute: when it started, and calls in it
  window_calls INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;
```

A table of its own, so a rule's body (what every list, copy and file carries) never holds the hash. The step is
additive and `IF NOT EXISTS`. `AutomationStore.remove` deletes the rule's row; `insert` and `update` delete it when the
rule's trigger is not `incoming_webhook`. Copies and the plan's file never read the table.

### The secret

- `lwh_` + base64url(64 bytes from `crypto.getRandomValues`), 90 characters. **Why 64 bytes, not 32**: HMAC hashes a
  key longer than its 64-byte block first (RFC 2104 §2), so for a 90-character secret `HMAC(secret, body)` equals
  `HMAC(SHA-256(secret), body)`. The plan then stores only the SHA-256 and still checks a GitHub-style signature
  keyed with the secret itself. This holds only while the encoded secret is longer than 64 bytes: a shorter one is
  used as the key as it is, and every signature would fail. `automation-incoming.test.ts` pins both: a signature
  made independently with the raw secret (node:crypto) passes `provesSecret`, and `newHookSecret()` encodes to more
  than 64 bytes, so shortening `WEBHOOK_SECRET_BYTES` or the prefix fails loudly.
- Residual risk, stated: whoever reads the plan's own storage could sign calls with the hash (any HMAC scheme keeps
  key material server-side); the Bearer path still needs the secret itself.

### Routes

| Route                                               | Who                            | Answer                                      |
| --------------------------------------------------- | ------------------------------ | ------------------------------------------- |
| `POST /api/projects/:id/automations/:ruleId/secret` | the Automations gate, no token | 201 `AutomationSecretResponse` `{ secret,   |
|                                                     |                                | hook }`; 404, 409 `automation_not_incoming` |
| `POST /api/hooks/automations/:projectId/:ruleId`    | anyone holding the secret      | 202 `{ queued }`; 400, 401, 404, 405,       |
|                                                     |                                | 413, 415, 429                               |

- The listed rule (`AutomationListedRule`) of a saved incoming rule carries `hook: AutomationHookInfo`
  (`{ url, secret: { last4, madeAt, usedAt } | null }`, null before Make Secret); every other rule has no `hook`.
  `url` is `${appBaseUrl(env)}/api/hooks/automations/<plan>/<rule>`, so the panel shows the address before a secret
  is made.
- **The worker side** (`routes/automation-hook-routes.ts`), answered in index.ts before identity (as `internal`), so a
  `Bearer lwh_…` is never read as a person: path matching `/api/hooks/automations/<plan>/<rule>` exactly, ids of 1 to 200
  characters (`[A-Za-z0-9_-]`, one anchored regex, so the dispatch probe's vocabulary stays the projects'), else 404; POST, else 405; `Content-Type` `application/json` (parameters allowed), else 415; a
  declared length past 16 KB, or a body that reads past it through the capped reader, 413; then
  `WRITE_RATE_LIMITER` keyed `hook:<network>` (429). Then the plan's room: `PlanRoomRpc.incomingHook(planId, ruleId,
{ body, authorization, signature })` answers `{ status, body, retryAfter? }`, made into the response.
- **The room side** (`plan-room/automations/automation-incoming.ts`, `verifyHookCall` then `acceptHookCall`): a room
  with no stored schema answers 401 without making one. Otherwise, in order: the rule (on, `incoming_webhook`) and its
  hook row, else 401; the proof: Bearer → `timingSafeEqual(sha256hex(sent), hash)`; else signature →
  `timingSafeEqual(hmacHex(hashBytes, body), sent)` (`@liveworkspace/index-app/timing-safe`); a missing row still
  hashes the sent value against a fixed dummy so the work is the same; else 401. Then the minute window
  (`window_at + 60 s > now` and `window_calls >= 60` → 429 with `Retry-After`), in ONE `UPDATE … RETURNING` that also
  stamps `used_at`; then the day's budget (`runsToday >= 1000` → 429 until UTC midnight); then `readHookBody` (400);
  the named numbers to cards (`SELECT id, item_key FROM items WHERE plan_id = ? AND item_key IN (json_each)`, then
  the Trash left out); the events, id `w:<call uuid>:<card id | ->`, `kind: 'incoming'`, `by:
INCOMING_WEBHOOK_PERSON`, `role: 'system'`, `ruleId`, `webhook: webhookValues(payload, webhookPathsIn(rule.steps))`,
  `cards: named count`; `enqueueStatement` (the queue's cap) and `hook.queued(dropped)`; 202 with the inserted count.
- Logs: `[automations] hook` `{ answer: 'accepted' | 'unauthorized' | 'rate_limited' | 'budget' | 'invalid',
queued }`, never a secret, a signature, a hash or the body.

### Runner additions

- `triggerLine`: an `incoming` event reads `incomingTriggerWords(event.cards)`, with no `by`.
- An `incoming` event with `cardId: ''`: `runsWithoutCard(rule)` false → **skipped** "No cards named: this rule's
  steps need a card"; true → the run goes on with a blank card (`cardlessCard()`: no id, no fields), conditions none,
  `cardless: true` and the payload's values on the plan context, `card: null` on the run, the sends' `card: null`
  (the platform's contract allows it), the link the plan's own (`planUrl`).
- `[automations] run` gains `trigger: rule.trigger.kind`.
- Test on a Card of an incoming rule: an `incoming` event on the chosen card, `cards: 1`, no values.

### Editor

- `TriggerPanel` groups its kinds under "Something Happens to a Card", "A Time Comes Round" and "Another Tool Sends
  It" (Incoming Webhook), and draws `components/automations/step-panels/IncomingWebhookPanel.tsx` for it: **Address** (the URL in a
  monospace field with Copy; before the first save, "Save the rule to get its address."), **Secret** (Make Secret, or
  "Ends in …Xf3k · Made 2 days ago · Last used 3 min ago" with Regenerate behind `ConfirmPopover`), the once-shown
  secret (a monospace field, Copy, "You won't see it again. Keep it where the other tool keeps its passwords.",
  Done), what it runs on (the `runsWithoutCard` line), and **How to Send** (an accordion, closed: a curl with the
  header and one with the signature). The rule's id and hook come from `IncomingRuleContext` (incoming-rule.tsx),
  provided by RuleBuilder; the call is `makeHookSecret` in automations-client.ts.
- `ValueTextField` reads `useIncomingRule().incoming` and its Insert a Value popover adds **Webhook Field…**: a line for the path
  (checked by `webhookPathOf`) with Insert and Back (`WebhookPathForm`). A webhook value's chip reads its path.
- Personless rules (time and incoming) leave out "whoever triggered" in Assign and Send Email, as time rules do
  (`isPersonless`).
- Telemetry: `Plan · Created | Changed | Copied · AutomationSecret`.

### Tests

- items: incoming.ts (paths, values, body, cardless, words), validate (webhook values only in incoming rules;
  person checks), values (fill, cut, missing, `{{card.title}}` in a payload stays literal, cardless), matches,
  sentence; to the package's 100% branches.
- api, `automations-incoming.test.ts` (security, through the real worker): wrong secret; old secret after Regenerate;
  off, paused, deleted and re-triggered rules; unknown rule and plan; missing auth; bad signature; a signature over a
  changed body; the compare is `timingSafeEqual` (spied); the secret absent from every response after Make Secret,
  from the list, the Audit Trail and every log line; body over 16 KB (declared and streamed); wrong content type;
  the 61st call in a minute (429, Retry-After) and the next minute; a payload with `{{card.title}}` and `<script>`;
  a 5-deep and a 6-deep path, a 16 KB string; cards from another plan and unknown numbers; the hash never in a list,
  a rule body or a file; the secret route's role tests (Owner, team, Editor link, tab Editor link, Participant,
  Viewer, API token, guest). The V20 step in plan-schema.test.ts.
- perf, `automations-incoming.perf.test.ts`: verifying a signature over a 16 KB body and filling a rule's values from
  it, inside `cpuBudgetMs` (`@liveworkspace/vitest-config/cpu-time`).
- editor: the panel's states (unsaved, no secret, made, revealed, regenerate confirm), Copy, Webhook Field….
- help: "Start a Rule from Another Tool" in plan/automations/page.mdx.

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

## Add an Action picker and screen motion

The spec's "The rule builder" (Add an Action) and "Motion".

- `AddActionDialog.tsx`: the picker on the shared `Dialog` (size `3xl`, 60rem, with three columns of tiles from `lg`; `phoneSheet`). `action-groups.ts` holds the
  groups (`ACTION_GROUPS`: id, name, kinds), each kind's line (`ACTION_LINES`) and `pickerGroups(body, holder)`,
  which returns the groups for where the action goes: Other Tools and AI only at the top level, Create Card left out
  of a branch, and a group the rule has filled kept with its `full` reason (`canAddOutgoing`, `canAddAi`). The
  search matches a kind's name and line, case-folded, over 17 kinds at most, so it filters on every keystroke without
  a cost worth guarding. Arrow keys move a roving focus over the tiles in reading order (`Left`/`Right` by one, `Up`/`Down` by
  the grid's column count, read from the grid's computed columns); Enter picks.
- `StepAddButtons`: + Add Action (top level and in a holder) opens the picker; + Add Condition stays a menu (five
  kinds).
- Motion reuses the shared theme's utilities (@liveworkspace/tailwind-config theme.css), so it keeps to the motion
  budget and reduced motion with nothing new: `lvd-cascade` on the Rules list, the Audit Trail, the template grid, the
  picker's groups and the builder's step list (a list re-keyed on its filter remounts, so it cascades again; a new
  step mounts and rises alone); `animate-view-forward` on the builder and `animate-view-back` on the list it returns
  to; `animate-fade-in` on a tab's content (keyed on the tab) and the step panel's body (keyed on the step).
- `ScreenTabs`: the active underline is one absolutely placed bar moved by `transform` and sized to the picked tab's
  measured box (a layout effect, re-measured on resize and when the Rules count changes), over `duration-short`.
- Tests: the picker's groups for the top level, an If / Else list and a branch, the full-group reasons, search and
  its empty state, keyboard picking, and that picking calls `addAction` and closes.

## Template tiles: the living preview

- `TemplateScene.tsx` draws each template's scene (`SCENES`, keyed by template id, one small component each) from
  shared parts (`SceneColumn`, `SceneCard`, `SceneAvatar`, `ScenePill`, `SceneBubble`); every template id must have
  one (a type-level `Record<AutomationTemplateId, …>`, so a new template fails to compile without its scene).
- The motion is CSS only, in `apps/editor/app/automation-scenes.css` (a content illustration under motion.md, so its
  durations live there): `.ats-in` parts appear, `.ats-out` parts leave and `.ats-mv` parts move, on
  `[data-template]:hover` and `:focus-visible`, staggered by `--ats-d`. `(hover: none)` and reduced motion show the
  end state with no transition.
- `TemplatesGallery`: each tile is the scene over the body; the grid is `lvd-cascade`, keyed on the chip, so a chip
  change cascades the tiles in again.

- `ActionScene.tsx` draws each action's picture for the picker's tiles (`ACTION_SCENES`, a `Record<AddKind, …>`, so a
  new kind fails to compile without one) from the same `scene-parts.tsx` as the template scenes; the group sets the
  tone (`ACTION_GROUP_TONES`: the card groups blue, Labels, Flags and Timing orange, Checklists, Links and People emerald, Comments, Other Tools and AI violet). The
  scene CSS plays on `[data-action-tile]` as on `[data-template]`, never on a disabled tile.
- Ten more templates (the spec's table), and an **AI** category. `templates.ts` fills them by role with two more
  finders (`reviewStatus`, a column named like Review; the first to-do column), and `picksLeft` now also marks an
  empty Column condition, an empty Move to Column and an empty Create Card type.
- `ActionPanel`'s Action field is the action's tile and **Change**, opening `AddActionDialog` in its change mode
  (`mode: 'change'`, `current`): the groups for an If / Else list or a branch (`pickerGroups(null, …)`, so nothing
  reads as full), the current tile badged. It replaces the select.

## The actions after Phase 3

Change Card Type, Set Colour, Restore From Archive, Copy Card, Add a Checklist, Link Cards, Mention Someone, Resolve
Threads and Wait (spec "Actions", "Wait").

- **Shapes** (`packages/items/src/automation/types.ts`): `set_type`, `set_colour` (`#rrggbb` or null), `restore`,
  `copy_card` (`status?`), `add_checklist` (`items`, 1 to 20), `link_card` (`field`, `to: {card} | {trigger}`),
  `mention` (`to`, `text`), `resolve_threads`; and the step `AutomationWait` (`hours`, 1 to 720). `validate.ts` reads
  them: no Wait or Copy Card in a branch, no Wait in an If / Else, at most 3 Waits, `{trigger}` links inside a branch
  only, Copy Card counting as the run's one new card.
- **Planning** (`plan-actions.ts`): Change Card Type sets the patch's `type` (`Plan.retype`) after checking the column
  suits it; Set Colour writes the type's colour field (`colourFieldOf`); Add a Checklist appends the rows the card
  lacks by text; Link Cards writes the Card field and refuses a Blocked By loop (`blockingCycleOf`, so a rule with one
  reads the plan's cards); Copy Card plans a `PlannedCard` of the card's type and fields; Mention Someone and Resolve
  Threads plan `mentions` and `resolve`. A Wait ends the plan with `wait: {hours, from}`; `planActions(…, {from})`
  goes on from a step and `{through: true}` (Test on a Card) plans past every Wait.
- **Writes** (`apps/api/…/automation-writes.ts`): the patch carries `type` (a move too); a mention is a thread by
  Automation whose comment names the person in `mentions` (the Inbox reads it), and an email through
  `notifyMentions`; Resolve Threads resolves each of the card's threads through `writeThread` as the system.
- **Wait** (`automation-waits.ts`, the plan schema's step V22 `automation_waiting`): a run that reaches a Wait does
  its writes, settles as `waiting` with `waitsUntil`, and is held under its run id with a `resume` event (the step to
  go on from, the rule's `edited.at`, the hours waited, the run's id). `AutomationSchedule.restoreTimes` takes the
  earliest of the time triggers' and the waiting runs' moments, so the alarm wakes for both; `runWaits` queues each due
  run's resume event (or settles the run Skipped when its rule went, turned off or changed). The runner runs a resume
  on its one rule from that step, its trigger line "After waiting 2 days", Skipped when the card is gone, No Match when
  the conditions no longer hold, and settles the waiting run Done. At most 500 wait.
- **Editor**: the picker's groups (`action-groups.ts`) are one thing each: Cards, New Cards, Archive, Labels, Flags, Checklists, Links, People, Comments, Timing, Other Tools and AI; each
  kind has a glyph, a default (`step-defaults.ts`), a scene (`ActionScene.tsx`) and a panel (`CardActionPanels.tsx`,
  `ChecklistActionPanel.tsx`, `LinkCardPanel.tsx`, `WaitPanel.tsx`, Mention in `TextActionPanel.tsx`). The Audit Trail
  shows Waiting in sky blue with "Goes on Mon 9:00".
- **Tests**: validate (each shape and refusal), plan-actions (each action, Already So, a Wait's `from`/`through`), the
  runner (a Wait held, resumed, rule changed, card gone, conditions no longer hold, the 500 cap), the writes (type
  patch, mention thread and email, resolve), and the editor's picker groups and panels.

## The Pick a Trigger picker

- `StepPicker.tsx` is the pickers' one shell: `HeroDialogHeader` with the art passed in (`addActionHeroArt` from
  `AddActionHeroArt.tsx` for Add an Action, `automationsHeroArt` for Pick a Trigger; the centre piece at 4.5rem, as
  only the close stands beside the title), the search, the rail or
  chips, the grouped tile grid with its arrow keys, the empty state and the Current badge. Tiles carry
  `data-picker-tile`, which `automation-scenes.css` plays on hover. `AddActionDialog` and `ChangeTriggerField` map
  their groups into it.
- `trigger-groups.ts`: `TRIGGER_GROUPS` (card, time, tools), `TRIGGER_LINES` and `freshTrigger`; `TriggerScene.tsx`
  draws each trigger's picture (card triggers violet, time blue, tools emerald) from `scene-parts.tsx`.
- `ChangeTriggerField` replaces the When panel's select: the trigger's tile, name, line and **Change**.

## The triggers after Phase 3

- **Shapes** (`types.ts`): `card_archived`, `card_restored`, `checklist_completed`, `threads_resolved`, `mentioned`
  (`people?`), `card_unblocked`, `related_done` (`related: 'children' | 'linked'`), `column_limit` (`status`, `limit`
  1 to 500) and the time trigger `stuck` (`days` 1 to 90, `at`, `statuses?`).
- **Events** (`matches.ts`): `eventOfWrite` makes `archived` and `restored` events (the Trash stays quiet) and marks a
  `changed` or `moved` event `checklistDone` when the write ticks the last item. The thread routes queue `resolved`
  when a resolve leaves the card with no open thread (`SUM(open_comments) = 0` over its links), and a comment event
  carries `mentioned` (the mentioned people's person ids).
- **Worked out at run time** (`derived.ts`, `derivedTargets`): Card Unblocked hears a card moving into a done column
  or archived and answers the cards it blocks that have no open blocker left; Related Cards Done hears a card moving
  into a done column and answers the cards it belongs to (its parents, or the cards whose Card fields hold it) whose
  related cards are all done; Column Over Limit hears a card created in or moved into its column and answers that
  card when the column now holds exactly limit + 1. The runner reads the plan's cards for such an event only when a
  rule on hears one, and runs the rule on each answered card under `${event.id}>${card.id}`.
- **Card Stuck** (`time-cards.ts`): daily at its time, the live cards outside done columns (in its columns, when
  named) whose `updatedAt` is at least `days` before the moment, the run id `k:${rule}:${card}:${updatedAt}`.
- **Editor**: `trigger-groups.ts` gains Comments and Links; each trigger has a scene (`TriggerScene.tsx`) and its
  narrowing in the When panel (people for Someone Mentioned, the relation for Related Cards Done, the column and
  limit for Column Over Limit, days and columns for Card Stuck in `TimeTriggerPanel`).

- **Template scenes** live in `apps/editor/components/automations/template-scenes/` (`first.tsx`, `board.tsx`,
  `linked.tsx`); `TemplateScene.tsx` maps each template id to its scene.

## Describe a Rule (Work Item 759)

The spec's "Describe a Rule": a request in words drafted into a rule body by the AI actions' model, answered to the
builder unsaved and off. Nothing here saves, enables or runs a rule.

### Pure parts (packages/items/src/automation/ai-draft.ts, named.ts)

- `AI_DRAFT_PROMPT_MAX = 500`, `AI_DRAFT_PER_DAY = 20`, `AI_DRAFT_MAX_TOKENS = 1500`, and the plan's caps:
  40 columns, 20 card types, 20 fields a type and 120 across them, 30 labels, each name 40 characters.
- `aiDraftPlan(outline, labels)`: what the model sees of the plan, names only: column names (once each), card types
  (each with its custom fields' names and kinds), the built-in field names and the labels. Never people, cards or
  webhooks.
- The catalogue is `rule-format.ts` (`RULE_TRIGGER_FORMAT`, `RULE_CONDITIONS_FORMAT`, `RULE_STEPS_FORMAT`), moved
  here from `packages/agent-verbs/src/mcp/rule-schema.ts`, which now reads it (its trigger line adds the MCP's naming sentence).
  `rule-format.test.ts` holds a typed record of every trigger, condition and step kind and fails until the format
  describes each (it found Incoming Webhook and the AI steps missing from the agents' format: both are described now).
- `aiDraftRequest(prompt, plan, previous?)`: `{ messages, response_format, max_tokens, temperature: 0 }` as
  `aiRequest` is. The system message is fixed: the task, the data rule, the naming and no-invention rules, the
  catalogue and the two outcomes. The user message is `JSON.stringify({ request, plan })` alone; a retry
  adds `{ previous: { refused: "<path>: <message>" } }` with the validator's words, never the model's earlier text.
  The schema: `{ outcome: 'rule' | 'not_a_rule', rule: { name, trigger, conditions, steps } }`, the rule's parts
  loose objects (the validator is the check, not the schema).
- `readAiDraft(reply, ctx)`: `{ off: true }` for `not_a_rule`; `{ body, picks }` for a rule that reads; `{ refused:
{ path, message } }` otherwise. In order: names put back to ids (`namedRuleBody`, moved here from agent-verbs as
  `named.ts` so the api and agents share one resolver), `chain: false`, `timeZone` the caller's, each outgoing step's
  webhook set to a placeholder for the check and back to `''` after (a `webhook` pick at its path), every text cut
  and cleaned (`draftText`: control characters, links the request lacks, via ai-steps' `dropForeignLinks`), then
  `readRuleBody`, then the name made free (`freeRuleName`, from "New Rule" when it came out empty). Lists are cut to
  25 before they are walked, a text to twice its limit before a pattern reads it: a hostile reply reads in linear
  time.
- `packages/agent-verbs/src/rules/rule-names.ts` keeps `namedRuleBody(body, state)` as a thin adapter over items'
  `namedRuleBody(body, names)`.

### The api (apps/api/src/routes/automation-draft-route.ts, plan-room/automations/automation-ai.ts)

- `POST /api/projects/:id/automations/draft` `{ prompt, timeZone }` behind the Automations `gate` (an Editor of the
  whole plan, signed in or their token, never read-only). Answers `200 { rule, picks }`, or:
  `400 automation_draft_invalid` (empty or over 500, a bad time zone), `422 automation_draft_off_topic`,
  `422 automation_draft_unreadable`, `429 automation_ai_capped` (the day's 100, or 20 drafts, the message saying
  which), `503 automation_ai_unavailable` (no binding, a model error, slow: the message is `AI_NOT_SET_UP`, or
  `AI_DRAFT_FAILED` for a model that errs or is slow, since `AI_FAILED` and `AI_SLOW` are the Audit Trail's words).
- The ask goes through `ask()` (the 15 s race and the gateway) and `readAiReply`, with `AUTOMATION_AI_MODEL`.
- **Storage, plan schema V24**: `automation_ai_drafts (at INTEGER NOT NULL)`, indexed on `at`; one row per ask (so a
  retry is two), rows older than two days deleted on each insert (at most 40 a day are kept). `aiToday` adds that
  day's rows to the Audit Trail's count, so drafts and AI steps share the 100; `draftsToday` counts the distinct
  drafts (`retry = 0`, each draft's first ask) toward the 20. A second ask is not made once the first spent the
  day's last AI step.
- Telemetry and the log as the spec says, through `ctx.waitUntil`.

### api-schema and the manifest

`AutomationDraftRequest`, `AutomationDraftResponse` (`{ rule: AutomationRuleBody; picks: { path; pick }[] }`) and the
four new codes in `AUTOMATION_ERRORS`; the route in `openapi/manifest.ts`, `schemas.generated.ts` regenerated.

### Editor

- `automations-client.ts` `draftRule(scope, prompt, timeZone)`.
- `DescribeRuleDialog.tsx`: the dialog (the shared `Dialog`, `DialogHeader`, `TextArea`, the examples as secondary
  Buttons, the `AiNote` sparkle line shared with the AI steps' `AiCostNote`), its states (idle, drafting, said). A
  refusal says the api's `message` (fixed words from items); anything else "That didn't work. Check your
  connection and try again.".
- `DraftedNote.tsx`: the builder's note, passed as RuleBuilder's `notice` above the steps.
- `NewRuleMenu` gains **Describe a Rule**; `RulesEmpty` gains its button. `AutomationsDialog` holds the draft (`{ body,
picks, n }`) in state, the target `{ view: 'rule', ruleId: null, draft: true }`, the builder keyed `draft:<n>` and
  given `picks` as a template's are, plus `drafted` for the note (`DraftedNote` in RuleBuilder's header).

### Tests

- items `ai-draft.test.ts`: the request (the request and plan only in the user message, nothing personal), every
  catalogue kind described, the measured ask; the reader: off topic, a valid rule, names resolved, chain forced off,
  time zone forced, webhook picks, links and control characters cleaned, an injected request whose reply tries
  extra keys, unknown kinds, an enabled flag, a huge reply (linear time), every refusal.
- api `automations-draft.test.ts` with a stand-in `env.AI`: drafted, off topic, a retry that reads, a retry that
  doesn't, capped by the 100 and by the 20, no binding, a throwing and a slow model, roles (Participant, Viewer,
  read-only token, tab-scoped link refused), the prompt never logged, nothing written but the count.
- editor `DescribeRule.test.tsx`: the menu row and empty state button, the chips, the count, each refusal's
  words, the draft opening the builder with the note and its picks, Discard Changes? on leaving.

### Cost (measured in ai-draft.test.ts "measures the ask")

| Plan                                                          | System | User   | Schema | Tokens in   | Neurons (1,500 out) |
| ------------------------------------------------------------- | ------ | ------ | ------ | ----------- | ------------------- |
| Past every cap (60 columns, 32 types of 40 fields, 50 labels) | 7,848  | 11,287 | 509    | about 4,900 | about 86            |
| Typical (5 columns, 2 types, 5 labels)                        | 7,848  | 737    | 509    | about 2,260 | about 21 + output   |

Characters, four to a token; Neurons at 9,091 per million in and 27,273 per million out (spec "Cost"). A typical
draft's reply is about 300 tokens, so about 29 Neurons. Before the caps were added the first measurement was 145,503
characters for the wide plan; the field budget brought it to 19,603.

## Phones: drawers, the header, the filters and Insert a Value

Derived from the spec's "The rule builder on a phone", the screen's phone bullets and "Values". `phone` is the
dialog's `!useMediaQuery('(min-width: 640px)')`, as before; nothing below changes a desktop.

- `ScreenTabs`: on a phone the bar is `h-12 items-stretch`, each tab `flex items-center` (44 px of it a target).
- `RuleFilters.tsx` (out of `RulesList`): the desktop row as before; on a phone a column of the search (`SearchInput`
  at its `size="lg"`: 40 px, 14 px text) and a row of the trigger `Select` (`flex-1`, `PHONE_SELECT` = `h-10
rounded-lg pl-3 pr-8 text-[14px]`) and `SegmentedRadio` (`size="lg"`, All / On / Off, `h-10`).
- `AutomationsDialog`: on a phone, editing (`target.view === 'rule'`) keeps the rules screen mounted and renders the
  builder in `RuleDrawer.tsx`: the shared `Dialog` with `phoneSheet="tall"` (its height the full sheet's, the top bar
  and the notch kept clear, `PHONE_SHEET_TALL`), an sr-only title (New Rule or Edit Rule), `beforeClose` = the dirty guard (returns false and opens Discard Changes? when
  dirty). Discarding unmounts the drawer straight away (the question was the exit).
- `RuleBuilder` with `phone`: `PhoneRuleChrome.tsx` holds `PhoneRuleHeader` (back chevron, the shared `Switch`
  labelled with its visible word On or Off, or the Off · Not Saved pill for an unsaved rule; the name in `RuleNameField`, a one-row `textarea` that grows with its text, Enter
  ignored, newlines folded to spaces), the steps scrolling, and `PhoneRuleFoot` (Rule Details, then the two buttons
  as `Button size="md"` `flex-1 h-11`; a saved rule with nothing changed shows **Saved** with a check, a `role="status"`, in Save Rule's place).
- `RuleDetails` takes `placement="foot"`: the accordion's bar sits in the foot and its body opens above the bar,
  `max-h-[40dvh] overflow-y-auto`.
- `StepDrawer.tsx`: on a phone `StepPanel` renders its shell into the shared `Dialog` (`phoneSheet`, `size="lg"`) with
  the shell's tile and title as its header beside `DialogCloseButton`, the body `min-h-0 flex-1 overflow-y-auto
overscroll-contain`, and a foot holding **Done** (`useDialogDismiss`, so it slides out like the close). `RuleBuilder` holds `stepOpen`:
  set by a pick (`actions.select`), an add and a refusal's `partAt`; never by the first render's trigger selection.
- `ValueInsert.tsx`: `ValueTextField` draws `ValueInsertButton` inside the field's box (`absolute right-1.5 top-1.5`, the
  text padded `pr-10` on the textarea and its backdrop alike). `ValueInsertMenu.tsx`: `AnchoredPopover` (width 300,
  `pointer`) on a wide screen, the shared `Dialog` `phoneSheet` on a phone, both holding `ValueInsertList`: a
  `SearchInput` as a combobox over a `listbox` of `option`s grouped under `role="group"` headings, the active option
  moved by Up / Down (wrapping) and inserted by Enter, a click inserting too. `value-insert-options.ts` (pure):
  `valueInsertGroups(branch, fields, incoming)` and `filterValueGroups(groups, query)`. Webhook Field… swaps the list
  for `WebhookPathForm` (the old `WebhookFieldInsert` field, with Insert and Back). The field keeps the selection it
  had (a textarea keeps `selectionStart` / `selectionEnd` through a blur), so `insertValue` lands at the caret; a
  field never focused inserts at the end. Focus returns to the field after the insert, its caret past the value.
- `phone-board.ts`: `offColumnCard(card, view)` (the card's middle more than half its width from the view's middle)
  and `centreCardColumn(itemId, body, columnAttr)`; `PlanBoardView`'s open on a tap (the drag's `onClick` and the
  read-only press) calls it first when `look.columns === 'phone'`. It reads two rects on the tap, nothing per card.
- Tests: `RuleFilters.test.tsx` (the phone layout, the segmented filter), `RuleBuilderPhone.test.tsx` (the drawer on a
  phone and not on a desktop, the step drawer opening on a pick and closing on Done, the header, the foot, Saved, the
  Discard Changes? guard on Escape and Back), `ValueInsert.test.tsx` (the button, the keyboard, insert at the caret, no list
  under the field), `phone-board-tap.test.ts` (the off-column card centres its column and does not open).

## Run telemetry

- `apps/api/src/plan-room/automations/automation-telemetry.ts`: `AutomationTally`, a wake's buffer. `track(category,
action, type)` (a bound `track`, so the dashboard's emitter scan reads each literal call) pushes an event; `flush(env)`
  hands at most `TELEMETRY_BATCH_MAX` to `reportServerEvents`, results and trouble ahead of trigger kinds, and empties.
- `runAutomations` (plan-room-automations.ts) makes one per alarm, passes it to `runTimeTriggers` and
  `runAutomationWake`, and flushes it through `deps.defer` in a `finally`, so a failed wake still reports.
- `RunState.tally` (absent for Test on a Card and Run Rule): `runRule`'s `end` tracks the result and the trigger kind,
  the store's `settle` answering true tracks `AutomationPaused`, the catch tracks `AutomationCrashed`.
- The Incoming Webhook answer (automation-incoming.ts) sends its one event through `automations.deps()?.defer`, only
  once the address names a live webhook rule.
- The dashboard: `liveworkspace/apps/site/app/telemetry/liveplanner/event-explanations.ts` explains every pair, and
  `computed-emitters.ts` lists `AutomationTrigger.<Kind>` from `AUTOMATION_TRIGGER_KINDS`.
