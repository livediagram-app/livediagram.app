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
// Every trigger (Phase 1's included) gains `types?: string[]`: card type ids, none or empty meaning every type.
// Matched in matches.ts before anything is queued (so another type's card costs no run row), in Run Rule's list
// and in the time scan; outline.ts flags a gone type as Needs Attention.
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

- Trigger panel: a **Card Types** chip row (the plan's types, ChipToggles, hint "None picked: every card type.")
  under every trigger's own fields; the sentence reads "When a Bug or Task card moves to Done".
- Trigger panel: Scheduled (Every: Day, Weekday, Week with day chips, Month with a day; At: a quarter-hour select),
  Due In (days), Overdue; the time zone shown ("Times are Europe/London"). A time rule's row shows "Next: Mon 9:00".
- **+ For Related Cards** adds a branch card with its inset steps and its own + Add Condition / + Add Action.
- Notify panels list the plan's webhooks of their kind from `GET /api/index/items/:id/webhooks` (lazy, once per
  builder), with **Add a Webhook…** opening the existing Webhooks dialog and refreshing the list on close.
- Assign panel gains **People in Turn** (a person multi-picker, 2 to 10, order as picked).
- Templates tab and the empty state's gallery (`TemplatesGallery`, category chips, tiles); a picked template opens
  the builder unsaved with its left-to-pick steps marked.
- A Browser Storage plan's footer button opens the **Rules Run on Our Servers** panel instead of the screen.

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
