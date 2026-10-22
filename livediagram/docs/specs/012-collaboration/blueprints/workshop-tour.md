# Workshop tour blueprint

Derived from [Workshop tour](../workshop-tour.md). Where this is silent, the
[Plan tour blueprint](../../026-plan/blueprints/plan-tour.md) holds.

## Domain and naming

| Thing               | Identifier                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| The host            | `WorkshopTourHost` in `apps/editor/components/tour/WorkshopTourHost.tsx`                            |
| The steps           | `WORKSHOP_TOUR_STEPS`, `workshopTourSteps({ canShare })` in `workshop-tour-steps.ts`              |
| The welcome art     | `WorkshopTourArt` in `apps/editor/components/tour/WorkshopTourArt.tsx`                              |
| The seen-guard      | `UserPreferences.workshopTourSeen` (synced)                                                       |
| The rerun signal    | `WORKSHOP_TOUR_RELAUNCH_EVENT`, `requestWorkshopTourRelaunch` in `apps/editor/lib/workshop-tour.ts` |
| The one-tour slot   | `ActiveTour` `'workshop'` in `apps/editor/lib/tour-active.ts`                                       |
| The Settings switch | `workshopTourSeen`, "Workshop Tour", third toggle row in the Tours category                       |
| The help article    | `canvas/workshop-mode/workshop-tour` (`helpArticle: 'workshopTour'`)                              |

## Behaviour and state

- **Mount:** `EditorView` mounts the host the first time the tab's mode is `workshop`
  (`useEverTrue`), and keeps it mounted.
- **Armed** on entering Workshop (or mounting in it) and by the rerun event while in Workshop;
  disarmed on leaving, on offering, and whenever `workshopTourSeen` is true.
- **Offer** after `OFFER_DELAY_MS` (800) when armed, in Workshop, `canWork` (hydrated, `prefsSettled`, no welcome
  overlay, not read-only, not embedded, tab not locked), not seen, and no other tour active (`useActiveTour()`
  is null or `'workshop'`). It reads neither `tourSeen` nor `hasTourPending()`: the Diagram tour never runs
  in Workshop.
- **Retired: the welcome tour's chain.** Until October 2026 `TourHost` offered the welcome tour first in
  Workshop (`owedByWorkshop`), carried this tour's offer on its closing card (`outroChoice`, "Show me
  Workshop", `WORKSHOP_TOUR_START_EVENT`) and wrote `workshopTourSeen` with `tourSeen`. All of it is gone:
  `TourStage` / `TourPopover` lost `outroChoice`, `lib/workshop-tour.ts` lost the start event, and
  `workshopTourSteps` lost `withWelcome`.
- **One tour at a time:** each of `TourHost` (the Diagram tour), `PlanTourHost`, `WorkshopTourHost` treats any other
  active tour as blocking and publishes itself with `setActiveTour` while active.
- **Steps:** `welcome` (card) → `collaborate` (`band-collaborate` with `alsoHighlight`
  `option-collab-navigate`: the band's heading to its last tile; opens the picker, closes it on cleanup) → `session-strip` (`session-tools`) → `share` (`share`, the
  `EditorHeader` Share button) → `outro` (card). `share` is filtered out
  when `findTour('share')` is null as the offer starts.
- **End** (any outcome) writes `workshopTourSeen: true` through `rebaseUserPreferences`, then
  `setUserPreferences` and `writeUserPreferences`.
- **Abandon:** while active, losing `canWork`, leaving Workshop or a different `activeTab.id` stops
  the engine and ends as `skipped`.

## Interfaces and contracts

- `WorkshopTourApi = Record<string, never>`: the steps drive only the DOM.
- `TourStage` gets `ariaPrefix="Workshop tour"`, copy `{ welcomeEyebrow: 'Workshop tour',
helpHref: '/help/canvas/workshop-mode/', finish: TOUR_FINISH }` and no
  `welcomeChoices` (the default Yes / No).

## Data and persistence

- One new optional boolean in the synced preferences blob; missing reads as not seen. No document
  data, no history entries.

## Errors and edge cases

- A missing anchor mid-tour is skipped by the engine, as in every tour.
- A rerun outside Workshop is ignored; the cleared preference offers it on the next entry.

## Security and trust

- No new trust boundary: the preference rides the existing preferences write and its 4 KB cap.
- Offered only to someone who may edit (`!isReadOnly`), so never to a Participant or a Viewer.

## Performance and limits

- The host's chunk loads only after the first entry to Workshop. No work runs while unarmed beyond
  one store subscription; the offer is one timeout.

## Presentation and UX

- Copy per the spec's steps, exact strings in `workshop-tour-steps.ts`; outro title
  "You're ready to run a workshop".
- The art loops with the `animation` shorthand and `infinite`, and sets `animation: none` under
  reduced motion.

## Accessibility

- The shared `TourStage` / `TourPopover`: focus moves to the card, Escape skips, the ring is
  decorative. The art is `aria-hidden`.

## Observability

- `debugLog('[workshop-tour] offer' | '[workshop-tour] end')`, and the spec's telemetry.

## Testing

| Rule                                                                                            | Test                                                                         |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Offer after the delay, only in Workshop, not when seen, read-only, locked, unhydrated, embedded | `WorkshopTourHost.test.tsx`                                                  |
| Offered without the Diagram tour, even owed; waits while another tour is on screen              | `WorkshopTourHost.test.tsx`                                                  |
| Rerun in Workshop only                                                                          | `WorkshopTourHost.test.tsx`                                                  |
| Decline and completion mark it seen and send telemetry; leaving ends as skipped                 | `WorkshopTourHost.test.tsx`                                                  |
| The Diagram tour is never owed or offered in Workshop                                           | `TourHost.test.tsx`                                                          |
| Step order, anchors, Share filter, telemetry tokens                                             | `workshop-tour-steps.test.ts`                                                |
| Settings switch inverted, third in Tours                                                        | `settings-catalogue.test.ts`                                                 |
| Power user mode marks it seen                                                                   | `power-user-preset-rows.test.ts`, `SettingsCategoryPane.power-user.test.tsx` |
| The slot holds `'workshop'`                                                                     | `lib/tour-active.test.ts`                                                    |

## Constants and configuration

| Constant         | Value | Provenance                         |
| ---------------- | ----- | ---------------------------------- |
| `OFFER_DELAY_MS` | 800   | The Diagram and Plan tours' settle |

## Assets and external resources

- `WorkshopTourArt`: inline SVG drawn for this tour, no external asset. Help card glyph
  `workshop-tour` in `apps/help/lib/featureIcons.tsx`, hue `#ea580c` in `featureColours.ts`.

## Defaults ledger

- FT1, FT2 in [DEFAULTS.md](DEFAULTS.md).
