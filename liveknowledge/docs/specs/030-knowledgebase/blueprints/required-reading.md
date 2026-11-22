# Blueprint: Required Reading

How [Required Reading](../required-reading.md) is built. It follows [Watching a Page](watching.md) for the store (a
room table of its own written through `knowledgeDb`, a route under the page, one editor store read once a session)
and Remind the Owners (`knowledge/knowledge-emails.ts`) for the email: a press, a mark that holds the week, the
Knowledgebase Reviews switch and the shared daily ceiling.

## Domain and naming

- **Requirement** (`page_required_reading` row): a page's `audience` (`ReadingAudience`: `everyone` or `people`),
  its `people` (the chosen account ids, `people` only), who set it and when, `asked_at` (when this **round** began)
  and `round` (1, then one more each time everyone is asked again).
- **Confirmation** (`page_read_confirmations` row): one person's I've Read This on one page, with `at`.
- **Asked**: a person the requirement covers. `everyone`: any signed-in person who reads the page. `people`: the
  chosen. **Audience list** (what Editors see and what is counted): `people`'s chosen; `everyone`'s team joined
  members with an account, the knowledgebase's owner and every confirmer, once each.
- **Sees**: an Editor, or the page's owner (`Tab.knowledge.owner`), in person. **Manages**: an Editor in person.
- **Remind**: `ReadingRemindResult`; its mark is `knowledge_email_marks` kind `reading-remind`, key `<tab> <person>`
  (a space: neither id holds one).

## Interfaces and contracts

`@liveknowledge/api-schema` `page-reading.ts`:

- `PageReadingResponse { required: { audience, askedAt, round } | null, mine: { asked: boolean, readAt?: number },
progress: { done, total } | null, sees: boolean, manages: boolean, people?: PageReadingPerson[], chosen?: string[],
remindedAt?: number, email: boolean }`. `people` (each `{ id, name, readAt?, remindedAt? }`, not yet read first,
  then read, newest first, at most `READING_LIST_MAX`) and `remindedAt` only when `sees`; `chosen` only when
  `manages` and the audience is `people`. `email`: whether Remind can send at all (`emailEnabled`).
- `PageReadingChange { audience: ReadingAudience | null, people?: string[] }`.
- `ReadingRemindResult`: `{ outcome: 'sent', sent }`, `{ outcome: 'already_sent', nextAt }`, `'nobody_pending'`,
  `'no_recipients'`, `'daily_limit'`, `'unavailable'`.
- `KnowledgeRequiredReadingPage { tab, title, audience, done, total }`; `KnowledgeOverviewResponse.requiredReading?`.

Routes, `routes/knowledge-reading-routes.ts`, under `/api/documents/<id>/pages/<tab>/reading`, run after the
knowledge router's grant and page lookup:

| Method and path        | Who                                      | Answers               | Refusals                                                                                                       |
| ---------------------- | ---------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET reading`          | every grant that reads the page          | `PageReadingResponse` |                                                                                                                |
| `PUT reading`          | an Editor in person                      | `PageReadingResponse` | `forbidden` 403, `invalid_change` 400, `too_many_people` 400, `reading_pages_full` 409, `reading_too_fast` 429 |
| `POST reading/confirm` | a signed-in person who is asked          | `PageReadingResponse` | `reading_needs_account` 403, `not_required` 409, `not_asked` 409, `reading_too_fast` 429                       |
| `POST reading/again`   | an Editor in person                      | `PageReadingResponse` | `forbidden` 403, `not_required` 409, `reading_too_fast` 429                                                    |
| `POST reading/remind`  | an Editor or the page's owner, in person | `ReadingRemindResult` | `forbidden` 403, `not_required` 409                                                                            |

"In person": `pageCreatorOf(ctx)` is an account (`isAccountId`), `readerOf(ctx).kind === 'person'` and no token.
Each method is in the OpenAPI manifest, its types in `ROOT_TYPES`.

## Behaviour and state

- **The store** (`knowledge/page-reading.ts`): `requirementOf(env, tab)`, `confirmationsOf(env, tab)`,
  `setRequirement(env, tab, change, by, now)` (an upsert that keeps `asked_at` and `round` for a page already
  required; a new row only while the knowledgebase holds fewer than `REQUIRED_READING_PAGES_MAX`, one statement as
  watching's), `clearRequirement` (the row and its confirmations, one batch), `confirmRead(env, tab, person, now)`
  (`INSERT ... ON CONFLICT DO NOTHING`), `askAgain(env, tab, now)` (confirmations deleted, `asked_at` now, `round` +
  1, one batch). All through `knowledgeDb`: nothing is an edit.
- **The audience** (`knowledge/reading-people.ts`): `audienceOf(env, document, requirement, confirmers)` answers the
  audience list's ids and the names it knows; `everyone` reads the team through `teamPeople`, kept 60 s a team in
  memory (`TEAM_CACHE_MS`, at most `TEAM_CACHE_MAX` teams), so a page read by many in a minute reads the team once.
  Names missing from the team come from one `getParticipants` read; one never found reads "Someone".
- **The answer** (`readingAnswer`): `progress.total` the audience list's size, `done` its confirmers; `mine.asked`
  for a person in person who is in it, or anyone signed in under `everyone`. A page not required answers
  `required: null` from one indexed read, with no team read.
- **Remind** (`knowledge/reading-remind.ts`): the audience list less confirmers, accounts only; less anyone whose mark
  for this page is newer than `READING_REMIND_GAP_MS` (one prefix read of the page's marks). None pending:
  `nobody_pending`; all marked this week: `already_sent` with the soonest mark plus the gap. Then `ownersWhoReach`,
  `reserveEmails` (the shared 50 a day), one `readingReminderEmail` (the same for each), `notifyKnowledgeReviews`.
  Everyone tried gets their mark (one with the switch off too: they chose), so the week holds; nothing tried takes
  none. `sent` counts those the notifier emailed.
- **Ask again** from the editor: `lib/required-reading/read-again.ts` holds which pages have the draft bar's toggle
  on. `useEditorPageEditing`'s `save` calls `noteOwnSave(tabId)`, which, when it is on for the page, clears it and
  hands the page to the sender `ReadAgainToggle` registered (the store's `askAgain`, with its toast). The toggle
  clears itself when it unmounts (Save, Cancel, leaving the page). The save and the ask are two requests: the ask
  never waits on the sync.
- **The overview** (`readingOverview(env, document)`): every requirement and its confirmers in two reads, the team
  read once when any page is `everyone`; least read first (`done / total`, then title).
- **The daily prune** drops `reading-remind` marks older than `READING_MARKS_KEPT_MS` (8 days, past the gap).

## Data and persistence

- `page_required_reading (tab TEXT PRIMARY KEY, audience TEXT CHECK (audience IN ('everyone','people')), people
TEXT NOT NULL DEFAULT '[]', set_by TEXT NOT NULL, set_at INTEGER NOT NULL, asked_at INTEGER NOT NULL, round INTEGER
NOT NULL DEFAULT 1)`; trigger `page_required_reading_tab_removed` AFTER DELETE ON tabs.
- `page_read_confirmations (tab TEXT, person TEXT, at INTEGER, PRIMARY KEY (tab, person))`, index `(person)`;
  trigger `page_read_confirmations_tab_removed`.
- Schema step V42 (`requiredReadingSchemaStep`), appended after V41, additive and IF NOT EXISTS.
- A closed account (`document-anonymise.ts`): its confirmations are deleted and its id leaves every `people` list.
- Never in the page's body, a snapshot, an export or a copy.

## Errors and edge cases

- A page in the Trash reads as missing (404), as every page route. A page deleted for good takes its rows by
  trigger.
- An Editor changes `everyone` to `people`: confirmations of people not chosen stay stored and stop counting; back to
  `everyone`, they count again. Stop Requiring deletes them.
- Chosen ids are deduplicated; an empty `people` list or one that is not an array of account ids is
  `invalid_change`.
- Two confirms at once: the primary key keeps one.
- Remind with email off for the deployment answers `unavailable` and writes nothing.

## Security and trust

- Names and ids of who read, or who was reminded, leave the api only in a `sees` answer. Every other answer carries
  counts and the caller's own state.
- Confirming writes the caller's own row alone, from the request's credentials, never from the body.
- Abuse: `READING_CHANGES_PER_MINUTE` a person a knowledgebase for confirm, set and ask again (its own rate map);
  Remind is bounded by its weekly mark a person a page and the shared daily ceiling.

## Performance and limits

- A page read pays one indexed read for the requirement; a required page one more for its confirmations (at most
  `READING_LIST_MAX` rows), and for `everyone` the team read, cached 60 s.
- The overview: two reads (requirements, at most 200; confirmations of those pages) and at most one team read.
- Remind: one prefix read of marks, one reach check (the team read, then a grant request a person outside it), one
  batch of marks, one notifier call.
- The editor reads a page's state once a session, after the page drew, and again after the person's own change.

## Presentation and UX

- `lib/required-reading/reading-store.ts`: each page's `PageReadingEntry` (`loading`, `ready`, `failed`), `load`
  (once a session; concurrent asks share one request), `confirm` (shown at once: `mine.readAt` now, `done` + 1; put
  back on a refusal), `set`, `askAgain`, `remind` (each answering the api's body).
- `components/required-reading/`: `useRequiredReading(tab?)` (the slice for the open page, `shown`: signed in or not,
  not Offline, not an embed), `RequiredReadingBanner` (above the meta row, `PageKnowledgeSlots`), `PageRailReading`
  (the rail's section, after Page Health), `ReadingSetupPanel` (the popover; `BottomSheet` on a phone),
  `ReadAgainToggle` (the draft bar, left of Cancel), `reading-icons.tsx`; `components/ai-knowledge/RequiredReadingCard`.
- The banner: `role="region"` named "Required Reading", brand-50 ground and brand-200 hairline (dark: brand-950/40
  and brand-900/60), the book glyph in a 28 px brand chip, the words, and `Button` primary `sm` **I've Read This**
  at the right (under the words on a phone, full width, 44 px).
- The rail section: `RAIL_LABEL` heading **Required Reading**; a 6 px rounded bar (brand on slate-100, its share
  done), "7 of 12 have read it" and the audience on the right ("Everyone", "4 People"); the caller's line; for
  `sees`, **Not Yet** and **Read** groups (the rail's `Disc`, name, the date for Read; the first 8 of each with
  "Show all 23" opening the rest in place), then **Remind** (`Button` secondary `xs`, the bell) and "Last reminded
  <when>"; for `manages`, **Change** (a link-styled button beside the heading).
- Toasts: "Thanks. You've confirmed you read Expenses."; "Expenses is now Required Reading."; "Expenses is no longer
  Required Reading."; "Everyone is asked to read Expenses again."; Remind's outcomes (`remindText`). Refusals in words
  (`readingFailureText`, `lib/required-reading/reading-words.ts`).
- Empty and loading: the rail section and the banner draw nothing until the page's state is read (no layout shift in
  the writing: the banner arrives with the page's first read, before the person scrolls); a failed read draws
  nothing.

## Accessibility

- The banner is a named region; I've Read This is a real button named "I've Read This". The bar is a `progressbar`
  with `aria-valuenow`, `aria-valuemax` and its words as `aria-valuetext`. The setup panel is a `dialog` named
  "Required Reading" with a `radiogroup` for the audience and checkboxes for the people; Escape closes it and focus
  goes back to its button. The draft bar's toggle is a `switch` named "Ask Everyone to Read Again" with
  `aria-checked`. Contrast holds 4.5:1 for every line on both grounds; motion is the bar's 200 ms width, none with
  reduced motion.

## Observability

- `[reading] set` (document, page, audience, people), `[reading] stopped`, `[reading] confirmed`, `[reading] asked
again` (how many confirmations cleared), `[reading] reminded` (pending, tried, sent, held). Telemetry: `UI·Used`
  `RequiredReadingSet`, `RequiredReadingStopped`, `ReadConfirmed`, `ReadingReminded`, `ReadingAskedAgain`; the email
  kind `ReadingReminder`.

## Testing

- api `routes/knowledge-reading-routes.test.ts`: each role reads, an Editor requires for everyone and for chosen
  people, a Participant, a Viewer, a link and an agent are refused; who confirms (asked or not, a guest, a token);
  names only for an Editor and the page's owner; ask again clears and counts again; Stop Requiring; the bounds and
  the rate; the overview's counts; Remind's week, ceiling, unavailable and nobody pending; a trashed and a deleted
  page; a closed account.
- api `email/reading-reminder-email.test.ts`: the lines, escaping, the settings link.
- editor `lib/required-reading/reading-store.test.ts`, `components/required-reading/required-reading-roles.test.tsx`
  (the banner for the asked only, the rail per role, the panel, the toggle and Save asking again),
  `components/ai-knowledge/RequiredReadingCard.test.tsx`.

## Constants and configuration

`REQUIRED_READING_PAGES_MAX` 200; `READING_PEOPLE_MAX` 200; `READING_CHANGES_PER_MINUTE` 30; `READING_LIST_MAX` 500;
`READING_REMIND_GAP_MS` 7 days; `READING_MARKS_KEPT_MS` 8 days; `TEAM_CACHE_MS` 60 s; `TEAM_CACHE_MAX` 100; the
shared `KNOWLEDGE_EMAILS_PER_DAY` 50.
