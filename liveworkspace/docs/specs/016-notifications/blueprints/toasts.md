# Toasts blueprint

Derived from [Toasts](../toasts.md). Implementation detail only; the spec decides.

## Files

| File                                                                    | Holds                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/toast/ToastProvider.tsx`                               | `ToastProvider` (`quiet`, `historyScope`), `useToast`, `ToastApi`, `ToastOptions`; nesting hands over   |
| `packages/ui/src/toast/toast-queue.ts`                                  | Pure queue writes: `pushToast`, `upsertActionToast`, `retireToasts`, `TOAST_LIMIT`, durations, `sticky` |
| `packages/ui/src/toast/ToastStack.tsx`                                  | The always-mounted `Notifications` region, the floor, each toast's timer, exit and collapse             |
| `packages/ui/src/toast/ToastCard.tsx`                                   | One toast: icon, message, actions, close; `TOAST_SURFACE`, `TOAST_ICONS`, `TOAST_ICON_TINT`             |
| `packages/ui/src/toast/toast-history.ts`                                | The notification list's module store: records, scopes, localStorage, seen and missed                    |
| `packages/ui/src/toast/toast-collapse.ts`                               | `collapseIntoBell`, `collapseTarget`, `findToastBell`, `TOAST_BELL_ATTR`                                |
| `packages/ui/src/toast/ToastBell.tsx`                                   | The footer's bell: the dot, the popover and its read-only list                                          |
| `packages/ui/src/toast/useToastTimer.ts`                                | The pausable timeout (`null` for none)                                                                  |
| `packages/ui/src/toast/toast-floor.ts`                                  | Pure `toastFloor()`, `TOAST_FLOOR_SELECTOR`, `BOTTOM_CHROME_SELECTOR`, `announceToastFloorChange()`     |
| `packages/ui/src/toast/useToastFloor.ts`                                | Measures the floor while the stack is up; `useChromeFloor` for other bottom notices                     |
| `packages/workbench/src/hooks/ui/useToast.tsx`                          | The editors' `ToastProvider`: the shared one with `quiet` bound to `readPreferences()`                  |
| `packages/explorer/src/ui/Toasts.tsx`                                   | The Explorer's `useToast` (`show`, `error`) over the shared one; `historyScope` `explorer`              |
| `packages/workbench/src/components/chrome/NewVersionPrompt.tsx`         | The new-version standing toast (`new-version` key)                                                      |
| `packages/workbench/src/components/chrome/AccountUnreachableNotice.tsx` | The account-unreachable standing warning (`account-unreachable` key)                                    |

The bell is drawn by each editor's `components/chrome/ChromeControls.tsx` (after Settings) and by the site's
`apps/site/components/explorer/ExplorerBottomBar.tsx` (after Settings), with the host's own button classes.

## Domain and naming

- **Toast**: one entry (`ToastEntry`). **Tone**: `ToastTone = 'info' | 'success' | 'warning' | 'error'`.
- **Plain**, **action** and **offer** toasts as in the spec. A toast **has answers** when it is an offer, or has at
  least one action (`toastAnswers(entry)`). **Standing**: `sticky: true`; `toastTimeout(entry)` is `null` for it,
  `TOAST_ANSWER_TIMEOUT_MS` for one with answers, else `TOAST_TIMEOUT_MS[tone]`.
- **Record**: one entry of the notification list (`ToastRecord`: `id`, `tone`, `message`, `at`, `state`, `key?`).
  **State**: `live` (on screen), `missed` (left unseen), `seen`. **Scope**: the list a record is in.
- **Bell**: the footer button, found by `[data-toast-bell]`.
- **Floor**: the stack's CSS `bottom`, in px. **Obstacle**: an element matched by `TOAST_FLOOR_SELECTOR`.
- **Leaving**: an entry dismissed but still playing its exit (`leaving: true`).

## Behaviour and state

`ToastRoot` holds `ToastEntry[]` (oldest first) in state and mirrors the last committed list in a ref, so a push knows
which entry it became (new, or the keyed one upserted in place) and records that one. Writes are pure functions in
`toast-queue.ts`:

- `pushToast(list, input, id)`: returns `list` unchanged when a non-leaving entry has the same tone and message;
  otherwise appends, then applies the limit.
- `upsertActionToast(list, spec, id)`: replaces the non-leaving entry with the same `key` in place (keeping its id), or
  appends and applies the limit. `spec.tone` (default `info`), `sticky` and `onDismiss` carry over.
- The limit: while more than `TOAST_LIMIT` non-leaving entries remain, the oldest without answers and not standing is
  marked leaving; else the oldest not standing; else the oldest. An append that retired another is marked `full`.
- Gate: `shown = tone is warning or error || sticky || important || !quiet()`. A push that is not shown is recorded
  `missed` and goes no further.
- A plain toast's `options.action` becomes its one action, wrapped to retire the toast (seen) after it runs. An action
  toast's actions are wrapped to settle its record `seen` before they run; the toast stays (its feature dismisses it).
- Close (button, Escape): `onDismiss?.()` once, then the offer's decline when it is an offer; its record is
  removed (`forgetToast`) and the entry marked `dismissed`, so it fades in place instead of collapsing into the bell.
- Expire: settled `missed`. Retired by the limit: `missed`. `dismissAction(key)`: `seen` (NT4).

Nesting: `ToastProvider` reads its own context; when an outer provider is there it renders its children alone, so
the inner tree's `useToast` is the outer API (one stack, one list, the outer `quiet`; the inner `historyScope` is
ignored). The top provider with a `historyScope` sets it on the store for as long as it is mounted
(`setToastHistoryScope`), and puts the path back on unmount.

`ToastItem` (in `ToastStack.tsx`) owns:

- `useToastTimer(ms, paused, onElapsed)`: `ms` is `null` for a leaving or standing toast (no timer).
- `paused = hovered || focusWithin || document.hidden`.
- Leaving: in a layout effect, `collapseIntoBell(card)`. When it returns an animation, the toast is removed when the
  animation finishes, the card's own `toast-out` ending is ignored, and the fallback hold is
  `TOAST_COLLAPSE_MS + TOAST_EXIT_HOLD_MS`. Otherwise the card plays `animate-toast-out` and is removed on its
  `animationend` or after `TOAST_EXIT_HOLD_MS`.

## The notification list

`toast-history.ts` is a module store (a `Map` of scope to records, in memory, written through to localStorage), so the
bell reads it with `useSyncExternalStore` wherever it is drawn, inside the provider's tree or not.

- Scope: `scopeOf()`, the top provider's `historyScope`, else `location.pathname` (each editor document's own path).
- `recordToast(input, state, now)`: updates the record with the same id in place (an upsert's final words), or adds
  one. A `missed` toast under a key updates that key's last record when it is `missed` and under
  `TOAST_HISTORY_MERGE_MS` old (NT1). Keeps the last `TOAST_HISTORY_LIMIT`.
- Record ids: `<page start in base 36>-<toast id>`, unique across reloads.
- `settleToast(id, state)` changes a `live` record only. `forgetToast(id)` removes a record (a closed toast). `markToastHistorySeen()` turns every `missed` into `seen`
  (opening the list). `clearToastHistory()` empties the scope. `hasMissedToast(records)` is the dot.
- Read back: `parseToastRecords` keeps well-formed records only; a `live` record from an earlier page is `missed`
  (NT2).

## Data and persistence

- `localStorage['liveworkspace:toasts:<scope>']`: the scope's records as JSON, at most 50 (a few KB).
- `localStorage['liveworkspace:toasts:index']`: the scopes, most recently written first. Each write moves its scope to
  the front; past `TOAST_HISTORY_SCOPES` the oldest scopes' keys are removed.
- Storage refused or full: every write is wrapped; the list holds in memory for the page.
- Nothing leaves the browser.

## Interfaces and contracts

```ts
type ToastOptions = {
  action?: { label: string; ariaLabel?: string; onSelect: () => void };
  sticky?: boolean;
  important?: boolean;
  onDismiss?: () => void;
};
type ToastApi = {
  info(message: string, options?: ToastOptions): void;
  success(message: string, options?: ToastOptions): void;
  warning(message: string, options?: ToastOptions): void;
  error(message: string, options?: ToastOptions): void;
  offer(offer: ToastOffer): void; // { message, confirmLabel, declineLabel, onConfirm, onDecline }
  action(spec: ToastActionSpec): void; // { key, message, actions, tone?, important?, sticky?, onDismiss? }
  dismissAction(key: string): void;
};
// ToastProvider: { children, quiet?: () => boolean, historyScope?: () => string }
// ToastBell: { className: string } (the host's bar button classes; it must be `relative` for the dot)
```

An empty message is ignored. The Explorer keeps its own short API (`show(text, { tone, action: { label, run } })`,
`error(text)`), mapped onto this one.

## Presentation and UX

- Region and card: as before (`fixed inset-x-0 z-[var(--z-toast)]`, the card `rounded-xl border` with
  `TOAST_SURFACE`, the tone's border and icon). The close is `h-8 w-8`, `CloseIcon` 12px, `aria-label="Dismiss"`.
- Bell: `lucideBell` 16px in the host's button classes, `data-toast-bell`, `aria-haspopup="dialog"`,
  `aria-expanded`, `aria-label` "Notifications" or "Notifications, new"; a `HoverCard` "Notifications". The dot:
  `absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white dark:bg-brand-400
dark:ring-slate-900`.
- Popover: `ResponsivePopover` (`align="end"`, `bare`, 360px; a sheet on a phone). Header row: "Notifications"
  (`text-sm font-semibold`) and Clear (a compact text button, disabled while empty). List: `max-h-[22rem]`
  scrolling, rows `flex gap-3 px-4 py-2`, the tone's icon, the message `text-sm`, the time `text-xs` slate-500
  (`formatRelativeTimeShort` from when the list opened). Empty: `CompactEmptyState`.

## Accessibility

- `role="alert"` for `error`, `role="status"` for the rest, on the card; a leaving card is `aria-hidden`.
- Escape inside a card: `stopPropagation`, `preventDefault`, then the close path.
- The popover is a labelled dialog (its heading), focus moves in on open and back to the bell on close.

## Performance and limits

- At most `TOAST_LIMIT` (3) non-leaving entries, plus the few leaving ones: the list is bounded.
- A push writes one scope's JSON (at most 50 short records) and the index (at most 20 strings) to localStorage: measured at
  0.02 ms per write for a full list (7.3 KB) with 20 lists kept, under jsdom. No write happens per frame or keystroke.
- The list's popover (`ToastListPopover.tsx`) is loaded on the bell's first opening, or when it is pointed at or
  focused, so it stays off every page's first load: with it eager the site's `explorer.html` measured 380.7 KiB gzip,
  over its 380 KiB budget; lazy, 378.0 KiB.
- The bell's snapshot is the scope's array from memory (no parse per render); the dot is one pass over at most 50.
- The collapse is one Web Animations run per leaving toast (transform and opacity only, composited), plus two rect
  reads; the bell lookup is one `querySelectorAll` of a single attribute.

## Constants and configuration

| Constant                   | Value | Provenance                                   | Safe range    |
| -------------------------- | ----- | -------------------------------------------- | ------------- |
| `TOAST_TIMEOUT_MS.info`    | 4000  | The previous single timeout                  | 3000 to 6000  |
| `TOAST_TIMEOUT_MS.success` | 4000  | Same                                         | 3000 to 6000  |
| `TOAST_TIMEOUT_MS.warning` | 6000  | Longer copy, needs reading                   | 5000 to 8000  |
| `TOAST_TIMEOUT_MS.error`   | 6000  | Same                                         | 5000 to 8000  |
| `TOAST_ANSWER_TIMEOUT_MS`  | 10000 | Time to reach for Undo, never for good       | 8000 to 15000 |
| `TOAST_LIMIT`              | 3     | A burst of deletes never covers the screen   | 3 to 5        |
| `TOAST_EXIT_HOLD_MS`       | 150   | The `micro` token `toast-out` runs at        | = `micro`     |
| `TOAST_COLLAPSE_MS`        | 250   | The `long` token, the chrome ceiling         | = `long`      |
| `TOAST_BELL_PULSE_MS`      | 200   | The `short` token                            | = `short`     |
| `TOAST_HISTORY_LIMIT`      | 50    | Owner's choice: a session's worth to re-read | 20 to 100     |
| `TOAST_HISTORY_SCOPES`     | 20    | Bounds storage to about 20 x 50 records      | 10 to 50      |
| `TOAST_HISTORY_MERGE_MS`   | 10000 | `TOAST_ANSWER_TIMEOUT_MS`                    | 5000 to 15000 |
| `TOAST_LIST_WIDTH_PX`      | 360   | Fits a 90-character message on two lines     | 320 to 400    |
| `TOAST_EDGE_PX`            | 16    | The page gutter                              | 8 to 24       |

`TOAST_FLOOR_SELECTOR`: `[data-toast-floor], [data-start-footer], [data-editor-tabbar], [data-zoom-cluster],
[data-whiteboard-dock]`. The Explorer bottom bar and the sign-in banner's card carry `data-toast-floor`; a template
start's foot row carries `data-start-footer`, and `setStartPanelOpen` announces the floor change.

`toastPlacement()` gives the stack its `bottom` and, from 640px, a `right`: the bottom-right cluster
(`TOAST_SIDE_SELECTOR`, `[data-zoom-cluster]`) that intrudes on the centred column (576px) is taken as a side, not a
floor, so the stack stands level with its bottom (`innerHeight - rect.bottom`, never below the other floors) with its
right edge `TOAST_FLOOR_GAP_PX` left of it, toasts aligned to the end. Under 640px it is a floor (`toastFloor`).

## Errors and edge cases

- An empty message: ignored. A deduped repeat: not recorded again (NT3).
- `animate` missing (jsdom), no bell on screen, reduced motion: the plain exit.
- A collapse that never finishes (a hidden tab): the fallback hold removes the toast.
- A standing toast whose condition ends while it is up: its feature calls `dismissAction(key)`; one closed by the
  person comes back only when the feature raises it again (the new-version toast: a still newer format).
- The bell drawn before the Explorer's provider names its scope: it reads the path's list, then the store's change
  re-renders it on the named one.

## Motion

`packages/tailwind-config/theme.css` keeps `toast-in`, `toast-in-full` and `toast-out`. The collapse and the pulse are
script-driven (`toast-collapse.ts`): keyframes `translate(0,0) scale(1)` at opacity 1, opacity 0.9 at 60%, then
`translate(dx, dy) scale(s)` at opacity 0, over 250ms `cubic-bezier(0.4, 0, 0.2, 1)`, `fill: forwards`; the bell
`scale(1 → 1.15 → 1)` over 200ms ease-out. `prefersReducedMotion()` (the OS setting or the app's `.reduce-motion`)
skips both.

## Testing

| Rule                                                                                        | Test                                                                         |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Dedupe, limit, upsert in place, retire oldest timed out                                     | `packages/ui/src/toast/toast-queue.test.ts`                                  |
| Close on every toast, plain action closes, standing, quiet still listed                     | `packages/ui/src/toast/ToastProvider.test.tsx`                               |
| Nesting hands over; the top provider's scope; collapse removes on finish                    | `packages/ui/src/toast/ToastProvider.test.tsx`                               |
| The list: scopes, reload, upsert once, muted burst, limits, storage                         | `packages/ui/src/toast/toast-history.test.ts`                                |
| The collapse's target, the bell lookup, reduced motion, the pulse                           | `packages/ui/src/toast/toast-collapse.test.ts`                               |
| The bell: no label, dot, opening sees all, newest first, read-only                          | `packages/ui/src/toast/ToastBell.test.tsx`                                   |
| Floor: column, overlap, off-column chrome, phone, the selector; the side beside the cluster | `packages/ui/src/toast/toast-floor.test.ts`                                  |
| Timeouts per tone, pause and resume with the remainder                                      | `packages/ui/src/toast/useToastTimer.test.tsx`                               |
| The editors' gate (In-Editor Notifications), roles, Escape, exit                            | `packages/workbench/src/hooks/ui/useToast.test.tsx`                          |
| New version: a standing toast, Reload phases, closed until newer                            | `packages/workbench/src/components/chrome/NewVersionPrompt.test.tsx`         |
| Account unreachable: standing warning, Try Again, leaves when answered                      | `packages/workbench/src/components/chrome/AccountUnreachableNotice.test.tsx` |

## Observability

Toasts are themselves the observable surface; the callers log their own failures. The new-version toast keeps its
`UI Opened NewVersionPrompt` and `UI Used NewVersionPrompt` events.

## Defaults ledger

NT1, NT2, NT3, NT4 in `DEFAULTS.md`.
