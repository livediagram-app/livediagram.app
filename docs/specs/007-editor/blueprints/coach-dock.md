# Coach dock blueprint

Derived from [Coach dock](../coach-dock.md) and the dock rules of [Pages tour](../pages-tour.md). Code lives in
`apps/live/components/tour/coach-dock/`. Every tour host (`TourHost`, `PlanTourHost`, `WorkshopTourHost`,
`DrawTourHost`, `FormTourHost`, `AvatarTourHost`, `PagesTourHost`, `ElementTourHost`) and every Show Me
(`ShowMeStage`, `PageTourStage`) draws through `CoachDockStage`; the old `TourStage`, `TourBanner`, `TourPopover`,
`tour-colours.ts`, `tour-position.ts` and `TourHelpArt` are removed.

## Domain and naming

| Spec term    | Identifier                                                               |
| ------------ | ------------------------------------------------------------------------ |
| Coach dock   | `CoachDock` (component), `[data-coach-dock]` (its root)                  |
| Dock slot    | `CoachDockSlot`, `[data-coach-dock-slot]`, slot key `'dock'`             |
| Tour chip    | `CoachChip`, `[data-coach-chip]`; its slot `CoachChipSlot`, key `'chip'` |
| Pointer      | `CoachPointer` (ring `[data-coach-ring]`, badge `[data-coach-badge]`)    |
| Try it       | `TryIt<Api>` on a step (`step.tryIt`), `useTryIt`                        |
| Offer        | dock state `'offer'` (the engine's `card: 'welcome'` step)               |
| Folded offer | `folded` in `CoachDockStage`                                             |
| Step         | dock state `'step'`                                                      |
| Closing      | dock state `'closing'` (the engine's `card: 'outro'` step)               |
| Dock floor   | CSS custom property `--coach-dock-floor` on `<html>`                     |
| Offer choice | `TourWelcomeChoice` (`tour-card-copy.ts`), the stage's `choices`         |
| Dialog tour  | the stage's `layer: 'modal'`, or a step's own `layer: 'modal'`           |

## Behaviour and state

`CoachDockStage<Api>` reads the shared `TourEngine<Api>` and holds one piece of state of its own, `folded`.

| Engine                          | `folded` | Draws                                                                                                                                       |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| not active, or no step          | any      | nothing                                                                                                                                     |
| step `card: 'welcome'`          | false    | dock `'offer'` (choices in place of Take the Tour), fold timer armed                                                                        |
| step `card: 'welcome'`          | true     | chip only                                                                                                                                   |
| step without `card`             | n/a      | dock `'step'`, pointer when `targetRect`, Try it when set and `api` given; over the dim when the step's layer (or the stage's) is `'modal'` |
| step `card: 'outro'`            | n/a      | dock `'closing'`, fold timer armed; over the dim for a `'modal'` stage                                                                      |
| `yielded` (another dialog open) | any      | the dock as it was, no pointer                                                                                                              |

Transitions:

- offer · Take the Tour → `engine.next()` (the host's `onStart` fires).
- offer · a choice → that choice's `onPick()` (the Plan host sets its track, then calls `engine.next()`).
- offer · No Thanks / Escape inside the dock → `engine.skip()` (outcome `declined`).
- offer · fold timer → `folded = true`, `onFolded()`.
- chip · ▶ → `folded = false`, `onChipStart()`, then `engine.next()`; with `choices`, the offer only unfolds, to be
  chosen from.
- chip · × → `engine.skip()` (declined).
- step · Next → `engine.next()`; Back → `engine.back()` (shown from the second counted step); End Tour /
  Escape inside the dock → `engine.skip()` (`skipped`).
- step · Try it done → after `TRY_IT_ADVANCE_MS`, `engine.next()` if the same step is still up.
- closing · Start / Escape inside → `engine.next()` (`completed`); fold timer → `engine.next()`.
- `folded` resets to false whenever the engine becomes active (a new offer).

Fold timer (`useFoldTimer(armed, hold, onFold)`): one `setTimeout(OFFER_FOLD_MS)` while `armed && !hold`; any
change of `hold` clears it and, on release, starts it again from full. `hold` is a `pointermove` of
`pointerType` mouse over the dock (until `pointerleave`) or focus inside it: a pointer resting where the dock
appeared, or a touch, holds nothing.

Try it (`useTryIt(selector, stepKey, onDone)`): `done` is false on every new `stepKey`; one `click` listener on
`document` in the capture phase marks it true when the event target `closest(selector)` matches; once true, a
`setTimeout(TRY_IT_ADVANCE_MS)` calls `onDone`; the timer and listener are removed on step change or unmount.

## Interfaces and contracts

```ts
// tour-step.ts
type TryIt<Api> = { label: string; pressed: (api: Api) => string };
TourStepOf<Api>.tryIt?: TryIt<Api>;

// coach-dock/CoachDockStage.tsx
CoachDockStage<Api>(props: {
  engine: TourEngine<Api>;
  api?: Api;                  // only the tours whose steps carry a Try it
  eyebrow: string;            // "Slides tour", "Show Me · Card Types"
  art?: ReactNode;            // offer and closing, desktop only
  help: { href: string; label: string };
  finish: string;             // the closing's button: TOUR_FINISH ("Start") or "Done"
  chip?: { label: string; about: string }; // an offered tour's chip: "Diagram Tour"
  choices?: readonly TourWelcomeChoice[];  // the Plan tour's Boards / Spreadsheets
  layer?: 'overlay' | 'modal';             // 'modal': a tour of a dialog
  onFolded?: () => void;
  onChipStart?: () => void;
});
```

`CoachDock` takes the state, the words, the counts, the Try it view (`{ label, done } | null`), `choices`,
`overModal` and one handler per button; it owns `hold`, Escape and the dock floor. With `overModal` (or no dock
slot) it portals to a `fixed inset-x-0 bottom-0 z-[var(--z-toast)]` wrapper, above the dialog layer (`--z-modal`)
and its menus (`--z-popover`). A step's `tryIt.pressed(api)` is resolved once per step entry.

Pages selectors (`page-tour-dom.ts`):

- `emptyPageLayouts(pageId)`: `[data-empty-page-layouts="<id>"]`.
- `layoutAnchor(pageId)`: the card when present, else `pageOrPopover(pageId, 'Layout')`.
- `openLayouts(pageId)`: the card present → records Layout as opened (so a later heal never opens the popover) and
  returns; else `openTitlePopover(pageId, 'Layout')`.
- `layoutTiles(pageId)`: `[data-layout-tile]` inside the card or inside the Layout popover.
- `BACKGROUND_CHOICES`: `button` inside a `[role="radiogroup"]` of the Background popover.
- `ADD_PAGE_PRESS`: the row's or the strip's +.

## Data and persistence

None stored. `folded` lives in memory for the mount; the offer's seen-guard (`pagesTourKinds`) is unchanged: a
fold writes nothing, so the offer returns on the next visit.

## Errors and edge cases

| Case                                                         | Handling                                                                                                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No dock slot mounted (a surface outside the editor, a test)  | `CoachDock` renders fixed to the bottom of the viewport in a Portal                                                                                                                                                |
| No chip slot (zen mode: no tab bar)                          | The chip renders in the dock slot as a right-aligned row                                                                                                                                                           |
| Try it target pressed twice                                  | `done` is already true; one timer                                                                                                                                                                                  |
| Next pressed during the Try it beat                          | The step changes; the timer is cleared with it, so no double advance                                                                                                                                               |
| Layout picked from the page's card                           | The card unmounts; the anchor falls to the Layout button; Layout counts as opened, no popover                                                                                                                      |
| The page-tour host ends the tour (page gone, mode left)      | Engine inactive → the stage draws nothing; the floor variable is removed on unmount                                                                                                                                |
| Window resized / phone rotated                               | The floor re-measures (ResizeObserver on the dock, `resize` on window)                                                                                                                                             |
| Expanded bottom sheet while the dock shows                   | Its full height subtracts the floor, so it stays below the header                                                                                                                                                  |
| A tour of a dialog (Show Me in Share, Card Types, Tab Style) | The dock stands over the dim; the shared `Dialog` layer pads its bottom by the floor (`pb-[var(--coach-dock-floor,0px)]`) and caps the panel at `calc(100%-2rem)` of what is left; a phone sheet caps at 85% of it |
| Tab Style panel anchored to its brush                        | `bottom: max(brush, floor + 8px)` in panel px; its max height takes the same away                                                                                                                                  |
| Photo Review                                                 | Its layer pads by the floor and the photo caps at `88vh` less the floor                                                                                                                                            |
| An editor tour's step inside its own data dialog             | That step stands the dock over the dim; the next step returns it to the slot                                                                                                                                       |
| Offer choices folded, then the chip pressed                  | The offer unfolds with its choices; no track is started for the person                                                                                                                                             |

## Security and trust

No input beyond presses on the editor's own controls; the Try it selector is a constant per step. Nothing is sent
except the closed telemetry tokens below.

## Performance and limits

- The canvas resizes twice per tour (dock in, dock out). No height animation: the dock's contents use
  `animate-fly-up-in` (opacity + transform only).
- The pointer follows the engine's existing 150 ms `targetRect` tick; one ring and one badge, re-rendered only
  when the rect changes (the engine keeps the same object for an unchanged rect).
- One capture `click` listener while a Try it step is up; `closest()` on one selector per click.
- The dock floor is one ResizeObserver and one `resize` listener while the dock is mounted.
- First load: the dock modules are imported by the tour hosts and `ShowMe`, which already sit in the editor's
  first load; the old banner, popover and colour modules leave it, so every tour moving over is a net saving.

## Presentation and UX

- Dock root: `bg-white dark:bg-slate-900`, `border-t border-slate-200 dark:border-slate-800`, inner row
  `mx-auto max-w-6xl`, `py-3` (`sm:py-3.5`), side padding 1rem past the safe-area insets, gap 20 px; `sm:min-h-[7.25rem]`
  (116 px, the tallest step: eyebrow, title, one body line, Try it) so the canvas resizes only on show and hide;
  phone stack gap 12 px.
- Words: eyebrow `text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300` with the
  count in slate 500 / 400 beside it; title `text-sm font-semibold sm:text-[15px]`; body `text-[13px]
text-slate-600 dark:text-slate-300`.
- Progress: `role="progressbar"` with `aria-valuemin=1`, `aria-valuemax`, `aria-valuenow`, four-pixel segments,
  brand 600 / 400 filled, slate 200 / 700 empty, 80 px wide.
- Try it: 16 px circle, brand border; done fills emerald 600 with a white tick and reads "Done".
- Buttons: shared `Button`, `size="sm"`; Take the Tour / Next / Finish / Start `primary`, No Thanks / Back
  `secondary`, End Tour `ghost`; phone `flex-1 h-10`.
- Art: 112 px wide tile, `rounded-lg bg-slate-50 dark:bg-slate-800`, desktop only.
- Chip: 28 px pill, `bg-brand-50 text-brand-700 ring-1 ring-brand-200` (dark `bg-brand-500/15 text-brand-200
ring-brand-500/40`), ▶ label then a divider and ×, each a 44 px tap area on touch.
- Ring: `border-2 border-brand-600 dark:border-brand-400`, halo `0 0 0 4px` brand at 20%, radius 12 px, pad
  `RING_PAD_PX`; glides with `transition-all duration-long`.
- Badge: `BADGE_SIZE_PX` circle centred on the ring's top-left corner, clamped 4 px inside the window; brand 700
  with white 11 px semibold digits (dark: brand 400, slate 900 digits), a 2 px white (dark: slate 900) ring; glides
  with the ring.

Copy (Title Case on buttons): Take the Tour, No Thanks, End Tour, Back, Next, Finish, Start; chip "<Kind> Tour";
offer length from `tourLength(count)`: "1 stop, under a minute", "N stops, about a minute" (N ≤ 6),
"N stops, about two minutes" (N > 6).

## Accessibility

- `role="region"` with `aria-label` = eyebrow; never focused programmatically; `onMouseDown` prevents default so
  a press leaves focus where it was.
- An `sr-only` `aria-live="polite"` line: "<eyebrow>, step N of M: <title>" on each step; the offer's question on
  the offer.
- Escape handled only when focus is inside the dock and the event is not `defaultPrevented`.
- Contrast: slate 600 on white 7.6:1, slate 300 on slate 900 12.0:1, white on brand 700 5.9:1 (shared Button).
- `motion-reduce:` removes the rise-in and the ring glide.

## Web Experience

- CLS: the dock is user-triggered chrome after load (the offer waits `OFFER_DELAY_MS` past hydration), outside
  the initial layout shift window; the canvas resize is one step, not a slide.
- INP: every handler is a state flip; no layout read in a press handler.

## Observability

- `debugLog('[coach-dock] fold')` when the offer folds, `[coach-dock] try-it` when a Try it lands, with the step
  id.
- Each host's existing `[<tour>] offer` / `end` logs stay.

## Testing

| Rule                                                  | Test                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Offer: Take the Tour starts, No Thanks declines       | `CoachDockStage.test.tsx`                                                                                    |
| Offer folds after `OFFER_FOLD_MS`, held by a pointer  | `CoachDockStage.test.tsx`                                                                                    |
| Chip starts and dismisses; a new offer starts open    | `CoachDockStage.test.tsx`                                                                                    |
| Step count, progress, Back from the second, End Tour  | `CoachDockStage.test.tsx`                                                                                    |
| Try it ticks on its own press only, advances once     | `CoachDockStage.test.tsx`                                                                                    |
| Escape only from inside the dock                      | `CoachDockStage.test.tsx`                                                                                    |
| Dock floor and sign-in banner quieting, set and clear | `CoachDockStage.test.tsx`                                                                                    |
| Ring and badge, badge kept inside the window          | `CoachDockStage.test.tsx`                                                                                    |
| Without slots: the dock and chip still show           | `CoachDockStage.test.tsx`                                                                                    |
| Slots publish and release by their owner              | `CoachDockSlots.test.tsx`                                                                                    |
| `tourLength` and the step announcement                | `coach-dock-pure.test.ts`                                                                                    |
| Layout step rings the page's own card, opens nothing  | `page-tour-dom.test.ts`, `PageTour.test.tsx`                                                                 |
| Try it on a slide: layout, background, a stray press  | `PageTour.test.tsx`                                                                                          |
| Pages offer, fold and chip telemetry                  | `PagesTourHost.test.tsx`                                                                                     |
| Every mode tour's fold and chip telemetry             | `TourHost`, `PlanTourHost`, `WorkshopTourHost`, `DrawTourHost`, `FormTourHost`, `AvatarTourHost` `.test.tsx` |
| Offer choices; the chip reopens a choice offer        | `CoachDockStage.test.tsx`                                                                                    |
| A dialog tour stands over the dim, ring 14 px clear   | `CoachDockStage.test.tsx`                                                                                    |
| An editor tour's step in its dialog lifts the dock    | `CoachDockStage.test.tsx`                                                                                    |
| Every Show Me in the dock                             | `ShowMe`, `CardTypeTour`, `ShareTour`, `DashboardTour`, `SankeyFlowsTour`, `PhotoReviewTour` `.test.tsx`     |
| Dialogs stand on the dock floor                       | `Dialog.test.tsx` (`packages/ui`)                                                                            |
| Sheets and toasts stand on the dock                   | `BottomSheet.test.tsx`, `toast-floor.test.ts`                                                                |

## Constants and configuration

| Constant                | Value | Provenance                                                            | Safe range |
| ----------------------- | ----- | --------------------------------------------------------------------- | ---------- |
| `OFFER_FOLD_MS`         | 12000 | Spec: long enough to read the offer twice, short enough not to linger | 8000-20000 |
| `TRY_IT_ADVANCE_MS`     | 900   | Spec: a beat to see the pick land before moving on                    | 600-1500   |
| `RING_PAD_PX`           | 6     | Spec: the ring 6 px clear of the control                              | 4-10       |
| `RING_PAD_IN_DIALOG_PX` | 14    | Spec: a dialog's packed rows want more room (the old Show Me pad)     | 10-18      |
| `BADGE_SIZE_PX`         | 20    | Spec: a 20 px badge, room for two digits in 11 px type                | 18-24      |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows D89 to D92.
