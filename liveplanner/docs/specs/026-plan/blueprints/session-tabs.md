# Session tabs blueprint

Derived from [Session tabs](../session-tabs.md). File-level contracts, constants, defaults and tests.

## Domain and naming

| Spec term     | Identifier                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| Session tab   | `TabKind` `'session'` (`tab-kind.ts`), in `PLAN_TAB_KINDS`                                                        |
| session state | `Tab.session: SessionTabState` (`packages/project/src/session-tab.ts`)                                            |
| session kind  | `SessionKindId` (`'refinement' \| 'planning'`), `SESSION_KINDS` (label, outcomes, completes, grouping, tally)     |
| set-up        | `SessionSetup` `{ typeIds, statuses, sortBy?, targets?, timeboxMs?, capacity? }`                                  |
| outcome       | `SessionOutcome` `'refined' \| 'skipped' \| 'flagged' \| 'committed'`; `SessionDecision`; `SESSION_KIND_OUTCOMES` |
| tally         | `sessionTally()`, `capacityState()` in `packages/items/src/session-tally.ts`                                      |
| facilitator   | `SessionFacilitator` `{ id, name, color }`, `id` the collab key                                                   |
| queue         | `sessionQueue()` in `packages/items/src/session-queue.ts`                                                         |
| target stage  | `sessionTarget()` in `session-queue.ts`                                                                           |
| history entry | `ItemHistoryChange` `{ kind: 'session', session, outcome }`, tag `'session'`                                      |
| fill button   | `FillActionButton` (`apps/editor/components/session/FillActionButton.tsx`)                                        |

Never "meeting", "ceremony" or "host" in code or copy; the dot vote's `startedBy` host is unrelated.

## Data and persistence

`SessionTabState` (version 1), stored whole on the tab body and carried in `tab-meta` patches like `timer`:

```ts
{ v: 1; sessionKind: 'refinement' | 'planning'; setup: SessionSetup; facilitator?: SessionFacilitator;
  currentId?: string; cardStartedAt?: number; decided?: Record<itemId, { outcome; at; by }> }
```

- `readSessionTab(raw)` is the only reader: anything malformed reads as `null` (the page then shows the empty set-up
  state). Unknown session kinds read as `null`. `typeIds` and `statuses` are deduped strings, capped at
  `SESSION_TYPES_MAX` (50) and `SESSION_STAGES_MAX` (100); `sortBy` through `normaliseBoardSort`; `targets` keeps
  string pairs only; `capacity` a positive number rounded to a whole point and capped at `SESSION_CAPACITY_MAX`
  (9 999), else dropped; `timeboxMs` clamped to `SESSION_TIMEBOX_MIN_MS`..`SESSION_TIMEBOX_MAX_MS` (1 to 30 minutes) or
  dropped; `decided` capped at `SESSION_QUEUE_MAX` (500) entries.
- No migration: a tab without `session` is not a Session tab; an old build reads `kind: 'session'` as the general kind
  (`tabKindOf`) and shows an empty canvas, losing nothing.

## Behaviour and state

- `sessionQueue({ items, types, planStatuses, setup, decided })` answers `{ decided: Item[], toGo: Item[], capped }`:
  decided cards (still present, not archived or trashed) by `at`; to-go cards whose type is in `typeIds` and status in
  `statuses`, not archived or trashed, not decided, `sortCards` by `sortBy` over rank order, capped at 500.
- `sessionTarget(item, type, planStatuses, targets)`: `targets[type]` when it is a status the type uses, else the
  status after the card's in `typeStatusesOf(type, planStatuses)`, else `null` (no later stage: Refined moves nothing).
- `outcomeFits(kind, outcome)`: the outcome is one `SESSION_KIND_OUTCOMES[kind]` offers (refinement: refined, skipped,
  flagged; planning: committed, skipped). The kind's `completes` outcome (`refined`, `committed`) is the fill button
  and moves the card to `sessionTarget`.
- `sessionTally(cards, decided)`: over the cards decided `committed`, `{ points, counted, unestimated }`, a card's
  points its `estimate` when a finite number of 0 or more, else it is `unestimated` (never 0).
  `capacityState(points, capacity)`: `'none'` without a capacity, `'over'` past it, `'near'` from `CAPACITY_NEAR`
  (85%) of it up to it, else `'under'`.
- `nextCurrent(queue, currentId)`: the first to-go card after `currentId` in the to-go order, else the first to-go
  card, else `null` (complete).
- `currentOf(queue, session)`: `session.currentId` when it is in the queue, else `nextCurrent(queue)`.
- Facilitator: `mayClaim(session, canEdit)` (no holder, Editor); `isFacilitator(session, selfId)`;
  `facilitatorAway(lastSeenAt, now)` true past `FACILITATOR_GRACE_MS` (10 s) of this screen not seeing them.
- `withDecision(session, itemId, outcome, by, now, nextId)` records the outcome, moves `currentId` to `nextId` and
  restarts `cardStartedAt`; `withoutDecision` clears one; `withCurrent` moves the current card and restarts the clock.
- Timebox: `timeboxLeftMs(session, now)`; `timeboxUp` at 0. The chime plays on the transition seen by a mounted
  screen, once per `(currentId, cardStartedAt)`.

## Interfaces and contracts

- `POST /api/projects/:id/items/:itemId/session` body `{ session: 'refinement' | 'planning', outcome }` (edit access; a tab-scoped
  caller only for a card its tab shows). Appends one history entry tagged `session` holding one session change, by
  the caller, at now; writes nothing on the card. Answers `204`. Refusals: `session_invalid` (422, naming `session` or
  `outcome`) for an unknown session kind, or an outcome the kind does not offer, `item_not_found` (404), `forbidden` (403) below edit. Lives in
  `apps/api/src/routes/item-session-route.ts`.
- A changeset on a Session tab is refused (422 `invalid_value`) in `apps/api/src/changesets/submit.ts`.
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
notes) and `planning-words.ts` (pure wording). The tab writes go through `hooks/plan/useSessionTabActions.ts`. Start Planning
gains the `sessions` category, the `session` start kind and `start/SessionPicture`.

## Accessibility

The sidebar is a `listbox` of `option`s (`aria-current` on the room's card); the progress bar is a `progressbar` with
`aria-valuenow`; the fill button announces "Refined" through the live region; reduced motion swaps the fill for an
instant state change; keys R, S, F, J, K act only outside text fields.

## Performance and limits

The queue is one pass over the items plus a sort of at most 500 cards, memoised on the items map, types, set-up and
decisions. The timebox ticks once a second only while a timebox is on. The page's code loads only for a Session tab.

## Observability

`[session] outcome.recorded` on the api route (a refusal answers its code); `[changeset] session-tab` on a refused changeset; telemetry `Plan · Created · SessionTab`,
`Plan · Changed · SessionSetup`, `Plan · Used · Session{Refined,Skipped,Flagged,Committed}`.

## Testing

- `session-tab.test.ts`: reader bounds, decisions, facilitator rules, timebox.
- `session-queue.test.ts`: filter, order, decided first, target defaults and overrides, no next stage, cap, outcomes
  per kind; `session-tally.test.ts`: points, no estimate apart, capacity states at their edges.
- `item-history.test.ts`: a session change kept, read back, grouped only with its tag.
- api `item-history-route.test.ts` ("a session outcome"): records, refuses below edit, unknown outcome, tab scope;
  `submit.test.ts`: a changeset on a Session tab refused.
- editor: `planning/planning-parts.test.tsx` (tally states, estimate strip per role, pills, capacity part),
  `SessionPage.planning.test.tsx` (Commit moves the card and records it, C key, Skip, inline estimate, tally),
  `FillActionButton.test.tsx` (fill, tick, reduced motion), `SessionPage.test.tsx` (queue, run, keys, peek,
  phone queue, settings, roles), `session-parts.test.tsx` (action bar, sidebar, progress, complete, chip and keys per
  role), `SessionSetupDialog.test.tsx`, `useSessionRun`, `useSessionFacilitator`, `useSessionTimebox` and
  `useSessionTabActions` tests, `session-setup.test.ts`, `item-panel-wiring.test.tsx`,
  `StartPlanning.session.test.tsx`.

## Constants and configuration

| Constant                 | Value     | Why                                          |
| ------------------------ | --------- | -------------------------------------------- |
| `SESSION_QUEUE_MAX`      | 500       | A session longer than this is not a session  |
| `SESSION_TYPES_MAX`      | 50        | The type catalogue's own bound               |
| `SESSION_STAGES_MAX`     | 100       | Under the type's 128 statuses                |
| `SESSION_TIMEBOX_MIN_MS` | 60 000    | One minute                                   |
| `SESSION_TIMEBOX_MAX_MS` | 1 800 000 | Thirty minutes                               |
| `FACILITATOR_GRACE_MS`   | 10 000    | Covers a refresh before Take Over shows      |
| `FILL_MS`                | 700       | The Refined fill: 250 in, 200 held, 250 out  |
| `SEGMENTS_MAX`           | 40        | Past this the progress bar is one smooth bar |
| `SESSION_CAPACITY_MAX`   | 9 999     | Far past any team's sprint                   |
| `CAPACITY_NEAR`          | 0.85      | Amber from 85% of capacity                   |

## Defaults ledger

See `DEFAULTS.md` rows "Session tab".
