# Describe a Form blueprint

The spec's [Describe a Form](../describe-a-form.md): a request in words drafted into a form by the AI actions' model,
answered as a preview. Nothing here makes a tab, a card type or a sheet: the editor's Create Form does, through the
paths the starters and Responses Go To already take. Built on Describe a Plan's parts
([blueprint](../../026-plan/blueprints/describe-a-plan.md)), never a copy of them.

## Pure parts (`packages/forms/src/form-draft.ts`)

- `FORM_DRAFT_PROMPT_MAX = 500`, `FORM_DRAFT_MAX_TOKENS = 2000`, `FORM_DRAFT_SECTIONS_MAX = 4`,
  `FORM_DRAFT_QUESTIONS_MAX = 20`, `FORM_DRAFT_OPTIONS_MIN = 2`, `FORM_DRAFT_OPTIONS_MAX = 10`. The texts' limits are
  the form's own (`limits.ts`). The daily cap is `PLAN_DRAFT_PER_DAY` (one budget).
- `FormDraft`: `{ form: FormDefinition, respondsTo: 'board' | 'sheet' }`, the form with no destination, sheet, link
  settings or starter; ids `s-1`, `q-1`, ... (Create Form gives fresh ones).
- `formDraftRequest(prompt, previous?)`: an `AiRequest` as `planDraftRequest` builds one: the fixed system message
  (the task, Describe a Plan's data rule, the thirteen types with what each holds, the caps, the two outcomes), the
  user message `JSON.stringify({ request })` alone, a retry adding `{ previous: { refused: "<path>: <message>" } }`.
  The schema: `{ outcome: 'form' | 'not_a_form', form: { heading, description, respondsTo, sections: [{ title,
description, questions: [{ type, prompt, help, required, options, other, scale, style, lowLabel, highLabel, min,
max, whole }] }] } }`, the types an enum; the checks below are what holds, not the schema.
- `readFormDraft(reply, prompt)`: `{ off: true }` | `{ draft }` | `{ refused: { path, message } }`. Lists cut to one
  past their cap before they are walked and texts through `draftText` (`@liveplanner/items`: control characters,
  links the request lacks, cut to twice the limit first), so a hostile reply reads in linear time. Each question is
  held to its type (options 2 to 10 and distinct for a choice; a scale 3 to 10; bounds finite and in order; picks
  whole and within the options), every prompt given; then `checkFormDraft`.
- `checkFormDraft(form)`: the caps (1 to 4 sections, 1 to 20 questions), then `readForm(form)` must give back as many
  sections and questions, each question with what it was drafted with (options, scale), else a refusal at the place
  readForm would have dropped.
- Words: `FORM_DRAFT_OFF_TOPIC`, `FORM_DRAFT_UNREADABLE`, `FORM_DRAFT_CAPPED`; a failed ask and no model reuse
  `PLAN_DRAFT_FAILED` and `PLAN_DRAFT_NOT_SET_UP`. `PLAN_DRAFT_CAPPED` now names the shared budget.

## Create Form's plan (`packages/templates/src/form-draft-start.ts`)

- `FormDraftTarget`: `{ to: 'new-board' } | { to: 'board', tabId, elementId } | { to: 'new-sheet' } | { to: 'sheet',
tabId, sheetId }`. `formDraftTargets(tabs, formTabId)`: the menu, boards by `boardsOf`, sheets by `sheetsOf`.
- `planFormDraft({ draft, target, formTab, tabs, types, statusNames, newSheetId, random })`: the form with fresh ids
  (`newFormPartId`); to a board, a new type (`starterBaseType` Blank, `uniqueTypeLabel(heading)`), the first Short
  Answer to Title, `withQuestionFields(form, type)` for the rest; a new board from `responsesBoardTab(..., { typeId })`
  taking that type alone, an existing one `withBoardTaking` and its first column the type uses (`columnForType`); a
  board that is gone falls back to a new one. To a sheet, `responsesSheetTab` or the sheet named. Answers `{ form,
type | null, newTab | null, changedTab | null, newSheet | null }`, the shape `startForm` commits.

## The api (`apps/api/src/routes/form-drafts.ts`)

- `POST /api/form-drafts`, its own segment in `index.ts`, the manifest and the error-telemetry route list. Signed in
  (`ctx.verifiedUserId`), else 403 `form_draft_needs_account` for a guest and 401 for nobody; a prompt of 1 to 500
  (400 `form_draft_invalid`); `aiClient` (503 `form_draft_unavailable`, not set up); `spendPlanDraft` (the shared
  count; 429 `form_draft_capped`, 503 when unreadable); then `askForDraft` (below). Logs `[form-draft]` with answer,
  asks, tookMs, refused path, sections and questions.
- `apps/api/src/routes/draft-asks.ts` `askForDraft({ client, gateway, request, read, onAsk })`: the ask, `readAiReply`,
  the reader and the one retry with the check's words, shared with `plan-drafts.ts` (which now uses it).
- `packages/api-schema/src/form-drafts.ts`: `FormDraftRequest`, `FormDraftResponse { draft }`, `FORM_DRAFT_ERRORS`,
  `FormDraftErrorBody`.

## Editor

- `components/describe/DescribePrompt.tsx`: the box, its count, the examples, the refusal and the AI line, and
  `DescribeSignIn` (the nudge), shared by `DescribePlanDialog` and `DescribeFormDialog`.
- `components/forms/describe-form/`: `form-draft-client.ts` (`draftForm`, `FormDraftRefusal`), `DescribeFormDialog`
  (words, then Check Your Form), `FormDraftPreview` (the questions as `QuestionView` draws them, disabled, and the
  Responses Go To menu), `DescribeFormHost` (bound to the editor: signed in, the targets, Create Form through
  `ctx.forms.startDraftedForm`), `DescribeFormButton` (an entry: the button and its dynamically loaded host).
- `useFormActions.startDraftedForm(draft, target)`: `planFormDraft`, then one `commitTabs` (the Form tab and any new or
  changed tab), `markTabLoaded`, `makeSheet` for a new sheet, `saveType` for the type, `track('Form', 'Created',
'FormDraft')`.
- Start Planning: a `describe-form` item in Forms after Blank Form, `onDescribeForm` (an Editor's: `canImport` and a
  plan, as Describe a Plan).
- `FormConnectCard` (the third line) and `FormBuilderColumn`'s empty card (its action), each only while the form has
  no questions and the builder is editable.

## Tests

- `form-draft.test.ts`: valid; not a form; unknown types; a choice with one option or repeats; over the caps; texts
  cut and links dropped; readForm's whole-form check; the ask's size and data rule.
- `form-draft-start.test.ts`: new board, existing board, new sheet, existing sheet, a board gone.
- `form-drafts.test.ts` (api): 401, 403, 400, 405/404, not set up, the shared cap (a plan's draft spends it), the
  retry with the check's words, off topic, failed, nothing logged.
- `DescribeFormDialog.test.tsx`: the nudge, Draft Form, a refusal said, the preview, Create Form's target.
