# Wireframe pages blueprint

Derived from [Wireframe pages](../wireframe-pages.md). The page machinery it extends is in
[Pages](pages-mode.md); this blueprint names only what the wireframe kind adds or changes.

## Domain and naming

| Spec term           | Identifier                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| wireframe page      | `Page` with `kind: 'wireframe'`; `PageKind` member `'wireframe'`                                                  |
| device              | `Page.device`, `WireframeDeviceId`; `WIREFRAME_DEVICES` (label, `short`, class, portrait screen, `turns`)         |
| device class        | `WireframeDeviceClass` (`'phone' \| 'tablet' \| 'computer' \| 'watch'`); `pageDeviceClass(page)`                  |
| device frame        | `wireframeFrameSvg` (`wireframeFrameUnderSvg` beneath the content, `wireframeFrameOverSvg` above it)              |
| screen              | `DeviceGeometry.screen` and `radii`; `pageScreenRect(page)`, `pageClipPathData(page)`                             |
| system bars         | `Page.systemBars` (absent is shown); `DeviceGeometry.bars`; `deviceHasSystemBars`, `pageShowsSystemBars`          |
| safe area           | `deviceSafeArea(geometry, systemBars)`; `pageContentBox(page)` (any kind: a wireframe page's safe area)           |
| frame look          | `Page.frameLook`, `WireframeFrameLook` (`'theme'` absent); `WIREFRAME_FRAME_LOOKS`, `WIREFRAME_FRAME_LOOK_LABEL`  |
| frame theme         | `WireframeFrameTheme`, `wireframeFrameTheme(theme)`, `tabWireframeFrameTheme(tab)`                                |
| wireframe layout    | `WireframeLayoutId`, `WIREFRAME_LAYOUTS`, `WIREFRAME_LAYOUT_CATEGORIES`, `wireframeLayoutsFor(class)`             |
| screen form         | `ScreenForm` (`'watch' \| 'phone' \| 'wide'`), `screenForm(box)`                                                  |
| device memory       | `lastWireframeDevice()`, `rememberWireframeDevice(device)`                                                        |
| Inspect             | `CanvasTool` member `'inspect'`; `can.inspect`; `PanelId` `'inspect'`; `InspectPanel`, `InspectOverlay`           |
| measurements        | `InspectSpec` (`inspectElement`), `SpacingLine` (`neighbourSpacing`, `pairSpacing`), `InspectRect`                |
| inspect link        | `INSPECT_PARAM` (`'inspect'`), `wantsInspect`, `withInspect`, `inspectViewLink`                                   |
| screen link         | `PageLink` (`ElementLink` kind `'page'`, `pageId`); `ScreenLink` (`PageLink \| BackLink`); `isScreenLink`         |
| back link           | `BackLink` (`ElementLink` kind `'back'`)                                                                          |
| transition          | `PageLinkTransition`, `PAGE_LINK_TRANSITIONS`, `DEFAULT_PAGE_LINK_TRANSITION`, `pageLinkTransitionOf`             |
| broken link         | `ScreenLinkTarget` state `'broken'` (`resolveScreenLink`)                                                         |
| screen links' roles | `can.linkScreens(el)`, `can.playPrototype`                                                                        |
| Screen mode         | `LinkPickerDialog` mode `'screen'`; `ScreenLinkMode`; `ScreenChoice`, `screenLinkChoices`                         |
| link handle         | `ScreenLinkHandle`; `showsScreenLinkHandle`; `onLinkScreen`, `onPickScreenLink`, `canLinkScreens`                 |
| link marker         | the `link` indicator with `screen: 'linked' \| 'broken'` (`ScreenIndicatorItem`); `useScreenLinkMarker`           |
| Prototype mode      | `PrototypePlayer`; `openPrototype`, `closePrototype`, `usePrototypePlayer` (the player store); `usePrototypeHost` |
| player state        | `PlayerState` (`shownId`, `history`, `change`); `startPlayer`, `followHotspot`, `stepScreen`, `shownScreen`       |
| hotspot             | `Hotspot` (`elementId`, `rect`, `link`, `label`); `prototypeHotspots(tab, page)`                                  |
| prototype link      | `PROTOTYPE_PARAM` (`'prototype'`), `wantsPrototype`, `withPrototype`; `copyFlaggedViewLink`                       |

"Device" alone always means the page's `WireframeDeviceId`; never "mockup" or "frame" for the device itself.

## Where the code lives

| File                                                                                  | Role                                                                                                                |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `packages/design/src/wireframe-device.ts` (+ test)                                    | Devices, groups, gutters, geometry (`deviceGeometry`), the safe area, paths, `wireframeAddress`                     |
| `packages/design/src/wireframe-device-svg.ts`                                         | The frame under the screen, in each device and look; re-exports the two below                                       |
| `packages/design/src/wireframe-frame-paint.ts`                                        | Each look's paint and finish (Theme, Outline, Sketch, Marker) and the parts a frame is built from                   |
| `packages/design/src/wireframe-frame-over.ts`                                         | What is drawn over the screen: the camera in it, the status bar and home indicator                                  |
| `packages/design/src/wireframe-page.ts`                                               | The page-level answers every caller asks once: geometry, screen, content box, clip, frame                           |
| `packages/design/src/pages-edits.ts`                                                  | `pageDeviceSet` (orientation, frame look, system bars; re-fit), `not_a_wireframe`                                   |
| `packages/templates/src/wireframe-layouts.ts`, `wireframe-layouts-*.ts`               | The layouts by category; `wireframeLayoutsFor`                                                                      |
| `packages/templates/src/wireframe-layout-kit.ts`                                      | `WF` (the wireframe greys), `ui(box)`, `screenForm`, bars and navs, `fitToBox`, `scaleFrom`                         |
| `packages/templates/src/template-builders-wireframe-flows.ts`                         | The Wireframes templates' flows                                                                                     |
| `apps/live/components/canvas/WireframeDeviceSheet.tsx`, `WireframeDeviceOverlays.tsx` | The frame under the page's content, and the bars over it                                                            |
| `apps/live/components/canvas/wireframe/`                                              | `ChooseDeviceStep`, `DevicePicker`, `DeviceMiniature`, `DeviceGlyph`, `PageDeviceButton`, `WireframeDeviceSettings` |
| `apps/live/components/canvas/AddScreenPopover.tsx`                                    | **Add a Screen of Another Device**                                                                                  |
| `apps/live/hooks/editor/page-edits.ts`                                                | `addPage(kind, device)`, `choosePageKind(pageId, kind, device)`, `setDevice(pageId, patch)`, telemetry              |
| `apps/live/hooks/editor/usePagesMode.ts`                                              | Framing a wireframe page (`WIREFRAME_FIT_MAX_ZOOM`)                                                                 |
| `apps/live/lib/wireframe-device-memory.ts`                                            | The device last chosen in this browser                                                                              |
| `apps/live/lib/palette-kind.ts`, `components/palette/palette-wireframe-tiles.tsx`     | The palette's Wireframe kind and its Elements tiles                                                                 |
| `apps/live/components/tour/wireframe-tour-steps.ts`                                   | The Wireframe track of the Pages tour ([Pages tour](../pages-tour.md))                                              |
| `packages/design/src/inspect-element.ts` (+ test)                                     | Inspect's reading of an element (`inspectElement`) and its CSS and plain values                                     |
| `packages/design/src/inspect-spacing.ts` (+ test)                                     | The spacing lines to neighbours, containers and the screen edge; between two elements                               |
| `apps/live/lib/inspect-target.ts`                                                     | Which element is inspected, its neighbours on its page, its spec and lines in page points                           |
| `apps/live/lib/inspect-link.ts`, `inspect-export.ts`                                  | The `inspect` parameter and the Viewer link it rides; exporting one element at a scale                              |
| `apps/live/components/canvas/inspect/`                                                | `InspectOverlay` (outlines, lines, pills), `InspectClusterSegment`, `useInspectHost`, `InspectSessionContext`       |
| `apps/live/components/panels/inspect/`                                                | `InspectPanel`, `InspectSpacingBox`, `inspect-panel-parts` (sections, copyable value cells, swatches)               |
| `packages/design/src/page-link.ts` (+ test)                                           | Screen links: the stored shape, `isWellFormedLinkField`, `resolveScreenLink`, `screenName`, `describeScreenLink`    |
| `packages/design/src/validate.ts`                                                     | The `link` field check in `COMMON_FIELD_CHECKS` (`SCREEN_LINK_RULE`)                                                |
| `packages/design-views/src/attributes.ts`                                             | `link=page:<pageId>`, `link=back`, `transition=`, `broken` (`ViewModel.pageIds`)                                    |
| `packages/agent-verbs/src/mcp/element-docs.ts`                                        | `SCREEN_LINKS`: the element format's screen link facts                                                              |
| `apps/live/lib/link-label.ts`, `components/canvas/LinkCardView.tsx`                   | A screen link's hover line (`describeLink(link, tabs, pages)`) and a link card holding one                          |
| `apps/live/hooks/canvas/useElementLinks.ts`                                           | `followLink` leaves a screen link to Prototype mode                                                                 |
| `apps/live/lib/editor-capabilities.ts`                                                | `linkScreens`, `playPrototype`                                                                                      |
| `apps/live/lib/screen-link-choices.ts` (+ test)                                       | `screenLinkChoices`, `screenOfElement`, `relinkToScreen`, `showsScreenLinkHandle`, `wireframeTabPages`              |
| `apps/live/components/dialogs/ScreenLinkMode.tsx`, `LinkPickerDialog.tsx`             | Link Element's Screen mode: the transition, the screens, Back, the broken note                                      |
| `apps/live/components/canvas/ScreenLinkHandle.tsx`, `LayerSelectionChrome.tsx`        | The link handle, its drag line and the outlined screen                                                              |
| `apps/live/components/canvas/screen-link-pages.tsx`, `useElementIndicators.ts`        | The tab's pages for the markers (a store, so a page edit re-renders only the linked elements) and the marker item   |
| `apps/live/components/canvas/screen-link-glyphs.tsx`, `ElementIndicators.tsx`         | The screen, broken screen and back glyphs; the marker drawn in its state                                            |
| `apps/live/lib/prototype-player.ts` (+ test)                                          | The player's pure state: screens, hotspots, following, stepping, the change and its direction                       |
| `apps/live/lib/prototype-player-store.ts`                                             | Whether the player is open and on which screen it starts (one per browser tab)                                      |
| `apps/live/lib/link-flag.ts`, `prototype-link.ts`, `copy-flagged-view-link.ts`        | A link's flag (`inspect`, `prototype`); the `prototype` flag; copying a flagged Viewer link (Inspect's too)         |
| `apps/live/components/prototype/`                                                     | `PrototypePlayer` (stage, bar, keys), `PrototypeScreen` (one screen and its hotspots), `usePrototypeHost`           |
| `apps/live/components/chrome/PrototypeHeaderButton.tsx`                               | The header's **Prototype** action (the shared `EditorHeader`'s `leadAction` slot)                                   |

## Behaviour and state

### Page model

- `pageDeviceGeometry(page)`: `deviceGeometry(page.device ?? DEFAULT_WIREFRAME_DEVICE, page.orientation ===
'landscape')` for a wireframe page, else null. A turned device (one whose `turns` is true) swaps the screen's sides
  and turns the frame; a device that does not turn is always portrait.
- The page's rect is the whole frame (`DeviceGeometry.width`, `height`); the screen is inset within it.
- Parsing: a missing or unknown `device` reads as `iphone`, an unknown `frameLook` as Theme, an orientation on a
  device that does not turn as portrait.
- A new page of a device held landscape (`WIREFRAME_DEVICES[id].landscape`, the iPhone Duo) starts turned.

### The safe area

`deviceSafeArea(g, systemBars)`: the screen less the bars while shown and the class's `WIREFRAME_GUTTER` each side.
A turned phone keeps its camera side (`bars.left`) clear with or without the bars. `pageContentBox` answers it for a
wireframe page and the sheet less its margin for any other, so layouts and snapping ask once.

### Page edits

- **Adding.** `addPage('wireframe', device)` and the first page's `choosePageKind(pageId, 'wireframe', device)` take
  the device chosen; the + takes the last page's device and frame look. `rememberWireframeDevice` keeps the choice
  in this browser (`livedesign:v2:wireframe-device`), and **Choose a Device** rings it first.
- **`pageDeviceSet(tab, pageId, patch)`** with `{ orientation?, frameLook?, systemBars? }`: refuses `unknown_page`,
  `locked` and `not_a_wireframe`; keeps the device; drops `frameLook` when Theme and `systemBars` when shown; a
  turn or a bars change re-fits the content into the new safe area as a change of size does. No change answers the
  tab unchanged.
- Each is one undoable page edit, synced as a page field.

### The frame

`wireframeFrameSvg(page, { dark, theme })` answers `{ under, over, screen }`: the device under the screen, the camera and system bars over its content, and the screen's outline, as
markup shared by the canvas (`WireframeDeviceSheet`, `WireframeDeviceOverlays`), the thumbnails and the export. The
looks follow the spec; Theme reads its colours through `tabWireframeFrameTheme(tab)`. Under Sketch or Marker the
frame is a line drawing (`SKETCH_FRAME_PX`, `MARKER_FRAME_PX`). The status bar reads `9:41` (the watch `10:09`), in
ink that reads on the screen's background. A browser's address is `wireframeAddress(page.name)`.

### Clipping and presses

The page's content is clipped to `pageClipPathData(page)` (the rounded screen). A press on the bezel falls through
to the canvas.

### Layouts

- `wireframeLayoutsFor(deviceClass)`: a watch the `wf-watch` category alone, any other device every other category;
  absent (an agent's catalogue) every layout.
- A responsive builder (`responsive(phone, wide, { column })` in `wireframe-layouts-start.ts`) picks by
  `screenForm(box)`: under `WATCH_MAX_WIDTH` the watch, under `PHONE_MAX_WIDTH` the phone column, else wide. A tall
  screen (height over `TALL_RATIO` times width) that suits a column takes the phone form in a centred column at most
  `COLUMN_MAX` wide, or across the width for `column: 'full'`. A wide screen shorter than `SHORT_HEIGHT` is laid out
  at `SHORT_HEIGHT` and scaled down by no less than `SHORT_SCALE_MIN`. `fitToBox` then scales whatever still
  overflows the safe area down as one, centred across.
- Parts are drawn in `WF` greys over the theme; pictures are empty image placeholders.

### Framing

Going to a wireframe page fits the whole device, with the fit's zoom capped at `WIREFRAME_FIT_MAX_ZOOM` rather than
100%, so a small device fills the view.

### Inspect

- Inspect is a canvas tool (`canvasTool === 'inspect'`), offered only on a wireframe tab (its first page's kind):
  the pages cluster strip's last button, and the command palette's **Inspect Tool** (`wireframeOnly` in
  `CANVAS_TOOLS`, offered when `CommandContext.wireframeTab`). `useInspectHost` turns it on once when the address
  carries `inspect` and the active tab is loaded, and back to Select when the tab is not a wireframe tab.
- While it is on, the canvas gets a Viewer's gestures whatever the role: `inspectToolActive` makes a press select
  only (no drag, anchor or arrow drag, no in-place edit), `canMove`/`canWriteText`/`canResize` are `NEVER`, the
  selection wears read-only chrome with no selection toolbars, the Quick Style bar stands down (`editsBlocked`), and the keyboard runs as read-only. The overlay draws beneath the panels. Escape returns to Select.
- `inspectTarget` picks the one selected element (a multi-selection shows a count); `inspectTargetSpec` reads it
  with `inspectElement` against its page's screen origin and surface (`pageSurface`, light when the page has none).
- Neighbours are the boxed elements on the same page (`rowPageAt` of each centre), so the lines are linear in the
  page's elements; `InspectOverlay` keeps the hovered id in state, set only when it changes, so a pointer move over
  the same element renders nothing.
- Export: `exportInspectedElement` renders the element and what it holds (`containerContents`, `withAttached`) with
  `renderTabToCanvas`/`renderTabToSvg` at `{ scale, padding: 0, transparent: true, pattern: false, surface }`.
- Copy Inspect Link: the visitor's `sessionShareCode`, else `inspectViewLink` over `indexClient.listShareLinks`;
  never creates a link. None: open the Share dialog with a toast. An offline design gets no button.

### Screen links

- **Stored shape.** `link?: ElementLink` on any element, with two more kinds: `{ kind: 'page', pageId, transition? }`
  and `{ kind: 'back', transition? }`. Absent `transition` reads `DEFAULT_PAGE_LINK_TRANSITION` (`'instant'`) through
  `pageLinkTransitionOf`; nothing writes `'instant'` back, and a stored `'instant'` is kept as given.
- **Validation.** `COMMON_FIELD_CHECKS` runs `isWellFormedLinkField` on `link`: a `page` link needs a `pageId` string
  of 1 to `PAGE_LINK_ID_MAX` characters, and either kind a `transition` in `PAGE_LINK_TRANSITIONS` or none; anything
  else is refused naming `link` with `SCREEN_LINK_RULE` (`invalid_result` for edit operations, `invalid` for a
  Participant's op, the api's design schema for a save). Every other link kind passes unchecked, as before, so no
  stored design starts failing. Whether `pageId` is on the tab is never a validation question.
- **Resolution.** `resolveScreenLink(link, pages)` answers `{ state: 'page', page, index }`, `{ state: 'back' }` or
  `{ state: 'broken' }` (no page of the tab has that id); it never throws, for any `pages`. Every reader (the
  marker, the menu, the player, the Flow view, the views) goes through it, so a broken link reads alike everywhere.
- **Deleting a page** leaves the links to it as they are: undo restores the page and the links resolve again.
- **Naming.** `screenName(page, index)`: the trimmed name, else `Screen <index + 1>`. `describeScreenLink`: "Goes to
  <screen>", "Goes back to the screen before", or "Broken link: its screen was deleted".
- **In the editor**, `followLink` does nothing for a screen link; Prototype mode follows them.
- **Screen mode.** `EditorElementDialogs` passes `screens` (`screenLinkChoices(pagesOf(activeTab), element,
elements)`: each page as `{ id, name: screenName(page, index), here }`, `here` the page `pageAt` finds under the
  element's `elementAnchorPoint`) when `wireframeTabPages(pages)` and `can.linkScreens(element)`; otherwise none and
  the dialog shows its three old modes. With `screens` the modes are Screen, External URL, Tab, Design, and the dialog
  opens on Screen unless the current link is a url, tab, element or design link or the caller asked for a mode.
  `ScreenLinkMode` holds the chosen transition in state (seeded `pageLinkTransitionOf(current)` for a screen link,
  else `'instant'`); a screen row commits `{ kind: 'page', pageId, transition? }` and Back `{ kind: 'back',
transition? }`, `transition` omitted when Instant. A `here` row is `disabled`. The broken note shows when
  `resolveScreenLink(current, pages).state === 'broken'`. The dialog mounts for `!isReadOnly`, or for a read-only
  session when `can.linkScreens(element)` and `screens` (a Participant's own element), then with `screenOnly`: no
  mode switcher, the Screen mode alone; `useCloseVanishedDialogs` closes it on the same test.
- **Link handle.** `LayerSelectionChrome` draws `ScreenLinkHandle` when `showsScreenLinkHandle` holds: one boxed
  element selected (`selectedId`, no multi-selection), not being edited, no menu open, not in paint mode, the tab not
  locked, `canLinkScreens(el)` (never while Inspect is on; not `readOnly`, which a Participant's canvas is), the element's anchor on a wireframe page,
  and two or more pages. Its centre is the selection box's bottom-right corner plus
  `(SCREEN_LINK_HANDLE_GAP_PX + SCREEN_LINK_HANDLE_PX / 2) / zoom` on each axis, counter-scaled like the quick-connect
  pluses. A press captures the pointer and stops propagation (no element drag, no marquee); past
  `SCREEN_LINK_DRAG_SLOP_PX` it is a drag: the pointer's canvas point is the press's plus the client delta over the
  zoom, `pageAt(pages, point)` the target, the element's own page and no page both "none". The line is a cubic from
  the handle to the pointer, the target outlined with its `screenName` in a pill above it. Release on a target calls
  `onLinkScreen(elementId, pageId)`; release elsewhere, Escape or `pointercancel` drops it. A press released before the
  slop calls `onPickScreenLink(elementId)`, which opens the picker on `'screen'`.
- **Linking from the handle.** `useElementLinks.linkElementToScreen(elementId, pageId)` commits
  `relinkToScreen(el.link, pageId)` on that element alone (the current transition kept from a screen link, none
  otherwise) and tracks `Element · Linked · Screen`.
- **Link marker.** `ScreenLinkPagesProvider` (around the element layer) holds the tab's laid-out pages and
  `focusPage` in a store; `useScreenLinkMarker(link)` subscribes with a snapshot of the marker's description string
  (null for no screen link), so a page edit re-renders only elements whose line changed. `elementIndicatorItems`
  takes the marker: the `link` item with `screen: 'linked'` (label "Go to screen", word "Screen", hover title
  "Screen link") or `screen: 'broken'` (label "Broken screen link", hover title "Broken link"), its description the
  `describeScreenLink` line. A linked marker's click calls `focusPage(pageId)`; a back link's does nothing but its
  card; a broken one's calls `onEditLink(id)` when given and the element may be linked, else nothing.
  `ElementIndicators` draws a screen item with `ScreenLinkGlyph`, `BackLinkGlyph` or `BrokenScreenLinkGlyph`, a
  broken one `text-rose-600 dark:text-rose-400` at full opacity.
- **Roles.** `can.linkScreens(el)`: an Editor any element; a Participant `!locked && addedBy === adderKey`; a Viewer
  none. `can.playPrototype` is true for all three. The server rule is the participant content rule unchanged: `link`
  is not among the fields a Participant writes on someone else's element (`PARTICIPANT_TEXT_FIELDS`, ...), and its own
  element takes any field.

### Prototype mode

- **Entry.** `editorViewHeader` passes `leadAction={<PrototypeHeaderButton/>}` when `can.playPrototype` and
  `wireframeTabPages(pagesOf(activeTab))` (the tab's first page is a wireframe page) and no welcome is open. Its press
  calls `openPrototype(currentPageIdNow())`. The shared `EditorHeader` draws `leadAction` first among its right-edge
  actions.
- **The address.** `usePrototypeHost` reads `wantsPrototype(location.search)` once, when the design is hydrated and the
  active tab loaded; on a wireframe tab it calls `openPrototype(null)`. `?prototype=0` or `false` is no ask.
- **Store.** `prototype-player-store.ts` holds `{ open, startId }` behind `useSyncExternalStore`; `openPrototype`
  tracks `Canvas · Used · Prototype` once per opening. `EditorCanvasHost` mounts `PrototypePlayer` while it is open,
  and closes it when the active tab is not a wireframe tab or the host unmounts.
- **Screens.** `layOutPages(pagesOf(tab))`, in order; the shown screen is `shownScreen(state, pages)`: the page with
  `shownId`, else the first.
- **State.** `startPlayer(pages, startId)` shows `startId` when it is a page, else the first. `followHotspot(state,
link, pages)`: a page link to a page on the tab pushes the shown id on `history` and shows the page; a back link pops
  `history` (no change when it is empty); a broken link changes nothing. `stepScreen(state, pages, 1 | -1)` moves to
  the page beside in order, pushing `history`, and changes nothing at the ends. Each change records `change: { fromId,
transition, direction: 'forward' | 'back', seq }` (`transition` the link's `pageLinkTransitionOf`, `instant` for a
  step; `direction` `back` for a back link), `seq` counting changes so the stage keys its animation.
- **Hotspots.** `prototypeHotspots(tab, page)`: the tab's visible elements (`visibleLayerElements`) whose anchor is on
  the page (`elementIdsOnPage`), with a screen link that does not resolve broken, in paint order; each `rect` is
  `contentBounds([el], undefined, tab.elements)` intersected with `pageScreenRect(page)` (none when the intersection is
  empty), `label` its `describeScreenLink` line.
- **Drawing.** `PrototypeScreen` renders `renderTabToSvg(tab, { page, imageHref, idPrefix: 'lvd-proto' })` with its
  root `<svg>` stripped, inside its own `<svg>` whose `viewBox` is the page's rect (desktop) or `pageScreenRect`
  (phone, `useIsMobileViewport`), `preserveAspectRatio="xMidYMid meet"`; the markup is memoised on the tab and the
  page and the image sources. Pictures come from `useImageSources(thumbImageIds(...))` through `thumbImageHref` (the
  canvas's copy). Hotspots are `<rect>`s over it, `role="button"`, `tabIndex=0`, `aria-label` their label,
  `pointer-events="all"`, `fill` transparent until flashed.
- **Flash.** A pointer press on the stage that is not on a hotspot or the bar sets `flashing` for
  `PROTOTYPE_FLASH_MS` (500); hotspots take the brand fill at 0.22 and a 2 px brand outline, then fade out by a 150 ms CSS transition
  (collapsed by reduced motion, so they simply show and hide).
- **Transitions.** While a change's `transition` is not instant and motion is allowed (`prefersReducedMotion()`: the
  `(prefers-reduced-motion: reduce)` query or the `reduce-motion` class on `<html>`), the stage keeps the leaving
  screen beneath and animates with the Web Animations API over `PROTOTYPE_TRANSITION_MS` (`cubic-bezier(0.2, 0, 0,
1)`): slide, the new layer `translateX(100%)` (back: `-100%`) to 0 and the old 0 to `-33%` (back: `33%`) at opacity
  0.6; dissolve, the new layer's opacity 0 to 1. The leaving layer is dropped on finish, or at once where `animate`
  is missing.
- **Keys.** One `keydown` listener on `window` in the capture phase while open stops every key's propagation (the
  editor's shortcuts never see it) and handles: Escape closes; ArrowLeft / ArrowRight step; Enter or Space on a focused
  hotspot follows it. Tab keeps its default. The dialog (`role="dialog"`, `aria-modal`, `aria-label="Prototype"`)
  takes focus on open; closing hands focus back to what had it.
- **Close.** `closePrototype()`, then `pagesMode.focusPage(shownId)`.
- **Copy Prototype Link.** `copyFlaggedViewLink({ withFlag: withPrototype, ... })`, Inspect's routine made shared:
  the visitor's `sessionShareCode`, else `inspectViewLink` over `indexClient.listShareLinks`; none opens Share with
  "Make a Viewer link, then copy the Prototype link."; tracks `UI · Copied · PrototypeLink`. Offered when
  `sessionShareCode !== null || (canShareDesign && !offline)`.
- **Phone.** `useIsMobileViewport`: the stage fills `100dvh` on black with no padding, the bar a floating pill
  (`top: max(8px, env(safe-area-inset-top))`), the screen's `viewBox` the screen rect.
- **Drag pill.** `ScreenLinkDragLine` measures its name pill after layout and shifts it by whatever keeps its box
  `SCREEN_LINK_PILL_MARGIN_PX` inside the window on each side.

### Flow view

- **Store.** `lib/flow-view-store.ts` holds one boolean behind `useSyncExternalStore` (`useFlowView()`), off on load,
  one per browser tab, never in storage. `toggleFlowView()` tracks `UI · Toggled · FlowViewOn` / `FlowViewOff` and
  then flips it.
- **The button.** `FlowClusterSegment` (`components/canvas/FlowClusterSegment.tsx`): a `ClusterPopoverSegment` with
  `toggle` (so `aria-pressed`, and its hover card stays while pressed), label **Flow View**, name **Flow**, the
  `lucideWorkflow` glyph, `dataTourId="flow-view-button"`. `CanvasChrome` passes it as `PagesClusterStrip`'s `flow`
  slot, after `inspect`, on the same test (`pagesMode.pages[0]?.kind === 'wireframe'`), for every role: the strip is
  drawn for read-only sessions and on a phone.
- **The command.** `CommandContext.flowView` names it (`Show Flow View` / `Hide Flow View`, id `flow-view`), offered
  among the view-safe commands while `wireframeTab`; it runs `CommandHandlers.toggleFlowView` (`toggleFlowView`).
- **The layer.** `CanvasWorldLayer` draws `FlowViewLayer` (`components/canvas/FlowViewLayer.tsx`) after the element
  layer, in canvas coords, while `useFlowView()` and the tab's first page is a wireframe page and not `zenMode`. It
  takes the tab's elements, `tabLayers`, the laid-out pages and the zoom, and memoises `flowLinks(...)` on them.
- **Geometry.** `flowLinks(elements, layers, pages, zoom)` (`lib/flow-view.ts`, pure): for each element of
  `visibleLayerElements` with a screen link, its page is `rowPageAt(pages, elementAnchorPoint(el, index))` (none:
  skipped), its `box` is `contentBounds([el])` cut to `pageScreenRect(page)` (empty: skipped). The link resolves with
  `resolveScreenLink`:
  - `back` gives `{ state: 'back', box }`; `broken` gives `{ state: 'broken', box, stub }`, the stub from the box's
    right edge at its middle, `FLOW_STUB_PX / zoom` long;
  - a page link to its own page gives `{ state: 'self', box }`;
  - a page link to an adjacent page (indexes one apart) gives `{ state: 'page', box, path, toPageId }`: from the
    middle of the box's facing side (right when the target lies right) to the target rect's near edge at the start's
    `y` clamped into `[top + FLOW_EDGE_INSET, bottom - FLOW_EDGE_INSET]`, a cubic whose handles run level, each
    `max(FLOW_PULL_MIN_PX / zoom, |dx| / 2)` long;
  - a page link further along: from the box's facing side level to `gapX`, the middle of the gap between the
    element's page and the next one towards the target moved `min(FLOW_GAP_SIDE_PX / zoom, gap / 4)` towards the
    element's page (so a rightward and a leftward arc in one gap never share a column), up that gap to a lane
    `(FLOW_LANE_BASE_PX + FLOW_LANE_STEP_PX * lane) / zoom` above the highest top of the pages from the source to the
    target inclusive, where `lane` is the lowest lane from `span - 2` up (`span` the index gap), at most
    `FLOW_LANE_SPREAD` above it, that no earlier arc holds over an overlapping run of pages (page indices `[lo, hi]`
    overlap when each starts before the other ends); with all of those held it takes the highest and holds nothing,
    so each lane's runs stay apart (at most one per page) and the walk stays linear in the links,
    level along it, and down onto the target's top edge at `x` its near side plus
    `FLOW_ENTRY_FRACTION` of its width plus `FLOW_ENTRY_STEP` for each earlier arc into that target (capped at
    `FLOW_ENTRY_MAX`): straight runs joined by quadratic corners of `FLOW_CORNER_PX / zoom` (never more than the
    runs allow), ending vertical. Arcs leaving one page share its gap's column up to their lanes.
    Items come in paint order. The walk is linear in the tab's elements (`buildElementIndex` once): about 2 ms warm for
    4,000 elements with 1,333 links over 20 screens, 0.15 ms for 200 (measured on an M-series laptop, 2026-11-15);
    `flow-view.test.ts` holds a 4,000-element tab to a CPU budget. It reruns on each render while the view is on (the
    laid-out pages are new each render), and nothing at all while it is off.
- **Drawing.** One `<svg>` (`data-flow-view`, `aria-hidden`, `pointer-events-none`, overflow visible) in canvas coords:
  each box a `rect` (`rx` `4 / zoom`, brand stroke `FLOW_STROKE_PX / zoom`, brand fill at 0.1; broken in
  `rose-600` / dark `rose-400`, dashed `4 / zoom` `3 / zoom`, the brand being a rose); each path drawn twice, a halo in the canvas colour (`stroke-white` /
  dark `stroke-slate-900`, `FLOW_HALO_PX / zoom`, opacity 0.85) under the brand stroke, with a start dot and an
  arrowhead `marker` in `markerUnits="strokeWidth"` (so it holds its size), `orient="auto"`. The broken stub is
  dashed (`6 / zoom`, `4 / zoom`). The tags (**Back** with `BackLinkGlyph`, **Broken** with `BrokenScreenLinkGlyph`)
  are HTML pills counter-scaled by `1 / zoom` like the drag pill, beside the box's right edge or at the stub's end.

## Interfaces and contracts

- `Page` fields: `kind: 'wireframe'`, `device?: WireframeDeviceId`, `orientation?: PageOrientation`,
  `frameLook?: WireframeFrameLook`, `systemBars?: boolean`; validated by the api with the design schema.
- `change_pages` ([MCP server](../../015-api/mcp-server.md)): `{ op: 'add', kind: 'wireframe', device? }`;
  `{ op: 'set', page, frameLook?, systemBars?, orientation? }`; a `set` naming a device, or a wireframe field on
  another kind of page, is refused `not_a_wireframe` (`packages/api-schema/src/pages.ts`). A page's rectangle answer
  carries the safe area beside the page's rect.
- Screen links: `update_design` elements and edit operations' `set` take `link` as a stored field; views print
  `link=page:<pageId>` or `link=back`, then `transition=<t>` when not instant and the `broken` flag when the page id is
  not in `ViewModel.pageIds` ([Design views](../../024-agents/blueprints/design-views.md) `VW28`).

## Errors and edge cases

- An unknown device, look or orientation reads as the default (Page model above).
- A device without system bars (a computer) ignores `systemBars`.
- Laying loose content out into pages never makes a wireframe page.
- A screen link to a page not on the tab (deleted, or from a copy whose pages differ) is broken: kept, read as
  broken, never followed, never a load, save, render or export failure.
- A back link on the first screen shown does nothing.
- A screen link on a page that is not a wireframe page is kept and never followed.
- The shown screen deleted while playing: the player shows the first screen. The tab turned into another kind, or
  another tab made active: the player closes. A hotspot whose box lies wholly off the screen is left out.
- A share link's `prototype` on a tab that is not a wireframe tab is ignored, as `inspect` is.
- The Flow view on a tab with no screen links draws nothing (no `<svg>`); a linked element on a hidden layer, off every
  page or wholly off its screen is left out; a link to its own screen draws only its outline; on a tab that is not a
  wireframe tab, or in Zen, nothing is drawn while the store stays on.

## Security and trust

The frame is the app's own markup, never content; nothing on the page reaches it. Every control is gated on `can`
(`can.editPages` for the device), as every page control is ([Share roles](../../013-workspace/share-roles.md)).

## Observability

Telemetry from `page-edits.ts`: `Tab · Changed · WireframePageAdded` and `PageKindWireframe`;
`Tab · Changed · WireframeDevice<Device>` (`WIREFRAME_DEVICE_EVENT`); `Tab · Changed · WireframeFrame<Look>`
(`WIREFRAME_FRAME_EVENT`); `UI · Toggled · WireframeSystemBarsOn` / `WireframeSystemBarsOff`. Never a name or text.
Inspect: `Canvas · Used · Inspect` (`useCanvasTool`); `UI · Copied · InspectValue`, `InspectCss`, `InspectValues`,
`InspectLink`; `Document · Exported · InspectPng` / `InspectSvg`. Never a value, a name or a link.
Screen links: `Element · Linked · Screen` (a screen row, or the handle's drop) and `Element · Linked · ScreenBack`
(Back), from `EditorElementDialogs` and `useElementLinks`; charted with the site's Links Added. Never a page id or
name. Prototype mode: `Canvas · Used · Prototype` (each opening, from the header or a link; the site's Prototypes
Played) and `UI · Copied · PrototypeLink` (counted in Share Links Copied). Flow view: `UI · Toggled · FlowViewOn` /
`FlowViewOff` (from the cluster button and the command, before the flip; the site's Flow View chart).

## Testing

| Rule                                                                                                                                                                                                                                                                                                | Test                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Devices, turning, the iPhone Duo, the address; parsing, screen, safe area, clip, frame and export; adding, the +, device edits and refusals                                                                                                                                                         | `packages/design/src/wireframe-device.test.ts`                                                                                                                                                                                                                                |
| Layouts by device class; each flow on its own pages                                                                                                                                                                                                                                                 | `packages/templates/src/wireframe-layouts.test.ts`                                                                                                                                                                                                                            |
| Adding a screen, the device memory, the + and the chooser                                                                                                                                                                                                                                           | `apps/live/components/canvas/AddPageButton.test.tsx`, `ContentsAddPage.test.tsx`, `FirstPageChoice.test.tsx`                                                                                                                                                                  |
| The editor's page edits on a wireframe page                                                                                                                                                                                                                                                         | `apps/live/hooks/editor/page-edits.test.ts`                                                                                                                                                                                                                                   |
| The page panel's Device tab                                                                                                                                                                                                                                                                         | `apps/live/components/canvas/PagePanel.tabs.test.tsx`                                                                                                                                                                                                                         |
| Layout gallery by device class                                                                                                                                                                                                                                                                      | `apps/live/components/canvas/layout-gallery/LayoutGallery.test.tsx`, `layout-gallery-filter.test.ts`                                                                                                                                                                          |
| The Wireframe tour track                                                                                                                                                                                                                                                                            | `apps/live/components/tour/page-tour-steps.test.ts`                                                                                                                                                                                                                           |
| Inspect's reading: size, position, colours, border, radius, text; CSS and plain values                                                                                                                                                                                                              | `packages/design/src/inspect-element.test.ts`                                                                                                                                                                                                                                 |
| Spacing to neighbours, containers and the screen edge; between two elements                                                                                                                                                                                                                         | `packages/design/src/inspect-spacing.test.ts`                                                                                                                                                                                                                                 |
| Every role may inspect; Inspect's press selects only; the tool on wireframe tabs only                                                                                                                                                                                                               | `apps/live/lib/editor-capabilities.test.ts`, `hooks/canvas/useEditorDrag.inspect-press.test.tsx`, `lib/editor-commands-tools.test.tsx`                                                                                                                                        |
| The target, its page and lines; the link and its Viewer link; the export's name and options                                                                                                                                                                                                         | `apps/live/lib/inspect-target.test.ts`, `inspect-link.test.ts`, `inspect-export.test.ts`                                                                                                                                                                                      |
| Screen links: shape, transitions, resolution, a deleted page reading as broken, naming, the `link` check                                                                                                                                                                                            | `packages/design/src/page-link.test.ts`                                                                                                                                                                                                                                       |
| A Participant sets a screen link on its own element only; a malformed one is refused                                                                                                                                                                                                                | `packages/design/src/participant-content.test.ts` ("screen links")                                                                                                                                                                                                            |
| Agents set a screen link and are refused a malformed one; views print it; the element format names it                                                                                                                                                                                               | `packages/edit-operations/src/operations/set.test.ts`, `packages/design-views/src/attributes.test.ts`, `packages/agent-verbs/src/mcp/schema.test.ts`                                                                                                                          |
| Roles: Editor any, Participant its own, Viewer none; every role plays; the editor leaves screen links alone                                                                                                                                                                                         | `apps/live/lib/editor-capabilities.test.ts`, `hooks/canvas/useElementLinks.test.ts`, `lib/link-label.test.ts`, `components/canvas/LinkCardView.test.tsx`                                                                                                                      |
| Screen mode: the screens, This screen, Back, the transition, the broken note; opening on it; the role gate                                                                                                                                                                                          | `apps/live/components/dialogs/LinkPickerDialog.screen.test.tsx`, `apps/live/lib/screen-link-choices.test.ts`                                                                                                                                                                  |
| The handle: when it shows (roles, lock, edit, page kind, page count), drop on a screen, own screen, off, Escape, a press opens the menu                                                                                                                                                             | `apps/live/components/canvas/ScreenLinkHandle.test.tsx`, `apps/live/lib/screen-link-choices.test.ts`                                                                                                                                                                          |
| The marker: linked, back and broken items, their clicks; a page edit re-rendering only the linked elements                                                                                                                                                                                          | `apps/live/components/canvas/useElementIndicators.test.ts`, `screen-link-pages.test.tsx`                                                                                                                                                                                      |
| Prototype state: start, follow a page link, back, broken, steps at the ends, a deleted shown screen; hotspots                                                                                                                                                                                       | `apps/live/lib/prototype-player.test.ts`                                                                                                                                                                                                                                      |
| The player: the screen drawn, a hotspot followed, the flash, keys, close framing the screen, transitions, the phone; the screen as an export draws it (`imageHref`, `idPrefix`, `lib/export-tab.test.ts`)                                                                                           | `apps/live/components/prototype/PrototypePlayer.test.tsx`                                                                                                                                                                                                                     |
| Every role plays: the header button for Editor, Participant and Viewer; the address opening Prototype; copying the link                                                                                                                                                                             | `apps/live/components/prototype/usePrototypeHost.test.tsx` (with `offersPrototype`), `lib/editor-capabilities.test.ts`, `lib/copy-flagged-view-link.test.ts`, `lib/prototype-link.test.ts`                                                                                    |
| The drag pill kept inside the window                                                                                                                                                                                                                                                                | `apps/live/components/canvas/ScreenLinkHandle.test.tsx`                                                                                                                                                                                                                       |
| Flow view geometry: adjacent curve and its clamp, the arc up the gap and over the row, its side of the gap, its lane (and the next free one where arcs overlap) and corners, entry slots, back, broken stub, own screen, hidden layers, off-screen and off-page elements, a worst-case tab's budget | `apps/live/lib/flow-view.test.ts`                                                                                                                                                                                                                                             |
| Flow view: the toggle and its telemetry, the button for every role (pressed state), the command, the layer drawn, its tags and nothing on other tabs or in Zen                                                                                                                                      | `apps/live/lib/flow-view-store.test.ts`, `components/canvas/FlowClusterSegment.test.tsx`, `components/canvas/FlowViewLayer.test.tsx`, `lib/editor-commands-tools.test.tsx`                                                                                                    |
| The panel's sections, copy, export and link; the overlay; the address opening Inspect                                                                                                                                                                                                               | `apps/live/components/panels/inspect/InspectPanel.test.tsx`, `components/canvas/inspect/InspectOverlay.test.tsx`, `useInspectHost.test.tsx`, `InspectClusterSegment.test.tsx`, `CanvasSelectionToolbars.test.tsx`; `lib/export-tab.test.ts`, `export-tab-canvas-draw.test.ts` |

## Constants and configuration

| Constant                               | Value                                      | Where                        |
| -------------------------------------- | ------------------------------------------ | ---------------------------- |
| `DEFAULT_WIREFRAME_DEVICE`             | `'iphone'`                                 | `wireframe-device.ts`        |
| `WIREFRAME_GUTTER`                     | phone 16, tablet 24, computer 32, watch 12 | `wireframe-device.ts`        |
| Device screens                         | as the spec's table                        | `WIREFRAME_DEVICES`          |
| `BROWSER`                              | border 1, toolbar 52, radius 12            | `wireframe-device.ts`        |
| `STATUS_TIME` / `WATCH_TIME`           | `9:41` / `10:09`                           | `wireframe-frame-over.ts`    |
| `SKETCH_FRAME_PX` / `MARKER_FRAME_PX`  | 1.4 / 3                                    | `wireframe-frame-paint.ts`   |
| `WATCH_MAX_WIDTH` / `PHONE_MAX_WIDTH`  | 300 / 600                                  | `wireframe-layout-kit.ts`    |
| `SHORT_HEIGHT` / `SHORT_SCALE_MIN`     | 600 / 0.72                                 | `wireframe-layouts-start.ts` |
| `TALL_RATIO` / `COLUMN_MAX`            | 1.2 / 560                                  | `wireframe-layouts-start.ts` |
| `WIREFRAME_FIT_MAX_ZOOM`               | 2.5                                        | `usePagesMode.ts`            |
| Device memory key                      | `livedesign:v2:wireframe-device`           | `wireframe-device-memory.ts` |
| `INSPECT_PARAM`                        | `'inspect'` (copied as `inspect=1`)        | `inspect-link.ts`            |
| `INSPECT_EXPORT_SCALES`                | 1, 2, 3                                    | `inspect-export.ts`          |
| `INSPECT_LINE_COLOUR`                  | `#e5484d`                                  | `InspectOverlay.tsx`         |
| `PAGE_LINK_TRANSITIONS`                | `instant`, `slide`, `dissolve`             | `page-link.ts`               |
| `DEFAULT_PAGE_LINK_TRANSITION`         | `'instant'`                                | `page-link.ts`               |
| `PAGE_LINK_ID_MAX`                     | 64 (a page id is `page-` and 8 hex)        | `page-link.ts`               |
| `SCREEN_LINK_HANDLE_PX`                | 22 (the quick-connect plus's size)         | `ScreenLinkHandle.tsx`       |
| `SCREEN_LINK_HANDLE_GAP_PX`            | 6 (screen px past the corner)              | `ScreenLinkHandle.tsx`       |
| `SCREEN_LINK_DRAG_SLOP_PX`             | 4 (screen px before a press is a drag)     | `ScreenLinkHandle.tsx`       |
| `SCREEN_LINK_PILL_MARGIN_PX`           | 8 (the drag pill's gap from the window)    | `ScreenLinkHandle.tsx`       |
| `PROTOTYPE_PARAM`                      | `'prototype'` (copied as `prototype=1`)    | `prototype-link.ts`          |
| `PROTOTYPE_TRANSITION_MS`              | 250                                        | `prototype-player.ts`        |
| `PROTOTYPE_FLASH_MS`                   | 500                                        | `prototype-player.ts`        |
| `FLOW_EDGE_INSET`                      | 24 (canvas px inside a screen's top, foot) | `flow-view.ts`               |
| `FLOW_PULL_MIN_PX`                     | 40 (screen px, a curve's least handle)     | `flow-view.ts`               |
| `FLOW_LANE_BASE_PX` / `_STEP_PX`       | 44 / 20 (screen px over the row's top)     | `flow-view.ts`               |
| `FLOW_GAP_SIDE_PX`                     | 6 (screen px off a gap's middle)           | `flow-view.ts`               |
| `FLOW_LANE_SPREAD`                     | 4 (lanes an arc rises over its own)        | `flow-view.ts`               |
| `FLOW_ENTRY_FRACTION` / `_STEP`/`_MAX` | 0.2 / 0.12 / 0.8 (of the target's width)   | `flow-view.ts`               |
| `FLOW_CORNER_PX`                       | 12 (screen px, an arc's corner radius)     | `flow-view.ts`               |
| `FLOW_STUB_PX`                         | 32 (screen px, the broken stub)            | `flow-view.ts`               |
| `FLOW_STROKE_PX` / `FLOW_HALO_PX`      | 2 / 6 (screen px)                          | `FlowViewLayer.tsx`          |

## Defaults ledger

None.
