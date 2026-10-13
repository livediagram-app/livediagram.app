# Tab Style dialog

A focused modal for changing how the active tab looks (its **theme**, **finish**, **text** and **canvas**), reached from the Theme & canvas dock button. It opens on a home of ready-made **Looks** and a **Fine-tune** list of the four settings. The same controls live in the canvas's context menus too ([Canvas and palette](../008-canvas/canvas-and-palette.md)); this dialog is a larger entry point that brings them front-and-centre when the user explicitly asks to change the canvas or theme.

## Why

The pattern grid, canvas/pattern colour pickers, opacity slider, and theme grid sit inside narrow side-panel accordions. They work, but they're cramped (a 3-wide theme grid, a flat list) and easy to miss. Right-clicking the canvas already offered **Change Canvas** / **Change Theme**, but those merely popped the matching accordion open in the side panel. This spec turns those two menu items into a proper modal so the controls get the room they deserve, and the theme picker can use the same browser as the [New-document](../007-editor/new-document-route.md) screen.

## Behaviour

- The dialog is one modal (`CanvasThemeDialog`) titled **Tab Style** ("Appearance" names the VIEWER's own
  chrome, [Live app](../007-editor/live-app.md)). It opens on its **home**: a grid of **Looks**, then a
  **Fine-tune** list. The tab / canvas context menu carries no Look & Feel or Font category: the dock button is
  the one entry point.
- A **dock button** ("Theme & canvas") sits in the bottom-right chrome cluster, **in one strip with the Layers
  button** (Layers on its left) in every mode ([Live app](../007-editor/live-app.md) "Mobile chrome"), and opens
  the dialog on its home. Its icon is a painter's palette with filled paint wells, in the button's own colour like every other chrome icon, so it reads as "how this tab
  looks" at a glance. It shows on **every viewport, mobile included**, and stays hidden in zen mode and in
  read-only / embed views.
- The header is a title row with the **help icon beside the close button** on the right.
- Every control applies **live** to the active tab, so the canvas updates behind the dialog. There is no
  Apply/Cancel: the dialog is an editor, not a wizard. Closing (the X, Escape, or a backdrop click) just dismisses
  it; nothing is rolled back.
- The dialog is only reachable when the tab is editable. It is not offered on read-only / embed views.

### Looks

A **look** is a shortcut that sets four of the tab's existing settings at once: its **theme**, **finish**
([Finish](../008-canvas/finish.md)), **tab font** and **canvas pattern**. It is not a stored concept: nothing
records which look was picked, and the tab carries only those four ordinary settings, exactly as if they had been
picked one by one.

The table is in the order the carousel shows them, six to a page:

| Look        | Theme    | Finish       | Tab font         | Pattern     | Pattern strength |
| ----------- | -------- | ------------ | ---------------- | ----------- | ---------------- |
| Everyday    | Default  | Flexible     | (none)           | Grid        | (kept)           |
| Textbook    | UML      | Professional | Oswald           | Graph       | 50%              |
| Whiteboard  | Mono     | Sketch       | (none)           | Blank       | (kept)           |
| Carnival    | Rainbow  | Flexible     | Poppins          | Confetti    | 50%              |
| Boardroom   | Steel    | Professional | Inter            | Blank       | (kept)           |
| Notebook    | Mocha    | Sketch       | (none)           | Lines       | (kept)           |
| Seaside     | Ocean    | Flexible     | Nunito           | Waves       | (kept)           |
| Doodle      | Rainbow  | Sketch       | Caveat           | Blank       | (kept)           |
| Editorial   | Cream    | Professional | Lora             | Blank       | (kept)           |
| Midnight    | Midnight | Flexible     | (none)           | Grid        | (kept)           |
| Workshop    | Sand     | Sketch       | Permanent Marker | Grid        | 60%              |
| Poster      | Tropical | Professional | Abril Fatface    | Diagonal    | 40%              |
| Graph Paper | Indigo   | Professional | Roboto Mono      | Graph       | (kept)           |
| Daydream    | Pastel   | Flexible     | Nunito           | Grid        | 60%              |
| Engineer    | Sky      | Professional | Space Grotesk    | Engineering | (kept)           |
| Lagoon      | Tropical | Flexible     | Space Grotesk    | Ripple      | 50%              |
| Studio      | Lavender | Professional | Roboto Slab      | Isometric   | (kept)           |
| Garden      | Forest   | Flexible     | Poppins          | Hexagonal   | 40%              |

- **Multi-colour looks.** Six looks use a theme whose nodes take different colours: the branch palettes of Rainbow,
  Pastel and Tropical ([Multi-colour themes](multicolour-themes.md)) and UML's colour per shape kind. Each is a
  different feel: Carnival is a bright party (rainbow on confetti), Doodle a bold hand-drawn rainbow, Daydream soft
  pastels on dotted paper, Lagoon a fresh tropical spread on ripples, Poster a bold tropical display face on
  diagonals, and Textbook a crisp colour-coded notation on graph paper. A dark-mode viewer sees each in its theme's
  dark half ([Light and dark halves](light-and-dark.md)), so the bright-on-dark versions come for free.
- **Order.** Everyday is always first (it is what an untouched tab reads as). The rest follow a fixed, interleaved
  order written into the catalogue (`TAB_LOOKS`, never shuffled at runtime): every page holds two multi-colour looks,
  and no two neighbours on a page share a theme or a finish, so each page reads as a spread of contrasting styles
  rather than the colourful looks clumping on one page. `apps/live/lib/tab-looks.test.ts` locks both rules.
- A look that sets a pattern strength sets it (a busy pattern toned down); the rest leave the tab's own strength.
- The looks sit in a **carousel**, six to a page (three columns, two on a phone), three pages, with arrows and page
  dots.
- When the tab matches no look, no card is selected (there is no "Current" card for the tab's own mix).
- Each look is a card: a small sample diagram drawn in the look (the same sample and renderer as the Finish
  preview, on the look's own canvas colour and pattern, in the viewer's half of its theme), its name, and a line on what it is made of.
  The sample is coloured with its two boxes as separate branches, taking the palette's first and fourth colours
  (across the wheel: Rainbow's red and green, Tropical's teal and orange), and its arrow is put back on its pins
  after; so a multi-colour look's card shows two contrasting palette colours rather than the trunk neutral and one
  hue. Single-colour and per-shape (UML) looks draw exactly as they would without it (`apps/live/lib/look-preview.ts`).
- Picking a look applies it as **one undo step**. The theme is applied exactly as picking that theme does
  (preserve-customs, arrows track the theme, see Theme below), then the finish, font and pattern are set; an
  element's own finish or font still wins over the tab's.
- A look's card shows as **selected** while the tab's four settings match it. Change any one of them and no look is
  selected; the tab simply has its own mix.
- **Share roles:** an Editor picks looks. A Participant or Viewer never reaches the dialog (it is only offered on
  an editable tab, and the tab setters refuse a blocked session), so neither can apply a look.

### Fine-tune

Below the looks, four rows, one per setting, each showing its current value: **Colours** (the theme's name),
**Finish**, **Text** (the tab font and the default size) and **Canvas** (the pattern). Two columns, one on a phone.
Pressing a row opens that setting's panel **in place**, sliding in from the right (back slides from the left; a fade
with reduced motion), under the shared back bar (the one Import and Export use: **Tab Style** then the panel's name).
Panels carry no descriptions. The editor's commands that open a panel directly ("Change Theme", "Canvas Options")
open the dialog on that panel.

### Eased changes

Options do not preview on hover (tried and removed: the canvas changing under a passing pointer was distracting); a
click applies. Each pick **eases** the canvas's colours (background, fill, outline, text) over 250 ms instead of
snapping (`lib/tab-style-ease.ts`); the transition is switched on only for the moment of the change (a class on the
root, scoped to the canvas), so it costs nothing the rest of the time. Reduced motion snaps.

### Text panel

The tab's typography ([Fonts](../004-interface-design/fonts.md)): a **preview** of the sample diagram lettered in
the tab's font at the size new text takes; the **Typeface** specimen cards ("Aa" and the name in each face, with its
style), six to a carousel page (three to a row, two rows), "Editor default" first; and **Size of New Text** as four tiles (Small, Medium,
Large, Scale), each drawing a letter at that size. Picking a typeface or a size **applies to the whole tab at
once**: the tab's setting, and every element following it again (an element's own font is cleared, every
text-bearing element takes the size). There is no separate apply action.

### Finish panel

The tab's [Finish](../008-canvas/finish.md): a preview of the sample diagram in the chosen finish, and the three
finishes as tiles with a 40 px icon each. Picking one applies to the whole tab at once (every element's own finish
cleared).

### Canvas panel

The canvas-style controls, shared with the palette's **Canvas** accordion (`CanvasStyleControls`, so the two can never drift):

- **Pattern** — in the dialog, two carousels of real pattern previews: **static** patterns and **animated** ones,
  nine to a page on a desktop and six on a phone (`PatternCarousel`). The narrow palette accordion keeps its 4-wide
  grid with "Show more". ([Canvas and palette](../008-canvas/canvas-and-palette.md) lists the patterns.)
- **Colours** — Canvas colour + Pattern colour, each opening the [colour picker](../004-interface-design/colour-picker.md) in a popover (soft and strong standard colours for the canvas, strong only for the pattern).
- **Opacity** — the pattern-opacity slider with its percentage readout.
- **Size** — the pattern-size slider (50%–200%, default 100%) with its percentage readout, directly under Opacity. Writes `backgroundPatternScale` on the tab; `tabBackgroundStyle` multiplies every tile's `background-size` by it (never the pan phase, so the pattern still tracks panning at any size). Blank has no tile, so the slider is a no-op there.
- **Speed** — a motion-rate slider (25%–300%, default 100%) with its percentage readout, directly under Size, shown **only while an animated pattern is active** (a static pattern has nothing to pace). Writes `backgroundAnimationSpeed` on the tab; the animated backdrop divides each motif's tuned duration by it via the `--lvd-bg-speed` var, so every pattern keeps its character and the slider just scales the pace.

### Colours panel

Every theme in **one flat list**, nine to a carousel page (`ThemeBrowser`, shared with the palette accordion and
the [New-document](../007-editor/new-document-route.md) picker so they stay identical), the owner's saved themes
([Custom themes](custom-themes.md)) among them. No categories, no shuffle. Each card previews the theme in the
viewer's half ([Light and dark halves](light-and-dark.md)).

- Clicking a theme applies it live; double-clicking applies and closes the dialog.
- There is no "reset elements to theme" action: picking a theme already moves every element still on the old
  theme's colours, and a colour someone chose is theirs.

**Arrows always track the theme.** Picking a theme keeps the per-field
preserve-customs rule for shapes / text (a colour the user hand-set survives the
switch), but **arrows are the one exception**: every arrow's stroke is always
reset to the new theme's stroke, even if it was custom-coloured. A theme switch
that left hand-coloured connectors on the old hue read as broken, so
`setTheme` runs `resetArrowsToTheme` on top of `switchThemeElements`. It's
palette-aware (each arrow snaps to its branch's stroke), reusing the same
per-element resolution every theme transform uses.

### Formal themes / per-shape colours

Most themes paint every shape the same fill / stroke / text. A **Formal** theme instead colours each shape **kind** by its conventional meaning, so a diagram reads as a standard notation at a glance.

- **UML** is the first Formal theme. Each `ShapeKind` carries its own colours: a decision **diamond** is amber, a datastore **cylinder** is purple, a start/end **stadium** is green, a process **square** is blue, and so on. Kinds without a specific colour fall back to the theme's crisp dark-on-light box. The canvas is plain white so the colour coding (not the backdrop) carries the meaning.
- Mechanically, a theme may define `shapeColors?: Partial<Record<ShapeKind, { fill?; stroke?; text? }>>`. These win over the single `elementFill` / `-Stroke` / `-Text` for that kind; unset fields fall through. Resolution flows through the same `elementThemeView` synthetic-theme path the multi-colour ([Multi-colour (rainbow) themes](multicolour-themes.md)) branch colours use, so every theme transform (apply to new shapes, recolour a scaffold, switch themes, reset to theme) is shape-aware through one code path. A theme can in principle combine `shapeColors` with a `palette`, but in practice per-shape (UML) and per-branch (rainbow) themes are distinct.
- The theme card preview (`ThemeSwatch`) stripes a per-shape theme's kind colours, like it does a multi-colour palette, so the card reads as colourful rather than as one neutral dot.

## Editor chrome follows the active theme

The editor chrome **follows the active tab's theme** so it matches the diagram you're editing, in two ways. Both the brand accent and the neutral slate surfaces are Tailwind v4 CSS variables (`--color-brand-50..950`, `--color-slate-*`), so `useEditorAccent` retargets those variables for the editor session by injecting one `<style>` element:

- **Accent (both modes).** The active theme's accent (its `elementStroke`) is spun into an 11-stop ramp anchored at `600` (a pale dark-theme stroke is darkened first so white-on-`600` keeps contrast) and emitted as `html:root { --color-brand-* }`, so every `brand-*` utility — buttons, rings, focus outlines — takes the theme colour.
- **Dark mode (a darker version of the theme).** Plain dark mode is the blue-slate dark palette. The hook also emits `html.dark { --color-slate-600..950 }`, a muted-then-shaded ramp of the theme hue (the accent pulled toward neutral slate so it's a tint, not a garish saturated dark), so dark-mode panels / borders / deep backgrounds read as a dark version of the chosen theme. Only the surface stops (600–950) are retargeted; the lighter stops stay neutral so dark-mode text keeps its readable greys. The override is `.dark`-scoped, so CSS handles the mode switch with no JS detection.
- **The tint outranks the base by selector.** Dark mode's own palette ([Colour scheme](../004-interface-design/color-scheme.md#dark-palette-steel)) also retargets `--color-brand-*` and the surface stops under `.dark`, so the hook's rules are written as `html:root` (brand) and `html.dark` (surfaces): one element-type step more specific than the base, so the theme's tint wins whatever order the stylesheets load in.
- The `<style>` lives in `<head>` so body-portaled UI (context menus, dialogs, popovers, toasts) inherits both. The **Default** (`brand`) scheme and an unthemed tab have no `elementStroke`, so nothing is injected: the built-in brand stands (sky in light mode, Steel in dark) on the built-in surfaces. Switching tabs re-resolves it; leaving the editor removes the `<style>` so the rest of the app (Explorer, marketing) keeps the defaults.
- Only the chrome retargets — element colours come from the theme applied to the elements themselves ([Multi-colour (rainbow) themes](multicolour-themes.md)), unaffected.

## Show Me

The dialog is a [Show Me](../007-editor/show-me.md) surface: its title row carries **Show Me** left of Help. The tour
runs on the home (a panel that is open goes back to it first), points at live controls and ends on a closing card
linking Tab Style Help:

1. **One-Click Looks**: the looks carousel. Each look sets the tab's colours, finish, font and canvas at once.
2. **More Looks**: the carousel's arrows and page dots.
3. **Fine-Tune Any Part**: the Fine-tune rows, each showing what the tab uses now.

While it runs, Escape belongs to the tour. Telemetry: `UI · Started · TabStyleTour`, `UI · Ended ·
TabStyleTourCompleted` / `TabStyleTourSkipped`.

## Telemetry

Opening the dialog fires `track('UI', 'Opened', 'ThemePicker')` (the dock button, Change Theme) or
`track('UI', 'Opened', 'CanvasStyle')` (Canvas Options). Picking a look fires `track('Tab', 'Changed', 'Look')`;
the underlying setters keep their existing `Canvas` / `Theme` / `Tab` events (the Apply to All actions, and their
`FinishToAll` and `ResetElements` events, are gone)
([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## Reuse notes

- `CanvasStyleControls` — pattern grid + colour swatches + opacity slider. Rendered by both the palette's Canvas accordion and the dialog's Canvas panel.
- `ThemeBrowser` — the flat, paged theme list. Rendered by the palette accordion, the New-document picker and the dialog's Colours panel.
- `PagedCarousel` — the carousel (arrows, page dots, nine or six to a page) the looks, themes, typefaces and patterns share.
- On a screen wider than a phone (640 px and up), the dialog is a **popover flying out of the Theme & canvas button**: its
  bottom-right corner sits 8 px above the button, right edges aligned, and it grows from that corner (the long motion
  token's `fly-up-in`; a fade alone with reduced motion), at most as tall as the room above the button. Without the
  button on screen, or on a phone, it is the centred (phone: full-screen) dialog.
- The dialog follows the existing modal contract (`Portal` + `useEscape` + a full-screen click-catcher, see `SettingsDialog`) — but with **no dimming / blur backdrop**: because every control applies live, the catcher is left transparent so the user can watch the canvas background + theme update behind the dialog as they click. The catcher still closes on an outside click and swallows pointer / right-click events so an edit doesn't leak to the canvas while it's open.
