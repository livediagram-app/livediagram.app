# Workshop tour blueprint

Derived from [Workshop tour](../workshop-tour.md). Where this is silent, the
[Diagram tour](../../007-editor/editor-tour.md) holds.

## Domain and naming

| Thing               | Identifier                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| The host            | `WorkshopTourHost` in `apps/editor/components/tour/WorkshopTourHost.tsx`                            |
| The steps           | `WORKSHOP_TOUR_STEPS`, `workshopTourSteps({ canShare })` in `workshop-tour-steps.ts`                |
| The taken record    | `UserPreferences.workshopTourSeen` (synced), read by Settings only                                  |
| The rerun signal    | `WORKSHOP_TOUR_RELAUNCH_EVENT`, `requestWorkshopTourRelaunch` in `apps/editor/lib/workshop-tour.ts` |
| The one-tour slot   | `ActiveTour` `'workshop'` in `apps/editor/lib/tour-active.ts`                                       |
| The Settings switch | `workshopTourSeen`, "Workshop Tour", third toggle row in the Tours category                         |
| The help article    | `canvas/workshop-mode/workshop-tour` (`helpArticle: 'workshopTour'`)                                |

## Behaviour and state

- **Mount:** `EditorView` mounts the host the first time the tab's mode is `workshop`
  (`useEverTrue`), and keeps it mounted.
- **Offer:** `useOfferTour('workshop', …)` publishes `{ name: 'Workshop', rank: TOUR_OFFER_RANK.mode, start }` to
  the footer's Start Tour button while in Workshop and `canWork` (hydrated, no start panel open, no welcome
  overlay, not read-only, not embedded, tab not locked), seen or not. `start` does nothing while this tour or
  another (`useActiveTour()`) is active. The tour never starts on its own.
- **Rerun:** `WORKSHOP_TOUR_RELAUNCH_EVENT` starts it when it is on offer; elsewhere it is ignored.
- **No offer, no chain.** The host never offers the tour on entering Workshop (no delay, no welcome card), and no
  other tour carries it: `TourStage` / `TourPopover` have no `outroChoice`, and `workshopTourSeen` is written only by
  this tour.
- **One tour at a time:** each of `TourHost` (the Diagram tour), `DrawTourHost`, `WorkshopTourHost` (and the
  avatar and element tours) treats any other
  active tour as blocking and publishes itself with `setActiveTour` while active.
- **Steps:** `collaborate` (`band-collaborate` with `alsoHighlight`
  `option-collab-navigate`: the band's heading to its last tile; opens the picker, closes it on cleanup) → `session-strip` (`session-tools`) → `share` (`share`, the
  `EditorHeader` Share button) → `outro` (card). `share` is filtered out
  when `findTour('share')` is null as the tour starts.
- **End** (any outcome) writes `workshopTourSeen: true` through `rebaseUserPreferences`, then
  `setUserPreferences` and `writeUserPreferences`.
- **Abandon:** while active, losing `canWork`, leaving Workshop or a different `activeTab.id` stops
  the engine and ends as `skipped`.

## Interfaces and contracts

- `WorkshopTourApi = Record<string, never>`: the steps drive only the DOM.
- `TourStage` gets `ariaPrefix="Workshop tour"`, copy `{ helpHref: '/help/canvas/workshop-mode/' }`; there is no
  welcome card.

## Data and persistence

- One new optional boolean in the synced preferences blob; missing reads as not seen. No document
  data, no history entries.

## Errors and edge cases

- A missing anchor mid-tour is skipped by the engine, as in every tour.
- A rerun outside Workshop is ignored; the button offers the tour on the next entry.

## Security and trust

- No new trust boundary: the preference rides the existing preferences write and its 4 KB cap.
- On offer only to someone who may edit (`!isReadOnly`), so never to a Participant or a Viewer.

## Performance and limits

- The host's chunk loads only after the first entry to Workshop. Beyond publishing its offer it does no work until
  the button is pressed.

## Presentation and UX

- Copy per the spec's steps, exact strings in `workshop-tour-steps.ts`; outro title
  "You're ready to run a workshop".

## Accessibility

- The shared `TourStage` / `TourPopover`: focus moves to the card, Escape skips, the ring is
  decorative.

## Observability

- `debugLog('[workshop-tour] start' | '[workshop-tour] end')`, and the spec's telemetry.

## Testing

| Rule                                                                           | Test                                                                         |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| On the button in Workshop, never starting on its own; stays on offer once seen | `WorkshopTourHost.test.tsx`                                                  |
| Never starts beside another tour on screen                                     | `WorkshopTourHost.test.tsx`                                                  |
| Rerun in Workshop only                                                         | `WorkshopTourHost.test.tsx`                                                  |
| Skip and completion mark it seen and send telemetry; leaving ends as skipped   | `WorkshopTourHost.test.tsx`                                                  |
| The Diagram tour is never offered in Workshop                                  | `TourHost.test.tsx`                                                          |
| Step order, anchors, Share filter, telemetry tokens                            | `workshop-tour-steps.test.ts`                                                |
| Settings switch inverted, third in Tours                                       | `settings-catalogue.test.ts`                                                 |
| Power user mode marks it seen                                                  | `power-user-preset-rows.test.ts`, `SettingsCategoryPane.power-user.test.tsx` |
| The slot holds `'workshop'`                                                    | `lib/tour-active.test.ts`                                                    |

## Constants and configuration

None.

## Assets and external resources

- No art of its own. Help card glyph
  `workshop-tour` in `apps/help/lib/featureIcons.tsx`, hue `#ea580c` in `featureColours.ts`.

## Defaults ledger

- FT1, FT2 in [DEFAULTS.md](DEFAULTS.md).
