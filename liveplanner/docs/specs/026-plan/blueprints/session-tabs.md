# Session tabs blueprint

Derived from [Session tabs](../session-tabs.md). File-level contracts, constants, defaults and tests.

## Domain and naming

| Spec term     | Identifier                                                                  |
| ------------- | --------------------------------------------------------------------------- |
| Session tab   | `TabKind` `'session'` (`tab-kind.ts`), in `PLAN_TAB_KINDS`                   |
| session state | `Tab.session: SessionTabState` (`packages/project/src/session-tab.ts`)       |
| session kind  | `SessionKindId` (`'refinement'`), `SESSION_KINDS` (label, outcomes, grouping) |
| set-up        | `SessionSetup` `{ typeIds, statuses, sortBy?, targets?, timeboxMs? }`        |
| outcome       | `SessionOutcome` `'refined' \| 'skipped' \| 'flagged'`; `SessionDecision`    |
| facilitator   | `SessionFacilitator` `{ id, name, color }`, `id` the collab key              |
| queue         | `sessionQueue()` in `packages/items/src/session-queue.ts`                    |
| target stage  | `sessionTarget()` in `session-queue.ts`                                      |
| history entry | `ItemHistoryChange` `{ kind: 'session', session, outcome }`, tag `'session'` |
| fill button   | `FillActionButton` (`apps/editor/components/session/FillActionButton.tsx`)  |

Never "meeting", "ceremony" or "host" in code or copy; the dot vote's `startedBy` host is unrelated.

## Data and persistence

`SessionTabState` (version 1), stored whole on the tab body and carried in `tab-meta` patches like `timer`:

```ts
{ v: 1; sessionKind: 'refinement'; setup: SessionSetup; facilitator?: SessionFacilitator;
  currentId?: string; cardStartedAt?: number; decided?: Record<itemId, { outcome; at; by }> }
```

- `readSessionTab(raw)` is the only reader: anything malformed reads as `null` (the page then shows the empty set-up
  state). Unknown session kinds read as `null`. `typeIds` and `statuses` are deduped strings, capped at
  `SESSION_TYPES_MAX` (50) and `SESSION_STAGES_MAX` (100); `sortBy` through `normaliseBoardSort`; `targets` keeps
  string pairs only; `timeboxMs` clamped to `SESSION_TIMEBOX_MIN_MS`..`SESSION_TIMEBOX_MAX_MS` (1 to 30 minutes) or
  dropped; `decided` capped at `SESSION_QUEUE_MAX` (500) entries.
- No migration: a tab without `session` is not a Session tab; an old build reads `kind: 'session'` as the general kind
  (`tabKindOf`) and shows an empty canvas, losing nothing.

## Behaviour and state

- `sessionQueue({ items, types, planStatuses, setup, decided })` answers `{ decided: Item[], toGo: Item[], capped }`:
  decided cards (still present, not archived or trashed) by `at`; to-go cards whose type is in `typeIds` and status in
  `statuses`, not archived or trashed, not decided, `sortCards` by `sortBy` over rank order, capped at 500.
- `sessionTarget(item, type, planStatuses, targets)`: `targets[type]` when it is a status the type uses, else the
  status after the card's in `typeStatusesOf(type, planStatuses)`, else `null` (no later stage: Refined moves nothing).
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

- `POST /api/projects/:id/items/:itemId/session` body `{ session: 'refinement', outcome }` (edit access; a tab-scoped
  caller only for a card its tab shows). Appends one history entry tagged `session` holding one session change, by
  the caller, at now; writes nothing on the card. Answers `204`. Refusals: `invalid_body` (400) for an unknown session
  kind or outcome, `item_not_found` (404), `forbidden` (403) below edit.
- `apiItemSessionOutcome(scope, itemId, body)` in `apps/editor/lib/api/items.ts`; an offline plan records nothing.

## Presentation and UX

Files under `apps/editor/components/session/`: `SessionPage` (layout, lazy-loaded by `EditorStartPanels`),
`SessionSidebar`, `SessionProgress`, `SessionCard` (embeds `ItemPanelBody`), `SessionActionBar`, `FillActionButton`,
`SessionFacilitatorChip`, `SessionComplete`, `SessionSetupDialog` (+ `session-setup.ts`, pure), `session-kinds.tsx`
(per-kind set-up parts and actions), `session-chime.ts`, `useSessionRun.ts` (writes and keys). Start Planning gains
the `sessions` category and the `session` start kind.

## Accessibility

The sidebar is a `listbox` of `option`s (`aria-current` on the room's card); the progress bar is a `progressbar` with
`aria-valuenow`; the fill button announces "Refined" through the live region; reduced motion swaps the fill for an
instant state change; keys R, S, F, J, K act only outside text fields.

## Performance and limits

The queue is one pass over the items plus a sort of at most 500 cards, memoised on the items map, types, set-up and
decisions. The timebox ticks once a second only while a timebox is on. The page's code loads only for a Session tab.

## Observability

`[session] outcome.recorded` / `outcome.refused` on the api route; telemetry `Plan · Created · SessionTab`,
`Plan · Changed · SessionSetup`, `Plan · Used · Session{Refined,Skipped,Flagged}`.

## Testing

- `session-tab.test.ts`: reader bounds, decisions, facilitator rules, timebox.
- `session-queue.test.ts`: filter, order, decided first, target defaults and overrides, no next stage, cap.
- `item-history.test.ts`: a session change kept, read back, grouped only with its tag.
- api `item-session-route.test.ts`: records, refuses below edit, unknown outcome.
- editor: `FillActionButton.test.tsx` (fill, tick, reduced motion), `SessionPage.test.tsx` (sidebar order, select,
  peek, Refined moves and records, Skip and Flag grey out and advance, roles), `session-setup.test.ts`.

## Constants and configuration

| Constant                 | Value  | Why                                                    |
| ------------------------ | ------ | ------------------------------------------------------ |
| `SESSION_QUEUE_MAX`      | 500    | A session longer than this is not a session            |
| `SESSION_TYPES_MAX`      | 50     | The type catalogue's own bound                         |
| `SESSION_STAGES_MAX`     | 100    | Under the type's 128 statuses                          |
| `SESSION_TIMEBOX_MIN_MS` | 60 000 | One minute                                             |
| `SESSION_TIMEBOX_MAX_MS` | 1 800 000 | Thirty minutes                                      |
| `FACILITATOR_GRACE_MS`   | 10 000 | Covers a refresh before Take Over shows                |
| `FILL_MS`                | 700    | The Refined fill, in and out                           |
| `SEGMENTS_MAX`           | 40     | Past this the progress bar is one smooth bar           |

## Defaults ledger

See `DEFAULTS.md` rows "Session tab".
