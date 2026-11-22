# Steps in other apps blueprint

Derived from [Automations](../automations.md) "Steps in other apps". Five step kinds every app's rules hold, one
index route that checks the author and signs the grant, one internal door every target app serves, and the builder's
panels. Nothing here is a new Worker, queue or binding: the apps already reach the index over `INDEX`, and the index
already calls each app's internal doors with the app's key (`app-calls.ts`). The index gains one D1 migration (the
author's day count and the Inbox notices).

## Flow

```
source item's room ── POST /app/items/:source/automation-steps ──▶ index (app key)
   step, author, rule, chain, key                                     │ source is the caller app's
                                                                       │ chain: same rule? 3 hops?
                                                                       │ author's day: 500?
                                                                       │ loadItem(target, author, need)
                                                                       │ mintGrant(author, target, level)
                                                                       ▼
                       target app ◀── POST /api/internal/items/:target/automation-step (index key, X-Index-Grant)
                          verifyGrant: audience, item, sub = author, level ≥ need, whole item
                          the write, as the author, marked Automation · <rule>, chain carried into its events
```

`inbox_notice` stops at the index: it writes the notices itself (the people must reach the source item).

## Wire (`@liveworkspace/index-client`, src/automation-steps.ts)

- `CrossAppTarget = { app, item, title }`; `CrossAppChain = { id, hops, rules: string[] }` (`<app>:<item>:<rule>`,
  at most `CROSS_APP_HOPS_MAX + 1` entries).
- `AutomationStepPush = { key, author, rule: { id, name }, from: { title, url }, chain, step }`: what a room sends.
  `step` is one of the five kinds below, its texts already filled.
- `AutomationStepAnswer = { ok: true, text, link? } | { ok: false, code, reason }`, `code` one of `no_access`,
  `loop`, `chain_long`, `capped`, `target_gone`, `invalid`, `failed`, `unavailable`.
- `AutomationStepDoorCall = { author, rule, from, chain, step }` with the grant in `X-Index-Grant`: what the index
  sends the target.
- `AutomationTargetDescription`: what a target offers the picker: a plan's `boards` (id, name, columns), a
  knowledgebase's `pages` (id, name, parent), a document's `templates` (id, name), a Space's `tabs` (id, name).
- Constants: `CROSS_APP_HOPS_MAX` 3, `CROSS_APP_RULE_DAY_MAX` 100, `CROSS_APP_AUTHOR_DAY_MAX` 500,
  `CROSS_APP_STEPS_MAX` 5, `CROSS_APP_NOTICE_PEOPLE_MAX` 10; `CROSS_APP_KIND_APPS` (which apps each kind targets).
- `IndexAppClient.pushAutomationStep(itemId, push)` and `IndexClient.automationTarget(itemId)` (a person's read,
  `GET /items/:id/automation-target`, Editor).

## Kinds (`@liveworkspace/automations`, src/cross-app/)

```
src/cross-app/
  types.ts      the five step shapes
  kinds.ts      crossAppActions(): ActionKind definitions (read, defaults, words, would, summary, format)
  chain.ts      ruleKeyOf, chainOf(event), chainStop(chain, key), CROSS_CHAIN_* words
  words.ts      targetWords, the Audit Trail's words per answer code
  index.ts
```

| Kind           | Fields                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `plan_card`    | `target`, `board`, `column` (a column's name), `title`, `description`, `assignee?` (a person id or a |
|                | value naming one), `dueDays?` (0 to 365), `linkBack` (bool), `skipIfOpen` (bool)                     |
| `kb_page`      | `target`, `parent?` (a page id), `title`, `body` (Markdown)                                          |
| `space_post`   | `target`, `tab` (a tab id), `text`                                                                   |
| `doc_tab`      | `target` (livedocuments or livediagram), `template`, `name`                                          |
| `inbox_notice` | `to` (1 to 10 of `{ person }` or `{ value }`), `text`                                                |

- Every kind is `top`: never inside an If / Else (its answer can pause the rule). A rule holds at most
  `CROSS_APP_STEPS_MAX` of them (`checkCrossAppCap`, called by `readItemRule` and liveplanner's check).
- `defineItemKinds` adds them after the shared steps, untouched by `inTabWords` (a knowledgebase's "Add a Tab to a
  Document" names a document's tab). liveplanner adds the same definitions' readers and words to its own check.
- `target.item` must not be the item itself (`automation_invalid`); `target.app` must be one the kind targets.

## Running (`@liveworkspace/automations/room`, src/room/cross-app.ts)

- `CrossAppClient = { push(itemId, push): Promise<AutomationStepAnswer> }` over the index app client
  (`kitCrossApp(client)` in src/room/app/kit-cross-app.ts).
- `runCrossAppStep(input)` answers a `StepOutcome`: Done with the target's words; `no_access` and `target_gone`
  fail with `pause: true` (the engine pauses the rule at once, `store.pauseNow`); `loop`, `chain_long` and `capped`
  are `skip: true` (the run ends Skipped once the rest is done, as the AI cap's); anything else fails.
- The per-rule day: `crossAppRunsToday(sql, ruleId, now)` counts the rule's runs today that were not No Match (the
  `automation_runs (rule_id, at)` index); at 100 the step is skipped without asking.
- `ItemEvent.cross` (and the writer window's `who.cross`) carries a chain into a room; a run's chain is the event's,
  or a fresh one (`id` the run id, `hops` 0). `StepOutcome` gains `pause?` and `skip?`; `ItemActionContext` gains
  `author` (the rule's `edited.by`), `runId` and `stepIndex` (the push's key is `runId:stepIndex`).

## The index (liveworkspace/apps/index)

```
src/automation-steps.ts         POST /app/items/:id/automation-steps (app-routes.ts), GET /items/:id/automation-target
src/automation-step-notices.ts  inbox_notice: the notices written, the Inbox read of them
migrations/0028_automation_steps.sql
```

| Table                  | Holds                                                                             |
| ---------------------- | --------------------------------------------------------------------------------- |
| `automation_step_days` | `(person_id, day)` → `count`: an author's steps in other apps a UTC day           |
| `automation_notices`   | `id`, `person_id`, `app`, `item_id`, `rule`, `text`, `at`: the Notify step's rows |

- The day's count is one statement, `INSERT … ON CONFLICT DO UPDATE SET count = count + 1 … RETURNING count`, taken
  only after a target answered Done; rows before yesterday go on the day's first write. A step past 500 is refused
  before any target is asked (`capped`).
- The access read is `loadItem(env, target, { person: { id: author, kind: 'account', teams: [] } }, need)`: the
  owner, a team (read fresh from accounts, `inTeamNow`), a live link at its level, the Trash. Any refusal is
  `no_access`, whatever it was, so a rule learns nothing of an item it cannot reach. A target of another app than
  the kind's is `invalid`.
- The grant is `mintGrant` for the author at the access's level and tab; the call is `callAppJson` with
  `X-Index-Grant`, `APP_CALL_TIMEOUT_MS`.
- Notices: each person named must reach the source item (`loadItem` at view), at most 10 a step; their rows show in
  `GET /inbox` as `notices` (newest 50, 30 days), each `{ id, app, itemId, itemTitle, rule, text, at }`.

## The door (`@liveworkspace/index-app`, src/automation-step-door.ts)

`handleInternalItems` serves `POST /api/internal/items/:id/automation-step` and `POST …/automation-target` with the
index's key, then checks the grant with the app's `verifyGrant` (the option every app passes:
`indexService.verifyGrant`): signed by the index, for this app and item, its subject the call's author, its level at
least the step's need, and not confined to a tab. A failed check is 403 `grant_refused` (the index reads it as
`no_access`). It then hands the app's handler the call and the claims:

```ts
automationStep?: (itemId: string, call: VerifiedStepCall) => Promise<AutomationStepAnswer>;
automationTarget?: (itemId: string, grant: GrantClaims) => Promise<AutomationTargetDescription>;
```

| App           | Serves       | Writes through                                                                   |
| ------------- | ------------ | -------------------------------------------------------------------------------- |
| liveplanner   | `plan_card`  | the room's card create (as Email to Board makes one): one op, the author's stamp |
| liveknowledge | `kb_page`    | create_page's path (`newPageFromMarkdown`, `upsertTabAtRev`, `notePageWrite`)    |
| livehuddle    | `space_post` | an agent changeset's element add: one sticky on the tab                          |
| livedocuments | `doc_tab`    | `addTemplateTab` (Add a Tab from a Template's own)                               |
| livediagram   | `doc_tab`    | `addTemplateTab`                                                                 |

Each write runs inside the room's writer window `{ who: { by: author, role: 'automation', cross: chain }, own: true }`
(item apps) or with liveplanner's source `{ role: 'automation', cross: chain }`, so the events it queues carry the
chain and none is an edit.

## The builder (`@liveworkspace/automations-ui`, src/cross-app/)

```
src/cross-app/
  cross-app-kit.tsx       the five tiles (name, line, glyph, scene, first form, panel), merged into every kit's actions
  cross-app-group.ts      Add a Step's In Other Apps group: badged New, "Every step acts as you, …" under the tiles
  cross-app-art.tsx       each tile's glyph and scene
  TargetPicker.tsx        the Connect picker for a step: Recent across apps by kind, View Only rows with a lock
  TargetField.tsx         the target row (Pick, Change), then its lists once read; a failed read offers Try Again
  use-cross-target.ts     a target's boards, pages, tabs or templates, read once (automationTarget), the newest 10 kept
  cross-app-panels.tsx    the five panels: pickers, field chips (Insert a Field), the live preview
  CrossAppPreview.tsx     the preview: each text as it lands, its values as chips
  CrossAppRuleCard.tsx    beside the steps: Runs As, Reaches, Limits, Last Runs in the Audit Trail
```

liveplanner's kit (apps/editor/components/automations) merges the same tiles, group and panels.

A rule paused on lost access (`isAccessPause`: `Stopped: no access …` or no author) offers **Take Over Rule** on its
row and in a banner over its Audit Trail runs: the screen saves the rule as it stands (the save stamps the person as
its author) and turns it on. A template's empty target is a pick (`target`, "Pick where it goes"), so the builder
marks it until it is picked.

## Tests

- Kinds: each read, refusal, sentence and dry run; the cap of 5; the item itself refused (`cross-app/*.test.ts`).
- Chain: the same rule twice, the fourth hop, a fresh chain (`chain.test.ts`).
- Room: Done, no access pauses at once, loop and cap skip, the per-rule day (`room/cross-app.test.ts`).
- Index: the route's every refusal, the grant's claims, the day count, a target the author cannot reach answering
  `no_access` (the privilege test: a rule never reaches what its author cannot), notices.
- Door: a grant for another item, another person, a lower level, a tab-scoped grant, no grant: each refused.
- Each target app: its write, the author's stamp, the chain carried into its next run.

## Cost

Measured in `src/cross-app/cross-app.perf.test.ts` and the index's route test, Apple-silicon laptop, 2026-11-22: see the
PR's Performance section. A rule with no step in other apps pays nothing: the kinds are read only where a step names
them, and the per-rule day is read only before such a step.
