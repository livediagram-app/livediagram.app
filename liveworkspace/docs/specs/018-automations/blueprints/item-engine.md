# Automations item engine blueprint

Derived from [Automations](../automations.md) "Built once". The second stage, on top of [engine.md](./engine.md): the
whole engine for an item that has **no cards** (a livediagram or livedocuments document, a design, a Space), built
once in `@liveworkspace/automations`. An app hands it a **kit** and adds its own kinds; a later stage wires each app
in by the [checklist](#wiring-an-app) below, and another builds the screen. liveplanner keeps its own run loop on
stage 1 and uses nothing here.

## Naming

| Word        | Means in the package                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| **item**    | what rules belong to; the app's own word arrives as `itemWord` (`canvas`, `document`, `design`, `Space`, |
|             | `knowledgebase`)                                                                                         |
| **tab**     | a tab of the item, by id; called a **page** where the item is a `knowledgebase` (`tabWordOf`)            |
| **subject** | what a run is about: a tab (`AutomationSubject`: id, title, url) or null for the item alone              |
| **kind**    | one trigger, condition, step or value, as a self-describing definition                                   |
| **settle**  | a trigger that fires after things go quiet (Edited, Then Quiet; an app's Everyone Left)                  |
| **writer**  | who is writing the item's tables right now, for the SQL triggers (a rule's own window, a person)         |

## Files

```
packages/automations/
  package.json            a third entry: "./item" (src/item/index.ts); "./room" also exports src/room/item
  src/item/               pure: a browser, a Worker, node
    types.ts                ItemEvent, the open rule types, the shared kinds' shapes, ItemOutline
    kinds.ts                TriggerKind, ConditionKind, ActionKind, ValueKind, ItemKinds, defineTrigger and its kin
    define.ts               defineItemKinds: the shared kinds and an app's own
    names.ts                ItemNames: tabs, people, snapshots, connections and templates by id, gone and unpicked
    tab-word.ts             tabWordOf(itemWord): `page` for a knowledgebase, else `tab`; inTabWords(text, itemWord)
                            rewrites a static line's "tab", "Tab", "tabs", "Tabs" (never a name, never `format`)
    refs.ts                 what a part names (tab, snapshot, connection, template, person): mapRefs, refsOf
    triggers.ts             the shared triggers (and the collab ones); agentChangedTrigger, AGENT_CHANGED_EVENT
    conditions.ts           Tab, Who Did It, Day of Week, Text
    actions.ts              Take Snapshot, Revert to Snapshot, Send Email, Add a Tab; Wait, If / Else, a message, Summarise
    values.ts               item.name, item.url, tab.name, tab.url, comment, summary; itemValueOptions; the resolver
    validate.ts             readItemRule, ruleNeedsPerson, ruleSnapshotIds, snapshotsFull, ruleUnpicked
    words.ts                itemRuleSentence, itemTriggerLine, itemRuleFormat, undescribedKinds, ruleNeeds, needLine
    summary.ts              itemRuleSummary
    collab.ts               collabEvents
    ai.ts                   Describe a Rule's prompt and reader; the Summarise request and its answer
    templates.ts            ItemTemplate, itemPicksLeft
    file.ts                 rulesForFile, rulesFromFile
  src/room/item/          the Durable Object's half
    kit.ts                  ItemRoomKit, ItemDeps, StepOutcome, ItemActionContext
    schema.ts               itemAutomationSchemaSteps(tables): stage 1's steps and the `item` step
    writer.ts               markItemWriter, clearItemWriter, withItemWriter
    engine.ts               ItemEngine (an ItemAutomations), ItemSchedule
    intake.ts               queueItemEvent, touchSettles
    settles.ts              runItemSettles
    time.ts                 runItemTimeTriggers
    actions.ts              the shared runners
    ai.ts                   the Summarise step
    run.ts                  runItemRule
    wake.ts                 runItemWake, runItemAutomations
    hook.ts                 answerItemHook, readItemHookCall, itemHookResponse, the opt-out door
    route-kit.ts            ItemCaller, the answers' shapes, a request's body, a rule as the list shows it
    routes.ts               handleItemAutomationRoutes (the gate and the route table)
    routes-rules.ts         list, create, save, delete, toggle, duplicate, order
    routes-runs.ts          test, run, runs, secret, summary
    routes-draft.ts         Describe a Rule
    kept.ts                 keptSnapshotIds
    telemetry.ts            tallyItemRun
    test-kit.ts             tests only: a fake kit over node:sqlite with `tabs` and a link table
    perf.test.ts            the hot paths, held to CPU-time budgets
  src/room/app/           an app api's bindings: what every item app's Worker and room wire the same way
    host.ts                 ItemHost (AUTOMATIONS, COLLAB on the room's env), hearsEvent, queueEvent, writerOf,
                            roleOfLevel, asTabWriter, silently, keptSnapshots, queueAgentChanged, SOMEONE, AGENT_NAME
    standing.ts             ItemStandingKeeper: archived or trashed at the index, kept in storage, newest word wins
    collab-watch.ts         CollabWatch, watchRules, tabElements, COLLAB_SEEN_SCHEMA_STEP: the outbox's collab diff
    rules-file.ts           hostRulesForFile, copiedRulesOf, landedRuleStatements, CopiedRules
    doors.ts                incomingItemHook, itemEmailOptOut: the room's halves of the two doors
    worker-doors.ts         serveItemHook, serveItemOptOut: the Worker's halves, before identity
    app-routes.ts           itemAutomationPath, itemCallerOf, serveItemAutomations: the sub-resource route
    openapi.ts              itemAutomationOperations({ collection, itemWord })
    email.ts                ItemEmailLook, itemAutomationEmail: a rule's email, in the app's own shell
    kit-mail.ts             kitMail, itemHookUrl
    kit-sends.ts            kitSends
    kit-snapshots.ts        kitSnapshots
    kit-add-tab.ts          addTemplateTab, RULE_TABS_MAX, tabLimitWords, TEMPLATE_GONE, TEMPLATE_FAILED
  src/testing/            tests only
    room-world.ts           a room driven on node:sqlite, as the app tests drive theirs
    worker.ts, workerd.ts   the workerd harness: a test Worker's doors and the vitest side (unstable_dev)
```

`@liveworkspace/automations` gains one dependency, `@liveworkspace/api-schema` (the wire types and the error lists,
[below](#wire-types)); `@liveworkspace/api-schema` imports nothing of the engine, so there is no cycle.

## The pure entry (`@liveworkspace/automations/item`)

### Shapes (types.ts)

- `ItemEvent`: `id`, `kind`, `at`, `by?` (an `AutomationPerson`), `role?` (`editor`, `participant`, `viewer`, `agent`,
  `automation`), `rule?` and `chain?` (the rule whose change this is, and how deep), `tab?`, `data?` (flat strings,
  numbers and booleans: the comment's text, an Incoming Webhook call's values under `webhook.<path>`, an app's own),
  and what a held Wait adds (`ruleId`, `step`, `edited`, `waited`, `origin`; the summary so far rides in
  `data.summary`).
- `ItemPart = { kind: string } & Record<string, unknown>`: a trigger, a condition or a step with open kinds.
  `ItemRuleBody`, `ItemRule` and `ItemRun` are stage 1's generics over it.
- `ItemOutline`: `name`, `url`, `ownerId`, `tabs`, `people`, `editedAt?`.

### Kinds (kinds.ts)

Every kind is one definition; validation, the sentence, agents' format prose, Describe a Rule and the pickers read
nothing else.

```ts
interface KindBase<Part extends ItemPart> {
  kind: string;
  name: string; // Title Case, as the picker shows it
  group: string;
  line: string; // the picker's one-line description
  format: string; // the JSON, in prose, for agents and Describe a Rule
  read(value: Obj, path: string, ctx: ItemReadContext): Part; // throws Refused
  defaults(): Part;
  words(part: Part, names: ItemNames): RuleSentencePart[];
}
interface TriggerKind<Trigger extends ItemPart = ItemPart> extends KindBase<Trigger> {
  hears: readonly string[]; // the event kinds that may start it
  matches(trigger: Trigger, event: ItemEvent): boolean;
  said(trigger: Trigger, event: ItemEvent, names: ItemNames): string; // the run's first line
  personless?: true; // nobody behind it: Who Did It is refused
  time?: true; // it has an `at`; the schedule wakes for it
  tabbed?: true; // its runs are about a tab: Test Rule asks which
  collab?: true; // only where the app has comment threads
  due?(trigger: Trigger, at: ItemTimeMoment): string | null; // a time kind that runs once per stretch
  settle?: ItemSettle<Trigger>;
}
interface ItemSettle<Trigger> {
  after: readonly string[]; // the event kinds that start (or push back) the quiet
  cancel?: readonly string[]; // the event kinds that call it off
  quietMs(trigger: Trigger): number;
  key(event: ItemEvent, trigger: Trigger): string; // '' for the whole item
}
interface ConditionKind<Condition extends ItemPart = ItemPart> extends KindBase<Condition> {
  holds(condition: Condition, ctx: ItemHoldContext): ItemHeld; // { ok, text, gone? }
  personal?: true; // reads Who Did It
}
interface ActionKind<Action extends ItemPart = ItemPart> extends KindBase<Action> {
  would(action: Action, ctx: ItemWouldContext): string; // a dry run's "Would …"
  summary?(action: Action, names: ItemNames): string; // a reader's words, where the name alone says too little
  last?: true; // nothing may follow it
  needsPerson?: true; // a token may not save it
  top?: true; // the rule's top level only, never inside an If / Else
}
interface ValueKind {
  name: string; // as written between the braces
  label: string; // the chip
  under?: readonly string[]; // only under these triggers
  afterAi?: true; // only after a Summarise step
  fill(ctx: ItemValueContext): string;
}
```

`defineItemKinds({ itemWord, collab, tabTemplates, triggers?, conditions?, actions?, values? })` answers `ItemKinds`:
the shared kinds below and the app's own, as lists (`triggers`, `conditions`, `actions`, `values`) and lookups
(`trigger(kind)`, `condition(kind)`, `action(kind)`, `value(name)`). A kind registered twice throws. An app writes each
definition through `defineTrigger`, `defineCondition` or `defineAction`, which type its functions over its own part.

### The shared kinds

| Triggers           | Kind               | Fields                      | Hears                              |
| ------------------ | ------------------ | --------------------------- | ---------------------------------- |
| Scheduled          | `scheduled`        | stage 1's                   | time                               |
| Run by Hand        | `manual`           | none                        | `manual` (Run Rule)                |
| Incoming Webhook   | `incoming_webhook` | none                        | `incoming` (a call)                |
| Tab Added          | `tab_added`        | none                        | `tab_added` (SQL trigger)          |
| Tab Removed        | `tab_removed`      | none                        | `tab_removed` (SQL trigger)        |
| Edited, Then Quiet | `edited`           | `minutes` 5 to 1440, `tab?` | settles after `edit` (SQL trigger) |
| Not Edited For     | `not_edited`       | `days` 1 to 365, `at`       | time, once per stale stretch       |
| Snapshot Taken     | `snapshot_taken`   | none                        | `snapshot_taken`                   |
| Someone Joined     | `joined`           | none                        | `joined`                           |
| Access Requested   | `access_requested` | none                        | `access_requested`                 |
| Comment Added      | `comment_added`    | `tab?`                      | `comment_added` (collab)           |
| Thread Resolved    | `thread_resolved`  | `tab?`                      | `thread_resolved` (collab)         |
| All Threads Res.   | `threads_resolved` | `tab?`                      | `threads_resolved` (collab)        |
| Action Assigned    | `action_assigned`  | none                        | `action_assigned` (collab)         |
| Action Done        | `action_done`      | none                        | `action_done` (collab)             |

**Agent Made Changes** (`agent_changed`, `tab?`, `tabbed`) is not one of the shared kinds every app gets: an app that
has it adds `agentChangedTrigger({ line, note })` to its own triggers, with its own words for what an agent changes,
and queues it with `queueAgentChanged(host, { key, tab?, author, tokenName? })` once per token write (Who Did It the
token's name, role `agent`). livedesign uses both; livediagram and livedocuments define the same kind in their own
modules, from before the helper, and can move onto it.

Conditions: `tab { tabs, not? }`, `who { who: ({ person } | { role })[], not? }` (roles `editor`, `participant`,
`agent`), `weekday { days }`, `text { value, op: 'contains' | 'not_contains', text }`.

Steps: `take_snapshot { name }`, `revert_snapshot { snapshot, name? }` (`last`, `needsPerson`), `email { to, subject,
body }`, `add_tab { template, name }` (only with `tabTemplates`), and the top-level ones: stage 1's `notify` and
`wait`, `if { conditions, then, else }` and `ai { task: 'summarise', tab?: 'run' | id }`. An If / Else holds actions
only: never a Wait, an AI step, a message or another If.

Values: `item.name`, `item.url`, `tab.name`, `tab.url`, `comment` (under the comment triggers), `summary` (after a
Summarise step), and stage 1's (`person`, `rule`, `now`, `now.date`, `now ± Nd`, `webhook.<path>`).
`itemValueOptions(kinds, trigger, { afterAi })` lists what Insert a Value offers at a place, with labels that follow
`itemWord` ("Document Name").

### References (refs.ts)

What a part names is read by field name, in the shared kinds and an app's alike: `tab` (a tab id; `run` is no id) and
`tabs`, `snapshot`, `webhook` (a connection), `template`, `person`. `refsOf(part)` lists them and `mapRefs(part,
visit)` rewrites them, walking `conditions`, `then`, `else`, `who` and `to`. An app's kind that names one of these
uses the same field name, and gets needs, kept snapshots, copies and files for nothing.

What only one app has (a named version of a tab in livedocuments, a main component in livedesign) is an **own reference**: the app declares it in
`defineItemKinds({ ownRefs: [{ field, noun, title }] })`. `mapOwnRefs` and `ownRefsOf` read and rewrite those
fields as the shared ones are; a copy or a file's import empties them, as it does a snapshot, so the rule waits for
a pick (`ruleLeftToPick`); and the rules list asks the kit's `owns(field, ids)` which ones the item still has, a need
line (`ownNeedLine`) for each it lacks. An app with none declares none and pays nothing.

### The check (validate.ts)

`readItemRule(value, kinds)` is `readRuleShell` with the kinds' readers, and refuses: an unknown kind
(`automation_invalid`); more than 10 conditions, 20 actions, 5 messages, 3 AI steps, 3 Waits; a value no kind offers
at that place (`automation_value_unknown`: unknown, a trigger's own under another trigger, `{{summary}}` before a
Summarise step); a `personal` condition or an email to "whoever started it" under a `personless` trigger
(`automation_condition_unsupported`); a `last` step anywhere but the rule's end, or inside an If / Else that is not
the rule's last step, or not last in its list (`automation_step_unsupported`); a `top` step inside an If / Else.

`ruleNeedsPerson(rule, kinds)`; `ruleSnapshotIds(rules)` (the ids rules name, on or off) and `snapshotsFull(rules)`
(more than `AUTOMATION_KEPT_SNAPSHOTS_MAX`, 5); `ruleUnpicked(rule)` (a reference left empty by a template, a copy or
a file).

### Words (words.ts, summary.ts)

**Tab words.** Every word for a tab a person reads comes through `inTabWords(text, itemWord)`: `defineItemKinds`
passes the shared kinds' `name`, `line` and `group` and the shared values' `label` through it; the shared kinds'
`words`, `said`, `would`, `summary` and `holds` pass their own fixed words through it with `names.itemWord`, never
the names they print; `refName`'s unpicked and gone words follow it; and the room's step lines (`Added a page named
…`) follow `kit.itemWord`. `format` keeps "tab": it spells out the JSON, whose field is `tab` in every app. The
screen (`@liveworkspace/automations-ui`) reads the same helper with `kinds.itemWord`. Under any word but
`knowledgebase` the text is unchanged, so no other app's words move.

`itemRuleSentence(rule, kinds, names)` (When … Only If … Then … chips; a gone name reads "a tab that's gone", an
empty one "a tab"), `itemTriggerLine(rule, event, kinds, names)` (the run's first line; "After waiting 2 days" for a
run going on), `itemRuleFormat(kinds)` (`{ trigger, conditions, steps }` for MCP `.describe()` and the draft prompt),
`undescribedKinds(kinds)` (kinds whose `format` does not show their own `"kind"`; a test holds it empty),
`ruleNeeds(rule, have)` and `needLine(need)`, and `itemRuleSummary(rule, kinds, names)` on stage 1's `ruleSummary`:
no address, connection name or AI ask.

### Collab diff (collab.ts)

`collabEvents(before, after, { tab, at })` over two `CollabSummary`s (`threads`: `elementId`, `resolved`,
`commentCount`, `latestText`, `latestAuthorId`, `latestAuthorName`, `latestAuthorColor?`; `actions`: `elementId`,
`actionId`, `name`, `status`, `assigneeId`, `assigneeName?`): `comment_added` (the text's opening 500 characters and
its author), `thread_resolved`, `threads_resolved`, `action_assigned`, `action_done`. A comment by Automation makes no
event.

### AI (ai.ts)

`itemDraftSystem(kinds)`, `itemDraftAbout(outline)` (the item's tab names, cut and capped, nothing else) and
`readItemDraft(reply, ctx, kinds, outline)` on stage 1's `readAiDraft` (tab names in the reply go back to ids; every
text is cleaned of links the person did not write). `summariseRequest(text)` (the text cut to
`AI_SUMMARISE_TEXT_MAX`) and `readSummary(raw, own)` (plain text, foreign links dropped, at most
`AUTOMATION_AI_SUMMARY_MAX`).

### Templates and files (templates.ts, file.ts)

`ItemTemplate<Id, Category>` is stage 1's template over `ItemTemplateItem` (the outline's names and the saver's time
zone), with picks `tab`, `snapshot`, `connection`, `template` and `person`; `itemPicksLeft(body, picks)`. The package
ships no template.

`rulesForFile(rules)` keeps each rule's body and whether it was on. `rulesFromFile(value, kinds, { stamp, tabs?,
copy? })` reads them back through the check: new ids, tab ids remapped by `tabs` (one the map lacks is left empty),
and for a copy every rule off with its snapshots and connections cleared. A rule that does not read is dropped and
counted.

## Wire types

`@liveworkspace/api-schema/automations` (packages/api-schema/src/automations.ts) holds the request and response bodies
of the route table, generic over the rule, run and need an app's engine has, and the error lists:
`AUTOMATION_ERRORS` (liveplanner's codes and `automation_needs_a_person`, `automation_snapshots_full`) and
`AUTOMATION_HOOK_ERRORS`. liveplanner's own api-schema is unchanged.

## The room entry (`@liveworkspace/automations/room`)

### Tables (schema.ts)

`itemAutomationSchemaSteps({ tabs?, links, tabKey? })` answers stage 1's steps and one more, `item`, for the app to
append to its schema's steps. The table names are the app's (`tabs`, and `document_tabs` or `design_tabs`; the link's
tab column is `tab_id`), checked against `[a-z_]+`.

| Table                | Holds                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| `automation_hears`   | the SQL-fed kinds some rule that is on hears: `tab_added`, `tab_removed`, `edit`    |
| `automation_writer`  | one row while a writer's window is open: `who` (JSON), `own`, `silent`, `until`     |
| `automation_edits`   | `tab_id` → `at`: each tab's last edit (`''`: the item's, kept when a tab goes)      |
| `automation_quiet`   | each rule that settles after edits: `rule_id`, `quiet_ms`, `tab` (`''`: any tab)    |
| `automation_settles` | `(rule_id, key)` → `due_at`, `data`: a quiet stretch under way; indexed by `due_at` |

Three SQL triggers (`automation_tab_added` and `automation_tab_removed` on the link table, `automation_tab_edited` on
`tabs` after an update of `data` or `name`), each gated by `WHEN EXISTS (SELECT 1 FROM automation_hears)`: an item
with no rule on pays one probe of an empty table per tab write and nothing else. When a rule hears them:

- a link's insert or delete queues a `tab_added` / `tab_removed` event (with the tab's name in `data`), while the
  queue has room;
- any of the three stamps `automation_edits` and pushes back each matching `automation_quiet` rule's row in
  `automation_settles` (`due_at = now + quiet_ms`).

`automation_writer` is how a write says who makes it. `markItemWriter(sql, { who?, own?, silent? })` opens a window
(60 seconds at most, so a crash never leaves it open); the triggers merge `who` (`by`, `role`, `rule`, `chain`) into
the events they queue, count nothing as an edit while `own` is set (a rule's own writes), and do nothing at all
while `silent` is set (a revert, a rule's or a person's). The engine opens the window round every step it runs.
Windows nest: the room keeps the open ones in order (in memory, per storage), the row always holds the newest still
open, and a window closing puts back the newest one left (with its own `until`) or deletes the row when none is. So
a person's tab write landing inside a rule's step (the step awaits) is the person's while it runs, and the rule's
later writes in that step are the rule's again; a person's write that lands without a window of its own, while a
rule's is open, is still taken for the rule's, as the window is as short as the step.

### The kit (kit.ts)

```ts
interface ItemRoomKit {
  kinds: ItemKinds;
  itemId: string;
  itemWord: ItemWord;
  category: string; // telemetry: 'Document' (livehuddle's Spaces too), 'Design'
  outline(): Promise<ItemOutline>;
  tabUrl(tabId: string): string;
  snapshots: {
    list(): Promise<{ id: string; name: string | null }[]>;
    take(
      name: string,
      author: AutomationPerson,
    ): Promise<{ ok: true } | { ok: false; reason: string }>;
    revert(
      id: string,
      author: AutomationPerson,
    ): Promise<{ ok: true } | { ok: false; reason: string }>;
  };
  text(tabId?: string): Promise<string>;
  addTab?(
    template: string,
    name: string,
  ): Promise<{ id: string; name: string } | { failed: string }>;
  mail: ItemMailer | null;
  sends: AutomationSendsClient<ItemSendSubject> | null;
  ai: { client: AutomationsAi | null; gateway?: string };
  run: Readonly<Record<string, ItemActionRunner>>;
  values?(event: ItemEvent): Promise<Readonly<Record<string, string>>>;
  telemetry(events: TelemetryWireEvent[]): Promise<void>;
  hookUrl(ruleId: string): string;
  owns?(field: string, ids: readonly string[]): Promise<ReadonlySet<string>>; // its own references, by field
  putAway(): boolean;
  defer(promise: Promise<unknown>): void;
}
```

`ItemMailer`: `sendToAddress(address, message, links)`, `sendToPerson(personId, message)`, `optOutDoor`,
`optOutPage`. `ItemActionRunner = (action, ctx: ItemActionContext) => Promise<StepOutcome>`; the context holds the
rule, the event, the tab, `fill(text)`, and `source` (`{ role: 'automation', rule, chain }`) for the events the app's
own writes queue. `StepOutcome = { ok: true; text } | { ok: false; text; gone? }`.

### The holder (engine.ts)

`new ItemEngine({ sql, ready, arm, kinds, kit, putAway })` is an `ItemAutomations` (stage 1; its constructor gained an
optional `schedule` so the holder can bring its own, and liveplanner passes none). `engine.deps()` answers the
`ItemDeps` a run needs (`kit`, `sql`, `store`, `wake()` to ask the alarm again, `fed()`), or null while the room
holds no item. It adds:

- `settlers` and `direct`: the settling rules and the kinds a rule hears straight, rebuilt on every rule write;
- `sync()`: `automation_hears` and `automation_quiet` rewritten from the rules that are on (none when put away). The
  store calls it after every rule write; the app calls it when the item is put away or brought back;
- `ItemSchedule`: `wakeAt` and `due(now)` also read `MIN(due_at)` of `automation_settles` and whether the queue holds
  a row, in one statement, only while a rule hears a SQL-fed kind (the triggers write with no JavaScript run).

### Events in (intake.ts)

`queueItemEvent(sql, hook, event)` for an app's call sites, inside the write's transaction: nothing unless
`hook.kinds` holds the kind; it starts or cancels the settles the kind touches, and queues the event (while the
queue has room) when a rule hears it straight.

### A wake (wake.ts, settles.ts, time.ts, run.ts)

`runItemAutomations(engine, now)`: due Waits go on, due settles queue their event (a fired settle's row is deleted,
so only a later starting event fires it again), due times queue theirs (a moment under 24 hours late runs once; an
older one is skipped and said on the Audit Trail; a kind with `due` runs once per key through `automation_fired`),
then `runItemWake` runs up to `ITEM_EVENTS_PER_WAKE` (25) events against the rules that hear them, for at most
`ITEM_WAKE_MS` (60 s). A wake never throws; a failed one tries again in a minute. One `AutomationTally` batch a wake.

`runItemRule(deps, state, rule, event, { dry? })`, as liveplanner's `runRule`: never its own change; the run id
(`sha256(event.id:rule.id)`) claimed before anything; the day's 1,000 (past it the run never starts, `state.spent`
is set, and the rule's one `budget:` line for the day is written if it is not there yet: one statement, `INSERT OR
IGNORE`, remembered for the wake in `state.noted`); the chain (a rule that keeps its changes
starts nothing; five deep); the conditions; then each step in order: an action through the shared runner or
`kit.run[kind]`, If / Else, a message (`sendMessages`), Summarise (the day's 100; past it the step is skipped and
the run ends Skipped), Wait (`holdRun`; the run goes on later from the next step, Skipped if the rule changed). A
failed step stops the run. A `last` step that is done ends the run. Ten failures in a row pause the rule. A dry run
changes nothing and says "Would …".

### Routes (routes.ts)

`handleItemAutomationRoutes({ engine, method, segments, request, url, caller })`, `segments` being the path after
`…/automations`. `caller`: `{ editor, signedIn, token?: { readOnly }, person, reader }`.

| Route                     | Does                                                          | Refusals of its own                                        |
| ------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| `GET /`                   | rules with stats, needs, hook info; `runsToday`, `runsPerDay` |                                                            |
| `POST /`                  | a new rule, on once it has a step                             | 409 `automation_rules_full`, `automation_name_taken`       |
| `PUT /:ruleId`            | the rule as written now                                       | 409 `automation_name_taken`                                |
| `DELETE /:ruleId`         | 204                                                           |                                                            |
| `POST /:ruleId/toggle`    | on or off; Resume clears a pause                              | 400 a rule with no step, or something left to pick         |
| `POST /:ruleId/duplicate` | a copy, off                                                   | 409 `automation_rules_full`                                |
| `POST /:ruleId/run`       | Run Rule, `{ tab? }`                                          | 409 `automation_not_manual`, 429 `automation_budget_spent` |
|                           |                                                               | (Retry-After), 500 `automation_run_failed`                 |
| `POST /:ruleId/secret`    | Make Secret, shown once; never a token                        | 409 `automation_not_incoming`                              |
| `POST /order`             | the list's order                                              |                                                            |
| `POST /test`              | Test Rule, `{ rule, tab? }`: a dry run                        |                                                            |
| `POST /draft`             | Describe a Rule                                               | 422, 429 `automation_ai_capped`, 503                       |
| `GET /runs`               | the Audit Trail, at most 200                                  |                                                            |
| `GET /summary`            | one rule for any reader (`?rule=` or `?name=`)                | 404 `automation_not_found`                                 |

Every route but the summary is a signed-in Editor's of the whole item (403 `automations_need_editor`); a read-only
token only reads (403 `read_only_token`). A token saving or duplicating a rule that `ruleNeedsPerson` is 403
`automation_needs_a_person`; a token's add naming any connection, its change naming one the held rule does not, or its
duplicate of a rule naming one (`ruleConnections(rule)`, every non-empty `webhook` field) is 403
`automation_connection_needs_a_person`; a save that would keep a sixth snapshot is 409 `automation_snapshots_full`.

A `tab` the item lacks (Test Rule, Run Rule) is 404 `tab_not_found`; a verb a route lacks is 405
`method_not_allowed`; a path that is none of these answers null, for the app's own chain to go on.

The public doors, mounted before identity: `readItemHookCall(request)` (405, 415 `webhook_json_only`, 413
`webhook_too_large`; it reads the signature and `X-Liveworkspace-Timestamp`) and `itemHookResponse(answer)` in the
Worker, where `serveItemHook` asks the network's write limit (429) before it reads anything of the call;
`answerItemHook(engine, ruleId, call, now)` in the room (401 `webhook_unauthorized` for every refusal before the proof, 429 with Retry-After, 400
`webhook_body_invalid`, `202 { queued }`); `itemOptOut(engine, token, now)` for the email opt-out.

`keptSnapshotIds(store)` is the snapshots door's `kept`.

## Wiring an app

Nearly all of it is `@liveworkspace/automations/room`'s (`src/room/app/`); an app writes only what is its own.
livediagram's, livedocuments', livedesign's and livehuddle's apis are the examples (their
`docs/specs/013-workspace/blueprints/automations.md`). A trigger an app's own events settle (livehuddle's Everyone
Left: `tab_emptied` starts it, `tab_filled` calls it off) needs nothing more: `queueEvent` with a kind only a
settle hears touches `automation_settles` and queues nothing.

1. **Kinds.** One `KINDS = defineItemKinds({ itemWord, collab, tabTemplates, ownRefs?, triggers, conditions,
actions, values })` in the app's model package, which the editor and the api share.
2. **Schema.** Append each `itemAutomationSchemaSteps({ links: '<link table>' })` step's `run` to the room schema,
   then `COLLAB_SEEN_SCHEMA_STEP` for a collab app.
3. **The room.** An `ItemEngine`, an `ItemStandingKeeper` and (collab) a `CollabWatch` as members; `AUTOMATIONS` and
   `COLLAB` on the room's env (`ItemHost`); restore the standing before the content and the engine after it; add
   `schedule.wakeAt` and `collab.at` to the alarm's due list, `collab.baseline(now)` before the outbox drain and
   `runItemAutomations` after; forget them on purge. RPCs `incomingHook`, `emailOptOut`, `takeStanding`,
   `accessRequested`, and `joined` with the level, each a line over `room/app` (`incomingItemHook`, `itemEmailOptOut`).
4. **The kit.** `outline`, `text` and `run` (its own steps) are the app's; `snapshots` (`kitSnapshots`), `mail`
   (`kitMail` over its email look), `sends` (`kitSends`), `addTab` (`addTemplateTab` over its template compiler) and
   `hookUrl` (`itemHookUrl`) are one call each. `owns` only with own references.
5. **Call sites.** `hearsEvent` / `queueEvent` for Snapshot Taken (the snapshots route's 201), Someone Joined,
   Access Requested and its own triggers; `asTabWriter` round a save that makes a tab and a tab delete;
   `silently` round a person's revert; `kept: () => keptSnapshots(env)` on the snapshots door; in the outbox,
   `env.COLLAB?.watching()` then `note(tab, rows, now, soleEditor)`. A step passes `ctx.source` to what it queues.
6. **Routes.** `serveItemAutomations` behind `itemAutomationPath([segments[4], segments[5]])` (literal indices, for
   route parity) with the caller from the app's gates; `serveItemHook` and `serveItemOptOut` in the Worker before
   identity; `itemAutomationOperations` in the OpenAPI manifest, the wire roots in its generator.
7. **Files and copies.** `hostRulesForFile(env)` in the export, `copiedRulesOf(env, tabIds)` on a copy its own
   people make, `landedRuleStatements(db, KINDS, rules, now)` in the import's batch.
8. **AI and telemetry.** The `[ai]` binding in every environment of `wrangler.toml`; the `Ran` action under the
   app's Automations category.
9. **Tests.** `testing/room-world.ts` for the room on node:sqlite, `testing/worker.ts` + `testing/workerd.ts` for a
   workerd run, and the share-roles test of the routes.

## Agents

The tools of [Automations](../automations.md#agents) "Agents", built once in `@liveworkspace/agent-verbs` over the
routes above, so each app's MCP and CLI bind them in a few lines:

```
packages/agent-verbs/src/
  rules/rule-state.ts       RuleProduct (product words, ItemKinds, templates, a naming line), rulesPathOf, the reads,
                            RULE_RUNS_DEFAULT 20, RULE_RUNS_MAX 50, RULE_CHANGES_MAX 20
  rules/rule-listing.ts     listedRule (itemRuleSentence over ruleNamesOf: the list's tabs and people, the templates'
                            titles), listedRuleBody, listedRun, resolveRule and resolveRuleTab by id or name
  rules/rule-names.ts       namedRuleBody: a body's tabs and people by name put back to ids (mapRefs), else kept
  rules/rule-refusals.ts    createRuleRefusal: the routes' codes in words, the rest the product's apiRefusalOf
  rules/rule-read.ts        readRuleListing: one read of the list (it carries the tabs and people), one of the runs
  rules/rule-changes.ts     applyRuleChanges: the changes in order over the list read once, a refusal stopping them
  rules/rule-run.ts         createRuleRun(binding, apiRefusalOf): the three above bound to a product
  mcp/rule-tools.ts         createRuleTools(binding, idKey): list_rules and change_rules, the format itemRuleFormat
                            writes, spelled out once on add's rule (set and test point at it)
  verbs/rule.ts             createRuleVerbs: the CLI's rule verbs; ruleGuide, the `guide rules` topic
```

Each app's `packages/agent-verbs/src/rules/index.ts` binds `RULE_PRODUCT` (its `AGENT_PRODUCT`, its `KINDS`, its
`TEMPLATES`, and a naming line for a kind of its own: livedocuments' versions, livedesign's components) and
`ruleRun`; `mcp/rule-tools.ts` and `verbs/rule.ts` are one call each, and its MCP registers the two tools in
`rule-tools.ts`. Cost: `list_rules` is one GET of the list (two with `runs`), its sentences made over maps built
once; a change is one call each after one read of the list. 100 rules at the longest name, each at 10 conditions and
20 steps, list in 3.5 to 5.1 ms of CPU, measured under a load average of 45 (a test holds it under 40). The tools add about 30 KB to each CLI bundle and
the item engine's pure half and the app's kinds about 52 KB more (unminified); `change_rules`' schema is about
13 KB of text.

## Cost

Measured in `src/room/item/perf.test.ts` on node:sqlite as CPU time (`process.cpuUsage`, the best of a few rounds),
each test holding a budget several times the figure so a regression fails it. Figures from an Apple-silicon laptop,
2026-11-20:

| Path                                                               | Measured | Budget |
| ------------------------------------------------------------------ | -------- | ------ |
| a tab write, no rule on: what the triggers add                     | 0.3 µs   | 5 µs   |
| the same, the write's statement compiled afresh each time          | 20 µs    | 60 µs  |
| a tab write, 50 rules on, every one settling after edits           | 40 µs    | 150 µs |
| the same, compiled afresh                                          | 62 µs    | 200 µs |
| one wake: 25 events over 50 rules (the day's 1,000 runs, all done) | 175 ms   | 900 ms |
| the rules list: 50 rules over a full Audit Trail (2,000 + 500)     | 2.3 ms   | 25 ms  |
| a wake's trim of a full Audit Trail, nothing over its caps         | 40 µs    | 400 µs |
| the day's AI asks, over a full Audit Trail                         | 11 µs    | 200 µs |
| a signed call's signature kept, a rule holding 600                 | 43 µs    | 500 µs |

- **The probe is the whole cost of an item with no rule on**, once the write's statement is compiled: 0.3 µs.
  SQLite codes a table's triggers into every statement that writes the table as that statement is compiled, so a
  write compiled afresh pays about 20 µs for the three triggers' bodies whether or not a rule is on. On workerd,
  against a real Durable Object (livediagram's `test/workerd-automations`, the real save statement), a tab save
  measured 16.1 µs with the three triggers and 14.4 µs without; a second run gave 18.5 against 18.4, so the
  difference is noise. `sql.exec` reuses compiled statements, so a save pays nothing per write and the first save
  after a wake pays about 50 µs once. The triggers therefore stay static.
- **50 settling rules is the worst case a write can meet**: each save pushes back 50 rows of `automation_settles`.
  One Edited, Then Quiet rule costs about 1 µs a save.
- **A wake's cost is its runs'**: about 0.17 ms a run here (the run id's hash, the claim, the kit's step, the
  settle), and never more than the day's 1,000.
- A writer's window (`automation_writer`) is written only while a rule hears a SQL-fed kind (`deps.fed()`).
- **The trim and the AI count were scans** (2026-11-21, the same laptop under load): the trim sorted both kinds of
  row on every wake (803 µs over a full trail) and the day's AI count unpacked every run body of the day (2.0 ms over
  2,500 rows, on every Summarise step and Describe a Rule). The trim now counts first and sorts only what is over a
  cap (40 µs); the AI count reads one day row and the day's drafts (11 µs).

Every list is bounded: 50 rules, 500 queued events, 25 events a wake, 500 waiting runs, one settle row per rule and
key (a rule's rows go with it), 200 runs a read of the Audit Trail (never the whole trail), 2,000 + 500 kept, 256 KB
a request body, 16 KB a call's.

## Tests

One test file beside each module. The room's run on node:sqlite (`test-kit.ts`: stage 1's tables, a `tabs` table and
a link table with the triggers, and a fake kit that records what it was asked).
