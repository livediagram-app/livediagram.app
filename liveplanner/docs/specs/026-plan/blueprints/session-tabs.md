# Session tabs blueprint

Derived from [Session tabs](../session-tabs.md). File-level contracts, constants, defaults and tests.

## Domain and naming

| Spec term     | Identifier                                                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session tab   | `TabKind` `'session'` (`tab-kind.ts`), in `PLAN_TAB_KINDS`                                                                                                                                                                                                          |
| session state | `Tab.session: SessionTabState` (`packages/project/src/session-tab.ts`)                                                                                                                                                                                              |
| session kind  | `SessionKindId` (`'refinement' \| 'planning' \| 'triage' \| 'review' \| 'standup'`), `SESSION_KINDS` (label, outcomes, completes, closes, stays, archived, grouping `'none' \| 'person'`, tally)                                                                    |
| person        | `StandupPerson` `{ key, person, cards }`, `standupPeople()`, `personKeyOf()`, `UNASSIGNED_KEY` (`'unassigned'`) in `packages/items/src/session-standup.ts`                                                                                                          |
| people order  | `SessionSetup.personOrder` (`'alphabetical' \| 'shuffled'`, absent: Board Order), `standupSeed()`                                                                                                                                                                   |
| person Done   | `SessionTabState.peopleDone` (person key to `{ at, by }`); `withPersonDone()`, `withoutPersonDone()`, `lastStandupStep()` (`session-tab.ts`)                                                                                                                        |
| blocker       | a `flagged` decision with a `reason` on a Stand-up tab; `BlockedDialog`, `blockedHeroArt`, `BlockersSummary` (`liveplanner/apps/editor/components/session/standup/`)                                                                                                |
| set-up        | `SessionSetup` `{ typeIds, statuses, sortBy?, targets?, closeTargets?, timeboxMs?, capacity?, since?, until?, presenter? }`                                                                                                                                         |
| done range    | `SessionSetup.since`, `.until` (ms); `SessionPick.since`, `.until`, `.archived`; `doneRangeFrom()`, `inDoneRange()` in `packages/items/src/session-review.ts`                                                                                                       |
| presenter     | `SessionTabState.presenters` (card id to `ItemPerson` or `null`); `presenterOf()` (`session-tab.ts`); `SessionSetup.presenter: 'none'` turns it off                                                                                                                 |
| feedback      | `Comment.label` `'review'` (`COMMENT_LABELS`, `isCommentLabel`, `packages/project/src/comments.ts`); `reviewFeedback()` and `feedbackThreadOf()` (`liveplanner/apps/editor/components/session/review/review-feedback.ts`)                                           |
| follow-up     | `SessionTabState.followUps` (card id to new card ids); `withFollowUp()`; `followUpFieldOf()`, `followUpStatus()`, `FOLLOW_UP_TITLE_MAX`, `SESSION_FOLLOW_UPS_MAX` (`session-review.ts`); `FollowUpDialog`                                                           |
| demo strip    | `DemoStrip` (`liveplanner/apps/editor/components/session/review/DemoStrip.tsx`)                                                                                                                                                                                     |
| outcome       | `SessionOutcome` `'refined' \| 'skipped' \| 'flagged' \| 'committed' \| 'accepted' \| 'closed' \| 'reviewed' \| 'discussed'`; `SessionDecision` (with `SessionDecisionDetail`: `from`, `to`, `flagSet`, `reason`, `duplicateOf`, `linked`); `SESSION_KIND_OUTCOMES` |
| close stage   | `sessionCloseTarget()` in `packages/items/src/session-triage.ts`                                                                                                                                                                                                    |
| reason        | `sessionReason()`, `SESSION_REASON_MAX` (200), `session-triage.ts`; `reasonFits(kind, outcome)` (`session-queue.ts`)                                                                                                                                                |
| duplicate     | `duplicateFieldOf()` (`session-triage.ts`); the editor's `duplicateLink`, `duplicateUnlink` (`liveplanner/apps/editor/components/session/triage/triage-duplicate.ts`)                                                                                               |
| priority pill | `PriorityPill` (`apps/editor/components/session/triage/PriorityPill.tsx`)                                                                                                                                                                                           |
| Close dialog  | `CloseDialog`, `closeHeroArt` (`apps/editor/components/session/triage/CloseDialog.tsx`, `CloseHeroArt.tsx`)                                                                                                                                                         |
| Undo Last     | `lastDecided()` (`session-tab.ts`); `SessionUndoLast` on `SessionActionBar`                                                                                                                                                                                         |
| tally         | `sessionTally()`, `capacityState()` in `packages/items/src/session-tally.ts`                                                                                                                                                                                        |
| facilitator   | `SessionFacilitator` `{ id, name, color }`, `id` the collab key                                                                                                                                                                                                     |
| queue         | `sessionQueue()` in `packages/items/src/session-queue.ts`                                                                                                                                                                                                           |
| target stage  | `sessionTarget()` in `session-queue.ts`                                                                                                                                                                                                                             |
| history entry | `ItemHistoryChange` `{ kind: 'session', session, outcome, reason?, duplicateOf?, undone? }`, tag `'session'`                                                                                                                                                        |
| fill button   | `FillActionButton` (`apps/editor/components/session/FillActionButton.tsx`)                                                                                                                                                                                          |

Never "meeting", "ceremony" or "host" in code or copy; the dot vote's `startedBy` host is unrelated.

## Data and persistence

`SessionTabState` (version 1), stored whole on the tab body and carried in `tab-meta` patches like `timer`:

```ts
{ v: 1; sessionKind: 'refinement' | 'planning' | 'triage' | 'review' | 'standup'; setup: SessionSetup;
  facilitator?: SessionFacilitator; currentId?: string; cardStartedAt?: number;
  decided?: Record<itemId, { outcome; at; by; from?; to?; fromRank?; flagSet?; reason?; duplicateOf?; linked? }>;
  presenters?: Record<itemId, ItemPerson | null>; followUps?: Record<itemId, string[]>;
  peopleDone?: Record<personKey, { at; by }> }
```

- `readSessionTab(raw)` is the only reader: anything malformed reads as `null` (the page then shows the empty set-up
  state). Unknown session kinds read as `null`. `typeIds` and `statuses` are deduped strings, capped at
  `SESSION_TYPES_MAX` (50) and `SESSION_STAGES_MAX` (100); `sortBy` through `normaliseBoardSort`; `targets` keeps
  string pairs only, `closeTargets` likewise; a decision's `from` and `to` only as a pair of strings, `flagSet` only as
  `true`, `reason` through `sessionReason`, `linked` only beside a `duplicateOf`; `capacity` a positive number rounded to a whole point and capped at `SESSION_CAPACITY_MAX`
  (9 999), else dropped; `timeboxMs` clamped to `SESSION_TIMEBOX_MIN_MS`..`SESSION_TIMEBOX_MAX_MS` (1 to 30 minutes) or
  dropped; `decided` capped at `SESSION_QUEUE_MAX` (500) entries; `since` and `until` finite non-negative numbers
  (an `until` before `since` dropped), `presenter` only as `'none'`; `presenters` keeps `isItemPerson` values or
  `null`, `followUps` deduped string lists of at most `SESSION_FOLLOW_UPS_MAX` (20), both capped at 500 cards; `personOrder` only
  as `'alphabetical'` or `'shuffled'`; `peopleDone` keeps non-empty keys with a numeric `at` (its `by` a string, else
  `''`), capped at 500 people.
- `Comment.label` lives inside the thread row's `comments` JSON: no column, no migration. `isComment` refuses any
  label but `'review'`.
- No migration: a tab without `session` is not a Session tab; an old build reads `kind: 'session'` as the general kind
  (`tabKindOf`) and shows an empty canvas, losing nothing.

## Behaviour and state

- `holdOrder(order, toGo)` keeps the to-go cards in the order a screen first queued them (known ids in their old
  place, new ones after in the board's order) and answers the order to keep; `useSessionRun` holds it in a ref keyed
  by the set-up's value, so a saved set-up sorts afresh.
- `sessionQueue({ items, types, planStatuses, setup, decided })` answers `{ decided: Item[], toGo: Item[], capped }`:
  decided cards (still present, not trashed, not archived unless `pick.archived`) by `at`; to-go cards whose type is in
  `typeIds` and status in `statuses`, not trashed, not archived unless `pick.archived`, entered their status
  (`itemStatusSince`) within `pick.since`..`pick.until` when given, not decided, `sortCards` by `sortBy` over rank
  order, capped at 500. Sprint Review passes `archived: true`.
- Sprint Review: `SESSION_KINDS.review.stays` makes `decide` move nothing for `reviewed`; `doneRangeFrom(preset, now,
lastReviewAt)` answers a chip's date (`since-last`, `7`, `14`, `30` days, `all` none); `lastReviewAt(tabs, exceptId)`
  the newest decision `at` of another review tab. `presenterOf(session, item)`: `presenters[id]` when the key is set
  (null: no one), else `itemAssignee(item)`, `null` with `presenter: 'none'`. `withPresenter`, `withFollowUp`
  (append, dedupe, cap). `followUpFieldOf(type, toType)`: a Card field of `type` labelled in `FOLLOW_UP_FIELDS` linking
  to `toType`; `followUpStatus(type, names)`: the type's first status whose name is Backlog-like, else `null` (the
  editor then uses `newCardStatus`). Feedback: `feedbackThreadOf(threads)` the newest open thread whose first comment
  has `label: 'review'`; a reply to it, else a start with title `Sprint Review feedback`, both `label: 'review'`.
- `sessionTarget(item, types, planStatuses, targets, { names, phases })`: `targets[type]` when it is a status the type
  uses, else Next Stage over `typeStatusesOf(type, planStatuses)`: the first open status after the card's (open: not
  its own, not Done-like by phase `done` or name, not Backlog-like by name), stopping at a Done-like one; with none,
  and a Done-like status before the card's, the type's first open status (the Sprint Board's Ready to To Do); else
  `null` (the card stays: the outcome moves nothing). The editor passes the plan's status names and phases, and the
  kind's `passStages` as `pass` (Bug Triage's `TRIAGE_WAITING_STAGES`: a stage named so is never open).
- `sessionCloseTarget(item, types, planStatuses, closeTargets, { names, duplicate })`: `closeTargets[type]` when the
  type uses it, else (with `duplicate`) the type's stage named Duplicate, else its first stage whose `doneNameKey`
  name is in `CLOSE_LIKE` order (Won't Fix first), else `null`; the card's own stage reads as `null` (it stays).
- `duplicateFieldOf(type, toType)`: the type's Card field (in its fields) labelled Duplicate Of, Duplicates, Duplicate
  or Duplicated By that links to `toType`. `duplicateLink` adds the duplicate to it (appending to a field holding
  several; null when it holds it already or holds one other card); `duplicateUnlink` takes only that card back out.
- Undo (`useSessionRun.undo`): with the card present, moves it back to `from` while its status is still `to`, in front
  of `beforeRank(items, from, fromRank)` (the decision keeps the card's `fromRank` beside `from` and `to`), clears
  the flag when `flagSet` and still flagged, `duplicateUnlink`s a `linked` duplicate, records `{ ..., undone: true }`;
  then `withoutDecision` and `withCurrent` on the card. `lastDecided(session)` names Undo Last's decision (the newest
  `at`).
- `outcomeFits(kind, outcome)`: the outcome is one `SESSION_KIND_OUTCOMES[kind]` offers (refinement: refined, skipped,
  flagged; planning: committed, skipped; triage: accepted, closed, skipped, flagged). The kind's `completes` outcome
  (`refined`, `committed`, `accepted`) is the fill button and moves the card to `sessionTarget`; its `closes` outcome
  (`closed`) opens the Close dialog and moves the card to `sessionCloseTarget`.
- `sessionTally(cards, decided)`: over the cards decided `committed`, `{ points, counted, unestimated }`, a card's
  points its `estimate` when a finite number of 0 or more, else it is `unestimated` (never 0).
  `capacityState(points, capacity)`: `'none'` without a capacity, `'over'` past it, `'near'` from `CAPACITY_NEAR`
  (85%) of it up to it, else `'under'`.
- `nextCurrent(queue, currentId)`: the first to-go card after `currentId` in the to-go order, else the first to-go
  card, else `null` (complete).
- `currentOf(queue, session)`: `session.currentId` when it is in the queue, else `nextCurrent(queue)`.
- Facilitator: `mayClaim(session, canEdit)` (no holder, Editor); `isFacilitator(session, selfId)`;
  `facilitatorAway(lastSeenAt, now)` true past `FACILITATOR_GRACE_MS` (10 s) of this screen not seeing them.
- `withDecision(session, itemId, outcome, by, now, nextId, detail?)` records the outcome with what it did, moves `currentId` to `nextId` and
  restarts `cardStartedAt`; `withoutDecision` clears one; `withCurrent` moves the current card and restarts the clock.
- Timebox: `timeboxLeftMs(session, now)`; `timeboxUp` at 0. The chime plays on the transition seen by a mounted
  screen, once per `(currentId, cardStartedAt)`.

- Stand-up (`packages/items/src/session-standup.ts`): `personKeyOf(item)` the Assignee's id, else `UNASSIGNED_KEY`.
  `boardOrder(cards, planStatuses)` sorts by the stage's place in the plan's column order, then rank.
  `standupPeople(cards, { order, seed })` groups the (already board-ordered, held) cards by `personKeyOf`, each group's
  cards in their given order; people in Board Order (first card's place), by name (`localeCompare`, then key) or by
  `seededRank(seed, key)` (an FNV-1a hash of `seed` and the key, ties by key), `Unassigned` last always.
  `standupSeed(tabId, now)` (read once as the page opens, so a session never reshuffles midway) is `${tabId}:${YYYY-MM-DD in UTC}`. `STANDUP_INFLIGHT_STAGES` the in-flight names the set-up
  starts from (with the Doing phase, `SessionKindLook.startPhase: 'doing'`).
- Stand-up's run (`useStandupRun`): the list is `boardOrder` over the decided and to-go cards, held by `heldOrder`
  over the whole list (so a flagged or moved card keeps its place), then grouped. The room's card is `currentId` when
  queued, else the first card of the first person not Done, else none (complete). `goTo` keeps `cardStartedAt` when the
  card's person is the room's person (`withCurrent(..., keepClock)`), else restarts it. `block(reason)` patches
  `flagged: true` when not flagged, starts or replies in the day's stand-up thread with `Blocked: {reason}`, records
  `flagged` with the reason, and `withOutcome`s the decision (the room stays; each call is one step over the card's decision, which it keeps as
  `prior`, at most eight deep).
  `moveStage(to)` moves the card (`before: null`), and `withOutcome`s `discussed` with `{ from, to, fromRank }` (an
  existing decision keeps its outcome, this step's move on top). Undo Last reverts `sessionStep(d)`, the latest step's
  own move and flag, and `withoutStep` puts the `prior` decision back. `done()` records `discussed` for each
  undecided card of the room's person and `withPersonDone(s, key, by, now, ids, nextId)`; `nextId` is the first card of
  the next person not Done after this one, wrapping, else null. `undoLast()` reads `lastStandupStep(s)`: a person step
  `withoutPersonDone` (removing the Discussed decisions with that `at` and no move) and records each undo; a card step
  undoes as every kind (`undoDecision` in `session-writes.ts`).
- `lastStandupStep(s)`: the newer of the latest `peopleDone` entry and `lastDecided(s)` (a person's Done wins a tie, as
  its Discussed decisions share its `at`).

## Interfaces and contracts

- `POST /api/projects/:id/items/:itemId/session` body `{ session: 'refinement' | 'planning' | 'triage' | 'review' |
'standup', outcome, reason?, duplicateOf?, undone? }` (edit access; a tab-scoped caller only for a card its tab shows, and a duplicate it
  shows). Appends one history entry tagged `session` holding one session change, by the caller, at now, the reason
  trimmed; writes nothing on the card. Answers `204`. Refusals: `session_invalid` (422, naming `session`, `outcome`,
  `reason`, `duplicateOf` or `undone`) for an unknown session kind, an outcome the kind does not offer, a reason that
  is not text, is past 200 characters or is neither a Close's nor a Stand-up Flagged's (`reasonFits`), a duplicate that is not a Close's, is the card itself, is
  not a card of the plan (or of the tab), and an `undone` that is not `true`; `item_not_found` (404), `forbidden` (403)
  below edit. Lives in `apps/api/src/routes/item-session-route.ts`.
- A changeset on a Session tab is refused (422 `invalid_value`) in `apps/api/src/changesets/submit.ts`.
- Thread start and reply (`CardThreadStartRequest`, `CardThreadCommentRequest`) take `label?: 'review'`, read by
  `newComment` (`apps/api/src/routes/comment-routes.ts`): any other present value answers 400 `label_invalid`. The
  offline threads (`apps/editor/lib/offline/offline-threads.ts`) keep it the same way.
- `recordSessionOutcome(scope, itemId, body)` in `apps/editor/lib/api/item-history.ts`; an offline plan records
  nothing.

## Presentation and UX

Files under `apps/editor/components/session/`: `SessionPage` (layout, lazy-loaded by `EditorStartPanels`),
`SessionSidebar`, `SessionProgress`, `SessionCard` (embeds `ItemPanelEmbedded`, wired by the board panel's own
`components/plan/item-panel-wiring.ts`), `SessionActionBar`, `FillActionButton`, `SessionFacilitatorChip`,
`SessionComplete`, `SessionSetupDialog` (+ `session-setup.ts`, pure, and `SessionHeroArt`), `SessionStartHost`
(Start Planning's dialog), `session-kinds.tsx` (per-kind looks), `session-chime.ts`, `useSessionRun.ts` (the room's
card and outcomes), `useSessionFacilitator.ts` (the baton), `useSessionTimebox.ts` (the clock and chime) and
`useSessionKeys.ts` (each outcome's key, J, K). `session-kind-parts.ts` names which parts a kind's tally adds;
Sprint Planning's live in `planning/`: `PlanningTally` (the meter under the progress bar), `EstimateStrip` (the chips
above the action bar), `EstimatePill` (a row's aside), `CapacityPart` (the set-up's Capacity and the no-Estimate
notes) and `planning-words.ts` (pure wording). Bug Triage's live in `triage/`: `PriorityPill` (a row's aside),
`CloseDialog` (the workbench `Dialog`, `size="md"`, a sheet on a phone, with `HeroDialogHeader` and `closeHeroArt`,
`ChoicePills` for the reason chips, `TextInput` and `DialogFooter`; the shared `CardPickerDialog` for Duplicate Of
opens over it), `triage-duplicate.ts` and `triage-words.ts` (the reason chips). Sprint Review's live in `review/`: `DemoStrip`
(presenter picker, `CardPullRequests`' chips, Image field and picture Attachment thumbnails through `useImageUrl`,
Link chips), `FeedbackStrip` (the text box, Add Feedback, the count), `FollowUpDialog` (the workbench `Dialog`,
`size="md"`, `phoneSheet`, `HeroDialogHeader` with `followUpHeroArt`, `TextInput`, `Select`, `DialogFooter`),
`ReviewSetupParts` (Done Range and Presenter), `ReviewSummary` (Session Complete's feedback and follow-ups),
`review-range.ts` (Since Last Review from the plan's other review tabs, read only while Session Settings is open),
`review-feedback.ts`, `useReviewRun.ts` (feedback, presenter and follow-up writes) and `useReviewParts.tsx`, which
composes them for `SessionPage` (the demo and feedback strips, Follow-up and its dialog, the N key, a row's presenter
`PersonDisc` aside, a decided card's follow-up count and the Session Complete summary).
`SessionActionBar` takes `extra` (Sprint Review's Follow-up button) and a kind that stays reads "Stays in".
Stand-up's live in `standup/`: `StandupPage` (drawn by `SessionPage` for a Stand-up, in the shared `SessionFrame` and
`SessionHeader`), `useStandupRun.ts` (the grouped queue, the room's person, Done, Blocked, Stage and Undo Last),
`StandupSidebar` (a `listbox` of person `group`s, each headed by a fold button, its cards `SessionRow`s),
`StandupActionBar` (Undo Last, Blocked, the Stage `Select`, the person line, the timebox and the Done
`FillActionButton`), `BlockedDialog` (the workbench `Dialog`, `size="md"`, `phoneSheet`, `HeroDialogHeader` with
`blockedHeroArt`, `ChoicePills` reason chips, `TextInput`, `DialogFooter`), `BlockersSummary` (Session Complete's
list), `PeopleOrderPart` (the set-up's People Order chips) and `standup-words.ts` (reason chips, the stand-up thread's
title, the person line). The comment strip is Sprint Review's `FeedbackStrip` with Stand-up's `words` and no count.
Shared pieces every kind now uses: `SessionFrame` and `SessionHeader` (the page frame and the sidebar header),
`SessionRow` (one queue row, exported by `SessionSidebar`), `session-writes.ts` (`recordOutcome`, `undoDecision`: an
outcome's history write and an undo's card writes), and `SessionProgress` over any `{ id }` units with its own noun.
`CommentRow` draws `review/ReviewFeedbackMark` for a labelled comment.
`session-words.ts` (a decided card's note, Undo Last's label) serves every kind. The tab writes go through `hooks/plan/useSessionTabActions.ts`. Start Planning
gains the `sessions` category, the `session` start kind and `start/SessionPicture`.

## Accessibility

The sidebar is a `listbox` of `option`s (`aria-current` on the room's card); the progress bar is a `progressbar` with
`aria-valuenow`; the fill button announces "Refined" through the live region; reduced motion swaps the fill for an
instant state change; keys R, S, F, C (Commit or Close), A, N (Follow-up), D (Done), B (Blocked), U, J, K act only outside text fields and
never while the Close, Follow-up or Blocked dialog is open. Stand-up's sidebar is a `listbox` holding a `group` per
person (`aria-label` the person's name and card count), its fold button `aria-expanded`; the progress bar reads "2 of 5
people done"; the Done button is named "Done: {Name}"; the Blocked dialog is a `dialog` named "Mark Blocked", its reason
a labelled text field (Enter marks, Escape cancels), its chips `aria-pressed`; the Stage picker is a labelled `select`
("Stage of WI-41"); the Blockers list is a `list` of buttons, each naming its card. The Follow-up dialog is a `dialog` named "New Follow-up", its title a labelled text
field; the feedback box is a labelled `textarea` ("Feedback on WI-47") with its count in a `status`; the demo strip is
a `region` named "Demo", its thumbnails links named for their picture. The Close dialog is a `dialog` named "Close {Type}", its reason a labelled text field (Enter closes,
Escape cancels), its chips `aria-pressed`; Undo Last names its decision ("Undo Closed BUG-33") with
`aria-keyshortcuts="U"`.

## Performance and limits

The queue is one pass over the items plus a sort of at most 500 cards, memoised on the items map, types, set-up and
decisions. The timebox ticks once a second only while a timebox is on. The page's code loads only for a Session tab.

## Observability

`[session] outcome.recorded` (with `undone`) on the api route (a refusal answers its code); `[changeset] session-tab` on a refused changeset; telemetry `Plan · Created · SessionTab`,
`Plan · Changed · SessionSetup`, `Plan · Used · Session{Refined,Skipped,Flagged,Committed,Accepted,Closed,Reviewed,Undone,FollowUp}`;
`[session] feedback.failed` and `[session] follow-up.failed` when a write is refused (a toast says why).

## Testing

- `session-tab.test.ts`: reader bounds, decisions, facilitator rules, timebox.
- `session-queue.test.ts`: filter, order, decided first, target defaults and overrides, no next stage, never into Done, past Backlog, the Sprint Board's
  wrap from Ready to To Do, cap, outcomes
  per kind, Bug Triage's waiting stages passed; `session-tally.test.ts`: points, no estimate apart, capacity states at
  their edges; `session-triage.test.ts`: close stage preference, Duplicate stage, set-up override, stays, duplicate
  field, reason bounds.
- `item-history.test.ts`: a session change kept, read back, grouped only with its tag; an undo straight after cancels
  out.
- api `item-history-route.test.ts` ("a session outcome"): records, refuses below edit, unknown outcome, tab scope, a
  Close's reason and duplicate, an undo, each refusal of `reason`, `duplicateOf` and `undone`;
  `submit.test.ts`: a changeset on a Session tab refused.
- items `session-review.test.ts`: range presets, in-range by status stamp (not last edited), follow-up field and
  status; `session-queue.test.ts` archived cards and the range; project `session-tab.test.ts` presenters, follow-ups,
  range bounds; `comments` label check; api `card-threads-route` label kept and refused.
- items `session-standup.test.ts`: grouping by Assignee, Unassigned last, board order, alphabetical, seeded shuffle
  stable per day and changing across days; queue `reasonFits`; project `session-tab.test.ts` people Done, undo of a
  Done, last step, `withOutcome` keeping a move, `personOrder` and `peopleDone` bounds.
- editor: `SessionPage.standup.test.tsx` (grouped sidebar with Unassigned last, Done recording Discussed on each card
  and moving to the next person, per-person timebox kept across a person's cards, Blocked dialog flagging with a
  reason and a comment, Stage moving the card and Undo Last taking it back, Undo of a Done, D, B and U keys, peeking,
  the comment strip per role, Session Complete's blockers opening a card), `standup-parts.test.tsx` (sidebar folding,
  action bar per role, Blocked dialog, blockers summary, people order part, words); api `item-history-route.test.ts`
  a Stand-up's reason kept and a Discussed's refused.
- editor: `SessionPage.review.test.tsx` (Reviewed keeps the card's stage and records it, an archived card queued and
  left archived, feedback as a labelled comment for an Editor and a Participant, none for a Viewer, Follow-up making a
  linked card through Related and through the description, N key, presenter pick, Session Complete's feedback and
  follow-ups), `review-parts.test.tsx` (demo strip, feedback strip, follow-up dialog, set-up parts, summary,
  feedback threads, Since Last Review), `useReviewRun.test.tsx` (the write guards per role, each follow-up link shape),
  `CardThreads.test.tsx` (the Review Feedback chip), `session-setup.test.ts` (Done-phase start, the default range).
- editor: `SessionPage.triage.test.tsx` (Accept past Needs Info, Close with reason and duplicate, Undo Last moving
  back and unlinking, U undoing a Flag, a moved card staying, the priority pills, roles, Session Complete),
  `triage-parts.test.tsx` (pill, duplicate link, words, Close dialog), `planning-parts.test.tsx` (tally states, estimate strip per role, pills, capacity part),
  `SessionPage.planning.test.tsx` (Commit moves the card and records it, C key, Skip, inline estimate, tally),
  `FillActionButton.test.tsx` (fill, tick, reduced motion), `SessionPage.test.tsx` (queue, run, keys, peek,
  phone queue, settings, roles), `session-parts.test.tsx` (action bar, sidebar, progress, complete, chip and keys per
  role), `SessionSetupDialog.test.tsx`, `useSessionRun`, `useSessionFacilitator`, `useSessionTimebox` and
  `useSessionTabActions` tests, `session-setup.test.ts`, `item-panel-wiring.test.tsx`,
  `StartPlanning.session.test.tsx`.

## Constants and configuration

| Constant                    | Value          | Why                                          |
| --------------------------- | -------------- | -------------------------------------------- |
| `SESSION_QUEUE_MAX`         | 500            | A session longer than this is not a session  |
| `SESSION_TYPES_MAX`         | 50             | The type catalogue's own bound               |
| `SESSION_STAGES_MAX`        | 100            | Under the type's 128 statuses                |
| `SESSION_TIMEBOX_MIN_MS`    | 60 000         | One minute                                   |
| `SESSION_TIMEBOX_MAX_MS`    | 1 800 000      | Thirty minutes                               |
| `FACILITATOR_GRACE_MS`      | 10 000         | Covers a refresh before Take Over shows      |
| `FILL_MS`                   | 700            | The Refined fill: 250 in, 200 held, 250 out  |
| `SEGMENTS_MAX`              | 40             | Past this the progress bar is one smooth bar |
| `SESSION_CAPACITY_MAX`      | 9 999          | Far past any team's sprint                   |
| `CAPACITY_NEAR`             | 0.85           | Amber from 85% of capacity                   |
| `SESSION_REASON_MAX`        | 200            | A Close's reason: a line, not a comment      |
| `SESSION_FOLLOW_UPS_MAX`    | 20             | Follow-ups kept per reviewed card            |
| `FOLLOW_UP_TITLE_MAX`       | 200            | A follow-up's title, under the card's 500    |
| `REVIEW_RANGE_DEFAULT_DAYS` | 14             | No earlier review: the last two weeks        |
| `UNASSIGNED_KEY`            | `'unassigned'` | Never a person id (24 hex, `n-`, `ai-`)      |

## Defaults ledger

See `DEFAULTS.md` rows "Session tab".
