# Automations engine blueprint

Derived from [Automations](../automations.md) "Built once". This is the first stage: `@liveworkspace/automations`
(`packages/automations`) holds everything in liveplanner's engine that is not about cards, moved out unchanged in
behaviour, and liveplanner runs on it. The run loop for an item's rules, the kit an app hands it and the routes are a
later stage, built on what is here; the builder (`@liveworkspace/automations-ui`) is its own blueprint when it exists.

## Naming

| Spec term  | In the package                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------- |
| item       | the thing a rule belongs to; the package never names an app's own word for it                       |
| subject    | what a run is about: `AutomationSubject`, a send's `subject`, an Incoming Webhook call's `subjects` |
| connection | a message step's `webhook` id and `via`; identifiers keep the word webhook, as the index's do       |
| kind       | `AutomationKind = { kind: string }`: a trigger, a condition or a step, open to each app's own       |

Copy the package words itself takes the app's word as an argument (`aiCappedWords('design')`,
`waitFullWords('design')`).

## The package

```
packages/automations/
  package.json        two entries: "." (src/index.ts) and "./room" (src/room/index.ts)
  vitest.config.ts    100% lines, branches, functions and statements
  src/                the pure entry: runs in a browser, a Worker and node; uses no Workers types
    limits.ts           the numbers every app shares (spec "Runs, limits and loops")
    types.ts            the rule, stamp, run, line, stats and hook shapes, generic over an app's kinds
    dates.ts            `YYYY-MM-DD` days as UTC day numbers, the time zone sums, a recurrence
    schedule.ts         a time trigger's moments: firesOn, momentOn, nextMoment, latestMissed
    validate-read.ts    the reading primitives and the `Refused` they throw
    validate-scheduled.ts  readScheduled: the Scheduled trigger
    validate.ts         readRuleShell, the shared caps, Wait, a message step, If / Else, a rule's name rules
    values.ts           the `{{…}}` scanner, the one-pass fill and the names every app shares
    webhook-paths.ts    `{{webhook.<path>}}`: what a path is
    incoming.ts         Incoming Webhook's limits, secret shape, signature headers, values and body read
    email-addresses.ts  what an email address is; a step's typed-in addresses
    email-trigger.ts    an email trigger's From filter (an address or a domain)
    failed.ts           Failed / fail, personNamed, allHold
    words.ts            the sentence's parts, a day, an or-list, a Wait and a message step in words
    ai.ts               the AI request shape, the reply read, link rules, plainSummary, the AI words
    ai-draft.ts         Describe a Rule: limits, request, reply read, a drafted text's cleaning
    templates.ts        a template, its fill and picks; partAt and picksLeft
    summary.ts          a rule as a Participant or Viewer reads it: the shape and its shell
  src/room/           the Durable Object entry: SQL on `Pick<SqlStorage, 'exec'>`, the app's clients handed in
    sql.ts              `Sql`
    automation-schema.ts    every table, as an ordered list of named steps
    automation-store.ts     AutomationStore: the rules, `kinds`, the schedule's rows, turns, failures and pausing
    automation-queue.ts     AutomationSchedule (the wake), ItemAutomations (what the room holds), AutomationsHook
    automation-log.ts       the Audit Trail: claim, settle, trim, list, stats, today's count
    automation-waits.ts     holdRun, stopWaits, runWaits
    automation-fired.ts     the event ids a time rule has run on
    automation-incoming.ts  an Incoming Webhook secret: made, proved, listed; the rule's minute
    automation-sends.ts     a run's messages through the item's connections
    automation-addresses.ts typed-in addresses: the day's claim, tokens, opting out, sending
    automation-ai.ts        the AI binding, the bounded ask, the day's counts
    automation-telemetry.ts AutomationTally
    test-sql.ts             tests only: an item's SQLite on node:sqlite with every table made
```

Dependencies: `@liveworkspace/model-core` (`cutText`), `@liveworkspace/index-app` (`timingSafeEqual`; its `testing`
entry in tests) and `@liveworkspace/telemetry` (the wire event and the batch cap). Nothing of an app's.

## The pure entry

### Shapes (types.ts)

- `AutomationRuleBody<Trigger, Condition, Step>`: `name`, `trigger`, `conditions`, `steps`, `chain`, `timeZone`. Each
  parameter extends `AutomationKind` and defaults to it, so an app's closed unions are an instantiation.
- `AutomationRule<Trigger, Condition, Step, Stamp, Gone>` adds `id`, `enabled`, `paused?` (`reason`, `at`,
  `webhook?`, `gone?`), `made` and `edited`. `Stamp` is the app's own stamp type (default
  `AutomationStamp<AutomationPerson>`); `AutomationPaused<Gone>` names the `paused` shape.
- `AutomationStepLine<Gone, Person, Extra>`: the trigger, condition and action lines, and `Extra`, an app's lines of
  its own. `AutomationActionLine` is the action member; `AutomationLines` is what the room entry settles lines into.
- `AutomationRunShell<Line, Gone>` is everything a run holds but what it is about; `AutomationRun` adds
  `subject: AutomationSubject | null` (`id`, `ref?`, `title`, `url?`). An app that keeps its runs' subject under a
  field of its own extends the shell instead (liveplanner's stored runs keep `card`; no stored run is migrated).
- The steps every app has: `AutomationWait`, `AutomationOutgoing` (`notify`, `via`, `webhook`, `name?`, `text`),
  `AutomationIf<Condition, Action>`; the trigger `AutomationScheduled`; `AutomationDay`.
- `AutomationRole`, `AutomationPerson`, `AUTOMATION_PERSON_ID`, `AUTOMATION_COLOR`, `AutomationResult`,
  `AutomationGone<Kind>`, `AutomationRuleStats`, `AutomationRunsQuery`, `AutomationHookInfo`, `AutomationHookSecret`.

Type parameters take an app's named types (its stamp, its lines) rather than building them, and members are written
inline, so an app's generated API schemas keep the app's own type names.

### The check (validate-read.ts, validate-scheduled.ts, validate.ts)

`readRuleShell(v, readers)` answers `{ body }` or the first `RuleRefusal` (`error`, `path`, `message`). It reads the
name (1 to 60, trimmed), the time zone and `chain`, then calls the app's readers, each of which throws a `Refused`:

```ts
interface RuleReaders<Trigger, Condition, Step> {
  trigger: (v: unknown) => Trigger;
  conditions: (v: unknown, path: string) => Condition[];
  step: (v: unknown, path: string, trigger: Trigger) => Step;
  check?: (rule: { trigger: Trigger; conditions: Condition[]; steps: Step[] }) => void;
}
```

Without `check`, the rule is held to `checkActionsCap` (20 actions, counted by `stepActions`: an If / Else's both
lists, none for a Wait) and `checkStepCaps` (5 message steps, 3 AI steps, 3 Waits). An app with caps of its own passes
`check` and calls those two where its own refusals belong between them.

Readers for the shared steps: `readWait`, `readNotify(s, path, check)`, `readIf(s, path, { conditions, action,
refused })`, `readActions`, and `readScheduled(t)`. `text(v, path, max, { empty?, unknownValue? })` takes the app's
check of a text's values (answering the first unknown name); `day(v, path, isDayValue?)` takes the app's check of a
day where its fields hold more than `YYYY-MM-DD`. `ruleNameTaken` and `freeRuleName` are a rule's name rules.

### Values (values.ts, webhook-paths.ts)

`valuesIn(text)` scans; `fillValues(text, resolve)` fills in one pass; `unknownValueIn(text, known)` answers the first
name `known` refuses. The names every app shares are `AUTOMATION_SHARED_VALUE_NAMES` (`person`, `now.date`, `rule`,
`now`), `now ± Nd` (`dayShiftOf`) and, in an Incoming Webhook rule, `webhook.<path>`: `isSharedValue(name, {
webhook? })` knows them and `sharedValue(name, ctx, iso?)` reads them from a `SharedValueContext` (`person`, `rule`,
`now`, `timeZone`, `webhook?`), answering `undefined` for any other name so the app's resolver reads its own.

### The schedule (dates.ts, schedule.ts)

`occursOn(recurrence, day)`, `localDay`, `dayStart`, `clockMoment` and `isRuleTimeZone` are the sums (formatters kept
for `ZONE_CACHE_MAX` zones). `firesOn`, `momentOn`, `nextMoment` and `latestMissed` take an `AutomationTimed`: a
Scheduled trigger falls on its recurrence's days, any other trigger with an `at` on every day. liveplanner's Repeats
read the same sums from here.

### Incoming Webhook (incoming.ts)

`WEBHOOK_BODY_MAX`, `WEBHOOK_CALLS_PER_MINUTE`, `WEBHOOK_VALUE_MAX`, `WEBHOOK_SECRET_PREFIX`, `WEBHOOK_SECRET_BYTES`;
`webhookPathsIn(steps)` and `webhookValues(payload, paths)`; `readHookBody(raw, subjects?)`, where `subjects` is the
app's `{ key, read }` for the list a call may name (liveplanner: `cards`). Two signature headers are exported and
the app's route chooses: `WEBHOOK_SIGNATURE_HEADER` (`X-Liveworkspace-Signature`) and
`WEBHOOK_SIGNATURE_HEADER_LEGACY`, the header liveplanner shipped with and keeps accepting and documenting. A signed
call also carries `WEBHOOK_TIMESTAMP_HEADER` (`X-Liveworkspace-Timestamp`, unix seconds, the outgoing deliveries'
name and format) in every app, and its signature is over `` `${timestamp}.${body}` ``; `WEBHOOK_SKEW_MS` (5 minutes)
and `WEBHOOK_REPLAY_MS` (10 minutes) are its windows.

### AI and Describe a Rule (ai.ts, ai-draft.ts)

`AiRequest`, `readAiReply`, `fencedBody`, `keepOwnLink`, `dropForeignLinks`, `plainSummary(text, own, max?)`, the
`AI_*` words, `aiCappedWords(item)` and `AI_MAX_TOKENS`. For a draft: `aiDraftRequest(system, prompt, about,
previous?)` (the app's instructions, and its description of the item under the key those instructions name),
`AI_DRAFT_SCHEMA`, `draftText`, and `readAiDraft(reply, ctx, kit)` with

```ts
interface AiDraftKit<Body> {
  named?: (rule: Obj) => unknown; // names in the reply back to ids
  cleanStep?: (step: Obj, own: string) => void; // each step's texts, cleaned in place
  read: (v: unknown) => { body: Body } | RuleRefusal; // the app's check
}
```

A drafted message step always comes back with `webhook: ''` and a `webhook` pick: the model never picks a
connection.

### Words, templates, summary

`RuleSentencePart`, `automationDayWords`, `sentenceOrList`, `waitWords`, `notifyChip`, `AUTOMATION_NOTIFY_NAMES`;
`AutomationTemplate<Id, Category, Item, Body, Pick>`, `AutomationTemplateFill`, `AutomationTemplatePickAt`, `partAt(body,
path, lists?)` and `picksLeft(body, picks, stillEmpty, lists?)`; `AutomationSummaryLine`, `AutomationSummaryStep`,
`AutomationRuleSummary`, `SUMMARY_AI_STEP`, `looksLikeAddress` and `ruleSummary(rule, words)`.

## The room entry

### Tables (automation-schema.ts)

`AUTOMATION_SCHEMA_STEPS` is the ordered list an app appends to its own schema's steps; each step is `{ name, run }`
where `run` is SQL or a function of the schema's `exec`. A step, once shipped, is never edited.

| Step        | Makes                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| `rules`     | `automation_rules`, `automation_queue`, `automation_runs` and its three indexes       |
| `schedule`  | `automation_schedule`; adds `automation_rules.turn` when it is missing                |
| `hooks`     | `automation_hooks` (a secret's hash, last 4, made and used, the rate minute)          |
| `waiting`   | `automation_waiting`                                                                  |
| `ai_drafts` | `automation_ai_drafts`                                                                |
| `fired`     | `automation_fired`                                                                    |
| `addresses` | `automation_email_addresses`, `automation_email_days`                                 |
| `counts`    | `automation_hook_seen` (each signature a rule took, 10 minutes), `automation_ai_days` |

No table holds an item id. liveplanner registers the same SQL at the versions it shipped under (V18, V19, V20, V22,
V24, V26, V28, V41), by the exported constants; `automationSchemaStep(name)` answers one step.

### What an app hands in

| Where                                | The app hands in                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `AutomationStore`, `ItemAutomations` | `AutomationStoreKit<Rule, EventKind>`: `hears(rule)`, `nextAt(rule, now)`          |
| `ItemAutomations`                    | `sql`, `ready`, `arm` (the room's alarm), `deps` (the app's runner's), `putAway`   |
| `listRuns<Run>`, `settleRun<Run>`    | the stored run's own shape (`StoredRun` is all the log reads)                      |
| `holdRun<Event>`                     | the app's event (`ResumableEvent` is what a resume adds)                           |
| `runWaits(deps, schedule, now)`      | the runner's deps (`WaitsDeps`: `sql()` and `store.get`)                           |
| `hookInfos`, `makeHookSecret`        | `url(ruleId)`: the rule's address on the app's own origin                          |
| `sendMessages<Subject>`              | `AutomationSendsClient<Subject>`: `push(itemId, messages)` over the index's client |
| `sendToAddresses<Mail>`              | `AddressMailer<Mail>`: `optOutDoor`, `optOutPage`, `compose`, `send`               |
| `aiClient(env)`, `ask`               | the app's `AI` binding (`AutomationsAi`) and its gateway id                        |
| `AutomationTally<Category, Action>`  | the app's category and action types; `flush(report)` takes its reporter            |

A run's telemetry calls stay written out in each app (`tally.track('Plan', 'Ran', 'AutomationDone')`), where the
dashboard's emitter scan reads them.

### Behaviour kept from liveplanner

- The store deletes a rule's `automation_hooks` row once its trigger is not `incoming_webhook`, forgets its
  `automation_fired` ids when the rule goes or its trigger's kind changes, and settles its waiting runs Skipped when
  it is turned off or its `edited.at` changes.
- A run's id is claimed (`claimRun`) before anything is done; `runsToday` leaves out No Match and the Audit Trail's
  own lines (`burst:`, `time:`, `derived:`).
- `provesSecret(call, hash, now)` checks a rule with no secret against a dummy hash, so every refusal costs the same
  work. A signature is worked out over `<timestamp>.<body>` and compared whether or not the timestamp is fresh; a
  timestamp missing, not digits, or more than `WEBHOOK_SKEW_MS` off `now` either way then fails the proof.
  `hookReplayed(sql, ruleId, call)` reads whether a proved signature was taken already (the app answers it the same
  401), and `takeHookSignature(sql, ruleId, call, now)` keeps it once the call is accepted, in the same synchronous
  stretch as the read: rows past `WEBHOOK_REPLAY_MS` go on each take (indexed by `at`), and a rule keeps its newest
  `WEBHOOK_SEEN_MAX` (600). A Bearer call keeps nothing.
- `aiToday` reads `automation_ai_days` (one row a day, bumped by `markAiAsked(sql, id, asked, now)` as each call is
  asked, rows before yesterday deleted on a day's first ask) plus Describe a Rule's asks today: two indexed reads,
  never a scan of the Audit Trail's bodies.
- `trimRuns(sql, now)` deletes rows past 30 days (by the `at` index), then counts the runs and the No Matches in one
  read and runs each cap's delete only when its count is over it, so a wake under both caps sorts nothing.
- `sendToAddresses` never throws: each address is sent on its own, one whose send throws (or answers `false` or
  `{ sent: false }`, as an app's sendEmail does for a refusal) is listed as failed, and it answers `{ sent, failed }`
  for the step's line.
- `claimAddresses` is synchronous, and throws (claiming nothing) when the day's count cannot be read.
- Log lines keep their tags: `[automations] paused`, `queue.full`, `waits.due`, `sends`, `sends.failed`,
  `ai.failed`, `email.failed`.
- `runsToday` and `ruleStats` also leave out `budget:` lines (`budgetLineId(ruleId, now)`: one a rule a UTC day, said
  once the day's budget is spent).

## Tests

One test file beside each module (the three wholly moved ones, `schedule`, `email-addresses` and `email-trigger`,
came with their liveplanner tests). The room's run on node:sqlite through `test-sql.ts`. liveplanner's own suites
(items, api, agent-verbs, editor) keep covering the engine end to end through its bindings.
