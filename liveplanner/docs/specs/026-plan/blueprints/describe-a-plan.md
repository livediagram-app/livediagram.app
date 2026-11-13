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
  limit before a pattern reads it (`draftText` from `automation/ai-draft.ts`: control characters, links the request
  lacks, via ai-steps' `dropForeignLinks`), so a hostile reply reads in linear time. A glyph Plan lacks becomes
  `star`; colours come from `PLAN_DRAFT_COLOURS` (the type colours, darkest left out) in turn; built-in fields by
  name or id, unknown ones dropped, Description and Assignee always kept; options dropped from kinds that hold none.
  Only `title`, `columns` and `cardTypes` are read: anything else the reply holds is dropped. Then `checkPlanDraft`.
- `checkPlanDraft(draft)`: the board through `placeBoard({ title, columns }, [], [], …)`, then the draft's own caps
  (types, fields, options, kinds), then the types as `add` changes (`planDraftChanges`) through
  `applyCardTypeChanges(null, changes, the board's statuses)`. `{ ok: true, board, changes }` or `{ ok: false, path,
message }`, the path the place at fault (`columns`, `cardTypes.1.fields.3.kind`). The editor's preview runs the same
  check on what the person changed.

## The api (apps/api/src/routes/plan-draft-route.ts, plan-draft-count.ts)

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

- `components/plan/start/describe-plan/`: `plan-draft-client.ts` `draftPlan(prompt)`; `DescribePlanDialog.tsx` (the
  shared `Dialog` with `phoneSheet`, `DialogHeader`, `TextArea`, the examples as secondary Buttons, the `AiNote`
  sparkle line), its states (idle, drafting, said, preview); `PlanDraftPreview.tsx` (the board's title and column
  chips, each type's fields, every problem from `checkPlanDraft` beside its place); `make-plan.ts` (Make Plan: the
  board placed as Start Planning places one, the types the plan lacks added through the catalogue save, a type the
  plan has kept); the rail entry and its search card in `StartPlanning.tsx`; the sign-in nudge for a guest.

## Tests

- items `plan-draft.test.ts`: the request (the request alone in the user message, the schema's enums and caps), the
  measured ask; the reader: off topic, a plan that reads, names cut and cleaned of links and control characters, a
  glyph Plan lacks, built-in fields by name, options dropped from kinds without them, extra keys dropped, every cap
  refused with its path, an injected request whose reply tries other kinds or keys, a huge reply (linear time), the
  board's and the catalogue's refusals.
- api `plan-draft-route.test.ts` with a stand-in `env.AI` and a stand-in `PLAN_ROOM`: drafted, off topic, a retry
  that reads, a retry that doesn't, the 10 a day per account (another account unaffected, a new UTC day), the count
  unreadable, no binding, a throwing and a slow model, who (guest 403, nobody 401, a token 200), the prompt never
  logged, nothing written but the count.
- api `plan-draft-count.test.ts`: `spendPlanDraft` on a room's storage, the day turning over, the reserved name.

## Cost (measured in plan-draft.test.ts "measures the ask")

| Ask                       | System | User | Schema | Tokens in   | Neurons (2,000 out) |
| ------------------------- | ------ | ---- | ------ | ----------- | ------------------- |
| A 500-character request   | 4,400  | 520  | 1,100  | about 1,500 | about 69            |
| A typical (150) request   | 4,400  | 170  | 1,100  | about 1,420 | about 13 + output   |

Characters, four to a token; Neurons at 9,091 per million in and 27,273 per million out (automations spec "Cost"). A
typical reply is about 350 tokens, so a typical draft is about 24 Neurons.
