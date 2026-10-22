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
  button** (Layers on its left) ([Live app](../007-editor/live-app.md) "Mobile chrome"), and opens
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

A **Finish filter** sits left of the carousel's page controls on the Looks heading row: a compact dropdown,
**All finishes** (the default, every look), then each finish (**Flexible**, **Professional**, **Sketch**, **Marker**),
narrowing the carousel to the looks of that finish, paged afresh from its first page (or the page holding the
tab's look when it is among them). It is the viewer's own, for this open of the dialog only (not stored), and
changing it is tracked as `UI / Changed / LooksFinishFilter`.

The table is in the order the carousel shows them after the Mashup card, six to a page:

| Look            | Theme    | Finish       | Tab font      | Pattern      | Pattern strength |
| --------------- | -------- | ------------ | ------------- | ------------ | ---------------- |
| Everyday        | Default  | Flexible     | (none)        | Grid         | (kept)           |
| Textbook        | UML      | Professional | Oswald        | Graph        | 50%              |
| Whiteboard      | Mono     | Marker       | (none)        | Blank        | (kept)           |
| Spectrum        | Rainbow  | Flexible     | Inter         | Grid         | 50%              |
| Boardroom       | Steel    | Professional | Inter         | Blank        | (kept)           |
| Notebook        | Mocha    | Sketch       | (none)        | Lines        | (kept)           |
| Seaside         | Ocean    | Flexible     | Nunito        | Waves        | (kept)           |
| Doodle          | Rainbow  | Sketch       | Caveat        | Blank        | (kept)           |
| Editorial       | Cream    | Professional | Lora          | Blank        | (kept)           |
| Midnight        | Midnight | Flexible     | (none)        | Grid         | (kept)           |
| Poster          | Tropical | Professional | Abril Fatface | Diagonal     | 40%              |
| Workshop        | Sand     | Marker       | (none)        | Grid         | 60%              |
| Graph Paper     | Indigo   | Professional | Roboto Mono   | Graph        | (kept)           |
| Daydream        | Pastel   | Flexible     | Nunito        | Grid         | 60%              |
| Engineer        | Sky      | Professional | Space Grotesk | Engineering  | (kept)           |
| Lagoon          | Tropical | Flexible     | Space Grotesk | Ripple       | 50%              |
| Studio          | Lavender | Professional | Roboto Slab   | Isometric    | (kept)           |
| Garden          | Forest   | Flexible     | Poppins       | Hexagonal    | 40%              |
| Billboard       | Sunset   | Professional | Oswald        | Stripes      | 40%              |
| Patchwork       | Pastel   | Sketch       | Lora          | Checkerboard | 30%              |
| Northern Lights | Abyss    | Flexible     | Poppins       | Aurora       | 60%              |
| Coffeehouse     | Espresso | Sketch       | Caveat        | Bricks       | 40%              |
| Schematic       | UML      | Professional | Roboto Mono   | Crosshatch   | 40%              |
| Flipchart       | Rainbow  | Marker       | (none)        | Lines        | 50%              |
| Sketchbook      | Rose     | Sketch       | (none)        | Blank        | (kept)           |
| Greenboard      | Pine     | Marker       | (none)        | Blank        | (kept)           |
| Picnic          | Pastel   | Flexible     | Poppins       | Checkerboard | 25%              |
| Mural           | Plum     | Marker       | (none)        | Grid         | 50%              |
| Field Notes     | Olive    | Sketch       | (none)        | Lines        | 60%              |

- **Multi-colour looks.** Eight looks use a theme whose nodes take different colours: the branch palettes of Rainbow,
  Pastel and Tropical ([Multi-colour themes](multicolour-themes.md)) and UML's colour per shape kind. Each is a
  different feel: Spectrum is crisp colour-coding for everyday work (rainbow branches in a clean sans on a
  quiet dot grid), Doodle a bold hand-drawn rainbow, Daydream soft
  pastels on dotted paper, Lagoon a fresh tropical spread on ripples, Poster a bold tropical display face on
  diagonals, Textbook a crisp colour-coded notation on graph paper, Patchwork pastel branches sketched on soft
  checks, and Schematic the UML colours in a monospace on a crosshatch. A dark-mode viewer sees each in its theme's
  dark half ([Light and dark halves](light-and-dark.md)), so the bright-on-dark versions come for free.
- **Order.** The **Mashup** card leads the carousel (below), then the looks; Everyday is always the first look (it
  is what an untouched tab reads as). The rest follow a fixed, interleaved
  order written into the catalogue (`TAB_LOOKS`, never shuffled at runtime): every page holds two multi-colour looks,
  and no two neighbours on a page share a theme or a finish, so each page reads as a spread of contrasting styles
  rather than the colourful looks clumping on one page. `apps/live/lib/tab-looks.test.ts` locks both rules.
- **Retired looks.** Carnival (Rainbow, Flexible, Poppins, Confetti at 50%) was replaced by Spectrum: its confetti
  backdrop fought the diagram, and the party feel was already covered by Doodle. Because a look is not stored, a tab
  that once picked Carnival keeps its four settings and simply reads as its own mix (no card selected); nothing
  migrates.
- A look that sets a pattern strength sets it (a busy pattern toned down); the rest leave the tab's own strength.
- The looks sit in a **carousel**, six to a page (three columns, two on a phone), with arrows and page dots: the
  Mashup card and the twenty-nine looks fill five pages. Looks are added six at a time, so every page stays full.
- **The newest five** (Billboard, Patchwork, Northern Lights, Coffeehouse, Schematic) each bring a theme or a
  pattern no other look uses (Sunset, Abyss and Espresso; stripes, checks, aurora, bricks and crosshatch), so page
  four is new ground rather than a reshuffle.
- **Marker has looks of its own** ([Finish](../008-canvas/finish.md)): Whiteboard (a whiteboard is drawn in marker),
  Workshop, and on page five Flipchart, Greenboard and Mural, a flip chart, a green board and a wall to draw on, each in
  marker on a theme no other look used (Rose, Pine, Plum and Olive arrive with page five). Page five alternates them
  with Sketchbook, Picnic and Field Notes, so no two neighbours share a finish, and its two multi-colour looks
  (Flipchart and Picnic) keep two to every page.
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

### Seasonal looks

Six more looks are for holidays: one for **New Year**, one for **Easter**, one for **Halloween** and three for
**Christmas**. They are looks in every way (four ordinary settings, not stored, one undo step, selected while the
tab matches) but they never appear among the everyday looks.

- **The Seasonal toggle.** A **Seasonal** button sits left of the Finish filter on the Looks heading row. Pressed
  (`aria-pressed`), the carousel shows the seasonal looks only, with no Mashup card (a mashup rolls everyday
  ingredients); pressed again, the everyday carousel comes back. The Finish filter still narrows whichever set is
  shown, and every finish has at least one seasonal look. Like the filter, the toggle is the viewer's own, for this
  open of the dialog only, except that the dialog opens with it on when the tab already wears a seasonal look, so
  that look's card shows selected. Toggling is tracked as `UI / Changed / LooksSeasonal`.
- **Always on offer, the current season first.** Every season is there all year. The seasons are ordered by the
  next time each one ends, from the viewer's local date: the season on now, or the next to come, leads. A season
  leads through its last day: New Year through 7 January, Easter through Easter Monday (Easter Sunday by the
  Gregorian computus), Halloween through 31 October, Christmas through 26 December. Within a season, looks keep
  catalogue order. The order is worked out once per open of the dialog.
- **The card** names its season in a small line above the look's name.

| Season    | Look              | Theme     | Finish       | Tab font      | Pattern       | Pattern strength |
| --------- | ----------------- | --------- | ------------ | ------------- | ------------- | ---------------- |
| New Year  | Countdown         | Sparkle   | Professional | Abril Fatface | Sparkles      | 70%              |
| Easter    | Egg Hunt          | Spring    | Flexible     | Nunito        | Eggs          | 70%              |
| Halloween | Haunted           | Pumpkin   | Marker       | (none)        | Cobwebs       | 70%              |
| Christmas | Christmas Morning | Yuletide  | Flexible     | Lora          | Candy Stripes | 30%              |
| Christmas | Winter Wonderland | Frost     | Sketch       | Caveat        | Snowflakes    | 80%              |
| Christmas | Fireside          | Evergreen | Professional | Roboto Slab   | Drift         | 60%              |

- **Seasonal themes.** Sparkle (gold on midnight navy), Spring (painted-egg pastels, a hue per branch), Pumpkin
  (orange, purple and green per branch on a night canvas), Yuletide (red, green and gold per branch), Frost (icy
  blues) and Evergreen (berry red on fir green). They are built-in themes (`seasonal: true` in the catalogue), with
  light and dark halves at the same contrast floor as every theme
  (`apps/live/lib/tab-looks-contrast.test.ts` checks the seasonal looks in both halves). No theme picker lists them
  and the Mashup never draws them; a tab wears one only through a seasonal look, and its name still shows on the
  Colours row.
- **Seasonal patterns.** Sparkles (four-point twinkles), Eggs (banded egg outlines), Cobwebs (a web strung from
  each tile's corner), Snowflakes (six-armed flakes) and Candy Stripes (thick 45° bands). Each is a static SVG tile
  in the tab's pattern colour, so it themes, fades and scales like the other static patterns, and the image export
  draws the same tile (`apps/live/lib/seasonal-patterns.ts`). No pattern picker lists them; the Canvas row still
  names the one a tab wears. Fireside reuses the animated Drift for falling embers.
- **Telemetry:** picking a seasonal look fires `track('Tab', 'Changed', 'SeasonalLook')` in place of the `Look`
  event.
- **Share roles:** as for looks, an Editor picks seasonal looks; a Participant or Viewer never reaches the dialog.

### Mashup

The carousel's first card is **Mashup**, a random look generator: each press dresses the tab in a new, random look,
and the user can keep pressing it to regenerate.

- **Ingredients.** A mashup draws each of a look's four settings at random, independently: a **theme** from the
  whole built-in catalogue less the seasonal themes, a **finish**, a **tab font** from the fonts the looks use (or none), and a **pattern**
  with its strength from the patterns the everyday looks use, so a busy pattern keeps the soft strength its look gave it.
  Every ingredient is curated, which keeps a mashup respectable; the mix is what makes it unique (over fifteen
  thousand combinations).
- **Light and dark.** Any theme reads in both appearances ([Light and dark halves](light-and-dark.md)), so every
  mashup does too: a dark-mode viewer sees it in its theme's dark half, with the same contrast floor as the looks
  (`apps/live/lib/tab-looks-contrast.test.ts` checks a spread of seeded mashups in both halves).
- **Always new.** A roll that equals one of the named looks, or the mashup the card already shows, is rolled
  again (up to `MASHUP_REROLLS` times), so a press always changes the tab and never lands on a named look.
- **The card.** Like a look's card (the sample diagram drawn in the mashup, in the viewer's half), named **Mashup**
  with a dice badge, and a line naming its four ingredients the way a look's does ("Ocean, Sketch, Caveat, waves").
  The dialog opens with a fresh roll on the card that is not applied yet, so the first press applies exactly what the
  card shows. While the tab wears the card's mashup the card is selected, and the next press rolls a new one and
  applies it. Its accessible name is "Mashup: a random look, press for another".
- **Finish filter.** The card stays first under any filter; with a finish chosen, the mashup rolls within that
  finish (a card showing another finish rolls afresh when the filter changes).
- **Not stored**, like any look: the tab carries the four ordinary settings. Reopening the dialog shows a fresh roll,
  and a tab still wearing an earlier mashup simply has its own mix (no card selected).
- Applying a mashup is one undo step, exactly as a look is (`withLookApplied`).
- **Share roles:** as for looks, an Editor rolls mashups; a Participant or Viewer never reaches the dialog.
- **Telemetry:** a mashup press fires `track('Tab', 'Changed', 'Mashup')` in place of the `Look` event.

### Fine-tune

Below the looks, four rows, one per setting, each showing its current value: **Colours** (the theme's name),
**Finish**, **Text** (the tab font and the default size) and **Canvas** (the pattern). Two columns, one on a phone.
Pressing a row opens that setting's panel **in place**, sliding in from the right (back slides from the left; a fade
with reduced motion), under the shared [back bar](../004-interface-design/back-bar.md) (the one Import and Export use: **Tab Style** then the panel's name), which stays pinned to the top as the panel scrolls.
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
style), six to a carousel page (three to a row, two rows), "Editor default" first; and **Size of New Text** on the one
[Text Size](../004-interface-design/fonts.md#text-size) control (Scale, or a 6 to 48 px slider), the preview following the slider as
it moves. Picking a typeface or a size **applies to the whole tab at
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
starts on the home (a panel that is open goes back to it first), points at live controls and ends on a closing card
linking Tab Style Help as **Learn More**:

1. **One-Click Looks**: the looks carousel. Each look sets the tab's colours, finish, font and canvas at once.
2. **Mashup**: the Mashup card, which rolls a fresh mix of colours, font and canvas on each press.
3. **More Looks**: the carousel's arrows and page dots.
4. **Fine-Tune Any Part**: the Fine-tune rows, each showing what the tab uses now.
5. **Finish**: opens the Finish panel and points at its four tiles.
6. **See It Change**: really redraws the tab in another finish (Sketch, or Marker on a tab already in Sketch), as a
   press on its tile would, so the person watches the tab change. The step puts the person's own finish back as it
   ends, however it ends (Next, Back, Skip, Escape). Both changes are ordinary edits, in the history and seen by
   everyone on the tab.

While it runs, Escape belongs to the tour. Telemetry: `UI · Started · TabStyleTour`, `UI · Ended ·
TabStyleTourCompleted` / `TabStyleTourSkipped`.

## Telemetry

Opening the dialog fires `track('UI', 'Opened', 'ThemePicker')` (the dock button, Change Theme) or
`track('UI', 'Opened', 'CanvasStyle')` (Canvas Options). Picking a look fires `track('Tab', 'Changed', 'Look')` (a Mashup press, `track('Tab', 'Changed', 'Mashup')`);
the underlying setters keep their existing `Canvas` / `Theme` / `Tab` events (the Apply to All actions, and their
`FinishToAll` and `ResetElements` events, are gone)
([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## Reuse notes

- `CanvasStyleControls` — pattern grid + colour swatches + opacity slider. Rendered by both the palette's Canvas accordion and the dialog's Canvas panel.
- `ThemeBrowser` — the flat, paged theme list. Rendered by the palette accordion, the New-document picker and the dialog's Colours panel.
- `PagedCarousel` — the carousel (arrows, page dots, nine or six to a page) the looks, themes, typefaces and patterns share.
- On a screen wider than a phone (640 px and up), the dialog is a **popover flying out of the Theme & canvas button**: its
  bottom-right corner sits 8 px above the button, its right edge on the bottom-right cluster's (the right of the zoom
  controls, so it sits as far right as the cluster and covers as little of the work as it can), and it grows from that corner (the long motion
  token's `fly-up-in`; a fade alone with reduced motion), at most as tall as the room above the button. Without the
  button on screen it is the centred dialog. On a phone it is a **bottom sheet**, as the editor's other phone sheets
  are: the screen's width, rising from the bottom edge (`sheet-up`), at most 75% of the screen tall so the canvas stays
  in view above it, with the shared grab handle that drags it taller or down to close.
- The dialog follows the existing modal contract (`Portal` + `useEscape` + a full-screen click-catcher, see `SettingsDialog`) — but with **no dimming / blur backdrop**: because every control applies live, the catcher is left transparent so the user can watch the canvas background + theme update behind the dialog as they click. The catcher still closes on an outside click and swallows pointer / right-click events so an edit doesn't leak to the canvas while it's open.
