# Forms blueprint

Derived from [Forms](../forms.md). Implementation contracts: files, types, constants, routes, tables and tests.

## 1. Packages and placement

| Concern                                                                                          | Home                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The form model, sanitiser, answers, mapping, response → card, starters, destination, public form | `packages/forms` (`@liveplanner/forms`, pure: `model`, `limits`, `read`, `answers`, `mapping`, `card`, `starters`, `destination`, `public`, `ids`)                                                                                                                                                  |
| The `form` tab kind, `Tab.form`                                                                  | `packages/project` (`tab-kind.ts`, `index.ts`)                                                                                                                                                                                                                                                     |
| Multiple Choice and Rating field kinds                                                           | `packages/items` (`item-types.ts`, `type-catalogue.ts`, `card-text.ts`, `board-csv.ts`, `type-changes.ts`, `plan-names.ts`); agents in `packages/agent-verbs/src/plan/plan-listing.ts` and `packages/agent-verbs/src/mcp/plan-schema.ts`                                                            |
| Wire DTOs (`FormLinkResponse`, `PublicFormResponse`, `FormResponseBody`, report reasons)         | `packages/api-schema` (`forms.ts`); the Inbox's `ActivityFormResponses` in `activity.ts`; `/form` in `page-views.ts`; `forms` in `error-telemetry.ts`; `Form` in `telemetry-schema.ts`                                                                                                              |
| `form_links`, `form_reports`, `form_reads`                                                       | `apps/api/migrations/0001_liveplanner_baseline.sql`, `apps/api/src/db/forms.ts`, the Inbox read `apps/api/src/db/activity-forms.ts`                                                                                                                                                                 |
| Owner routes, public routes, the response write                                                  | `apps/api/src/routes/form-link-routes.ts`, `apps/api/src/routes/forms.ts`, `apps/api/src/forms/respond.ts`, `apps/api/src/forms/form-tab.ts`                                                                                                                                                        |
| Emails                                                                                           | `apps/api/src/email/templates.ts` (`formResponseEmail`, `formSuspendedEmail`), `notifications.ts` (`notifyFormResponse`, `notifyFormSuspended`)                                                                                                                                                     |
| The Form tab                                                                                     | `apps/live/components/forms/FormPage.tsx` and `components/forms/builder/*`; actions in `apps/live/hooks/forms/*`                                                                                                                                                                                    |
| A colour background's colours (a form's cover)                                                   | `packages/page-background` (`@liveplanner/page-background`, pure: `PageColourFill`, `ColourBackground`, `PAGE_PATTERNS`, `PAGE_MOTIONS`, `parseColourBackground`); `@liveplanner/project` re-exports it                                                                                            |
| Form templates (one a starter)                                                                   | `packages/templates/src/form-templates.ts` (`FORM_TEMPLATES`, `isFormTemplateKind`, `formTemplateStarter`; `editorOnly`); `packages/template-previews/src/template-preview-24.tsx`; `apps/live/lib/pending-form-start.ts`, `components/forms/PendingFormStart.tsx`, `useTemplateFlow`'s `startForm` |
| Start Planning's Forms                                                                           | `apps/live/components/plan/start/start-planning-items.ts`, `StartPlanning.tsx`, `packages/template-previews/src/form-starter-picture.tsx`                                                                                                                                                           |
| The form page                                                                                    | `apps/live/app/form/[code]/page.tsx` → `components/forms/respond/*`; the worker rewrite in `apps/live/src/worker.ts`; `apps/live/lib/form-path.ts`                                                                                                                                                  |
| The Inbox, the New mark, the panel line                                                          | `apps/live/components/panels/activity-pane-parts.tsx`, `components/forms/fresh-responses.ts`, `NewResponseMark.tsx`, `components/plan/ItemPanelLayout.tsx`                                                                                                                                          |

`@liveplanner/forms` depends on `@liveplanner/items`, `@liveplanner/sheets` and `@liveplanner/page-background` (never on
`@liveplanner/project`, which depends on it for types, as `@liveplanner/api-schema` does).

## 2. Model (`packages/forms/src/model.ts`)

```ts
export const QUESTION_TYPES = [
  'short',
  'paragraph',
  'number',
  'email',
  'link',
  'date',
  'single',
  'multi',
  'rating',
  'checkbox',
] as const;

export type AnswerTarget =
  | { to: 'description' } // also what an absent `goesTo` reads as
  | { to: 'title' }
  | { to: 'field'; fieldId: string };

export interface FormQuestion {
  id: string;
  type: QuestionType;
  prompt: string; // '' reads as 'Untitled Question'
  help?: string;
  required?: true;
  placeholder?: string;
  options?: string[];
  other?: true;
  dropdown?: true; // single, multi
  min?: number;
  max?: number;
  whole?: true; // number; multi: picks
  scale?: number;
  style?: 'stars' | 'numbers';
  lowLabel?: string;
  highLabel?: string; // rating
  goesTo?: AnswerTarget;
}
export interface FormSection {
  id: string;
  title: string;
  description?: string;
  questions: FormQuestion[];
}
export interface FormDestination {
  tabId: string;
  typeId: string;
  status: string;
}
// A colour background (@liveplanner/page-background): a solid or gradient fill (a moving one included) and a
// pattern; no picture. Read with parseColourBackground.
export type FormCover = ColourBackground; // { fill?: PageColourFill; pattern?: PagePattern }
export interface FormDefinition {
  v: 1;
  heading: string;
  description?: string;
  accent?: string;
  cover?: FormCover;
  sections: FormSection[];
  destination?: FormDestination;
  closesAt?: number;
  limit?: number;
  confirmation?: string;
  closedMessage?: string;
  starter?: StarterId;
}
```

`readForm(raw)` sanitises: unknown keys dropped, strings trimmed and capped, ids checked (`/^[a-z0-9-]{1,24}$/`),
repeated sections and questions dropped, settings out of range dropped, a question of an unknown type dropped,
Title kept by the first question claiming it, an empty `sections` given one empty section. It never throws; `null`
only when `raw` is not an object. `QUESTION_TYPE_NAMES` and `QUESTION_TYPE_TELEMETRY` name each type.

## 3. Constants (`packages/forms/src/limits.ts`, and where noted)

| Name                                                         | Value       | Provenance                                                   | Safe range            |
| ------------------------------------------------------------ | ----------- | ------------------------------------------------------------ | --------------------- |
| `FORM_HEADING_MAX`                                           | 80          | spec "The form card"                                         | 40..120               |
| `FORM_DESCRIPTION_MAX`                                       | 1000        | spec                                                         | 500..2000             |
| `SECTION_TITLE_MAX`, `PROMPT_MAX`                            | 80, 200     | spec                                                         | 40..120, 100..300     |
| `HELP_MAX`, `PLACEHOLDER_MAX`                                | 500, 80     | spec                                                         | 200..1000, 40..120    |
| `OPTION_MAX`, `OPTIONS_MAX`                                  | 100, 20     | = items' Choice limits                                       | fixed                 |
| `SHORT_ANSWER_MAX`, `PARAGRAPH_MAX`                          | 200, 2000   | spec (Title, Long Text)                                      | fixed                 |
| `RATING_SCALE_MIN/MAX/DEFAULT`                               | 3/10/5      | spec; items' `RATING_FIELD_SCALE_*` the same                 | fixed                 |
| `MESSAGE_MAX`                                                | 500         | spec "Settings"                                              | 200..1000             |
| `SECTIONS_MAX`, `QUESTIONS_MAX`                              | 10, 100     | spec "Abuse and limits"                                      | 5..20, 50..200        |
| `FORM_RESPONSE_LIMIT_MAX`                                    | 2000        | = `ITEMS_MAX`                                                | = `ITEMS_MAX`         |
| `RESPONSE_BODY_MAX`                                          | 65536       | spec                                                         | 32K..256K             |
| `FORM_CODE_LENGTH`                                           | 22          | DEFAULTS D1                                                  | 20..32                |
| `FORM_SUSPENSIONS_MAX`                                       | 2           | spec "Report This Form"                                      | 1..5                  |
| `DROPDOWN_AFTER`                                             | 7           | DEFAULTS D6                                                  | 5..12                 |
| `FORM_RESPONSES_PER_HOUR` (respond.ts)                       | 500         | spec "Abuse and limits"                                      | 100..2000             |
| `FORM_REPORTS_TO_SUSPEND` (forms.ts)                         | 3           | spec "Report This Form"                                      | fixed                 |
| `FORM_EMAIL_THROTTLE_MS` (notifications.ts)                  | 15 min      | = the comment email's                                        | 5..60 min             |
| `FORM_RATE_LIMITER` (wrangler.toml)                          | 60 / 60 s   | spec; one binding, keys `form:` and `form-read:` per network | 30..120               |
| `FORM_LINK_POLL_MS` (useFormLink.ts)                         | 30 s        | DEFAULTS D7                                                  | 15..120 s             |
| `DRAFT_SAVE_MS` (DraftText.tsx)                              | 500 ms      | DEFAULTS D8                                                  | 250..1000 ms          |
| `FRESH_RESPONSE_MS`, `FRESH_OPENED_MAX` (fresh-responses.ts) | 7 days, 500 | spec; DEFAULTS D9                                            | 1..30 days, 100..2000 |

## 4. Answers (`answers.ts`)

`type AnswerValue = string | number | boolean | string[]`. The wire body is
`{ answers: Record<questionId, unknown>, other?: Record<questionId, unknown>, website?: string }` (`website` the hidden
field). An Other pick is sent as `OTHER_ANSWER` with its text under `other`.

`checkAnswer(q, raw, other?) → { value?, error? }`, errors `required | too_long | not_a_number | not_whole | below_min
| above_max | not_an_email | not_a_link | not_a_date | not_an_option | too_few | too_many | out_of_scale | must_tick`.
An empty answer (`''`, whitespace, `[]`, `false`, absent) is `{}`, or `required` / `must_tick` when required. A Link
without a scheme is taken as `https://`; only `https://` with a dotted host passes. Multiple picks are kept in option
order, an Other's text last. `checkResponse(form, body, questions?)` checks every question (or a section's); answers to
unknown ids are dropped. `answerErrorMessage(q, error)` is the page's copy, shared by client and api.

## 5. Mapping (`mapping.ts`)

`MAPPABLE_KINDS`, `TITLE_TYPES` (short, email, number, single, date) and `NEW_FIELD_KIND` are the spec's tables.
`fieldTakes(q, field)`: the kind fits; a rating field's scale ≥ the question's; a choice field holds every option
and the question has no Other. `effectiveTarget(q, type)` resolves `goesTo` or falls back to Description with
`broken: true` (field gone, not in `type.fields`, no longer fits; Title on a type that cannot be one).
`fieldChoices(form, q, type)` lists fitting fields with the question using each; `titleTakenBy`; `newFieldFor` (a choice with Other a text field, `MAPPABLE_KINDS[type][1]`, so the field it makes always fits).

## 6. Response → card (`card.ts`)

`responseCard(form, tabId, answers, type, number | null, preview = false) → { type, fields }`:

- `title`: the Title answer as text (blank falls back), else `` `${heading} #${number}` ``, capped at ITEM_TITLE_MAX.
  For `preview`: `PREVIEW_TITLE_PREFIX` (`'Preview: '`) then the Title answer, else the heading. A null `number` (not
  `preview`) names the card after the heading alone.
- `description`: each unmapped (or broken) answer in form order, `prompt\nanswer`, blocks split by a blank line;
  `descriptionRich` the same runs with the prompts bold. Past ITEM_DESCRIPTION_MAX: the plain text cut with `…`, no
  runs.
- a mapped field: currency rounded to 2 dp, Long Text from picks one a line, Text from any answer's text, a rating
  capped at the field's scale.
- `status`: the destination's. `fromForm`: `fromFormValue(tabId, number)`, read by `readFromForm`; none when `number`
  is null.

## 6a. Sections shown sometimes (`branching.ts`)

`FormSection.showIf?: SectionRule` (`{ questionId, anyOf }`), read on a later section only (`anyOf` through
`readOptions`; an empty or malformed rule is dropped) and carried by `publicForm`. `ruleChoices(q)` (options;
`CHECKBOX_TICKED` / `CHECKBOX_UNTICKED`), `ruleQuestions(form, index)` (earlier single, multi, checkbox questions with
choices), `ruleQuestion(form, index, rule)` (null when broken), `sectionsShown(form, answers)` (progressive: a rule reads
only questions of shown sections), `shownQuestions`. `checkResponse`'s default questions are `shownQuestions(form,
body.answers)`, so the api and the page check and keep only what shows. Live: `useFormFill` steps Next/Back over hidden
sections and reports `position` / `count`; `components/forms/builder/SectionRule.tsx` is the badge and editor; `updateSection` takes
`showIf` (an empty `anyOf` clears it).

## 6b. Ready to publish (`publish-check.ts`)

`publishProblems(form, type)`: `no_questions`, then per section in order `broken_rule` (a later section whose
`showIf` has no `ruleQuestion`), and per question `unworded` (blank prompt), `no_options` (single or multi with
none), `broken_mapping` (a `goesTo` whose `effectiveTarget` is broken; judged only with a type: without one the
destination's own problem speaks). `PUBLISH_PROBLEM_TEXT` the dialog's lines. The publish route answers 409
`form_not_ready` with `problems`; Share Form lists them (`notReady`, `onShow`).

## 6c. Responses to a Sheet (`sheet-row.ts`; api `forms/sheet-response.ts`)

`FormDefinition.sheet?: FormSheetDestination` (`{ tabId, sheetId }`, read when both match `TAB_ID` and
`SHEET_ID_PATTERN`). `sheetHeaders(form)` (`#`, `Submitted`, prompts made distinct), `submittedText(at)` (UTC),
`responseRowWrite({ form, answers, number, preview, at, layout, header, usedRows, rand? })` → one `SheetWrite`: header
row inserted if none, missing headers in one `insertCols` after the last header (`f: { b: true }`), `freeze rows 1`
when the sheet had no headers, the row after the last used (rows inserted as needed); `cells` kind when nothing needs
the layout. `sheetDestinationProblem(sheet, sheets)` → `sheet_missing`. Api: `responsesProblem(env, docId, form,
types)` (`sheetOnItsTab`: the sheet head on its tab and that tab still in the project (`projectLinksTab`), else the
board check) for publishing and the public read; `respond` branches on
`form.sheet` (`sheetThere`, claim, `writeResponseRow`, `accepted`); `previewToSheet` for an unlinked preview;
`writeResponseRow` reads the header cells and `usedSheetRows` (`SELECT DISTINCT row_id`) and stores through
`storeSheetWrite(ctx, projectId, sheetId, { write, unchecked: true }, by, null)`, the route's write path factored
out. The sheet store retries a create refused `tab_not_found` (`CREATE_TAB_RETRIES` 4, `CREATE_TAB_RETRY_MS` 800 ms
a step), for a sheet on a tab not saved yet. Live: `sheetsOf(tabs)`, `setResponsesTo`, `newResponsesSheet`
(a new Sheet tab, its sheet made through `makeSheet` so the form stays open; `placeNewSheet` and opened where nothing can make it), `DestinationPicker` (`SheetDestination` / `BoardDestination`),
`sendPreview` (a sheet destination with a problem fails at once, `PREVIEW_NO_SHEET`; else the api first; a sheet with
no link fails), `formsFeeding` (`hooks/forms/forms-feeding.ts`, the stored destination read without parsing) skips
sheet forms for a board. A sheet starter's sheet is made with its tab, not on opening it: `makeFormSheet`
(`lib/forms-make-sheet.ts`, the sheet store fetched lazily) through `useFormActions`' `makeSheet`.

## 7. Starters (`starters.ts`)

`FORM_STARTERS` as the spec's table (`id`, `name`, `line`, `telemetry`, `respondsTo?` (`'board' | 'sheet'`, absent for
Blank: where `planFormStart` sends its responses, and its picture's badge), `readyType?`, `accent` (its picture and a
new card type's colour; the form takes none), `description?`,
`sections` of questions with `to: 'title' | 'description' | StarterField`). `starterBaseType(starter, catalogue,
newTypeId)`: the project's copy of the ready-made type, else the ready-made one, else a new type (checklist glyph,
the starter's colour; "Response" for Blank). `buildStarter(starter, type, newId)`: the form, its questions pointing
at the type's fields; a field of the same name and kind reused (options it lacks added), else added. Returns the
same type object when nothing changed.

## 8. Destination and the public form (`destination.ts`, `public.ts`)

`destinationProblem(destination, boards, types)`: `no_destination | board_missing | status_missing | type_missing |
type_not_on_board`, Archive boards not counted; `DESTINATION_PROBLEM_TEXT` its sentence. `publicForm(form)` strips
`goesTo`, the destination and the starter, and fills the default confirmation. `closedReason(form, { open,
responses, now })`: `switched_off | no_destination | closes_at | limit`.

## 9. Project

- `formLook(tab) → FormLook` (`packages/project/src/form-look.ts`, beside the themes: `@liveplanner/forms`
  cannot import the project package, which imports it): `backdrop` and `accent` for each half from
  `getBuiltInTheme(tab.theme, half)` (a custom or unknown theme draws Default); the accent is the shared
  `themeAccent(half)`, or on Default (no stroke, no palette) the brand `#0284c7` /
  `#38bdf8`; `onAccent` is `deriveTextColorForBg(accent)` per half; `finish` is `resolveFinish(undefined,
tab.finish)`; `font` the tab font when `resolveFontStack` knows it; `canvas` (`FormCanvas`) only for a pattern
  `isBackgroundPattern` knows that is neither `blank` nor either half's theme pattern (Plan's plain canvas otherwise,
  as `resolveViewBackdrop`): `color` per half is `viewBackdropInTheme({ patternColor: tab.patternColor ??
DEFAULT_PATTERN_COLOR }, the built-in source or Default, half)`; `scale` (0.5 to 2), `speed` (0.25 to 3) and
  `opacity` (0 to 1) clamped, each left out at 1 or when not a finite number.
- `TabKind` gains `'form'`; `PLAN_TAB_KINDS`, `isPlanTabKind`, `tabKindOf` take it. `Tab.form?: FormDefinition`,
  stored as tab JSON; readers call `readForm`.
- A rename (`useTabActions`) and a duplicate set `form.heading` with the name (`apps/live/lib/form-tab.ts`).

## 10. Items: the two field kinds

`CUSTOM_FIELD_KINDS` += `multichoice`, `rating`; `CustomFieldDef.scale?`; `ratingScaleOf`. `readCustom` reads a
multichoice's options as Choice's and a rating's `scale` (3..10, the default unstored). `customFieldText`:
`multiChoiceText`, `ratingText` (stars to 5, else `n / scale`). `board-csv`: `multiChoiceOf`, ratings in range.
`resolveFields` (agents): picks by name, ratings in range. `applyCardTypeChanges`: `options` for multichoice, `scale`
for rating. No item store change: a list of strings and a number are already valid custom values.

## 11. Api

### Tables

```sql
form_links (code PK, project_id → projects ON DELETE CASCADE, tab_id, open, created_at, responses,
            last_response_at, hour_start, hour_count, suspended_at, deleted_at, last_email_at, held_emails)
  UNIQUE (project_id, tab_id) WHERE suspended_at IS NULL AND deleted_at IS NULL; INDEX (project_id)
form_reports (code → form_links ON DELETE CASCADE, browser, network, reason, note, created_at, PK (code, browser))
form_reads (code → form_links ON DELETE CASCADE, owner_id, seen_number, PK (code, owner_id)); INDEX (owner_id)
```

`form_reads.owner_id` is owner-keyed data (`docs/specs/015-api/api.md` "Owner-keyed data"): deleted with an account,
moved by the guest migration. Unseen = `responses - seen_number`.

### `db/forms.ts`

`generateFormCode` (base 62 without bias), `getLiveFormLink` (not suspended, not deleted), `getFormLink`,
`getSuspendedFormLink`, `countSuspendedFormLinks`, `createFormLink` (carries the tab's highest response number on,
from every earlier link, suspended or deleted; null on a second live link), `setFormLinkOpen`, `deleteFormLink` (a
live link marked `deleted_at` and closed, never removed, so its number carries on and its code answers nothing),
`deleteFormLinksForTab` (removes them all: the tab is gone), `claimResponseNumber` (one guarded `UPDATE … RETURNING`:
number, `last_response_at` and the hourly window together, and `responses < limit` when given; null at either cap),
`addFormReport` (distinct networks), `suspendFormLink`, `markFormSeen`, `unseenResponses`, `claimFormEmail`
(compare-and-swap on `last_email_at`, returning how many were held).

### Routes

| Method | Path                                       | Gate   | Does                                                                                                                                                                                                                                           |
| ------ | ------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/projects/:id/tabs/:tabId/form-link` | read   | `FormLinkResponse`; `link.code` `''` unless edit                                                                                                                                                                                               |
| POST   | `.../form-link`                            | edit   | Publish; marks it seen for the publisher. 409 `form_already_published` / `form_destination_missing`, 403 `form_suspensions`, 404 not a Form tab                                                                                                |
| PUT    | `.../form-link`                            | edit   | `{ open }`                                                                                                                                                                                                                                     |
| DELETE | `.../form-link`                            | edit   | Deletes the live link                                                                                                                                                                                                                          |
| POST   | `.../form-seen`                            | read   | Marks every response so far seen for the caller                                                                                                                                                                                                |
| GET    | `/api/forms/:code`                         | public | `PublicFormResponse` (open: `form`, `look`; closed: `heading`, `message`, `look`), `no-store`; 404 `form_not_found` for every miss                                                                                                             |
| POST   | `.../form-preview`                         | edit   | An Editor's Preview of a published form: `respond(…, { preview: true })` (no hidden field or closed check, numbered `Preview: ` card, no email, `Form·Sent·Preview`); marks it seen for a previewer with none unseen; 404 `form_not_published` |
| POST   | `/api/forms/:code/responses`               | public | 201 `{ number }`; 400 `invalid_answers`; 409 `form_closed`; 413 `form_full`; 429 `form_busy`                                                                                                                                                   |
| POST   | `/api/forms/:code/reports`                 | public | 201; 400 `invalid_report`; suspends at three networks and emails the owner                                                                                                                                                                     |

`/api/forms` requests skip the owner-keyed write limiter and take `FORM_RATE_LIMITER` (`index.ts`). The tab delete
(`project-subresource-routes.ts`) deletes the tab's links and pauses each form whose board or sheet the tab was
(`pauseFormsFeeding`, `forms/form-tab.ts`: the project's live links (`liveFormLinksOf`), each Form tab read, the
link closed with `setFormLinkOpen(false)` when its destination is the tab, its code and count kept). The link `PUT`
with `open: true` and the publish `POST` share `notReadyToOpen` (`form-link-routes.ts`): 409
`form_destination_missing` while responses have nowhere to go, 409 `form_not_ready` with the failing checks. All are in the OpenAPI manifest.

### The response write (`forms/respond.ts`)

1. Body ≤ RESPONSE_BODY_MAX (413), JSON with `answers` (400).
2. `openFormLink`: link live, project live, tab a Form tab (404 otherwise).
3. Hidden field set → 201 `{ number: 0 }`, `Form·Sent·Dropped`.
4. `closedReason` → 409 `form_closed`. `checkResponse` → 400 with errors.
5. `destinationProblem` over the destination tab's boards and the catalogue → 409 `form_closed`.
6. The card for number 1 checked by `readItemCreate` (400 if refused: never expected).
7. `claimResponseNumber` with the form's Response Limit (none for a preview) → 409 `form_closed` when another
   response took the last place meanwhile, else 429 `form_busy` at the hourly cap (`claimNumber`, `respond.ts`).
8. `createMany(ctx, { projectId, owner: formPerson.id }, [create], { by: formPerson })`; `items_full` → 413
   `form_full`. Relay; `Form·Sent·Response`; `notifyFormResponse` in `waitUntil`.

### Logs

`[forms] form.published`, `form.closed`, `form.reopened`, `form.deleted`, `form.response.accepted`,
`form.response.refused {error}`, `form.response.dropped`, `form.response.unmade`, `form.destination.broken`,
`form.reported`, `form.suspended`, `form.email.sent`, `form.email.held`, `form.paused.destination_deleted`.

### Elsewhere

- The Inbox: `readActivity` adds `FORM_RESPONSES_SQL` (`db/activity-forms.ts`) to its batch: live links in the
  reader's own and team projects with unseen responses, newest first; heading and board tab read from the tab's JSON.
- `notification-prefs`: `notifyFormResponses` (default on).
- `LIVE_ROUTE_SEGMENTS` += `form`; `pageViewPath('/form/…')` is `/form`; `API_ROUTE_RESOURCES` += `forms`.

## 12. Live: the Form tab

| File                                                                                               | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@liveplanner/forms` `edits.ts` (shared with agents, §15)                                          | Pure edits: add, duplicate (no mapping), delete, move, place (drag), update, set type, set target, options, sections, patch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `@liveplanner/templates` `form-start.ts` (shared with agents, §15)                                 | `planFormStart` (`board?` narrows the boards to one; `heading?` the tab's own name; `newSheetId?` for a sheet starter; a Blank form gets no destination, no board, no type), `responsesBoardSetup`, `responsesBoardTab`, `responsesSheetTab`, `boardsOf`, `sheetsOf`, `uniqueTypeLabel`, `withBoardTaking`, `withAutoBoardName`                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `hooks/forms/useFormActions.ts`                                                                    | `startForm` (a sheet starter's Sheet tab made, its sheet through `makeSheet`), `newFormFor` (a board's New Form; `Form·Created·FromBoard`), `changeForm`, `renameForm` (the destination tab follows on its automatic name, `withAutoBoardName`; a sheet retitled through `retitleSheets`), `addFieldFor`, `syncFieldOptions`, `newResponsesBoard`, `newResponsesSheet`, `setResponsesTo`, `newCardType`; a locked tab refuses each. `newFormFor` reaches the board menu as `PlanContext.newFormFor`                                                                                                                                                                                                                                                                              |
| `hooks/forms/useFormLink.ts`                                                                       | Reads (marking seen) on open, polls, publishes, opens/closes, deletes; `status` `offline` without a server                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `lib/api/forms.ts`, `lib/api/forms-public.ts`                                                      | The owner's client (identity headers; `apiSendFormPreview` → `sent` / `not_published` / `invalid` / `failed`), the page's (plain fetch)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `components/forms/FormPage.tsx`                                                                    | The cover over the canvas; Preview portalled into the menu box (`useMenuNameSlot`; the status bar's end without one); `setFormShareHost` for an Editor; the status bar with help and `FormSettingsButton`; builder or Preview; the look on the form column only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `lib/form-share-store.ts`                                                                          | `setFormShareHost({ published, open })` / `useFormShareHost()`: `EditorHeader` draws Share Form in place of Share while a host is set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `hooks/forms/form-preview.ts`                                                                      | `sendPreview`: `checkResponse` (invalid); `sendToLink` (a published form) first: sent, invalid, failed (`PREVIEW_FAILED`), or `not_published` falls through; then destination problem / type / `addItems` missing (`PREVIEW_NO_DESTINATION`), `responseCard(…, null, true)` through `plan.addItems`, `Form·Sent·Preview`                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `components/forms/FormBoardStrip.tsx`, `form-board-context.ts`, `hooks/forms/useFormBoardValue.ts` | The board's Form strip: `PlanBoardHeader` puts `FormBoardStrip` before `BoardWidgetZone`; `EditorView` provides `FormBoardContext` (`formsFeeding(tabs, activeTabId)`, api details, `canShare` = edit, `selectTab`); each pill's `useFormLink(…, markSeen: false)` reads `form-link`, never `form-seen`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `components/forms/form-look.ts`, `app/forms.css`                                                   | `formLookProps(look)`: `data-form-look`, `data-form-finish`, `--form-accent-light/dark`, `--form-on-accent-light/dark`, the font stack. `forms.css` (unlayered) picks the half under `.dark`; `form-box` boxes are reshaped by finish, `form-ink` outlines inked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `components/forms/builder/*`                                                                       | `FormBuilderColumn`, `FormHeaderCard` (+ `SectionHeader`; the cover popover is the `BackgroundSection` over a cover-shaped page, `only` Solid, Gradient and Animated, the theme's gradients from `themeBackgroundPresets`, a hover previewing on the band), `FormConnectCard` (under the header while the form sends nowhere), `FormQuestionCard` (grows open and closed with `growBetween`; a text type's box is `PlaceholderField`; `QuestionSettings` when `hasQuestionSettings`; the badge opens `AnswerGoesTo` in a `FormSheet`), `OptionsEditor`, `FormAddBar`, `QuestionTypeMenu`, `DraftText`, `useQuestionDrag`, `FormSheet` (`AnchoredPopover`, `BottomSheet` on a phone), `FormSettingsButton` (the cog: a tab switch over `DestinationPicker` and `FormSettingsTab`) |
| `components/forms/ShareFormDialog.tsx`, `FormStatusBar.tsx`, `FormProblems.tsx`                    | As the spec: `FormProblems` lists the destination problem and `publishProblems` together, in Share Form before and after publishing; the status bar's Problems with this Form (`formProblemCount`) opens Share Form                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `components/forms/form-not-taking.ts`, `FormNotTakingWarning.tsx`                                  | `formNotTakingReason({ link, problem, closedBy, full })`: `suspended` (no live link, `suspendedAt`), `paused` (a destination problem), `switched_off`, `closes_at` / `limit` (`closedBySettings`), `full` (a board form at `ITEMS_MAX`), else null; `FORM_NOT_TAKING[reason]` its tooltip, fix (`share` / `destination` / `settings` / `responses`) and telemetry type. `FormStatusBar` draws the warning for an Editor after the count; `FormPage` routes the fix (Share Form, `openSettings`, `openTab`); a full project with no responses tab draws a focusable `role="status"` that only says                                                                                                                                                                               |
| `components/dialogs/SyncProjectPrompt.tsx`                                                        | The offline prompt both share dialogs draw: This Project Is in This Browser, the caller's `message`, Sync Project (busy until the dialog swaps it out, `onBusyChange`; waits on `ready`; a failure toasts `syncFailureMessage` and re-arms). `ShareOfflineGate` wraps it in the project Share dialog; `ShareFormDialog` draws it while `link.status === 'offline'` and `onSyncToCloud` is given (`EditorStartPanels` passes `ctx.syncToCloud` and `syncReady` = the reader is not `'self'`), and swaps to the publish view as `useFormLink` turns enabled                                                                                                                                                                                                                     |
| `components/forms/FormLockedStrip.tsx`, `FormPage.tsx`                                             | As the spec "A live form is locked": `locked` = an Editor's form whose link is open; the builder renders with `canEdit: false` and `locked: true` in `FormBuilderContext`, the cog stays, rename is withheld, and the strip's Edit Form calls `setOpen(false)`. `SwitchRow` takes `disabled` for Accepting Responses while `problemCount` > 0 and the form is closed                                                                                                                                                                                                                                                                                                                                                                                                             |
| `components/tour/FormTourHost.tsx`, `form-tour-steps.ts`, `lib/form-tour.ts`                       | The Forms tour: offer, steps, the destination step's tab held in a ref for the run; `requestFormTourRelaunch` from the cog's Show Me Around and Settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `components/chrome/TabBar.tsx` (`deleteTabMessage`, `hooks/forms/forms-feeding.ts`)                | Delete's confirmation names the forms feeding the tab                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |     |
| Shared with the page                                                                               | `QuestionView`, `QuestionControl` (`placeholderHint`, `ANSWER_FIELD`), `RatingInput`, `FormCoverBand` (`pageSheetStyle` and, for a moving cover, `PageMotionLayer`), `LinkedText`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

`EditorView` mounts `FormPage` (lazy) for a Form tab with a form, Start Planning otherwise. `isCanvasCovered`,
`CanvasChrome`, `plan-tab-list-store` and the mode lock name the kind.

## 13. Live: the form page

`app/form/[code]/page.tsx` (one placeholder built; `index: false`); the live worker rewrites every `/form/…` to
`/form/placeholder`, with the same security headers (not frameable). `FormRespondPage` reads the code from the path,
loads `GET /api/forms/:code`, and draws loading, not found, error, closed or `FormFill`, its `<main>` carrying the
look (and the backdrop's `--bd-light` / `--bd-dark`), and, when the look has a `canvas`, `FormCanvasLayer` (loaded on
demand) under the form: `TabPatternLayer` fixed to the window, in the half `useAppearance` resolves. In the builder,
`CanvasCover` draws an animated pattern from `CanvasPatternContext` (EditorView's `resolveViewBackdrop`, memoised);
the canvas's own layer is hidden under a cover (`canvas-motion.css`). The Report panel stays unthemed. `FormFill` / `useFormFill`:
sections, checks, the summary, Submit, the confirmation; drafts in session storage `liveplanner:form:<code>`.
`FormFooter`: the made-with line and Report This Form (browser id `liveplanner:form-browser`). The page imports no
editor modules: `forms-public.ts`, the shared controls and `@liveplanner/ui`.

## 14. Tests (traceability)

| Spec rule                                                                                                                         | Test                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| readForm sanitises every field                                                                                                    | `packages/forms/src/read.test.ts`                                                                                                                                                                       |
| Every answer error per type; copy for each                                                                                        | `answers.test.ts`                                                                                                                                                                                       |
| Mapping table, fitting fields, fallback                                                                                           | `mapping.test.ts`                                                                                                                                                                                       |
| Title, Description, field values, numbering, `fromForm`, a preview's card                                                         | `card.test.ts`                                                                                                                                                                                          |
| The look: theme accent per half, Default's brand, finish, font, custom as Default, the picked canvas style                        | `packages/project/src/form-look.test.ts`                                                                                                                                                               |
| Preview makes the card, refuses as the api does, needs a destination                                                              | `apps/live/hooks/forms/form-preview.test.ts`                                                                                                                                                            |
| The form page wears the look                                                                                                      | `apps/live/components/forms/respond/FormRespondPage.test.tsx`                                                                                                                                           |
| Starters valid, mappings resolve, fields reused                                                                                   | `starters.test.ts`                                                                                                                                                                                      |
| The board's Form strip: forms feeding a tab, the pill, no Copy Link without sharing                                               | `apps/live/components/forms/FormBoardStrip.test.tsx`                                                                                                                                                    |
| Sheet rows: headers, columns found and added, the row, kinds, growth, counted previews                                            | `packages/forms/src/sheet-row.test.ts`, `apps/api/src/routes/forms.test.ts`                                                                                                                             |
| The sheet store retries a create waiting for its tab                                                                              | `apps/live/components/sheets/sheet-store-client.test.ts`                                                                                                                                                |
| What stops publishing                                                                                                             | `packages/forms/src/publish-check.test.ts`, `apps/live/components/forms/ShareFormDialog.test.tsx`                                                                                                       |
| Not Taking Responses: each reason, its order, Editor only, what it opens                                                          | `apps/live/components/forms/form-not-taking.test.ts`, `apps/live/components/forms/FormStatusBar.test.tsx`                                                                                               |
| Share Form on a project in This Browser syncs, then publishes                                                                    | `apps/live/components/forms/ShareFormDialog.test.tsx`, `apps/live/components/dialogs/ShareOfflineGate.test.tsx`                                                                                         |
| Sections shown by earlier answers, broken rules, the check dropping hidden answers, reading rules                                 | `packages/forms/src/branching.test.ts`                                                                                                                                                                  |
| Destination problems; public projection; closed reasons                                                                           | `destination.test.ts`, `public.test.ts`                                                                                                                                                                 |
| The two field kinds: catalogue, card text, CSV, agents                                                                            | `packages/items/src/form-field-kinds.test.ts`                                                                                                                                                           |
| Form tab kind always Plan                                                                                                         | `packages/project/src/dashboard.test.ts`                                                                                                                                                               |
| `/form/<code>` page views drop the code                                                                                           | `packages/api-schema/src/page-views.test.ts`                                                                                                                                                            |
| Publish by role, the code hidden, close, delete, tab delete                                                                       | `apps/api/src/routes/forms.test.ts`                                                                                                                                                                     |
| Public read, every miss alike, responses, refusals, cap, full, hidden field, reports, suspensions                                 | `apps/api/src/routes/forms.test.ts`                                                                                                                                                                     |
| Code generation, the email throttle, the Inbox read                                                                               | `apps/api/src/db/forms.test.ts`                                                                                                                                                                         |
| The response and suspension emails                                                                                                | `apps/api/src/email/notifications.test.ts`                                                                                                                                                              |
| `form_reads` owner-keyed                                                                                                          | `apps/api/src/db/account-owner-columns.test.ts`                                                                                                                                                         |
| Builder edits                                                                                                                     | `packages/forms/src/edits.test.ts`                                                                                                                                                                      |
| Starting a form                                                                                                                   | `packages/templates/src/form-start.test.ts`                                                                                                                                                             |
| Builder by role, selection, options, sections, rename                                                                             | `apps/live/components/forms/builder/FormBuilderColumn.test.tsx`                                                                                                                                         |
| The form page flow                                                                                                                | `components/forms/respond/FormFill.test.tsx`, `FormRespondPage.test.tsx`                                                                                                                                |
| New on a response's card                                                                                                          | `components/forms/fresh-responses.test.ts`                                                                                                                                                              |
| Start Planning's Forms                                                                                                            | `components/plan/PlanBoardPicker.test.tsx`                                                                                                                                                              |
| The Inbox section                                                                                                                 | `components/panels/ActivityPane.test.tsx`                                                                                                                                                               |
| The worker rewrite                                                                                                                | `apps/live/src/worker.test.ts`, `lib/form-path.test.ts`                                                                                                                                                 |
| A cover is a colour background, read and refused by its parser                                                                    | `packages/page-background/src/index.test.ts`, `packages/forms/src/read.test.ts`                                                                                                                         |
| No row, Preview or response, for a sheet whose tab left the project; pause on destination delete, reopen refused while not ready | `apps/api/src/routes/forms.test.ts`, `apps/live/hooks/forms/form-preview.test.ts`                                                                                                                       |
| Blank makes nothing; sheet starters make a Sheet tab; names follow the tab                                                        | `packages/templates/src/form-start.test.ts`                                                                                                                                                             |
| Rename keeps the destination's automatic name in step                                                                             | `apps/live/hooks/forms/useFormActions.rename.test.ts`                                                                                                                                                   |
| The connect box, the problems list and button, the placeholder field, the grow                                                    | `components/forms/builder/FormConnectCard.test.tsx`, `components/forms/FormProblems.test.tsx`, `components/forms/builder/PlaceholderField.test.tsx`, `components/forms/builder/question-motion.test.ts` |
| The Forms tour: offer, rerun, the destination step                                                                                | `components/tour/FormTourHost.test.tsx`, `form-tour-steps.test.ts`                                                                                                                                      |
| Delete's warning                                                                                                                  | `apps/live/hooks/forms/forms-feeding.test.ts`                                                                                                                                                           |
| Form templates: catalogue, editor-only, the pending start, the picker                                                             | `packages/templates/src/form-templates.test.ts`, `apps/live/lib/pending-form-start.test.ts`, `components/forms/PendingFormStart.test.tsx`, `app/project/[id]/useTemplateFlow.form.test.ts`             |

## 15. Agents

Derived from [Forms](../forms.md#agents) and [MCP server](../../015-api/mcp-server.md) §4.9e.

### Placement

| Concern                                                                                                                                                       | Home                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The builder's pure edits (shared by the editor and agents)                                                                                                    | `packages/forms/src/edits.ts`                                                                                                                                                                                                                                                                                                                                                                                             |
| Starting a form: `planFormStart`, `responsesBoardTab`, `responsesSheetTab`, `boardsOf`, `sheetsOf`, `uniqueTypeLabel`, `withBoardTaking`, `withAutoBoardName` | `packages/templates/src/form-start.ts` (it builds tabs, so it lives beside `form-templates.ts`, never in `@liveplanner/forms`)                                                                                                                                                                                                                                                                                            |
| A live form's lock                                                                                                                                            | `packages/forms/src/lock.ts`: `SETTINGS_KEYS` (`closesAt`, `limit`, `confirmation`, `closedMessage`), `changesBeyondSettings(before, after)`                                                                                                                                                                                                                                                                              |
| A destination checked against board outlines                                                                                                                  | `destinationProblem` (`destination.ts`) reads only each board's `columns` (`status`), `addTypes` and `archive`                                                                                                                                                                                                                                                                                                            |
| The changeset `form` source (a new Form tab) and `replace.kind` (a new Board or Sheet tab of elements)                                                        | `packages/edit-operations/src/replace.ts`, `types.ts`; `apps/api/src/changesets/request.ts` (`REPLACE_SOURCES`, `tabKind`), `submit.ts`; `packages/api-schema` `ChangesetReplaceBody.form`, `.kind`                                                                                                                                                                                                                       |
| The form route                                                                                                                                                | `apps/api/src/routes/tab-form-route.ts` (`handleTabForm`, routed in `project-subresource-routes.ts`), `apps/api/src/forms/agent-form-write.ts` (`writeAgentForm`); relayed through `relayPages(…, '[forms] agent')`                                                                                                                                                                                                      |
| The plan's tabs                                                                                                                                               | `apps/api/src/db/tab-outlines.ts` (`tabOutlines`), `routes/plan-route.ts`; `PlanTabOutline` and `PlanResponse.tabs` in `packages/api-schema/src/items.ts`                                                                                                                                                                                                                                                                 |
| The engine agents share                                                                                                                                       | `packages/agent-verbs/src/forms/`: `form-world.ts` (`readFormWorld`, `worldOf`, `BoardRef`, `SheetRef`), `form-names.ts`, `form-question.ts`, `form-draft.ts` (`draftOf`, `setRespondsTo`, `setGoesTo`, `syncChoiceField`), `form-changes.ts`, `form-read.ts` (`readFormOf`), `form-calls.ts` (`readForm`, `addForm`, `changeForm`, `shareForm`, and `readingOf`, `guarded` for `form-try.ts`), `form-try.ts` (`tryForm`) |
| Refusal words                                                                                                                                                 | `packages/agent-verbs/src/plan/api-refusal.ts` (`form_locked`, `form_changed`, `form_not_ready`, `form_destination_missing`, `form_suspensions`, `form_already_published`, `not_a_form_tab`, and the form-preview route's `form_closed`, `form_full`, `form_busy`)                                                                                                                                                        |
| MCP schemas and tool verbs                                                                                                                                    | `packages/agent-verbs/src/mcp/form-schema.ts`; `mcpReadForm`, `mcpAddForm`, `mcpChangeForm`, `mcpShareForm`, `mcpTryForm` in `packages/agent-verbs/src/verbs/mcp-tools.ts` (after the Pages tools); the server instructions in `packages/agent-verbs/src/mcp/schema.ts`                                                                                                                                                   |
| MCP registration                                                                                                                                              | `apps/mcp/src/form-tools.ts` (`registerFormTools`, `formLinkUrl`); a Form tab's picture in `apps/mcp/src/form-preview.ts`, first in `tabPreview`                                                                                                                                                                                                                                                                          |
| CLI verbs                                                                                                                                                     | `packages/agent-verbs/src/verbs/form.ts`: `form.get`, `form.add`, `form.change`, `form.share`, `form.try`; `form` among the named-only resources (`apps/cli/src/help/help.ts`)                                                                                                                                                                                                                                            |
| The outline's pointer                                                                                                                                         | `packages/project-views/src/header.ts`: a Form tab's header reads `kind=form (read_form)`                                                                                                                                                                                                                                                                                                                                |
| The form's picture                                                                                                                                            | `packages/plan-art/src/form-art.ts` (`formArt(form, look, fontStack?)` → `{ svg, width, height }`)                                                                                                                                                                                                                                                                                                                        |

### Writing a form

- **New Form tab**: a changeset `replace: { form, name, theme? }` on a new tab id. `readForm(raw)` null → `invalid_value`
  "form: not a form (a heading and sections of questions)". The tab is `{ id, name: form.heading, kind: 'form',
opensIn: 'plan', elements: [], defaultTextSize: 'sm', form, theme? }`. On an existing tab (any kind) the source is
  refused: "form: a changeset makes a new Form tab; an existing form changes through its form route", hint
  "change it with change_form" (changesets write and relay elements, and a form is none).
- **Existing form** (`writeAgentForm`): body `{ form, rev? }` (`invalid_body` otherwise); the stored tab read; 404
  `not_found`, 400 `not_a_form_tab`, 409 `tab_locked`; `rev` given and not the stored one → 409 `form_changed` with
  `rev`; `changesBeyondSettings` and a live link `open === 1` → 409 `form_locked`; written with `upsertTabAtRev`
  (`name` the heading, capped as a tab name), a lost race retried `SUBMIT_ATTEMPTS` times; relayed as
  `tab-meta { name, form }`. Gated `gateEdit` (a Participant or Viewer 403); a token's write counts as Applied.
  Logs `[forms] agent.written`, `agent.locked`, `agent.changed-since`, `agent.stale-retry`.
- **Responses tabs**: a changeset `replace: { elements, kind: 'board' | 'sheet', name, theme?, layout: 'preserve' }` on
  a new tab id (`kind` only with elements, only a new tab). A new Sheet tab's `plan-sheet` carries
  `start: 'blank-spreadsheet'`, so the api makes its sheet under the element's `sheetId` as the tab is written; then
  its header row through `changeSheet` (`set` A1 `sheetHeaders`, bold, `freeze` 1, `rename` the tab's name), a miss
  said in `made`, never fatal. A new Board tab's board takes the form's type alone (`addTypes: [type]`).

### Names and refusals (`form-names.ts`)

| Reference      | Matches, in order                                                                                                                                | Refusal (code, message lists what there is)                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form tab       | tab id; tab name (case aside); none given: the project's first Form tab                                                                         | `form_tab_unknown`; `form_tab_none` with add_form; `not_a_form_tab`                                                                                   |
| question       | id; prompt (case aside, trimmed); two prompts alike → `question_ambiguous`                                                                       | `question_unknown`                                                                                                                                    |
| section        | id; title (case aside); a whole number 1..n (its place)                                                                                          | `section_unknown`                                                                                                                                     |
| board          | a Board tab's live board: tab or element id; tab name; board title                                                                               | `board_unknown`                                                                                                                                       |
| card type      | the project's (`resolveType`); else the ready-made type of that name, brought in; else a new type of that name                                  | none                                                                                                                                                  |
| column         | the board's column name (case aside) or status                                                                                                   | `column_unknown`                                                                                                                                      |
| sheet          | its id; its Responses Go To name (`sheetRefsOf`: the tab's name, "Name 2" for a second)                                                          | `sheet_unknown`                                                                                                                                       |
| `goesTo` field | the card type's custom field by name (case aside); else a new field (`newFieldFor`; a choice with Other a text field, `MAPPABLE_KINDS[type][1]`) | `field_does_not_fit` with the kinds that fit; `title_not_allowed`; `fields_full` at `ITEM_TYPE_CUSTOM_MAX`; `goes_to_on_sheet`; `goes_to_needs_board` |

### Question input (`form-question.ts`)

`{ type, prompt, help?, required?, placeholder?, options?, other?, dropdown?, min?, max?, whole?, scale?, style?,
lowLabel?, highLabel?, goesTo? }`: `blankQuestion(type, id)`, then `applyQuestionSet`. A setting the type lacks →
`setting_not_for_type` naming the type's settings (`TYPE_SETTINGS`). Limits: `PROMPT_MAX` (`prompt_empty`, `too_long`),
`HELP_MAX`, `PLACEHOLDER_MAX`, `SCALE_LABEL_MAX`; options 1..`OPTIONS_MAX`, each 1..`OPTION_MAX`, unique case aside
(`option_empty`, `options_repeat`, `options_none`, `options_full`); scale `RATING_SCALE_MIN`..`RATING_SCALE_MAX`
(`scale_out_of_range`); labels only on a numbered rating (`labels_need_numbers`); Multiple Choice picks 0..options
(`picks_out_of_range`); `min_over_max`. `""` clears a text setting, `false` a switch.

### Engine flow

- **World** (`readFormWorld`): `GET /projects/:id/plan` alone: its `tabs` (kind, theme, a Sheet tab's sheets), its
  boards (only `kind: 'board'` boards with columns on Board tabs become `BoardRef`s), types, statuses and
  `itemTypesRev`. Then the Form tab's body and `GET .../form-link`, in parallel: three reads a call, whatever the
  project's size (guarded by a test).
- **add_form**: no `projectId` → a world of nothing and one `POST /projects` `{ id, name, tabs: [form tab, ...responses
tabs], source, itemTypes? }`, then the new sheet's headers. Otherwise, in order: card types `PUT` at
  `itemTypesRev` (a stale save rebuilds from a fresh read, `CARD_TYPES_SAVE_ATTEMPTS`), the Form tab's changeset, the
  responses tabs' changesets, then `changeBoard` for each board that now takes the type. A starter is `buildStarter`
  over `starterBaseType` (its ready-made type unless the project holds it unchanged); questions make a blank form
  (`UNTITLED_FORM` without a name) whose responses go to a new board unless `respondsTo` says otherwise. The Form
  tab's theme is the input's, else the first tab's (from the plan's tabs).
- **change_form**: no changes → `readForm`; more than `FORM_CHANGES_MAX` → `too_many_changes`. The changes applied on
  `draftOf(world, tab, form)`; a refusal names its change ("Change n (op): ... Nothing was written."). A live form
  (`state === 'accepting'`) with `changesBeyondSettings` → `form_locked` before any write. Then card types, the form
  route with `rev` the tab's, the responses tabs and boards.
- **share_form**: an unknown action → `action_unknown`. `publish`: problems → `form_not_ready` listing them; no link →
  `POST form-link`; closed → `PUT { open: true }`; open → nothing. `close` → `PUT { open: false }`; `delete_link` →
  `DELETE`; either without a link → `form_not_published`. Then the link read again.
- **try_form** (`tryForm`): the reads as `readForm`'s. Each answer's key through `resolveQuestion` (an unknown or
  ambiguous one refused as it names them); a `single` with `other` given text that is no option sends `OTHER_ANSWER`
  with the text in `other`, a `multi` likewise for the picks that are no option (joined ", "). `checkResponse` over
  the body: errors → `invalid_answers` "Nothing was sent. "<prompt>" (<id>): <answerErrorMessage>[ (options: ...)]",
  nothing written. Answers given to a question `shownQuestions` leaves out → a line "<prompt> (<id>) was left out: its
  section does not show for these answers". No sheet and no destination or its type missing →
  `form_destination_missing`. A live link (`link.link`) or a sheet form → `POST .../form-preview` `{ answers, other }`
  (the api's `invalid_answers` worded the same way; its other refusals through `apiRefusalOf`); the number is the
  api's when the form is published and above 0, else null; the title `responseCard(…, preview).fields.title` for a
  card, null for a row. Otherwise a board in the world holding the destination's column is required
  (`form_destination_missing` without one) and the card `responseCard(form, tabId, answers, type, null, true)` is
  `POST /projects/:id/items` `{ type, fields, place: { status } }`; its id answered. Answer `{ projectId, tabId,
made: 'card' | 'row', number, where, title, itemId, lines }`; `where` the board's tab name (as `read_form`'s `respondsTo` names it) and
  column, `the sheet "<name>"`, or "its board" / "its sheet" when the world does not show it. The MCP adds `url`.
- **Answers** (`readFormOf`): `{ tabId, heading, description?, state, closedReason?, code, responses, unseen,
respondsTo: { to: 'board', board, cardType, column } | { to: 'sheet', sheet } | { to: 'nowhere' },
respondsToProblem?, sections: [{ id, place, title?, description?, showIf?: { questionId, prompt, anyOf },
showIfBroken?, questions: [{ id, type, typeName, prompt, …settings, goesTo?, goesToBroken? }] }], cover?, settings:
{ closesAt?: ISO, limit?, confirmation, closedMessage }, problems }`; each problem names its question
  (`("prompt", id)`) or section. State: no link → `not_published` (or `suspended`); a link → `closedReason` (a sheet
  form's `no_destination` read as none) → `closed`, else a destination problem → `paused`, else `accepting`. After a
  write the answer is built from the draft (no second read). The MCP turns `code` into `link` (`formLinkUrl`), the
  CLI into `${host}/form/<code>`.
- **Theme**: `set_form` `theme` sets the draft's `formTab.theme`; `add_form` makes the tab in it, `change_form` sends
  it with the form (`{ form, rev, theme }`), and the route writes it on the tab and relays it in the `tab-meta`.
- **Settings**: `closesAt` an ISO time; one with no offset is UTC (a `Z` appended before `Date.parse`).
- **Sheet columns** (`syncSheetHeaders`): a new responses sheet is given every header, then `freeze` 1 and `rename`
  its tab's name; an existing sheet form's sheet, when the form asks for a header it did not (`sheetHeaders` of the
  form as read against the form as changed) or its sheet changed, is read (`A1:ZZ1`) and given the headers it lacks
  after its last one (bold, `resize` fit), never over one. A failed sync is said in `made`, never fatal. Read answers carry each
  question's `column` on a sheet form.
- **Placing a question**: `before` a question (its index), else `after` one (its index + 1), else the end of
  `section` (`placeQuestion`); `move_question` needs one of them.
- **New fields** (`newFieldOf`, over `newFieldFor`): a choice with Other a text field (`MAPPABLE_KINDS[type][1]`); a new choice,
  multichoice or rating field `onCard`. The line says so.

### The picture (`form-art.ts`)

Blocks drawn from their own top and measured: the cover (`COVER_H` 160, a gradient or colour with its pattern
as a light overlay; else a `BAND_H` band of the accent), the heading card, each section's card ("Section n of m", its
rule as "Shown when “prompt” is A or B"), each question's card (prompt with a red `tspan` asterisk when required, help,
its control: text boxes with the placeholder or the type's hint, a paragraph's three lines, radios or a dropdown past
`DROPDOWN_AFTER`, checkboxes, stars or numbered boxes with end labels, a Checkbox's box beside its prompt), and Submit.
They flow down a 720 px column to `FORM_ART_HEIGHT_MAX` and on into a second (`FORM_ART_COLUMNS_MAX`); a section card
never ends a column without its first question; what still does not fit is counted ("n more questions not drawn:
read_form lists every one"). Light half of the look, the tab font's stack when it has one.

### Constants

| Name                   | Value | Why                                                                                                                             |
| ---------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| `FORM_CHANGES_MAX`     | 50    | As `change_items`, `change_sheet`, `change_pages`                                                                               |
| `FORM_ART_WIDTH`       | 720   | The builder's 640 px column with its gutters                                                                                    |
| `FORM_ART_HEIGHT_MAX`  | 2,048 | The MCP draws a preview at most 2,048 px on its longer side (`PREVIEW_MAX_SIDE_PX`): a taller picture would shrink past reading |
| `FORM_ART_COLUMNS_MAX` | 2     | Two columns are 1,440 px wide, inside the same limit                                                                            |

### Tests

| Rule                                                                                                              | Test                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| The `form` source: a new tab, stored as read, refused on any existing tab; `kind` on a new tab only               | `packages/edit-operations/src/replace-form.test.ts`, `replace.test.ts`                                                           |
| The form route: rev, the heading names the tab, the relay, roles, the lock, not a Form tab                        | `apps/api/src/routes/forms.test.ts` ("an agent’s form write")                                                                    |
| The lock's rule                                                                                                   | `packages/forms/src/lock.test.ts`                                                                                                |
| The plan's tabs: kinds, themes, sheets in order, a scoped link's own tab                                          | `apps/api/src/routes/plan-route.test.ts`                                                                                         |
| Names resolve and refuse with what there is                                                                       | `packages/agent-verbs/src/forms/form-names.test.ts`                                                                              |
| Question input equals the builder's; settings per type; limits                                                    | `packages/agent-verbs/src/forms/form-question.test.ts`                                                                           |
| Every change kind; mappings, Other, choice sync; rules; responses to boards and sheets; card types by name; UTC   | `packages/agent-verbs/src/forms/form-changes.test.ts`                                                                            |
| States, problems naming their question, sheet forms                                                               | `packages/agent-verbs/src/forms/form-read.test.ts`                                                                               |
| Write order; new project; refusals write nothing; lock; api refusals in words; share actions; three reads a call | `packages/agent-verbs/src/forms/form-engine.test.ts`                                                                             |
| The CLI's text, stdin changes, reopening                                                                          | `packages/agent-verbs/src/verbs/form.test.ts`                                                                                    |
| The tools as registered, their behaviours, structured output                                                      | `apps/mcp/src/tools.test.ts`, `output-schema.test.ts`, `verb-parity.test.ts`; `packages/agent-verbs/src/verbs/mcp-tools.test.ts` |
| The picture: every type, look, rule line, pattern, two columns and the count, placeholder lines, within budget    | `packages/plan-art/src/form-art.test.ts`                                                                                         |
| The outline's pointer                                                                                             | `packages/project-views/src/header.test.ts`                                                                                     |
