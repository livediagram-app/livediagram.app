# Describe a Plan (Work Item 760)

The spec's [Describe a Plan](../describe-a-plan.md): a request in words drafted into a board's columns and card types
by the AI actions' model, answered as a preview of names. Nothing here makes a board or a card type: the editor's
Make Plan does, through the paths Start Planning and the type editor already take.

## Pure parts (packages/items/src/plan-draft.ts)

- `PLAN_DRAFT_PROMPT_MAX = 500`, `PLAN_DRAFT_PER_DAY = 10`, `PLAN_DRAFT_MAX_TOKENS = 2000`, `PLAN_DRAFT_TYPES_MAX = 4`,
  `PLAN_DRAFT_FIELDS_MAX = 8`, `PLAN_DRAFT_OPTIONS_MAX = 8`; `PLAN_DRAFT_FIELD_KINDS` (the nineteen kinds the spec
  lists, each in `OFFERED_FIELD_KINDS`) and `PLAN_DRAFT_BUILT_INS` (`priority`, `labels`, `estimate`, `start`,
  `due`, `checklist`). The board's caps are the board's own (`PLAN_COLUMNS_MAX`, `PLAN_COLUMN_NAME_MAX`,
  `PLAN_TITLE_MAX`), a type's and a field's the catalogue's (`ITEM_TYPE_LABEL_MAX`, `CUSTOM_FIELD_LABEL_MAX`,
  `CUSTOM_CHOICE_OPTION_MAX`).
- `PlanDraft`: `{ title, columns: string[], cardTypes: { name, color, glyph, builtInFields: ItemFieldId[], fields: {
name, kind, options? }[] }[] }`, names only, the shape the preview edits.
- `planDraftRequest(prompt, previous?)`: `{ messages, response_format, max_tokens, temperature: 0 }` as `aiRequest`
  is. The system message is fixed: the task, the data rule, the caps, the kinds, the built-in fields, the glyphs and
  the two outcomes. The user message is `JSON.stringify({ request })` alone; a retry adds `{ previous: { refused:
"<path>: <message>" } }` with the check's words, never the model's earlier text. The schema: `{ outcome: 'plan' |
'not_a_plan', plan: { title, columns, cardTypes } }`, the kinds and glyphs as enums, the lists' `maxItems` the
  caps; the checks below are what holds, not the schema.
- `readPlanDraft(reply, prompt)`: `{ off: true }` for `not_a_plan`; `{ draft }` for a plan that reads; `{ refused: {
path, message } }` otherwise. Every list is cut to one past its cap before it is walked and every text to twice its
  limit before a pattern reads it (`draftText` from `packages/items/src/automation/ai-draft.ts`: control characters, links the request
  lacks, via ai-steps' `dropForeignLinks`), so a hostile reply reads in linear time. A glyph Plan lacks becomes
  `star`; colours come from `PLAN_DRAFT_COLOURS` (the type colours, darkest left out) in turn; built-in fields by
  name or id, unknown ones dropped, Description and Assignee always kept; options dropped from kinds that hold none.
  Only `title`, `columns` and `cardTypes` are read: anything else the reply holds is dropped. Then `checkPlanDraft`.
- `checkPlanDraft(draft, plan?, random = () => 0)`: `plan` is `PlanDraftPlan` `{ catalogue, statuses }`, the plan the
  draft would join (absent: an empty plan, as the reader checks a reply). The board through `placeBoard({ title,
columns }, [], plan.statuses, …, random)`, so a column named as a status the plan has takes it; then the draft's own
  caps (types, fields, options, kinds), skipping a type `keptPlanDraftTypes(draft, catalogue)` finds the plan already
  has (by name, `statusKey`); then the other types as `add` changes (`planDraftChanges`) through
  `applyCardTypeChanges(plan.catalogue, changes, the board's statuses)`. `{ ok: true, board, setup, changes, kept,
catalogue }` (the placed board's set-up, the kept types' indexes, the catalogue with the new types) or `{ ok: false,
path, message }`, the path the place at fault (`columns`, `cardTypes.1.fields.3.kind`).

## The preview's checks and Make Plan (packages/items/src/plan-draft-preview.ts)

- `planDraftProblems(draft, plan?)`: every problem as `{ path, message }`, in the preview's order: the board's name
  (`title`), no columns (`columns`), each column empty or a second of one name (`columns.<i>`), no card types
  (`cardTypes`), each type's name (`cardTypes.<i>.name`), and, for every type the plan lacks, each field's name
  (`cardTypes.<i>.fields.<j>.name`) and each option (`….options.<k>`); only when none stands, `checkPlanDraft`'s one
  refusal at its path. Empty: Make Plan may go. Linear in the draft (four types, eight fields, eight options).
- `planFromDraft(draft, plan, random = Math.random)`: `checkPlanDraft` with a fresh status suffix, then `{ ok: true,
setup, newTypes }`: the set-up with `addTypes` every drafted type's id (the plan's own where kept, the new one's where
  added, by name), and `newTypes` the catalogue's types the plan's lacked. Or the refusal.

## The api (apps/api/src/routes/plan-drafts.ts, plan-draft-count.ts)

- `POST /api/plan-drafts` `{ prompt }`, its own segment in index.ts's dispatch. Who: `verifiedUserId` (signed in, a
  full API token or a workbench session; a read-only token is refused at the write choke point). A guest is 403
  `plan_draft_needs_account`; no identity 401 `unauthorized`. Answers `200 { draft }`, or: `400 plan_draft_invalid`
  (empty or over 500), `422 plan_draft_off_topic`, `422 plan_draft_unreadable`, `429 plan_draft_capped`, `503
plan_draft_unavailable` (no binding, a model error, slow, or a count that can't be read: `AI_NOT_SET_UP` or
  `AI_DRAFT_FAILED`).
- The ask goes through `ask()` (the 15 s race and the gateway) and `readAiReply`, with `AUTOMATION_AI_MODEL`.
- **The count** (`plan-draft-count.ts`): one instance of the worker's existing `PLAN_ROOM` namespace per account,
  named `~plan-drafts:<account id>` (no plan id starts with `~`: they are server-minted UUIDs), so there is no new
  binding, class or migration, as livediagram's daily reader cap keeps its count in a reserved `PERSON_STORE`
  instance. Its one RPC, `PlanRoom.spendPlanDraft(day, cap)`, reads and writes one storage key (`plan-drafts`, `{
day, count }`) and never touches the plan schema, so the instance stays a room with no plan: no route, index push
  or alarm reads it. True when the draft may go ahead (and is counted), false at the cap. Only a draft's first ask is
  counted; its second rides it. A stub that throws refuses the draft (503), so a fault never lifts the cap.
- Telemetry and the log as the spec says, through `ctx.waitUntil`.

## api-schema and the manifest

`packages/api-schema/src/plan-drafts.ts`: `PlanDraftRequest`, `PlanDraftResponse` (`{ draft: PlanDraft }`),
`PLAN_DRAFT_ERRORS` and `PlanDraftErrorBody`. The route in `openapi/manifest.ts` (segment `plan-drafts`, tag `Plans`),
`schemas.generated.ts` regenerated. Telemetry types `PlanAiDraft`, `PlanAiOffTopic` (api) and `PlanDescribe`,
`PlanDraft` (editor) in `telemetry-schema.ts`, charted on the liveworkspace site's liveplanner catalogue.

## Editor (part 2)

All in `apps/editor/components/plan/start/describe-plan/`:

- `plan-draft-client.ts`: `draftPlan(ownerId, prompt)`, `POST ${API_BASE}/plan-drafts` with `apiHeaders(ownerId, {
body: true })`; a `plan_draft_*` body with a `message` throws `PlanDraftRefusal(status, code, message)`, anything
  else goes to `expectOk`.
- `DescribePlanDialog.tsx`: the shared `Dialog` (`size="xl"`, `phoneSheet`, a column at most 46rem or 90dvh tall),
  `DialogHeader` with the sparkle, `TextArea` (500, the count), `DESCRIBE_PLAN_EXAMPLES` as secondary `xs` Buttons,
  `AiNote` ("Uses AI: you can describe 10 plans a day."). States: the words (idle, drafting with `busy` and the box
  read-only, said: a `role="alert"` amber line), the guest's nudge (`DESCRIBE_PLAN_SIGN_IN`, Sign In to
  `signInHref`), and the preview (a draft held in state, the heading focused). A stale answer (after Cancel or
  unmount) is dropped by an ask counter, as Describe a Rule's is. Problems from `planDraftProblems(draft, plan)`,
  memoised on the draft; Make Plan disabled while any stands; `onMake(draft)` answers null (made) or the words to say.
- `PlanDraftPreview.tsx`: the Drafted by AI note, the board (name, `NameChips` of columns), the card types
  (`PlanDraftTypeCard`), Add Card Type. `PlanDraftTypeCard.tsx`: one type (`CardTypeTile`, name, Shows chips, field
  rows with the shared `Select` of `PLAN_DRAFT_FIELD_KINDS` named by `CUSTOM_KIND_LABELS`, options as `NameChips`), or
  the kept type read-only. `NameChips.tsx`: renamed-in-place chips with × and Add, the new one focused and selected;
  `ProblemText` (rose, `role="status"`). `draft-edits.ts`: `freshName`, `withKind`, `newDraftType`, `problemsByPath`.
- `DescribePlanHost.tsx`: the dialog bound to the editor (`useEditorContext`): signed in is `accountUserId`; the plan
  is the stored catalogue, else the types the plan shows, with `planOutline(tabs, catalogue).statuses`; the sign-in
  return is this page. Make Plan: `planFromDraft`, then `itemTypes.addTypes(newTypes)` (one change), then
  `planTabs.startElementTab('board', () => dropPaletteItem('plan-board', centre, { planBoard: setup }))`, which places
  it through `planBoardSized` (lib/plan-board-placement.ts), then `Plan · Created · PlanDraft` and close. Opening
  sends `UI · Opened · PlanDescribe`.
- `DescribePicture.tsx`: the search card's picture. `start-planning-items.ts`: `DESCRIBE_ITEM` (kind `describe`, its
  own search group after Inspiration and before Import). `StartPlanning.tsx`: `onDescribe` gives the rail entry
  (`footLead`, the shared StartPanel's entries above Connect File, `ConnectRailEntry`'s `lead`) and the card.
  `EditorStartPanels.tsx` gives `onDescribe` where Import is offered (an Editor's) and mounts the host, loaded with
  `next/dynamic`, while it is open.

## Tests

- items `plan-draft.test.ts`: the request (the request alone in the user message, the schema's enums and caps), the
  measured ask; the reader: off topic, a plan that reads, names cut and cleaned of links and control characters, a
  glyph Plan lacks, built-in fields by name, options dropped from kinds without them, extra keys dropped, every cap
  refused with its path, an injected request whose reply tries other kinds or keys, a huge reply (linear time), the
  board's and the catalogue's refusals.
- api `routes/plan-drafts.test.ts` with a stand-in `env.AI` and a stand-in `PLAN_ROOM`: drafted, off topic, a retry
  that reads, a retry that doesn't, the 10 a day per account (another account unaffected, a new UTC day), the count
  unreadable, no binding, a throwing and a slow model, who (guest 403, nobody 401, a token 200), the prompt never
  logged, nothing written but the count.
- api `plan-draft-count.test.ts`: `spendPlanDraft` on a room's storage, the day turning over, the reserved name.
- items `plan-draft-preview.test.ts`: every problem at its place, the fallback to the whole check, a kept type never
  asked to be fixed and its caps skipped, a column taking the plan's status, the catalogue's cap, and `planFromDraft`
  (only the new types, the board taking every type, the new types on the new board's statuses).
- editor `DescribePlanDialog.test.tsx` (the words, busy, Cancel dropping a late answer, a refusal's words and a
  failure's, the guest's nudge, the preview's edits, problems holding Make Plan, a kept type, Back),
  `describe-plan-parts.test.tsx` (the client, the edit parts, the host's Make Plan and telemetry),
  `StartPlanning.describe.test.tsx` (the rail entry above Connect File and Import, alone without Connect File, none for
  a Participant or Viewer, the search card). workbench `StartPanel.test.tsx`: `footLead`'s order.

## Cost (measured in plan-draft.test.ts "measures the ask")

| Ask                     | System | User | Schema | Tokens in   | Neurons (2,000 out) |
| ----------------------- | ------ | ---- | ------ | ----------- | ------------------- |
| A 500-character request | 2,880  | 514  | 1,808  | about 1,300 | about 66            |
| A typical request       | 2,880  | 169  | 1,808  | about 1,210 | about 11 + output   |

Characters, four to a token; Neurons at 9,091 per million in and 27,273 per million out (automations spec "Cost"). A
typical reply is about 200 tokens, so a typical draft is about 17 Neurons. A reply at every cap is 5,334 characters
("measures the reply at every cap"), about 1,500 tokens, inside the 2,000.
