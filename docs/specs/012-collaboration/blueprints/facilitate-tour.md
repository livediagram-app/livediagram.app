# Facilitate tour blueprint

Derived from [Facilitate tour](../facilitate-tour.md). Where this is silent, the
[Plan tour blueprint](../../026-plan/blueprints/plan-tour.md) holds.

## Domain and naming

| Thing               | Identifier                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| The host            | `FacilitateTourHost` in `apps/live/components/tour/FacilitateTourHost.tsx`                              |
| The steps           | `FACILITATE_TOUR_STEPS`, `facilitateTourSteps({ canShare })` in `facilitate-tour-steps.ts`              |
| The welcome art     | `FacilitateTourArt` in `apps/live/components/tour/FacilitateTourArt.tsx`                                |
| The seen-guard      | `UserPreferences.facilitateTourSeen` (synced)                                                           |
| The rerun signal    | `FACILITATE_TOUR_RELAUNCH_EVENT`, `requestFacilitateTourRelaunch` in `apps/live/lib/facilitate-tour.ts` |
| The one-tour slot   | `ActiveTour` `'facilitate'` in `apps/live/lib/tour-active.ts`                                           |
| The Settings switch | `facilitateTourSeen`, "Facilitate Tour", third toggle row in the Tours category                         |
| The help article    | `canvas/facilitate-mode/facilitate-tour` (`helpArticle: 'facilitateTour'`)                              |

## Behaviour and state

- **Mount:** `EditorView` mounts the host the first time the tab's mode is `facilitate`
  (`useEverTrue`), and keeps it mounted.
- **Armed** on entering Facilitate (or mounting in it) and by the rerun event while in Facilitate;
  disarmed on leaving, on offering, and whenever `facilitateTourSeen` is true.
- **Offer** after `OFFER_DELAY_MS` (800) when armed, in Facilitate, `canWork` (hydrated, `prefsSettled`, no welcome
  overlay, not read-only, not embedded, tab not locked), not seen, and no other tour active (`useActiveTour()`
  is null or `'facilitate'`). It reads neither `tourSeen` nor `hasTourPending()`: the Diagram tour never runs
  in Facilitate.
- **Retired: the welcome tour's chain.** Until October 2026 `TourHost` offered the welcome tour first in
  Facilitate (`owedByFacilitate`), carried this tour's offer on its closing card (`outroChoice`, "Show me
  Facilitate", `FACILITATE_TOUR_START_EVENT`) and wrote `facilitateTourSeen` with `tourSeen`. All of it is gone:
  `TourStage` / `TourPopover` lost `outroChoice`, `lib/facilitate-tour.ts` lost the start event, and
  `facilitateTourSteps` lost `withWelcome`.
- **One tour at a time:** each of `TourHost` (the Diagram tour), `PlanTourHost`, `FacilitateTourHost` treats any other
  active tour as blocking and publishes itself with `setActiveTour` while active.
- **Steps:** `welcome` (card) → `collaborate` (`band-collaborate` with `alsoHighlight`
  `option-collab-navigate`: the band's heading to its last tile; opens the picker, closes it on cleanup) → `session-strip` (`session-tools`) → `share` (`share`, the
  `EditorHeader` Share button) → `outro` (card). `share` is filtered out
  when `findTour('share')` is null as the offer starts.
- **End** (any outcome) writes `facilitateTourSeen: true` through `rebaseUserPreferences`, then
  `setUserPreferences` and `writeUserPreferences`.
- **Abandon:** while active, losing `canWork`, leaving Facilitate or a different `activeTab.id` stops
  the engine and ends as `skipped`.

## Interfaces and contracts

- `FacilitateTourApi = Record<string, never>`: the steps drive only the DOM.
- `TourStage` gets `ariaPrefix="Facilitate tour"`, copy `{ welcomeEyebrow: 'Facilitate tour',
helpHref: '/help/canvas/facilitate-mode/', finish: 'Start facilitating' }` and no
  `welcomeChoices` (the default Yes / No).

## Data and persistence

- One new optional boolean in the synced preferences blob; missing reads as not seen. No document
  data, no history entries.

## Errors and edge cases

- A missing anchor mid-tour is skipped by the engine, as in every tour.
- A rerun outside Facilitate is ignored; the cleared preference offers it on the next entry.

## Security and trust

- No new trust boundary: the preference rides the existing preferences write and its 4 KB cap.
- Offered only to someone who may edit (`!isReadOnly`), so never to a Participant or a Viewer.

## Performance and limits

- The host's chunk loads only after the first entry to Facilitate. No work runs while unarmed beyond
  one store subscription; the offer is one timeout.

## Presentation and UX

- Copy per the spec's steps, exact strings in `facilitate-tour-steps.ts`; outro title
  "You're ready to facilitate".
- The art loops with the `animation` shorthand and `infinite`, and sets `animation: none` under
  reduced motion.

## Accessibility

- The shared `TourStage` / `TourPopover`: focus moves to the card, Escape skips, the ring is
  decorative. The art is `aria-hidden`.

## Observability

- `debugLog('[facilitate-tour] offer' | '[facilitate-tour] end')`, and the spec's telemetry.

## Testing

| Rule                                                                                              | Test                                                                         |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Offer after the delay, only in Facilitate, not when seen, read-only, locked, unhydrated, embedded | `FacilitateTourHost.test.tsx`                                                |
| Offered without the Diagram tour, even owed; waits while another tour is on screen                | `FacilitateTourHost.test.tsx`                                                |
| Rerun in Facilitate only                                                                          | `FacilitateTourHost.test.tsx`                                                |
| Decline and completion mark it seen and send telemetry; leaving ends as skipped                   | `FacilitateTourHost.test.tsx`                                                |
| The Diagram tour is never owed or offered in Facilitate                                           | `TourHost.test.tsx`                                                          |
| Step order, anchors, Share filter, telemetry tokens                                               | `facilitate-tour-steps.test.ts`                                              |
| Settings switch inverted, third in Tours                                                          | `settings-catalogue.test.ts`                                                 |
| Power user mode marks it seen                                                                     | `power-user-preset-rows.test.ts`, `SettingsCategoryPane.power-user.test.tsx` |
| The slot holds `'facilitate'`                                                                     | `lib/tour-active.test.ts`                                                    |

## Constants and configuration

| Constant         | Value | Provenance                         |
| ---------------- | ----- | ---------------------------------- |
| `OFFER_DELAY_MS` | 800   | The Diagram and Plan tours' settle |

## Assets and external resources

- `FacilitateTourArt`: inline SVG drawn for this tour, no external asset. Help card glyph
  `facilitate-tour` in `apps/help/lib/featureIcons.tsx`, hue `#ea580c` in `featureColours.ts`.

## Defaults ledger

- FT1, FT2 in [DEFAULTS.md](DEFAULTS.md).
