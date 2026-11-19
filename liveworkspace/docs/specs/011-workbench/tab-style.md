# Tab Style dialog

Every editor (livediagram, liveplanner, livedocuments, livehuddle, livedesign) has a **Tab Style** dialog: a home of
ready-made **Looks** and a **Fine-tune** list, each row opening a panel (Colours, Finish, Text, Canvas) that applies
live to the active tab. What the dialog does for a person is each product's spec
(`<product>/docs/specs/011-theme/canvas-and-theme-dialog.md`). This page is the part every editor shares: one dialog
in `@liveworkspace/workbench`, and the **profile** each product hands it to say what its dialog shows.

The dialog was copied near-verbatim five times; the copies differed in their imports and in a few product bits
(liveplanner's panel wrapper and its narrower typefaces, livedocuments' page Style anchor and text range, livehuddle's
Floor panel). One copy now holds the behaviour, and a profile holds the differences, so a product changes what its
dialog shows by changing its profile, never by forking the dialog.

## What is shared

- **The views.** The home (the Looks carousel, then one Fine-tune row per panel showing its current value) and the
  four panels, swapped through an easing height and a short slide, each panel under the shared breadcrumb back home
  (`BackBar`, "Tab Style" > the panel's name).
- **The Looks carousel.** Pages of six, led by the Mashup card, with the Seasonal toggle and the Finish filter; each
  card a preview drawn by the product's renderer. Its telemetry (`UI / Changed / LooksSeasonal`,
  `UI / Changed / LooksFinishFilter`) goes through the workbench's `track` binding, the product's own `track`.
- **The Finish and Text panels.** Four finish tiles; the typeface carousel (six to a page, "Editor default" first),
  the Size of New Text control; each over the product's preview.
- **Apply to All Tabs** at the foot of the home, for an Editor of the whole item (`ApplyToAllTabsRow`). It copies
  `TAB_STYLE_KEYS` (`lib/tab-style-to-all.ts`): the canvas, the text defaults, the finish and the background new pages
  start on (`newPageBackground`, a Pages editor's) and the tab's Element Colours choice (`keepElementColours`,
  livedesign's); each absent elsewhere, so nothing changes there.
- **Eased changes.** Every pick eases the canvas into its new colours (`lib/tab-style-ease`).
- **The frame.** By default the modal every editor wore: no dimming, a transparent click-catcher, the dialog hero
  header (title "Tab Style", the line for the view that is up, Show Me, the help link and the close), a popover
  anchored on what opened it on a screen 640 px wide and up, a bottom sheet on a phone. A product may wrap the views
  in a frame of its own instead (liveplanner's `ClusterPanel`, which it shares with a board's Configure).

## Surfaces

The editor says what the dialog is styling when it opens it: a **surface**, a short name for the kind of tab or page
in front of the person. The names in use:

| Surface       | Where                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `canvas`      | a canvas tab (livediagram, livedesign), a diagram tab (liveplanner), a tab with no pages yet (livedocuments) |
| `whiteboard`  | a whiteboard tab (livediagram)                                                                               |
| `board`       | a Board tab (liveplanner)                                                                                    |
| `sheet`       | a Sheet tab (liveplanner)                                                                                    |
| `form`        | a Form tab (liveplanner)                                                                                     |
| `dashboard`   | a Dashboard tab (liveplanner)                                                                                |
| `article`     | an article page (livedocuments)                                                                              |
| `slide`       | a slide page (livedocuments)                                                                                 |
| `infographic` | an infographic page (livedocuments)                                                                          |
| `flashcard`   | a flashcard page (livedocuments)                                                                             |
| `wireframe`   | a wireframe page (livedesign)                                                                                |
| `logo`        | a logo page (livedesign)                                                                                     |
| `photo`       | a photo page (livedesign)                                                                                    |
| `space`       | a Space (livehuddle)                                                                                         |

A surface the profile does not name, or none, takes the profile's base. The surfaces are where a product tailors the
dialog: liveplanner's sheets, forms and dashboards drop the controls their opaque pages hide, and link to the settings
that really style them; livedocuments shows an article what reaches it (no Finish or Text, no canvas pattern); and
livedesign keeps hand-drawn looks off logo and photo pages.

## The profile

A product's profile has two halves: its **parts**, the same on every surface, and its **surface settings**, a base
and optional changes per surface.

The parts are what only the product knows: its look catalogue (the year-round looks in carousel order, the seasonal
looks for a date, the match, the tab's current look, a look's card preview, the Mashup roll), its theme lookup and
swatch, its Colours panel (its `ThemeBrowser`), its finish names and swatch, its pattern names, the typefaces it offers,
its Text Size control, the viewer's appearance (so the cards redraw in the viewer's half), its help link, its frame
(the shared modal with its Show Me binding and, optionally, an opener the popover hangs from first; or a frame of its
own), and whether its Apply to All Tabs names locked tabs.

The surface settings say, for a surface:

- **Panels**: which Fine-tune panels show, in order. A panel left out has no Fine-tune row, and a view naming it (the
  command palette's Open Canvas Options, say) opens on the home instead.
- **Hidden controls**: controls a panel leaves out: the default text size (the Text panel's Size of New Text, and the
  size in the Text row's summary), the animation speed, the pattern scale and the pattern colour (the Canvas panel's).
- **Looks**: a filter over the catalogue. A look the filter drops shows on no page; a tab wearing one shows no card
  selected. The Finish filter offers only the finishes the surface's looks wear, and the Mashup card rolls within them
  (a livedesign logo page, which keeps hand-drawn looks out, never shows a Marker mashup); with no filter, every
  finish.
- **The Canvas panel**: its title (the copy below) and its content, which the product draws (livediagram's patterns,
  livehuddle's floors, the Pages editors' New Page Background). It is handed the tab's canvas settings, their setters
  and the hidden controls. The Fine-tune row's value is the pattern's name unless the editor hands the dialog a
  `canvasSummary` of its own (the Pages editors name the background new pages start on).
- **A home extra** (`renderHomeExtra`, optional): what the home shows between the looks and Fine-tune, a row the
  product draws for that surface (livedocuments' door to an article's own Style, livedesign's choice of whether a
  look or a theme recolours the elements). Nothing by default.
- **The preview** the Finish and Text panels draw over: the product draws it for the panel asking (`finish` or
  `text`), from the tab's finish, paper, theme, font and the size new text takes. Each product draws its own kind of
  work: a diagram, a page, a frame.
- **Copy**: the header's line for each view, and each panel's name (the Fine-tune row's label and the breadcrumb's
  chip). The shared lines are the default; a product changes only the ones it words differently.
- **Links**: rows after the panels' in the Fine-tune list for settings that live outside the dialog but style this
  surface (liveplanner's Board Configure on a board, say). Each has a name and a line saying what it holds; pressing
  one closes the dialog and runs the product's opener. None by default.

## Placement

On a screen 640 px wide and up the modal frame is a popover: hanging 8 px below the product's opener when it names one
and it is on screen (livedocuments' page Style), else rising 8 px above the Theme & canvas button
(`[data-tour-id="canvas-theme"]`) with its right edge on the bottom-right cluster's (`[data-zoom-cluster]`). With
neither on screen it is the centred dialog; on a phone, a bottom sheet. It is read once as the dialog opens.

## Reuse

- The dialog lives in `packages/workbench/src/components/dialogs/tab-style/`; the detail is its blueprint,
  [Tab Style blueprint](blueprints/tab-style.md).
- Each editor's `components/dialogs/CanvasThemeDialog.tsx` is the door: it hands the shared dialog that editor's
  profile (`components/dialogs/tab-style-profile.tsx`), so the code still loads only when the dialog opens.
- What stays a product's: its look catalogue (`lib/tab-looks.ts`), its previews and renderers, its Canvas panel
  (`components/canvas/CanvasStyleControls.tsx`) and its tab transforms.
