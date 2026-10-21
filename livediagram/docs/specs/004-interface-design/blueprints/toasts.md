# Toasts blueprint

Derived from [Toasts](../toasts.md). Implementation detail only; the spec decides.

## Files

| File                                          | Holds                                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/live/hooks/ui/useToast.tsx`             | `ToastProvider`, `useToast`, the `ToastApi` (`info`, `success`, `warning`, `error`, `offer`, `action`, `dismissAction`) |
| `apps/live/components/toast/toast-queue.ts`   | Pure queue writes: `pushToast`, `upsertActionToast`, `retireToast`, `TOAST_LIMIT`, durations                            |
| `apps/live/components/toast/ToastStack.tsx`   | The always-mounted `Notifications` region, its placement and the floor                                                  |
| `apps/live/components/toast/ToastCard.tsx`    | One toast: icon, message, actions, close; `TOAST_SURFACE` for the look shared by other notices                          |
| `apps/live/components/toast/useToastTimer.ts` | The pausable timeout                                                                                                    |
| `apps/live/components/toast/toast-floor.ts`   | Pure `toastFloor()` and `TOAST_FLOOR_SELECTOR`                                                                          |
| `apps/live/components/toast/useToastFloor.ts` | Measures the floor while the stack is up                                                                                |

## Domain and naming

- **Toast**: one entry (`ToastEntry`). **Tone**: `ToastTone = 'info' | 'success' | 'warning' | 'error'`.
- **Plain**, **action** and **offer** toasts as in the spec. A toast **has answers** when it is an offer, or an action
  toast with at least one action (`toastAnswers(entry)`). Every toast **times out**: `toastTimeout(entry)` is
  `TOAST_ANSWER_TIMEOUT_MS` for one with answers, else `TOAST_TIMEOUT_MS[tone]`.
- **Toast name**: a document, folder or tab name as a toast shows it, `toastName(name)` in
  `apps/live/lib/toast-name.ts`: whitespace collapsed, trimmed, cut by code point to `TOAST_NAME_MAX` with the last
  kept character an ellipsis (trailing spaces before it dropped), wrapped in `“` `”`; `null` for a blank name, and
  the caller substitutes its generic word.
- **Floor**: the stack's CSS `bottom`, in px. **Obstacle**: an element matched by `TOAST_FLOOR_SELECTOR`.
- **Leaving**: an entry dismissed but still playing `toast-out` (`leaving: true`).

## Behaviour and state

`ToastProvider` holds `ToastEntry[]` (oldest first). Writes are pure functions in `toast-queue.ts`:

- `pushToast(list, input, id)`: returns `list` unchanged when a non-leaving entry has the same tone and message;
  otherwise appends, then applies the limit.
- `upsertActionToast(list, spec, id)`: replaces the non-leaving entry with the same `key` in place (keeping its id), or
  appends and applies the limit.
- The limit: while more than `TOAST_LIMIT` non-leaving entries remain, the oldest one without answers is marked
  leaving; when every one has answers, the oldest is. A new entry whose append retired another is marked
  `full: true` (`appendToast`); a replace in place never is. The card then enters with `animate-toast-in-full`.
- `dismiss(id)` marks the entry leaving; `remove(id)` drops it. `dismissAction(key)` marks the keyed entry leaving.
- Gate: `info`, `success`, `offer` and `action` read `readUserPreferences().notificationsEnabled` per push and drop
  the push when it is `false`; `warning` and `error` never read it.

`ToastCard` is presentational. Its host (`ToastItem` in `ToastStack.tsx`) owns:

- `useToastTimer(ms, paused, onElapsed)`: `ms` is `null` for a leaving toast (no timer). Holds the remaining time in a ref; when
  `paused` turns true it clears the timeout and subtracts what ran; when false it restarts with the remainder.
  A change of `ms` (an action toast replaced with no actions) restarts it.
- `paused = hovered || focusWithin || document.hidden`, from `pointerenter`/`pointerleave`, `focus`/`blur` (React's
  bubbling `onFocus`/`onBlur` with a `relatedTarget` containment check) and `visibilitychange`.
- Leaving: the card plays `animate-toast-out`; `onAnimationEnd` (its own, not a child's) calls `remove`, and a
  fallback timeout of `TOAST_EXIT_HOLD_MS` does too, for an environment that never fires the event.

## Interfaces and contracts

```ts
type ToastApi = {
  info(message: string): void;
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  offer(offer: ToastOffer): void; // { message, confirmLabel, declineLabel, onConfirm, onDecline }
  action(spec: ToastActionSpec): void; // { key, message, actions: ToastAction[] }
  dismissAction(key: string): void;
};
type ToastAction = { label: string; ariaLabel?: string; onSelect: () => void; disabled?: boolean };
```

An empty message is ignored. Answering an offer (either button, close, Escape) dismisses it first, then calls its
callback once.

## Presentation and UX

- Region: `<section aria-label="Notifications">`, `fixed inset-x-0 z-[var(--z-toast)] pointer-events-none`,
  `flex flex-col items-center gap-2`, side padding `atLeastInset('1rem', side)`, `bottom: <floor>px`. Mounted after
  hydration (a `useSyncExternalStore` client flag), empty when there is nothing to show.
- Card: `pointer-events-auto relative flex w-full items-start gap-3 rounded-xl border py-1.5 pl-3 pr-1.5 shadow-lg
sm:w-auto sm:max-w-[36rem]` plus `TOAST_SURFACE` (white / slate-900, slate-200 / slate-700 border,
  `shadow-slate-900/10` / `dark:shadow-black/40`). Error border `rose-200` / `rose-500/40`; warning `amber-200` /
  `amber-500/40`.
- Icon: 16px in a `h-8` box, `info` `text-brand-700 dark:text-brand-400`, `success` emerald-600 / 400, `warning`
  amber-600 / 400, `error` rose-600 / 400.
- Body: `flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5`; message `min-w-0 flex-[1_1_auto] py-1.5
text-sm leading-5`; actions `ml-auto flex shrink-0 items-center gap-1`. The message's basis is its own width, so it
  and the actions share a row when they fit; a message too long for the row takes it whole and pushes the actions
  to the next row, at its end.
- Action button: `touch-target relative h-8 rounded-lg px-2.5 text-sm font-semibold transition`; primary
  `text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15`; secondary `text-slate-600
hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`; `disabled:opacity-50`.
- Close: `touch-target relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400
hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200`, `CloseIcon` 12px,
  `aria-label="Dismiss"`.

## Accessibility

- `role="alert"` for `error`, `role="status"` for the rest, on the card. The region carries no live attributes of
  its own, so nothing is announced twice.
- Escape inside a card: `stopPropagation`, `preventDefault`, then the close path.
- Focus rings: the shared `focus-visible` ring on every button.

## Performance and limits

- At most `TOAST_LIMIT` (3) non-leaving entries, plus the few leaving ones for 150ms: the list is bounded.
- The floor is measured only while the stack shows a toast: on mount, on a window `resize`, on a `ResizeObserver`
  callback for the obstacles found, on a document `animationend` (a banner that flew into place), and when the
  toast count changes. Each measure is one `querySelectorAll` and one `getBoundingClientRect` per obstacle (four or
  five elements), and sets state only when the floor changes.
- One timer per toast, never more than `TOAST_LIMIT`; a paused toast holds no timeout.
- `toastName` is linear in the name's length (one regex pass, one code-point split); names are capped by
  `docs/specs/006-document/name-length.md`, and it runs once per toast push, never on a hot path.

## Constants and configuration

| Constant                   | Value | Provenance                                   | Safe range    |
| -------------------------- | ----- | -------------------------------------------- | ------------- |
| `TOAST_TIMEOUT_MS.info`    | 4000  | The previous single timeout                  | 3000 to 6000  |
| `TOAST_TIMEOUT_MS.success` | 4000  | Same                                         | 3000 to 6000  |
| `TOAST_TIMEOUT_MS.warning` | 6000  | Longer copy, needs reading                   | 5000 to 8000  |
| `TOAST_TIMEOUT_MS.error`   | 6000  | Same                                         | 5000 to 8000  |
| `TOAST_ANSWER_TIMEOUT_MS`  | 10000 | Time to reach for Undo, never for good       | 8000 to 15000 |
| `TOAST_NAME_MAX`           | 30    | Two names plus copy stay under 90 characters | 20 to 32      |
| `TOAST_LIMIT`              | 3     | A burst of deletes never covers the screen   | 3 to 5        |
| `TOAST_EXIT_HOLD_MS`       | 150   | The `micro` token `toast-out` runs at        | = `micro`     |
| `TOAST_EDGE_PX`            | 16    | The page gutter                              | 8 to 24       |
| `TOAST_FLOOR_GAP_PX`       | 8     | The stack's own gap                          | 4 to 16       |
| `TOAST_MAX_WIDTH_PX`       | 576   | `sm:max-w-[36rem]`                           | 400 to 640    |
| `TOAST_PHONE_MAX_PX`       | 639   | Below Tailwind `sm`                          | = `sm` - 1    |

`TOAST_FLOOR_SELECTOR`: `[data-toast-floor], [data-editor-tabbar], [data-zoom-cluster], [data-whiteboard-dock]`. The
Explorer bottom bar and the sign-in banner's card carry `data-toast-floor`.

## Floor

`toastFloor({ viewportWidth, viewportHeight, obstacles })`, each obstacle a `{ top, left, right, width, height }`
rect:

- The column is the full width (minus `TOAST_EDGE_PX` each side) up to `TOAST_PHONE_MAX_PX`, else the centred
  `TOAST_MAX_WIDTH_PX`.
- An obstacle counts when it has a size, its top is on screen and in the lower half of it (a dock moved to the top
  is not bottom chrome), and it overlaps the column horizontally.
- Floor = `max(TOAST_EDGE_PX, max(viewportHeight - top + TOAST_FLOOR_GAP_PX))` over counted obstacles. The safe-area
  inset is added in CSS: `bottom: max(<floor>px, calc(16px + env(safe-area-inset-bottom)))`.

Bottom chrome that comes or goes without resizing anything the stack watches dispatches `TOAST_FLOOR_CHANGED_EVENT`
on `window` (`announceToastFloorChange()`): the sign-in banner on mount and unmount, the whiteboard dock on mount,
move and unmount, the new-version prompt when it shows or hides.

## Errors and edge cases

- An empty message: ignored (no blank toast).
- A second press on an answered offer, or on a leaving toast: ignored (`entry.leaving`, and `pointer-events-none`
  while it leaves).
- `animationend` never fires (a hidden page, jsdom): the exit hold removes the toast after `TOAST_EXIT_HOLD_MS`.
- No `ResizeObserver`: the floor still follows `resize`, `animationend` and `TOAST_FLOOR_CHANGED_EVENT`.
- Before hydration: the stack renders nothing; a push before it mounts still lands in state and shows on mount.
- A dismissed toast's `key` is free at once: an `action` under the same key while the old one leaves adds a new toast.

## Web Experience

- CLS: the stack is `fixed`, so a toast arriving or leaving moves nothing in the page.
- INP: a push is one state update; measuring the floor is a handful of rect reads after the commit, only while a
  toast is up.
- LCP: nothing renders before hydration, and nothing is loaded for toasts (no new dependency).

## Motion

`packages/tailwind-config/theme.css`:

- `--animate-toast-in: toast-in var(--transition-duration-short) cubic-bezier(0.16, 1, 0.3, 1)`, keyframe from
  `opacity: 0; transform: translateY(8px) scale(0.98)`.
- `--animate-toast-out: toast-out var(--transition-duration-micro) ease-in forwards`, keyframe to
  `opacity: 0; transform: translateY(4px)`.
- `--animate-toast-in-full: toast-in-full var(--transition-duration-long) cubic-bezier(0.34, 1.56, 0.64, 1)`, keyframe
  from `opacity: 0; transform: translateY(12px) scale(0.9)`: the entrance of an entry marked `full`.

## Testing

| Rule                                                      | Test                                                |
| --------------------------------------------------------- | --------------------------------------------------- |
| Dedupe, limit, upsert in place, retire oldest timed out   | `apps/live/components/toast/toast-queue.test.ts`    |
| Floor: column, overlap, off-column chrome, phone          | `apps/live/components/toast/toast-floor.test.ts`    |
| Timeouts per tone, pause and resume with the remainder    | `apps/live/components/toast/useToastTimer.test.tsx` |
| Gate (warning and error ignore it), roles, Escape, exit   | `apps/live/hooks/ui/useToast.test.tsx`              |
| One row: icon, message, actions, close in order           | `apps/live/components/toast/ToastCard.test.tsx`     |
| Offer and action toasts time out after the answer time    | `apps/live/hooks/ui/useToast.test.tsx`              |
| Names quoted, cut, fallen back; copy stays under 90 chars | `apps/live/lib/toast-name.test.ts`                  |

## Observability

Toasts are themselves the observable surface; the callers log their own failures. No new log.

## Defaults ledger

See `DEFAULTS.md` rows for `toasts`.
