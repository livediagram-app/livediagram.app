# Forms blueprint

Derived from [Forms](../forms.md). Implementation contracts: files, types, constants, routes, tables and tests.

## 1. Packages and placement

| Concern                                                                                          | Home                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The form model, sanitiser, answers, mapping, response → card, starters, destination, public form | `packages/forms` (`@livediagram/forms`, pure: `model`, `limits`, `read`, `answers`, `mapping`, `card`, `starters`, `destination`, `public`, `ids`)                                                                                                                                                  |
| The `form` tab kind, `Tab.form`                                                                  | `packages/document` (`tab-kind.ts`, `index.ts`)                                                                                                                                                                                                                                                     |
| Multiple Choice and Rating field kinds                                                           | `packages/items` (`item-types.ts`, `type-catalogue.ts`, `card-text.ts`, `board-csv.ts`, `type-changes.ts`, `plan-names.ts`); agents in `packages/agent-verbs/src/plan/plan-listing.ts` and `packages/agent-verbs/src/mcp/plan-schema.ts`                                                            |
| Wire DTOs (`FormLinkResponse`, `PublicFormResponse`, `FormResponseBody`, report reasons)         | `packages/api-schema` (`forms.ts`); the Inbox's `ActivityFormResponses` in `activity.ts`; `/form` in `page-views.ts`; `forms` in `error-telemetry.ts`; `Form` in `telemetry-schema.ts`                                                                                                              |
| `form_links`, `form_reports`, `form_reads`                                                       | `apps/api/migrations/0092_forms.sql`, `apps/api/src/db/forms.ts`, the Inbox read `apps/api/src/db/activity-forms.ts`                                                                                                                                                                                |
| Owner routes, public routes, the response write                                                  | `apps/api/src/routes/form-link-routes.ts`, `apps/api/src/routes/forms.ts`, `apps/api/src/forms/respond.ts`, `apps/api/src/forms/form-tab.ts`                                                                                                                                                        |
| Emails                                                                                           | `apps/api/src/email/templates.ts` (`formResponseEmail`, `formSuspendedEmail`), `notifications.ts` (`notifyFormResponse`, `notifyFormSuspended`)                                                                                                                                                     |
| The Form tab                                                                                     | `apps/live/components/forms/FormPage.tsx` and `components/forms/builder/*`; actions in `apps/live/hooks/forms/*`                                                                                                                                                                                    |
| A page background's colours (a form's cover and a slide page share them)                         | `packages/page-background` (`@livediagram/page-background`, pure: `PageColourFill`, `ColourBackground`, `PAGE_PATTERNS`, `PAGE_MOTIONS`, `parseColourBackground`); `@livediagram/document` re-exports it                                                                                            |
| Form templates (one a starter)                                                                   | `packages/templates/src/form-templates.ts` (`FORM_TEMPLATES`, `isFormTemplateKind`, `formTemplateStarter`; `editorOnly`); `packages/template-previews/src/template-preview-24.tsx`; `apps/live/lib/pending-form-start.ts`, `components/forms/PendingFormStart.tsx`, `useTemplateFlow`'s `startForm` |
| Start Planning's Forms                                                                           | `apps/live/components/plan/start/start-planning-items.ts`, `StartPlanning.tsx`, `packages/template-previews/src/form-starter-picture.tsx`                                                                                                                                                           |
| The form page                                                                                    | `apps/live/app/form/[code]/page.tsx` → `components/forms/respond/*`; the worker rewrite in `apps/live/src/worker.ts`; `apps/live/lib/form-path.ts`                                                                                                                                                  |
| The Inbox, the New mark, the panel line                                                          | `apps/live/components/panels/activity-pane-parts.tsx`, `components/forms/fresh-responses.ts`, `NewResponseMark.tsx`, `components/plan/ItemPanelLayout.tsx`                                                                                                                                          |

`@livediagram/forms` depends on `@livediagram/items`, `@livediagram/sheets` and `@livediagram/page-background` (never on
`@livediagram/document`, which depends on it for types, as `@livediagram/api-schema` does).

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
// A slide background in colour (@livediagram/page-background): a solid or gradient fill (a moving one included) and a
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
| `OPTION_MAX`, `OPTIONS_MAX`                                  | 40, 20      | = items' Choice limits                                       | fixed                 |
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
| `FORM_REPORTS_TO_SUSPEND` (forms.ts)                         | 3           | = Community's                                                | fixed                 |
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
`fieldChoices(form, q, type)` lists fitting fields with the question using each; `titleTakenBy`; `newFieldFor`.

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
types)` (`sheetOnItsTab`: the sheet head on its tab and that tab still in the document (`documentLinksTab`), else the
board check) for publishing and the public read; `respond` branches on
`form.sheet` (`sheetThere`, claim, `writeResponseRow`, `accepted`); `previewToSheet` for an unlinked preview;
`writeResponseRow` reads the header cells and `usedSheetRows` (`SELECT DISTINCT row_id`) and stores through
`storeSheetWrite(ctx, documentId, sheetId, { write, unchecked: true }, by, null)`, the route's write path factored
out. The sheet store retries a create refused `tab_not_found` (`CREATE_TAB_RETRIES` 4, `CREATE_TAB_RETRY_MS` 800 ms
a step), for a sheet on a tab not saved yet. Live: `sheetsOf(tabs)`, `setResponsesTo`, `newResponsesSheet`
(`placeNewSheet` on a new Sheet tab, opened), `DestinationPicker` (`SheetDestination` / `BoardDestination`),
`sendPreview` (a sheet destination with a problem fails at once, `PREVIEW_NO_SHEET`; else the api first; a sheet with
no link fails), `formsFeeding` (`hooks/forms/forms-feeding.ts`, the stored destination read without parsing) skips
sheet forms for a board. A sheet starter's sheet is made with its tab, not on opening it: `makeFormSheet`
(`lib/forms-make-sheet.ts`, the sheet store fetched lazily) through `useFormActions`' `makeSheet`.

## 7. Starters (`starters.ts`)

`FORM_STARTERS` as the spec's table (`id`, `name`, `line`, `telemetry`, `respondsTo?` (`'board' | 'sheet'`, absent for
Blank: where `planFormStart` sends its responses, and its picture's badge), `readyType?`, `accent` (its picture and a
new card type's colour; the form takes none), `description?`,
`sections` of questions with `to: 'title' | 'description' | StarterField`). `starterBaseType(starter, catalogue,
newTypeId)`: the document's copy of the ready-made type, else the ready-made one, else a new type (checklist glyph,
the starter's colour; "Response" for Blank). `buildStarter(starter, type, newId)`: the form, its questions pointing
at the type's fields; a field of the same name and kind reused (options it lacks added), else added. Returns the
same type object when nothing changed.

## 8. Destination and the public form (`destination.ts`, `public.ts`)

`destinationProblem(destination, boards, types)`: `no_destination | board_missing | status_missing | type_missing |
type_not_on_board`, Archive boards not counted; `DESTINATION_PROBLEM_TEXT` its sentence. `publicForm(form)` strips
`goesTo`, the destination and the starter, and fills the default confirmation. `closedReason(form, { open,
responses, now })`: `switched_off | no_destination | closes_at | limit`.

## 9. Document

- `formLook(tab) → FormLook` (`packages/document/src/form-look.ts`, beside the themes: `@livediagram/forms`
  cannot import the document package, which imports it): `backdrop` and `accent` for each half from
  `getBuiltInTheme(tab.theme, half)` (a custom or unknown theme draws Default); the accent is the shared
  `themeAccent(half)`, or on Default (no stroke, no palette) the brand `#0284c7` /
  `#38bdf8`; `onAccent` is `deriveTextColorForBg(accent)` per half; `finish` is `resolveFinish(undefined,
tab.finish)`; `font` the tab font when `resolveFontStack` knows it.
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

### Tables (migration `0092_forms.sql`)

```sql
form_links (code PK, document_id → documents ON DELETE CASCADE, tab_id, open, created_at, responses,
            last_response_at, hour_start, hour_count, suspended_at, last_email_at, held_emails)
  UNIQUE (document_id, tab_id) WHERE suspended_at IS NULL; INDEX (document_id)
form_reports (code → form_links ON DELETE CASCADE, browser, network, reason, note, created_at, PK (code, browser))
form_reads (code → form_links ON DELETE CASCADE, owner_id, seen_number, PK (code, owner_id)); INDEX (owner_id)
```

`form_reads.owner_id` is owner-keyed data (`docs/specs/015-api/api.md` "Owner-keyed data"): deleted with an account,
moved by the guest migration. Unseen = `responses - seen_number`.

### `db/forms.ts`

`generateFormCode` (base 62 without bias), `getLiveFormLink`, `getFormLink`, `getSuspendedFormLink`,
`countSuspendedFormLinks`, `createFormLink` (carries the tab's highest response number on; null on a second live
link), `setFormLinkOpen`, `deleteFormLink` (live only), `deleteFormLinksForTab`, `claimResponseNumber` (one guarded
`UPDATE … RETURNING`: number, `last_response_at` and the hourly window together; null at the cap),
`addFormReport` (distinct networks), `suspendFormLink`, `markFormSeen`, `unseenResponses`, `claimFormEmail`
(compare-and-swap on `last_email_at`, returning how many were held).

### Routes

| Method | Path                                       | Gate   | Does                                                                                                                                                                                                                                           |
| ------ | ------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/documents/:id/tabs/:tabId/form-link` | read   | `FormLinkResponse`; `link.code` `''` unless edit                                                                                                                                                                                               |
| POST   | `.../form-link`                            | edit   | Publish; marks it seen for the publisher. 409 `form_already_published` / `form_destination_missing`, 403 `form_suspensions`, 404 not a Form tab                                                                                                |
| PUT    | `.../form-link`                            | edit   | `{ open }`                                                                                                                                                                                                                                     |
| DELETE | `.../form-link`                            | edit   | Deletes the live link                                                                                                                                                                                                                          |
| POST   | `.../form-seen`                            | read   | Marks every response so far seen for the caller                                                                                                                                                                                                |
| GET    | `/api/forms/:code`                         | public | `PublicFormResponse` (open: `form`, `look`; closed: `heading`, `message`, `look`), `no-store`; 404 `form_not_found` for every miss                                                                                                             |
| POST   | `.../form-preview`                         | edit   | An Editor's Preview of a published form: `respond(…, { preview: true })` (no hidden field or closed check, numbered `Preview: ` card, no email, `Form·Sent·Preview`); marks it seen for a previewer with none unseen; 404 `form_not_published` |
| POST   | `/api/forms/:code/responses`               | public | 201 `{ number }`; 400 `invalid_answers`; 409 `form_closed`; 413 `form_full`; 429 `form_busy`                                                                                                                                                   |
| POST   | `/api/forms/:code/reports`                 | public | 201; 400 `invalid_report`; suspends at three networks and emails the owner                                                                                                                                                                     |

`/api/forms` requests skip the owner-keyed write limiter and take `FORM_RATE_LIMITER` (`index.ts`). The tab delete
(`document-subresource-routes.ts`) deletes the tab's links and unpublishes each form whose board or sheet the tab was
(`unpublishFormsFeeding`, `forms/form-tab.ts`: the document's live links (`liveFormLinksOf`), each Form tab read, the
link deleted when its destination is the tab). All are in the OpenAPI manifest.

### The response write (`forms/respond.ts`)

1. Body ≤ RESPONSE_BODY_MAX (413), JSON with `answers` (400).
2. `openFormLink`: link live, document live, tab a Form tab (404 otherwise).
3. Hidden field set → 201 `{ number: 0 }`, `Form·Sent·Dropped`.
4. `closedReason` → 409 `form_closed`. `checkResponse` → 400 with errors.
5. `destinationProblem` over the destination tab's boards and the catalogue → 409 `form_closed`.
6. The card for number 1 checked by `readItemCreate` (400 if refused: never expected).
7. `claimResponseNumber` → 429 `form_busy` at the cap.
8. `createMany(ctx, { documentId, owner: formPerson.id }, [create], { by: formPerson })`; `items_full` → 413
   `form_full`. Relay; `Form·Sent·Response`; `notifyFormResponse` in `waitUntil`.

### Logs

`[forms] form.published`, `form.closed`, `form.reopened`, `form.deleted`, `form.response.accepted`,
`form.response.refused {error}`, `form.response.dropped`, `form.response.unmade`, `form.destination.broken`,
`form.reported`, `form.suspended`, `form.email.sent`, `form.email.held`, `form.unpublished.destination_deleted`.

### Elsewhere

- The Inbox: `readActivity` adds `FORM_RESPONSES_SQL` (`db/activity-forms.ts`) to its batch: live links in the
  reader's own and team documents with unseen responses, newest first; heading and board tab read from the tab's JSON.
- `notification-prefs`: `notifyFormResponses` (default on).
- `LIVE_ROUTE_SEGMENTS` += `form`; `pageViewPath('/form/…')` is `/form`; `API_ROUTE_RESOURCES` += `forms`.

## 12. Live: the Form tab

| File                                                                                               | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/forms/form-edits.ts`                                                                        | Pure edits: add, duplicate (no mapping), delete, move, place (drag), update, set type, set target, options, sections, patch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `hooks/forms/form-start.ts`                                                                        | `planFormStart` (`board?` narrows the boards to one; `heading?` the tab's own name; `newSheetId?` for a sheet starter; a Blank form gets no destination, no board, no type), `responsesBoardSetup`, `responsesBoardTab`, `responsesSheetTab`, `boardsOf`, `sheetsOf`, `uniqueTypeLabel`, `withBoardTaking`, `withAutoBoardName`                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `hooks/forms/useFormActions.ts`                                                                    | `startForm` (a sheet starter's Sheet tab made, its sheet through `makeSheet`), `newFormFor` (a board's New Form; `Form·Created·FromBoard`), `changeForm`, `renameForm` (the destination tab follows on its automatic name, `withAutoBoardName`; a sheet retitled through `retitleSheets`), `addFieldFor`, `syncFieldOptions`, `newResponsesBoard`, `newResponsesSheet`, `setResponsesTo`, `newCardType`; a locked tab refuses each. `newFormFor` reaches the board menu as `PlanContext.newFormFor`                                                                                                                                                                                                                                                                                            |
| `hooks/forms/useFormLink.ts`                                                                       | Reads (marking seen) on open, polls, publishes, opens/closes, deletes; `status` `offline` without a server                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `lib/api/forms.ts`, `lib/api/forms-public.ts`                                                      | The owner's client (identity headers; `apiSendFormPreview` → `sent` / `not_published` / `invalid` / `failed`), the page's (plain fetch)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `components/forms/FormPage.tsx`                                                                    | The cover over the canvas; Preview portalled into the menu box (`useMenuNameSlot`; the status bar's end without one); `setFormShareHost` for an Editor; the status bar with help and `FormSettingsButton`; builder or Preview; the look on the form column only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `lib/form-share-store.ts`                                                                          | `setFormShareHost({ published, open })` / `useFormShareHost()`: `EditorHeader` draws Share Form in place of Share while a host is set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `hooks/forms/form-preview.ts`                                                                      | `sendPreview`: `checkResponse` (invalid); `sendToLink` (a published form) first: sent, invalid, failed (`PREVIEW_FAILED`), or `not_published` falls through; then destination problem / type / `addItems` missing (`PREVIEW_NO_DESTINATION`), `responseCard(…, null, true)` through `plan.addItems`, `Form·Sent·Preview`                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `components/forms/FormBoardStrip.tsx`, `form-board-context.ts`, `hooks/forms/useFormBoardValue.ts` | The board's Form strip: `PlanBoardHeader` puts `FormBoardStrip` before `BoardWidgetZone`; `EditorView` provides `FormBoardContext` (`formsFeeding(tabs, activeTabId)`, api details, `canShare` = edit, `selectTab`); each pill's `useFormLink(…, markSeen: false)` reads `form-link`, never `form-seen`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `components/forms/form-look.ts`, `app/forms.css`                                                   | `formLookProps(look)`: `data-form-look`, `data-form-finish`, `--form-accent-light/dark`, `--form-on-accent-light/dark`, the font stack. `forms.css` (unlayered) picks the half under `.dark`; `form-box` boxes are reshaped by finish, `form-ink` outlines inked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `components/forms/builder/*`                                                                       | `FormBuilderColumn`, `FormHeaderCard` (+ `SectionHeader`; the cover popover is the slide's `BackgroundSection` over a cover-shaped slide page, `only` Solid, Gradient and Animated, the theme's gradients from `themeBackgroundPresets`, a hover previewing on the band), `FormConnectCard` (under the header while the form sends nowhere), `FormQuestionCard` (grows open and closed with `growBetween`; a text type's box is `PlaceholderField`; `QuestionSettings` when `hasQuestionSettings`; the badge opens `AnswerGoesTo` in a `FormSheet`), `OptionsEditor`, `FormAddBar`, `QuestionTypeMenu`, `DraftText`, `useQuestionDrag`, `FormSheet` (`AnchoredPopover`, `BottomSheet` on a phone), `FormSettingsButton` (the cog: a tab switch over `DestinationPicker` and `FormSettingsTab`) |
| `components/forms/ShareFormDialog.tsx`, `FormStatusBar.tsx`, `FormProblems.tsx`                    | As the spec: `FormProblems` lists the destination problem and `publishProblems` together, in Share Form before and after publishing; the status bar's Problems with this Form (`formProblemCount`) opens Share Form                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `components/tour/FormTourHost.tsx`, `form-tour-steps.ts`, `lib/form-tour.ts`                       | The Forms tour: offer, steps, the destination step's tab held in a ref for the run; `requestFormTourRelaunch` from the cog's Show Me Around and Settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `components/chrome/TabBar.tsx` (`deleteTabMessage`, `hooks/forms/forms-feeding.ts`)                | Delete's confirmation names the forms feeding the tab                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |     |
| Shared with the page                                                                               | `QuestionView`, `QuestionControl` (`placeholderHint`, `ANSWER_FIELD`), `RatingInput`, `FormCoverBand` (`pageSheetStyle` and, for a moving cover, `PageMotionLayer`), `LinkedText`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

`EditorView` mounts `FormPage` (lazy) for a Form tab with a form, Start Planning otherwise. `isCanvasCovered`,
`CanvasChrome`, `plan-tab-list-store` and the mode lock name the kind.

## 13. Live: the form page

`app/form/[code]/page.tsx` (one placeholder built; `index: false`); the live worker rewrites every `/form/…` to
`/form/placeholder`, with the same security headers (not frameable). `FormRespondPage` reads the code from the path,
loads `GET /api/forms/:code`, and draws loading, not found, error, closed or `FormFill`, its `<main>` carrying the
look (and the backdrop's `--bd-light` / `--bd-dark`); the Report panel stays unthemed. `FormFill` / `useFormFill`:
sections, checks, the summary, Submit, the confirmation; drafts in session storage `livediagram:form:<code>`.
`FormFooter`: the made-with line and Report This Form (browser id `livediagram:form-browser`). The page imports no
editor modules: `forms-public.ts`, the shared controls and `@livediagram/ui`.

## 14. Tests (traceability)

| Spec rule                                                                                             | Test                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| readForm sanitises every field                                                                        | `packages/forms/src/read.test.ts`                                                                                                                                                           |
| Every answer error per type; copy for each                                                            | `answers.test.ts`                                                                                                                                                                           |
| Mapping table, fitting fields, fallback                                                               | `mapping.test.ts`                                                                                                                                                                           |
| Title, Description, field values, numbering, `fromForm`, a preview's card                             | `card.test.ts`                                                                                                                                                                              |
| The look: theme accent per half, Default's brand, finish, font, custom as Default                     | `packages/document/src/form-look.test.ts`                                                                                                                                                   |
| Preview makes the card, refuses as the api does, needs a destination                                  | `apps/live/hooks/forms/form-preview.test.ts`                                                                                                                                                |
| The form page wears the look                                                                          | `apps/live/components/forms/respond/FormRespondPage.test.tsx`                                                                                                                               |
| Starters valid, mappings resolve, fields reused                                                       | `starters.test.ts`                                                                                                                                                                          |
| The board's Form strip: forms feeding a tab, the pill, no Copy Link without sharing                   | `apps/live/components/forms/FormBoardStrip.test.tsx`                                                                                                                                        |
| Sheet rows: headers, columns found and added, the row, kinds, growth, counted previews                | `packages/forms/src/sheet-row.test.ts`, `apps/api/src/routes/forms.test.ts`                                                                                                                 |
| The sheet store retries a create waiting for its tab                                                  | `apps/live/components/sheets/sheet-store-client.test.ts`                                                                                                                                    |
| What stops publishing                                                                                 | `packages/forms/src/publish-check.test.ts`, `apps/live/components/forms/ShareFormDialog.test.tsx`                                                                                           |
| Sections shown by earlier answers, broken rules, the check dropping hidden answers, reading rules     | `packages/forms/src/branching.test.ts`                                                                                                                                                      |
| Destination problems; public projection; closed reasons                                               | `destination.test.ts`, `public.test.ts`                                                                                                                                                     |
| The two field kinds: catalogue, card text, CSV, agents                                                | `packages/items/src/form-field-kinds.test.ts`                                                                                                                                               |
| Form tab kind always Plan                                                                             | `packages/document/src/dashboard.test.ts`                                                                                                                                                   |
| `/form/<code>` page views drop the code                                                               | `packages/api-schema/src/page-views.test.ts`                                                                                                                                                |
| Publish by role, the code hidden, close, delete, tab delete                                           | `apps/api/src/routes/forms.test.ts`                                                                                                                                                         |
| Public read, every miss alike, responses, refusals, cap, full, hidden field, reports, suspensions     | `apps/api/src/routes/forms.test.ts`                                                                                                                                                         |
| Code generation, the email throttle, the Inbox read                                                   | `apps/api/src/db/forms.test.ts`                                                                                                                                                             |
| The response and suspension emails                                                                    | `apps/api/src/email/notifications.test.ts`                                                                                                                                                  |
| `form_reads` owner-keyed                                                                              | `apps/api/src/db/account-owner-columns.test.ts`                                                                                                                                             |
| Builder edits                                                                                         | `apps/live/hooks/forms/form-edits.test.ts`                                                                                                                                                  |
| Starting a form                                                                                       | `apps/live/hooks/forms/form-start.test.ts`                                                                                                                                                  |
| Builder by role, selection, options, sections, rename                                                 | `apps/live/components/forms/builder/FormBuilderColumn.test.tsx`                                                                                                                             |
| The form page flow                                                                                    | `components/forms/respond/FormFill.test.tsx`, `FormRespondPage.test.tsx`                                                                                                                    |
| New on a response's card                                                                              | `components/forms/fresh-responses.test.ts`                                                                                                                                                  |
| Start Planning's Forms                                                                                | `components/plan/PlanBoardPicker.test.tsx`                                                                                                                                                  |
| The Inbox section                                                                                     | `components/panels/ActivityPane.test.tsx`                                                                                                                                                   |
| The worker rewrite                                                                                    | `apps/live/src/worker.test.ts`, `lib/form-path.test.ts`                                                                                                                                     |
| A cover is a colour background, read and refused as a slide's                                         | `packages/page-background/src/index.test.ts`, `packages/forms/src/read.test.ts`                                                                                                             |
| No row, Preview or response, for a sheet whose tab left the document; unpublish on destination delete | `apps/api/src/routes/forms.test.ts`, `apps/live/hooks/forms/form-preview.test.ts`                                                                                                           |
| Blank makes nothing; sheet starters make a Sheet tab; names follow the tab                            | `apps/live/hooks/forms/form-start.test.ts`                                                                                                                                                  |
| Rename keeps the destination's automatic name in step                                                 | `apps/live/hooks/forms/useFormActions.rename.test.ts`                                                                                                                                       |
| The connect box, the problems list and button, the placeholder field, the grow                        | `components/forms/builder/FormConnectCard.test.tsx`, `components/forms/FormProblems.test.tsx`, `components/forms/builder/PlaceholderField.test.tsx`, `components/forms/builder/question-motion.test.ts`                       |
| The Forms tour: offer, rerun, the destination step                                                    | `components/tour/FormTourHost.test.tsx`, `form-tour-steps.test.ts`                                                                                                                          |
| Delete's warning                                                                                      | `apps/live/hooks/forms/forms-feeding.test.ts`                                                                                                                                               |
| Form templates: catalogue, editor-only, the pending start, the picker                                 | `packages/templates/src/form-templates.test.ts`, `apps/live/lib/pending-form-start.test.ts`, `components/forms/PendingFormStart.test.tsx`, `app/document/[id]/useTemplateFlow.form.test.ts` |
