# Get Started tours: blueprint

Derived from [Get Started tours](../knowledge-tours.md). Paths are under `apps/editor/` unless they say otherwise.

## Domain and naming

| Spec term                 | Identifier                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Get Started tour          | `KnowledgeTourId`: `'first-page' \| 'organise' \| 'trust' \| 'ask' \| 'connect' \| 'share'`                            |
| The six, in list order    | `KNOWLEDGE_TOURS` (`lib/knowledge-tours.ts`)                                                                           |
| Step plan                 | `KNOWLEDGE_TOUR_PLAN: Record<KnowledgeTourId, readonly PlannedStep[]>`, `PlannedStep = { id, needs, present?, tree? }` |
| What a step needs         | `TourNeed`: `'write' \| 'share' \| 'signedIn' \| 'online' \| 'desktop'`                                                |
| Who is looking            | `TourWho = { write, share, signedIn, online, phone }` (booleans)                                                       |
| Taken record              | `knowledgeTours?: KnowledgeTourId[]`, `knowledgeToursSeen?: boolean` on `UserPreferences`                              |
| A tour's words            | `KNOWLEDGE_TOUR_COPY: Record<KnowledgeTourId, { title, line, help, token }>`                                           |
| The host                  | `KnowledgeToursHost` (`components/tour/KnowledgeToursHost.tsx`), offer id `'knowledge'`                                |
| Steps, built at the press | `knowledgeTourSteps(id, who, api)` (`components/tour/knowledge-tour-steps.ts`)                                         |
| Step api                  | `KnowledgeTourApi` (`components/tour/knowledge-tour-dom.ts`)                                                           |

The telemetry token of a tour (`KNOWLEDGE_TOUR_COPY[id].token`): `FirstPage`, `Organise`, `Trust`, `Ask`,
`Connect`, `WorkTogether`.

## Behaviour and state

- **Offered tours.** `offeredTours(who) = KNOWLEDGE_TOURS.filter((id) => plannedFor(id, who).length >= MIN_TOUR_STEPS)`,
  `plannedFor(id, who) = KNOWLEDGE_TOUR_PLAN[id].filter((s) => s.needs.every((n) => meets(n, who)))`.
  `meets('write')` = `who.write`; `'share'` = `who.share`; `'signedIn'` = `who.signedIn`; `'online'` = `who.online`;
  `'desktop'` = `!who.phone`.
- **Who.** From the chrome store: `write = can.editPages && !isStructureReadOnly`, `share = can.manageKnowledgebase`,
  `signedIn = accountUserId != null`, `online = !useIsOfflineDocument(documentId)`, `phone = useIsMobileViewport()`.
- **Usable** = `useKnowledgeViewsOffered()` (hydrated, a document, app chrome, no embed, zen, welcome, workbench,
  Community visit or one-page link).
- **Offer.** `useOfferTour('knowledge', usable && offered.length > 0 ? { name: 'Knowledgebase', label: 'Knowledgebase
Tours', rank: TOUR_OFFER_RANK.mode, ownPanel: true, seen: offered.every(taken), start: toggleList, onShown } : null)`.
  `ownPanel`: the button's press calls `start`, which toggles the host's own list.
- **The list.** `list` state (`{ anchor, lengths }`, read as it opens); drawn as `GetStartedPopover` at that anchor with
  one `TourTopic` per offered tour: `title`, `line: knowledgeTourLine(id, who)` (a narrower line where the copy's
  names a step this person lacks: Organise and Trust for a reader, Share for a reader or a Participant), `icon`, `meta: stepsLength(shownPlan(...).length)`, `taken`. `idAttribute
'data-knowledge-tour'`. A pick closes the list and runs `begin(id)`. With no anchor (none drawn), a pick from Settings'
  rerun begins the first newly-on tour instead of opening the list.
- **Begin(id).** Refused while `engine.active`, another tour is active (`useActiveTour()` not null and not
  `'pages'`), or a load is in flight. Imports `./knowledge-tour-steps`, builds `knowledgeTourSteps(id, who)` (the
  plan filtered by `who`, then `shownPlan`: with the Pages view showing, each step whose plan entry names a
  `present` selector that is not on screen is dropped, except a `tree` step on a phone, whose sheet is shut: that one is judged by its plan entry's `held()`, the Trash's
  `trashedCount(pageTrashStore.get().pages) > 0`, and kept when it has none), sets a fresh run api and the subject in refs (the
  engine's callbacks read them in the same tick), `steps`, `engine.start()`, and records the tour taken when it was
  not.
- **Taken.** `markKnowledgeTourTaken(prefs, id)` adds `id` (each once, in order); `knowledgeTourTaken(prefs, id)` reads
  `knowledgeTours` or `knowledgeToursSeen`; `offerKnowledgeTourAgain(prefs, id)` removes `id` and, if
  `knowledgeToursSeen` was set, writes every other tour into the list and drops the flag. Written onto the freshest
  preferences (`rebaseUserPreferences`), then `setUserPreferences` and `writeUserPreferences`.
- **End.** `onFinish(outcome)` tracks Ended and runs `api.tidy()`, which puts back what the tour opened (see
  "Interfaces"). The view the last step showed stays.
- **Gone mid-tour.** An effect stops the engine, tidies and tracks Skipped when, while active, `usable` turns false,
  `documentId` changes, or a tour that needed `write` loses it.
- **One at a time.** `setActiveTour('pages', active)`, the shared slot's mode-tour place (no package change); unset
  on unmount.
- **Rerun.** `KNOWLEDGE_TOURS_RELAUNCH_EVENT` (`liveknowledge:knowledge-tours-relaunch`) carries `detail: { ids }`;
  `SettingsDialog` sends it on close with the tours newly untaken since it opened. One id: `begin(id)` if offered;
  several: open the list (or begin the first offered when no anchor is drawn); none offered: nothing.

## Interfaces and contracts

`KnowledgeTourApi` (built per run, kept in a ref):

- `showView(view: KnowledgeView)`: when `currentKnowledgeView()` differs, presses `[data-knowledge-view-link="<view>"]`
  (the tab's own handler, so a gate opens as a press would); a view the tour left records nothing.
- `openTree()`: on a phone presses `[data-page-tree-button]` when `[data-page-tree="sheet"]` is not on screen, and
  marks it opened; on a desktop with the tree folded (`[data-page-tree="rail"]`) presses `[data-page-tree-expand]` and
  marks it expanded. `closeTree()`: closes the phone sheet it opened (its own close, or Escape on the sheet).
- `openPageInfo()`: when `[data-page-health]` is not on screen, presses `[data-page-rail-expand]` (marks it) or
  `[data-page-rail-button]` (marks it); `closePageInfo()` puts the popover or sheet away.
- `tidy()`: closes what is still open, folds back a tree or a rail it expanded (`[data-page-tree-collapse]`,
  `[data-page-rail-collapse]`), and clears its marks. Safe to call twice.
- `pick(...selectors)`: the first selector whose first match is on screen, else the first (so the engine waits on it).

Step anchors (all existing attributes; no new markup):

| Step                                | Selector                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| first-page/new-page                 | `[data-new-page]`, else the rail's `[data-page-tree="rail"] button[aria-label="New Page"]`          |
| first-page/add-subpage              | `[data-page-row][data-current] [data-row-action="add"]`                                             |
| first-page/edit                     | `[data-page-edit]`                                                                                  |
| first-page/blocks                   | `[data-article-flow] > [data-block-id]`                                                             |
| organise/tree                       | `[data-page-tree-list]`                                                                             |
| organise/options                    | the menu opened from `[data-page-row][data-current] [data-row-action="menu"]` (`opensFrom`)         |
| organise/search                     | `[data-knowledge-search-door]`                                                                      |
| organise/breadcrumb                 | `[data-page-breadcrumb]`                                                                            |
| organise/trash                      | `[data-page-trash-row]`, else `[data-page-trash-rail]`                                              |
| trust/meta                          | `[data-page-meta]`                                                                                  |
| trust/verify                        | `[data-meta-verify]`                                                                                |
| trust/health                        | `[data-page-health]`                                                                                |
| trust/approval                      | `[data-request-approval]`                                                                           |
| ask/tab, ask/ai                     | `[data-knowledge-view-link="ask"]`, `[data-knowledge-view-link="ai"]`                               |
| ask/composer, ask/questions         | `[data-ask-composer]`, `aside[aria-label="Your Questions"]`                                         |
| connect/tab                         | `[data-knowledge-view-link="connect"]`                                                              |
| connect/apps, steps, access, status | `[data-connect-apps]`, `[data-connect-app-steps]`, `[data-connect-access]`, `[data-connect-status]` |
| share/share                         | `[data-tour-id="share"]` (the shared Share button)                                                  |
| share/makers                        | `ul[data-page-makers]` (the top row's avatars, not the meta row's pills)                            |
| share/reactions                     | `[data-page-reactions]`                                                                             |
| share/comments                      | `[data-page-comments]`                                                                              |

Each step's `prepare` first calls `showView` for its view, then what it opens (`openTree` for the tree steps,
`openPageInfo` for health and approval); its `cleanup` closes what the step alone opened (the phone's tree sheet, the
Page Info popover), so the next step starts from a quiet page. A step inside the Ask, Insights or Connect view
carries `layer: 'modal'`: those views are drawn over the editor as a modal frame (KnowledgeViewFrame's modal guard),
and without it the engine takes the view for someone else's dialog and steps aside, hiding the card.

## Data and persistence

- `knowledgeTours`: synced preference, an array of `KnowledgeTourId`, at most six entries (about 60 bytes), inside the
  4 KB blob. Unknown ids read as untaken and are kept as stored. `knowledgeToursSeen`: boolean.
- Retired, kept as stored, read by nothing: `pagesTourSeen`, `pagesTourKinds`, `elementTourKinds`, `elementToursSeen`
  (typed `string[]` now that their kinds' types are gone). `upgradeLegacyPreferences` keeps its fold of the retired
  Power user mode into `pagesTourKinds` (packages/api-schema), unchanged.

## Errors and edge cases

- The steps' chunk fails to load (a dropped connection): nothing starts, the load guard clears, a later pick tries
  again; `[knowledge-tours] load failed` is logged.
- A step's target never appears within `TARGET_WAIT_MS` (the engine's 3.5 s): the engine skips it the way the person
  was going.
- A view gated for this session (Ask turned away, Connect signed out): `showView`'s press opens the gate dialog; the
  engine steps aside for it, and the step's target never appears, so the step is skipped once the gate closes.
- The current page has no row in view (a long tree): the engine's reveal scrolls the tree list to it.
- Settings closed with tours newly on while a tour runs: ignored ("One tour at a time").

## Security and trust

Presentation only: the tours read the same `can` the controls read and press only controls already drawn for the
person. No write but the person's own preferences.

## Performance and limits

- The host chunk (`KnowledgeToursHost` with `lib/knowledge-tours.ts`'s plan and copy) loads with the editor's deferred
  code, after the first paint (`editor-deferred-code.ts`), as the two hosts it replaces did. The step chunk loads on a
  pick or a Settings rerun.
- Work per render: `offeredTours` filters 6 tours of at most 6 steps over 5 booleans, memoised on `who`. No timers,
  no listeners but the relaunch event and the engine's own.
- The host reads a slice of the chrome store (`useEditorChrome(slice, sameSlice)`), so typing renders nothing here.

## Presentation and UX

- Glyphs (`lucideGlyph`, 18 px): first-page `lucideFilePlus`, organise `lucideListTree`, trust `lucideShieldCheck`,
  ask `lucideSparkles`, connect `lucidePlug`, share `lucideUsers`.
- Card eyebrow: `${title} tour`; `ariaPrefix` the same. Last card: `copy={{ outroEyebrow: title, helpHref, finish:
'Done' }}`.
- The list's rows: the shared `TourTopics` (hover, focus ring, pressed, dark).

## Accessibility

The shared `TourPopover` and `GetStartedPopover` (focus into the list on open, Escape closes, arrow keys and Escape on
a card). The button's accessible name: "Get Started, Knowledgebase Tours".

## Observability

`debugLog('[knowledge-tours] start' | 'end' | 'gone' | 'load failed', { id, ... })`.

## Testing

| Spec rule                                      | Test                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Offered per role, phone, Offline               | `lib/knowledge-tours.test.ts` (each `TourWho` against each tour)                                                               |
| A reader's row lines; phone Trash count        | `lib/knowledge-tours.test.ts`                                                                                                  |
| Taken record, master and per-tour switches     | `lib/knowledge-tours.test.ts`, `settings-catalogue.test.ts`                                                                    |
| Plan and steps agree; 3 to 6 steps; outro help | `components/tour/knowledge-tour-steps.test.ts`                                                                                 |
| Every anchor resolves, per role                | `components/tour/knowledge-tour-steps.test.ts` (each selector's attribute in the app's markup; no writer control for a reader) |
| Offer, list, start, skip, restart, rerun       | `components/tour/KnowledgeToursHost.test.tsx`                                                                                  |
| Lazy steps, nothing in first load              | `app/document/[id]/document-lazy-load.test.ts`                                                                                 |
| No element tour or Pages tour row in Settings  | `settings-catalogue.test.ts`                                                                                                   |

## Constants and configuration

| Constant                         | Value                                      | Why                                             |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| `MIN_TOUR_STEPS`                 | 2                                          | A one-step tour is a tooltip, not a tour (spec) |
| `KNOWLEDGE_TOURS_RELAUNCH_EVENT` | `'liveknowledge:knowledge-tours-relaunch'` | The product's event prefix                      |

## Defaults ledger

D110 to D112 in [DEFAULTS.md](DEFAULTS.md).
