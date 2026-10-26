# Wireframe pages blueprint

Derived from [Wireframe pages](../wireframe-pages.md). The page machinery it extends is in
[Pages](pages-mode.md); this blueprint names only what the wireframe kind adds or changes.

## Domain and naming

| Spec term        | Identifier                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| wireframe page   | `Page` with `kind: 'wireframe'`; `PageKind` member `'wireframe'`                                                 |
| device           | `Page.device`, `WireframeDeviceId`; `WIREFRAME_DEVICES` (label, `short`, class, portrait screen, `turns`)        |
| device class     | `WireframeDeviceClass` (`'phone' \| 'tablet' \| 'computer' \| 'watch'`); `pageDeviceClass(page)`                 |
| device frame     | `wireframeFrameSvg` (`wireframeFrameUnderSvg` beneath the content, `wireframeFrameOverSvg` above it)             |
| screen           | `DeviceGeometry.screen` and `radii`; `pageScreenRect(page)`, `pageClipPathData(page)`                            |
| system bars      | `Page.systemBars` (absent is shown); `DeviceGeometry.bars`; `deviceHasSystemBars`, `pageShowsSystemBars`         |
| safe area        | `deviceSafeArea(geometry, systemBars)`; `pageContentBox(page)` (any kind: a wireframe page's safe area)          |
| frame look       | `Page.frameLook`, `WireframeFrameLook` (`'theme'` absent); `WIREFRAME_FRAME_LOOKS`, `WIREFRAME_FRAME_LOOK_LABEL` |
| frame theme      | `WireframeFrameTheme`, `wireframeFrameTheme(theme)`, `tabWireframeFrameTheme(tab)`                               |
| wireframe layout | `WireframeLayoutId`, `WIREFRAME_LAYOUTS`, `WIREFRAME_LAYOUT_CATEGORIES`, `wireframeLayoutsFor(class)`            |
| screen form      | `ScreenForm` (`'watch' \| 'phone' \| 'wide'`), `screenForm(box)`                                                 |
| device memory    | `lastWireframeDevice()`, `rememberWireframeDevice(device)`                                                       |

"Device" alone always means the page's `WireframeDeviceId`; never "mockup" or "frame" for the device itself.

## Where the code lives

| File                                                                                  | Role                                                                                                                |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `packages/design/src/wireframe-device.ts` (+ test)                                    | Devices, groups, gutters, geometry (`deviceGeometry`), the safe area, paths, `wireframeAddress`                     |
| `packages/design/src/wireframe-device-svg.ts`                                         | The frame as SVG in each look and finish, the status bar and home indicator                                         |
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

## Interfaces and contracts

- `Page` fields: `kind: 'wireframe'`, `device?: WireframeDeviceId`, `orientation?: PageOrientation`,
  `frameLook?: WireframeFrameLook`, `systemBars?: boolean`; validated by the api with the design schema.
- `change_pages` ([MCP server](../../015-api/mcp-server.md)): `{ op: 'add', kind: 'wireframe', device? }`;
  `{ op: 'set', page, frameLook?, systemBars?, orientation? }`; a `set` naming a device, or a wireframe field on
  another kind of page, is refused `not_a_wireframe` (`packages/api-schema/src/pages.ts`). A page's rectangle answer
  carries the safe area beside the page's rect.

## Errors and edge cases

- An unknown device, look or orientation reads as the default (Page model above).
- A device without system bars (a computer) ignores `systemBars`.
- Laying loose content out into pages never makes a wireframe page.

## Security and trust

The frame is the app's own markup, never content; nothing on the page reaches it. Every control is gated on `can`
(`can.editPages` for the device), as every page control is ([Share roles](../../013-workspace/share-roles.md)).

## Observability

Telemetry from `page-edits.ts`: `Tab · Changed · WireframePageAdded` and `PageKindWireframe`;
`Tab · Changed · WireframeDevice<Device>` (`WIREFRAME_DEVICE_EVENT`); `Tab · Changed · WireframeFrame<Look>`
(`WIREFRAME_FRAME_EVENT`); `UI · Toggled · WireframeSystemBarsOn` / `WireframeSystemBarsOff`. Never a name or text.

## Testing

| Rule                                                                                                                                        | Test                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Devices, turning, the iPhone Duo, the address; parsing, screen, safe area, clip, frame and export; adding, the +, device edits and refusals | `packages/design/src/wireframe-device.test.ts`                                                               |
| Layouts by device class; each flow on its own pages                                                                                         | `packages/templates/src/wireframe-layouts.test.ts`                                                           |
| Adding a screen, the device memory, the + and the chooser                                                                                   | `apps/live/components/canvas/AddPageButton.test.tsx`, `ContentsAddPage.test.tsx`, `FirstPageChoice.test.tsx` |
| The editor's page edits on a wireframe page                                                                                                 | `apps/live/hooks/editor/page-edits.test.ts`                                                                  |
| The page panel's Device tab                                                                                                                 | `apps/live/components/canvas/PagePanel.tabs.test.tsx`                                                        |
| Layout gallery by device class                                                                                                              | `apps/live/components/canvas/layout-gallery/LayoutGallery.test.tsx`, `layout-gallery-filter.test.ts`         |
| The Wireframe tour track                                                                                                                    | `apps/live/components/tour/page-tour-steps.test.ts`                                                          |

## Constants and configuration

| Constant                              | Value                                      | Where                        |
| ------------------------------------- | ------------------------------------------ | ---------------------------- |
| `DEFAULT_WIREFRAME_DEVICE`            | `'iphone'`                                 | `wireframe-device.ts`        |
| `WIREFRAME_GUTTER`                    | phone 16, tablet 24, computer 32, watch 12 | `wireframe-device.ts`        |
| Device screens                        | as the spec's table                        | `WIREFRAME_DEVICES`          |
| `BROWSER`                             | border 1, toolbar 52, radius 12            | `wireframe-device.ts`        |
| `STATUS_TIME` / `WATCH_TIME`          | `9:41` / `10:09`                           | `wireframe-device-svg.ts`    |
| `SKETCH_FRAME_PX` / `MARKER_FRAME_PX` | 1.4 / 3                                    | `wireframe-device-svg.ts`    |
| `WATCH_MAX_WIDTH` / `PHONE_MAX_WIDTH` | 300 / 600                                  | `wireframe-layout-kit.ts`    |
| `SHORT_HEIGHT` / `SHORT_SCALE_MIN`    | 600 / 0.72                                 | `wireframe-layouts-start.ts` |
| `TALL_RATIO` / `COLUMN_MAX`           | 1.2 / 560                                  | `wireframe-layouts-start.ts` |
| `WIREFRAME_FIT_MAX_ZOOM`              | 2.5                                        | `usePagesMode.ts`            |
| Device memory key                     | `livedesign:v2:wireframe-device`           | `wireframe-device-memory.ts` |

## Defaults ledger

None.
