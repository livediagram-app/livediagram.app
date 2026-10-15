# Forms blueprint

Derived from [Forms](../forms.md). Implementation contracts: files, types, constants, routes, tables and tests.

## 1. Packages and placement

| Concern                                                            | Home                                                |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| The form model, sanitiser, answers, mapping, response → card, starters | `packages/forms` (`@livediagram/forms`, pure, new)  |
| The `form` tab kind, `Tab.form`                                    | `packages/document` (`tab-kind.ts`, `index.ts`)     |
| Multiple Choice and Rating field kinds                             | `packages/items` (`item-types.ts`, `type-catalogue.ts`, `card-text.ts`, `board-csv.ts`, `type-changes.ts`, `plan-names.ts`) |
| Wire DTOs (`PublicFormDTO`, `FormLinkDTO`, refusals)               | `packages/api-schema` (`forms.ts`)                  |
| `form_links`, `form_reports`, `form_reads`; owner + public routes  | `apps/api` (`db/forms.ts`, `routes/form-link-routes.ts`, `routes/form-public-routes.ts`, `forms/*`) |
| The Form tab builder, Share Form dialog, Start Planning Forms       | `apps/live/components/forms/*`, `apps/live/hooks/forms/*` |
| The respondent page                                                | `apps/live/app/form/page.tsx` → `components/forms/respond/*` |

`@livediagram/forms` depends on `@livediagram/items` only. `@livediagram/document` depends on it for the `Tab.form`
type and `readForm`.

## 2. Model (`packages/forms/src/model.ts`)

```ts
export const QUESTION_TYPES = ['short', 'paragraph', 'number', 'email', 'link', 'date',
  'single', 'multi', 'rating', 'checkbox'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type AnswerTarget =
  | { to: 'description' }          // the default; also what an absent `goesTo` reads as
  | { to: 'title' }
  | { to: 'field'; fieldId: string };

export interface FormQuestion {
  id: string;                      // q-xxxxxx, unique in the form
  type: QuestionType;
  prompt: string;                  // 1..PROMPT_MAX; '' reads as 'Untitled Question'
  help?: string;                   // ..HELP_MAX
  required?: true;
  placeholder?: string;            // short, paragraph, number, email, link
  options?: string[];              // single, multi: 2..OPTIONS_MAX
  other?: true;                    // single, multi: an Other option with text
  dropdown?: true;                 // single
  min?: number; max?: number;      // number; multi: picks
  whole?: true;                    // number
  scale?: number;                  // rating: RATING_SCALE_MIN..MAX (default 5)
  style?: 'stars' | 'numbers';     // rating
  lowLabel?: string; highLabel?: string; // rating numbers, ..40
  goesTo?: AnswerTarget;
}

export interface FormSection { id: string; title: string; description?: string; questions: FormQuestion[] }

export interface FormDestination { tabId: string; typeId: string; status: string }

export interface FormDefinition {
  v: 1;
  heading: string;                 // = tab name
  description?: string;
  accent?: string;                 // #rrggbb, the form colour
  cover?: { color?: string; imageId?: string };
  sections: FormSection[];         // >= 1; sections[0].title is unused (the heading)
  destination?: FormDestination;
  closesAt?: number;               // epoch ms
  limit?: number;                  // 1..FORM_RESPONSE_LIMIT_MAX
  confirmation?: string;           // ..MESSAGE_MAX
  closedMessage?: string;          // ..MESSAGE_MAX
  starter?: StarterId;             // telemetry and the title hint only
}
```

`readForm(raw: unknown): FormDefinition | null` sanitises (unknown keys dropped, strings trimmed and capped, ids
checked, duplicates dropped, settings out of range dropped, a question of an unknown type dropped, an empty
`sections` given one empty section). It never throws. `null` only when `raw` is not an object.

## 3. Constants (`packages/forms/src/limits.ts`)

| Name                         | Value     | Provenance                               | Safe range     |
| ---------------------------- | --------- | ---------------------------------------- | -------------- |
| `FORM_HEADING_MAX`           | 80        | spec "The form card"                     | 40..120        |
| `FORM_DESCRIPTION_MAX`       | 1000      | spec                                     | 500..2000      |
| `PROMPT_MAX`                 | 200       | spec "Question types"                    | 100..300       |
| `HELP_MAX`                   | 500       | spec                                     | 200..1000      |
| `OPTION_MAX`                 | 80        | spec                                     | = items' CUSTOM_CHOICE_OPTION_MAX |
| `OPTIONS_MAX`                | 20        | spec (= Choice's 20)                     | = CUSTOM_CHOICE_OPTIONS_MAX |
| `SHORT_ANSWER_MAX`           | 200       | spec (= ITEM_TITLE_MAX)                  | = ITEM_TITLE_MAX |
| `PARAGRAPH_MAX`              | 2000      | spec (= Long Text)                       | = Long Text    |
| `RATING_SCALE_MIN/MAX/DEFAULT` | 3/10/5  | spec                                     | fixed          |
| `MESSAGE_MAX`                | 500       | spec "Settings"                          | 200..1000      |
| `SECTIONS_MAX`               | 10        | spec "Abuse and limits"                  | 5..20          |
| `QUESTIONS_MAX`              | 100       | spec                                     | 50..200        |
| `FORM_RESPONSE_LIMIT_MAX`    | 2000      | = ITEMS_MAX                              | = ITEMS_MAX    |
| `RESPONSE_BODY_MAX`          | 65536     | spec                                     | 32K..256K      |
| `FORM_CODE_LENGTH`           | 22        | ~131 bits over base 62; ≥16 chars so telemetry also treats it as an id | 20..32 |
| `FORM_NETWORK_PER_MINUTE`    | 10        | spec (binding `FORM_RATE_LIMITER`)      | 5..30          |
| `FORM_RESPONSES_PER_HOUR`    | 500       | spec, per form                           | 100..2000      |
| `FORM_EMAIL_THROTTLE_MS`     | 15 min    | spec (= comment email's)                 | 5..60 min      |
| `FORM_NEW_DOT_MS`            | 7 days    | spec "On the board"                      | 1..30 days     |
| `FORM_REPORTS_TO_SUSPEND`    | 3         | = Community's                            | fixed          |
| `FORM_SUSPENSIONS_MAX`       | 2         | spec "Report This Form"                  | 1..5           |
| `FORM_PUBLIC_CACHE_S`        | 60        | spec "Abuse and limits"                  | 10..300        |

## 4. Answers (`answers.ts`)

`type AnswerValue = string | number | boolean | string[]`. The wire body is
`{ answers: Record<questionId, AnswerValue>, other?: Record<questionId, string>, website?: string }` (`website` the
hidden field).

`checkAnswer(q, raw, other?) → { value?: AnswerValue } | { error: AnswerError }` where
`AnswerError = 'required' | 'too_long' | 'not_a_number' | 'not_whole' | 'below_min' | 'above_max' | 'not_an_email'
| 'not_a_link' | 'not_a_date' | 'not_an_option' | 'too_few' | 'too_many' | 'out_of_scale' | 'must_tick'`.
An empty answer (`''`, `[]`, `false` for a non-required checkbox, absent) is `{}`; required → `required`.
`checkResponse(form, body) → { answers: Map<id, AnswerValue> } | { errors: Record<id, AnswerError> }`: answers to
ids not in the form are dropped (spec "Live"). `answerErrorMessage(q, error)` gives the page's copy (spec
"Checking answers"), shared by the page's own checks so client and server read the same.

## 5. Mapping (`mapping.ts`)

- `MAPPABLE_KINDS: Record<QuestionType, CustomFieldKind[]>` is the spec table; `TITLE_TYPES` = short, email, number,
  single, date.
- `newFieldKind(type)`: short→text, paragraph→longtext, number→number, email→email, link→link, date→date,
  single→choice, multi→multichoice, rating→rating, checkbox→checkbox.
- `effectiveTarget(q, type: ItemTypeDef | undefined)`: `goesTo` when it still resolves (field exists, kind in
  `MAPPABLE_KINDS[q.type]`, rating scale ≤ field scale), else `{ to: 'description' }` with `broken: true`.
- `syncedOptions`: a mapped single/multi question's option edit returns the catalogue change for its field.

## 6. Response → card (`card.ts`)

`responseCard(form, answers, type, number, now) → { type: string; fields: ItemFields }`:

- `title`: the Title-mapped answer as text, else `` `${heading} #${number}` ``, capped at ITEM_TITLE_MAX.
- `description`: for each unmapped (or broken) answered question in form order, `**<prompt>**\n<text>\n\n`, capped at
  ITEM_DESCRIPTION_MAX (cut with `…`). Text: choices `, `-joined, rating `n / scale`, checkbox Yes/No.
- custom fields: the value converted to the field's kind (number→Currency rounds to 2 dp; multi→Long Text joins
  lines; single→Text as text).
- `status`: the destination's. `form: { tabId, number, at }` under the reserved field `formResponse` (shown as the
  From Form chip; validated by items as an unknown object field → added to KNOWN_FIELDS as kind `form`).

## 7. Starters (`starters.ts`)

`FORM_STARTERS: readonly FormStarter[]` with `{ id: 'blank'|'bug-report'|'feedback'|'feature-request'|'rsvp'|'job-application'|'contact', name, line, readyType?: 'bug'|'idea'|'candidate', form(newId): FormDefinition, fields: {questionId, label, kind, options?, scale?}[] }` exactly as the spec's table. `telemetryType` maps to `Blank`, `BugReport`, ...

## 8. Public projection (`public.ts`)

`publicForm(form) → PublicForm`: heading, description, accent, cover, sections with questions stripped of `goesTo`;
settings `confirmation`. Never the destination, ids of fields or the starter.

## 9. Document (`packages/document`)

- `TabKind` gains `'form'`; `PLAN_TAB_KINDS` = board, sheet, dashboard, form; `isPlanTabKind`, `tabKindOf` accept it.
- `Tab.form?: FormDefinition`. Tab validation keeps it as JSON; readers call `readForm`.
- A copy (`copyDocument`, tab duplicate, import) keeps `form` and clears nothing in it; the link lives server-side
  so a copy is unpublished by construction. A duplicate whose destination tab was not copied clears `destination`
  (`remapFormDestination(form, tabIdMap)`).

## 10. Items: the two field kinds

- `CUSTOM_FIELD_KINDS` += `'multichoice'`, `'rating'`. `CustomFieldDef.scale?: number` (rating; default 5).
- `readCustom`: multichoice reads options as choice does; rating reads `scale` in 3..10.
- `card-text.ts` `customFieldText`: multichoice joins `, `; rating `★★★★☆` up to 5, else `n / scale`.
- `board-csv.ts`: multichoice `; `-joined in and out; rating as the number, refused outside 1..scale.
- `type-changes.ts` (MCP `change_card_types`): accepts the kinds; `options` for multichoice, `scale` for rating.
- `KNOWN_FIELDS.formResponse = 'form'`; `checkFields` validates `{ tabId: string, number: int ≥1, at: number }`.
- Editor: `CustomFieldKindParts` (icons: list-checks, star), the Add Field grid becomes 12 tiles six to a row,
  `CustomFieldEditor` gains `MultiChoiceEditor` (checkbox list) and `RatingEditor` (radio group of stars, arrows),
  the card chip draws the text above.

## 11. Api

### Tables (migration `0092_forms.sql`)

```sql
CREATE TABLE form_links (
  code TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  tab_id TEXT NOT NULL,
  open INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  responses INTEGER NOT NULL DEFAULT 0,      -- the response number last given
  hour_start INTEGER NOT NULL DEFAULT 0,     -- per-form hourly cap window
  hour_count INTEGER NOT NULL DEFAULT 0,
  suspended_at INTEGER,
  last_email_at INTEGER, held_emails INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX form_links_tab ON form_links(document_id, tab_id) WHERE suspended_at IS NULL;
CREATE TABLE form_reports (code TEXT NOT NULL, browser TEXT NOT NULL, network TEXT NOT NULL, reason TEXT NOT NULL,
  note TEXT, created_at INTEGER NOT NULL, PRIMARY KEY (code, browser));
CREATE TABLE form_reads (code TEXT NOT NULL, owner_id TEXT NOT NULL, seen_number INTEGER NOT NULL,
  PRIMARY KEY (code, owner_id));
```

Unseen = `responses - seen_number` (by response number, so no per-card rows).

### Routes

| Method | Path                                             | Gate        | Does                                                                                     |
| ------ | ------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------- |
| GET    | `/api/documents/:id/tabs/:tabId/form-link`        | read        | `{ link: FormLinkDTO \| null, responses, unseen }`; `code` only to edit                   |
| POST   | `/api/documents/:id/tabs/:tabId/form-link`        | edit        | Publish: 409 `form_already_published`, 409 `form_destination_missing`, 403 `form_suspensions` |
| PUT    | `/api/documents/:id/tabs/:tabId/form-link`        | edit        | `{ open: boolean }`; purges the public cache                                             |
| DELETE | `/api/documents/:id/tabs/:tabId/form-link`        | edit        | Deletes the live link                                                                    |
| POST   | `/api/documents/:id/tabs/:tabId/form-seen`        | read        | `form_reads.seen_number = responses` for the caller                                      |
| GET    | `/api/forms/:code`                                | public      | `PublicFormDTO` `{ state: 'open' \| 'closed', form?, closedMessage?, backdrop }`, cached 60 s, 404 `form_not_found` |
| POST   | `/api/forms/:code/responses`                      | public, `FORM_RATE_LIMITER` per network | 201 `{ number }`; 400 `{ error: 'invalid_answers', errors }`; 409 `form_closed`; 413 `form_full` / `payload_too_large`; 429 `rate_limited` / `form_busy` |
| POST   | `/api/forms/:code/reports`                        | public, `COMMUNITY_RATE_LIMITER` per network | 201; once per browser (`X-Owner-Id`)                                   |

Public routes are exempt from the auth parse and the owner-keyed write limiter, as `/api/share` is. A trashed
document, a suspended link, a missing tab or a tab whose kind is not `form` answer 404 / closed alike, no leak.

### The response write (`forms/respond.ts`)

1. Body ≤ RESPONSE_BODY_MAX; hidden field set → 201 `{ number: 0 }`, `[forms] form.response.dropped`.
2. Read link (404), document (trash → 404), Form tab row (`readForm`); open check (switch, closesAt, limit,
   suspended) → 409 `form_closed`.
3. `checkResponse` → 400 with errors.
4. Destination: the board tab row exists and holds a board taking `typeId` with a column of `status`, the type in the
   catalogue; else 409 `form_closed` and `[forms] form.destination.broken`.
5. Claim the number and the hourly slot in one guarded UPDATE
   (`responses = responses + 1, hour_count = CASE ... END WHERE code = ? AND hour_count < cap RETURNING responses`);
   no row → 429 `form_busy`.
6. `createMany` with `by` = the form person `{ id: 'form:<code8>', name: '<heading> form', color: accent }`;
   `items_full` → 413 `form_full` (the number is not reused: it stays claimed).
7. Relay the item; `waitUntil` the email (`notifyFormResponse`, throttled by `last_email_at`/`held_emails`).

### Logs

`[forms] form.published`, `form.closed`, `form.reopened`, `form.deleted`, `form.response.accepted`,
`form.response.refused {error}`, `form.response.dropped`, `form.destination.broken`, `form.reported`,
`form.suspended`, `form.email.sent|held`.

### Elsewhere in the api

- Tab delete deletes the tab's form links (`deleteFormLinksForTab`) in the tab delete batch.
- Activity (`GET /api/activity`) gains `formResponses: { code, documentId, documentName, tabId, heading, unseen,
  boardTabId }[]` for documents the reader may edit with `unseen > 0`.
- `notification-prefs`: a `formResponses` email preference (default on).
- `LIVE_ROUTE_SEGMENTS` += `form`; `pageViewPath('/form/<code>')` → `/form`.

## 12. Live: the Form tab

| File                                         | Contract                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `hooks/forms/useFormActions.ts`              | `changeForm(fn, kind)` commits `tab.form` (one undo step per change), `startForm(starter)`        |
| `hooks/forms/form-edits.ts`                  | Pure edits: add/duplicate/delete/move question, section, option ops, `setTarget`, `setType` (keeps prompt and compatible settings, drops a mapping the new type cannot take) |
| `hooks/forms/useFormLink.ts`                 | Loads and changes the link via `lib/api/forms.ts`; `markSeen` on open                            |
| `components/forms/FormTab.tsx`               | The page: column, cover, heading, sections, add bar; selection; Preview                          |
| `components/forms/FormQuestionCard.tsx`      | One question, view and edit states                                                               |
| `components/forms/QuestionControl.tsx`       | The respondent's control per type (shared by builder, preview and the public page)               |
| `components/forms/FormPanel.tsx`             | Question / Responses Go To / Settings tabs                                                       |
| `components/forms/AnswerGoesTo.tsx`          | The mapping picker                                                                               |
| `components/forms/ShareFormDialog.tsx`       | Publish, copy, open, switch, delete                                                              |
| `components/forms/FormStatusBar.tsx`         | "14 responses · 3 new", View on Board, paused and suspended notices                               |
| `components/plan/start/start-planning-items.ts` | `forms` category and `{ kind: 'form', starter }` items                                         |

Start: `startForm(starter)` → one `commitTabs` making the tab `kind: 'form'`, `form`, and (when needed) the new Board
tab after it (`newSlotTab`-style board, columns New/In Progress/Done); then `itemTypes.addTypes` / `saveType` for
the card type and fields.

## 13. Live: the respondent page

- `app/form/page.tsx` (static, `index: false`), the live worker rewrites `/form/<code>` to `/form/placeholder` as
  it does `/document`; `components/forms/respond/FormRespondPage.tsx` reads the code from the path.
- Imports only `@livediagram/forms` (answers, messages), `QuestionControl` and `@livediagram/ui` primitives: no
  editor modules (guarded by a first-load test listing the page's chunks).
- Session storage key `livediagram:form:<code>`; wrapped in try/catch.

## 14. Tests (traceability)

| Spec rule                                   | Test                                                     |
| ------------------------------------------- | -------------------------------------------------------- |
| readForm sanitises every field              | `packages/forms/src/read.test.ts`                        |
| Every answer error per type                 | `answers.test.ts`                                        |
| Mapping table, fallback when field removed  | `mapping.test.ts`                                        |
| Title, Description, field values, numbering | `card.test.ts`                                           |
| Starters match the spec table               | `starters.test.ts`                                       |
| Public projection hides mapping/destination | `public.test.ts`                                         |
| New field kinds read, CSV, card text        | `packages/items` tests beside each file                  |
| Form tab kind always Plan                   | `packages/document/src/dashboard.test.ts` (kinds list)   |
| Owner routes gated by role                  | `apps/api/src/routes/form-link-routes.test.ts`           |
| Response write: open, closed, invalid, full, busy, hidden field, destination broken | `form-public-routes.test.ts` |
| Reports suspend after three networks        | `form-reports.test.ts`                                   |
| Share roles in the builder                  | `apps/live/components/forms/FormTab.roles.test.tsx`      |
| Edits are pure and one step                 | `hooks/forms/form-edits.test.ts`                         |
| Respondent page: sections, errors, submit   | `components/forms/respond/FormRespondPage.test.tsx`      |
| `/form/<code>` page view drops the code     | `packages/api-schema/src/page-views.test.ts`             |
