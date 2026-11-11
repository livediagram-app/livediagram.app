# Automations blueprint

Derived from [Automations](../automations.md). Phase 1 (#711).

## Domain and naming

| Spec term           | Identifier                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------- |
| rule                | `AutomationRule` / `AutomationRuleBody` (packages/items `automation/types.ts`)               |
| trigger             | `AutomationTrigger` (`kind`: `card_created`, `form_response`, `card_moved`, `field_changed`, |
|                     | `comment_added`, `manual`)                                                                   |
| condition           | `AutomationCondition` (`type`, `column`, `field`, `who`, `saved_filter`)                     |
| step / action       | `AutomationStep` / `AutomationAction`; If / Else is the step `{ kind: 'if' }`                |
| run                 | `AutomationRun` (`result`: `done`, `no_match`, `skipped`, `failed`)                          |
| value               | `{{…}}` placeholders, `automation/values.ts`                                                 |
| Automation (person) | `automationPerson(ruleName)`: `{ id: 'automation', name: <rule name>, color: '#7c3aed' }`    |
| history tag         | `ItemHistoryTag` gains `'automation'`                                                        |
| a waiting trigger   | `AutomationEvent` (api, `plan-room/automations/`)                                            |

## Files

```
packages/items/src/automation/
  types.ts            the shapes and limits (written first; the contract both sides build on)
  validate.ts         readRuleBody(v, plan) → { body } | { error, path }: every limit, every kind, values known,
                      names unique; plan = the outline (types, statuses, fields, people) for Needs Attention
  attention.ts        ruleNeeds(rule, outline) → string[]: what a rule names that the plan lacks
  values.ts           VALUE_NAMES, valuesIn(text), fillValues(text, ctx) and the {{now ± Nd}} day maths, in the
                      rule's time zone
  conditions.ts       holds(condition, ctx) → { ok, text }: one condition, with the line the Run Log shows
  matches.ts          triggerMatches(trigger, event) → boolean: the event kinds below against a trigger
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
  automation-schema.ts   the tables (below), made with the plan's schema (plan-schema.ts) and in its migrations
  automation-store.ts    rules CRUD on PLAN_DB; an in-memory `onKinds: Set<kind>` of the kinds some rule that is on
                         listens for, rebuilt on every rule write and on wake (the hot-path check)
  automation-queue.ts    enqueueEvents(env, writes, tag, ctx) used by appendItemHistory and the comment write;
                         AutomationSchedule (at / noteWrite / due / restore / run) as RepeatSchedule
  automation-runner.ts   one event against every rule it matches: run id, budget, chain, conditions, planActions,
                         then the writes (below), the Run Log row, the failure count and pausing
  automation-writes.ts   applies a planned run: one items patch for the triggering card via the shared write
                         loop with `by: automationPerson(name)` and tag 'automation'; a thread via the card-thread
                         store with Automation as author; Create Card via makeItem + insertItems; emails via the
                         notifier's send (opt-outs honoured, account people only)
  automation-log.ts      Run Log insert and trim (2,000 rows, 30 days), the stats query, today's count

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
  id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, at INTEGER NOT NULL);
CREATE TABLE automation_runs (
  id TEXT PRIMARY KEY,                                 -- runId(event.id, rule.id): INSERT OR IGNORE = never twice
  rule_id TEXT NOT NULL, at INTEGER NOT NULL, result TEXT NOT NULL, body TEXT NOT NULL);
CREATE INDEX automation_runs_at ON automation_runs (at);
CREATE INDEX automation_runs_rule ON automation_runs (rule_id, at);
```

The day's count is `SELECT COUNT(*) FROM automation_runs WHERE at >= <UTC midnight>`, indexed, so the budget needs no
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
  role: 'editor' | 'participant' | 'agent' | 'automation';
  rule?: string;
  chain?: number; // set when by is Automation: the rule that made it and the chain length
  ruleId?: string; // manual: the one rule to run
};
```

- `appendItemHistory` (db/item-history.ts) calls `enqueueEvents` after its batch with the same writes and tag: it
  builds events from `historyChangesOf(before, after)` (created / moved / changed), skips the Trash and archive
  moves, and inserts them **only when `onKinds` holds a matching kind** (the hot-path cost for a plan with no rule
  that is on is one Set lookup). A tag of `'automation'` carries the rule and chain from the write's context; a write
  whose rule has `chain: false` enqueues nothing but records the Skipped line for rules it would have met (runner).
- The comment write (card-thread-store / comment routes) enqueues `comment` for a new thread or reply whose author is
  not Automation.
- `POST …/automations/:ruleId/run` enqueues nothing: it runs at once and answers the run.
- Queue past `AUTOMATION_QUEUE_MAX`: the new events are dropped and one Skipped Run Log row says so (once per wake).
- After enqueueing, the room's schedule asks for a wake now (`noteWrite`), as Repeats do; the alarm drains up to
  25 events per wake, then asks again in 1 s while more wait.

## The run (automation-runner.ts)

For each event, for each rule that is on, in `position` order, whose trigger matches:

1. `runId = sha256(event.id + ':' + rule.id)` (packages/items sha256.ts); `INSERT OR IGNORE` the run row as
   `pending`. Not inserted means it ran already: skip.
2. Budget: today's count ≥ `AUTOMATION_RUNS_PER_DAY` → drop (no row; the meter says why).
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
(403 `automations_need_editor`). A Browser Storage plan never calls them.

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
