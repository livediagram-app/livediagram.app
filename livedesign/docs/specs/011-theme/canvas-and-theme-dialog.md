# Tab Style dialog

A focused modal for changing how the active tab looks (its **theme**, **finish**, **text** and **canvas**), reached from the Theme & canvas dock button. It opens on a home of ready-made **Looks** and a **Fine-tune** list of the four settings. The same controls live in the canvas's context menus too ([Canvas and palette](../008-canvas/canvas-and-palette.md)); this dialog is a larger entry point that brings them front-and-centre when the user explicitly asks to change the canvas or theme.

## Why

The pattern grid, canvas/pattern colour pickers, opacity slider, and theme grid sit inside narrow side-panel accordions. They work, but they're cramped (a 3-wide theme grid, a flat list) and easy to miss. Right-clicking the canvas already offered **Change Canvas** / **Change Theme**, but those merely popped the matching accordion open in the side panel. This spec turns those two menu items into a proper modal so the controls get the room they deserve, and the theme picker can use the same browser as the [New-design](../007-editor/new-design-route.md) screen.

## Behaviour

- The dialog is one modal (`CanvasThemeDialog`) titled **Tab Style** ("Appearance" names the VIEWER's own
  chrome, [Live app](../007-editor/live-app.md)). It opens on its **home**: a grid of **Looks**, then a
  **Fine-tune** list. The tab / canvas context menu carries no Look & Feel or Font category: the dock button is
  the one entry point.
- A **dock button** ("Theme & Canvas") sits in the bottom-right chrome cluster, in a strip of its own
  ([Live app](../007-editor/live-app.md) "Mobile chrome"; the Layers button that shared it retired with the
  Layers panel, [Layers](../006-design/layers.md) "Retired: the Layers panel"), and opens
  the dialog on its home. Its icon is a painter's palette with filled paint wells, in the button's own colour like every other chrome icon, so it reads as "how this tab
  looks" at a glance. It shows on **every viewport, mobile included**, and stays hidden in zen mode and in
  read-only / embed views.
- The header is the [dialog hero header](../../../../liveworkspace/docs/specs/004-index/dialog-hero-header.md): rings spreading like a colour
  wheel's from the bottom right, where a fan of swatch chips rises from the edge, the front one in the accent lifting
  out of it twice, and a brush sweeping a stroke of paint along the foot in the bottom left. The title mark is a
  palette. The title is **Tab Style**, and its line says what the view that is up sets: the home "Pick a look for the
  whole tab, then fine-tune any part of it.", and each Fine-tune panel its own few words (Colours "The colours every
  element on the tab draws in.", Finish "How every element on the tab is drawn.", Text "The tab's font, and the size
  new text starts at.", Canvas "The pattern and colours behind everything."). **Show Me**, the **help icon** and the
  close sit at the right. On a phone the band runs up under the sheet's grab handle.
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

The table is in the order the carousel shows them after the Mashup card, six to a page. The set is made for what a
design here is, wireframes and presentation pages: clean faces and quiet surrounds, a low-fidelity Wireframe look, a
Blueprint grid, and few enough that two pages hold them all (owner, 2026-11-19; the twenty-nine looks a diagram tool
offers read as noise on a design).

| Look        | Theme    | Finish       | Tab font      | Pattern     | Pattern strength |
| ----------- | -------- | ------------ | ------------- | ----------- | ---------------- |
| Everyday    | Default  | Flexible     | (none)        | Grid        | (kept)           |
| Blueprint   | Sky      | Professional | Roboto Mono   | Engineering | 50%              |
| Spectrum    | Rainbow  | Flexible     | Inter         | Grid        | 50%              |
| Wireframe   | Mono     | Sketch       | (none)        | Blank       | (kept)           |
| Boardroom   | Steel    | Professional | Inter         | Blank       | (kept)           |
| Workshop    | Sand     | Marker       | (none)        | Grid        | 60%              |
| Midnight    | Midnight | Professional | Space Grotesk | Blank       | (kept)           |
| Daydream    | Pastel   | Flexible     | Nunito        | Grid        | 60%              |
| Editorial   | Cream    | Professional | Lora          | Blank       | (kept)           |
| Lagoon      | Tropical | Flexible     | Space Grotesk | Lines       | 40%              |
| Graph Paper | Indigo   | Professional | Roboto Mono   | Graph       | (kept)           |

- **Multi-colour looks.** Three looks use a theme whose nodes take different colours: Spectrum (Rainbow), Daydream
  (Pastel) and Lagoon (Tropical) ([Multi-colour themes](multicolour-themes.md)). A dark-mode viewer sees each in its
  theme's dark half ([Light and dark halves](light-and-dark.md)).
- **Order.** The **Mashup** card leads the carousel (below), then the looks; Everyday is always the first look (it
  is what an untouched tab reads as). The rest follow a fixed, interleaved order written into the catalogue
  (`TAB_LOOKS`, never shuffled at runtime): every page holds one or two of the multi-colour looks, and no two
  neighbours on a page share a theme or a finish. `apps/live/lib/tab-looks.test.ts` locks both rules.
- **Retired looks.** The diagram looks that do not suit a design (Textbook, Whiteboard, Notebook, Seaside, Doodle,
  Poster, Engineer, Studio, Garden, Billboard, Patchwork, Northern Lights, Coffeehouse, Schematic, Flipchart,
  Sketchbook, Greenboard, Picnic, Mural, Field Notes, and Carnival before them) left the catalogue. Because a look is
  not stored, a tab that once picked one keeps its four settings and simply reads as its own mix (no card
  selected); nothing migrates.
- **Hand-drawn looks stay off finished art.** On a logo or a photo page the dialog leaves out the looks drawn by
  hand (Sketch and Marker: Wireframe and Workshop), since a logo or a photo is finished work (`suitsFinishedArt`).
  The Finish filter and the Finish panel still offer every finish.
- A look that sets a pattern strength sets it (a busy pattern toned down); the rest leave the tab's own strength.
- The looks sit in a **carousel**, six to a page (three columns, two on a phone), with arrows and page dots: the
  Mashup card and the eleven looks fill two pages. Looks are added six at a time, so every page stays full.
- **Marker** has Workshop, a wall to draw on; **Sketch** has Wireframe, the low-fidelity first pass.
- When the tab matches no look, no card is selected (there is no "Current" card for the tab's own mix).
- Each look is a card: a small sample diagram drawn in the look (the same sample and renderer as the Finish
  preview, on the look's own canvas colour and pattern, in the viewer's half of its theme), its name, and a line on what it is made of.
  The sample is coloured with its two boxes as separate branches, taking the palette's first and fourth colours
  (across the wheel: Rainbow's red and green, Tropical's teal and orange), and its arrow is put back on its pins
  after; so a multi-colour look's card shows two contrasting palette colours rather than the trunk neutral and one
  hue. Single-colour looks draw exactly as they would without it (`apps/live/lib/look-preview.ts`).
- Picking a look applies it as **one undo step**. The theme is applied exactly as picking that theme does
  (preserve-customs, or no element recoloured with Element Colours on Keep as They Are, see "Element colours"
  below), then the finish, font and pattern are set; an element's own finish or font still wins over the tab's.
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

| Season    | Look              | Theme     | Finish       | Tab font    | Pattern       | Pattern strength |
| --------- | ----------------- | --------- | ------------ | ----------- | ------------- | ---------------- |
| New Year  | Countdown         | Sparkle   | Professional | Bodoni Moda | Sparkles      | 70%              |
| Easter    | Egg Hunt          | Spring    | Flexible     | Nunito      | Eggs          | 70%              |
| Halloween | Haunted           | Pumpkin   | Marker       | (none)      | Cobwebs       | 70%              |
| Christmas | Christmas Morning | Yuletide  | Flexible     | Lora        | Candy Stripes | 30%              |
| Christmas | Winter Wonderland | Frost     | Sketch       | Kalam       | Snowflakes    | 80%              |
| Christmas | Fireside          | Evergreen | Professional | Roboto Slab | Drift         | 60%              |

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
  Every ingredient is curated, which keeps a mashup respectable; the mix is what makes it unique (about four thousand combinations, the design looks' quieter fonts and
  patterns keeping every mashup fit for a design).
- **Light and dark.** Any theme reads in both appearances ([Light and dark halves](light-and-dark.md)), so every
  mashup does too: a dark-mode viewer sees it in its theme's dark half, with the same contrast floor as the looks
  (`apps/live/lib/tab-looks-contrast.test.ts` checks a spread of seeded mashups in both halves).
- **Always new.** A roll that equals one of the named looks, or the mashup the card already shows, is rolled
  again (up to `MASHUP_REROLLS` times), so a press always changes the tab and never lands on a named look.
- **The card.** Like a look's card (the sample diagram drawn in the mashup, in the viewer's half), named **Mashup**
  with a dice badge, and a line naming its four ingredients the way a look's does ("Ocean, Sketch, Kalam, waves").
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

### Apply to All Tabs

Tabs drift apart in style over time, so the home ends with one grouped settings row, iOS style: **Apply to All Tabs**
(a brand icon tile, the title, and a line saying what it does: "Give the other N tabs this tab's colours, finish,
text and canvas."). It sits under Fine-tune, with a short note below the card: "Locked tabs keep their own style.
Undo puts every tab back."

- **What it copies:** the open tab's whole style onto every other tab of the design: its theme (applied as picking that
  theme does, so each tab's elements take the new colours and keep their own picks), and its canvas (pattern,
  colours, strength, scale, speed), its text defaults (font, size of new text) and its finish, set exactly as the
  open tab has them (a setting the open tab leaves unset is cleared on the others). Names, content and locks are
  untouched (`packages/workbench/src/lib/tab-style-to-all.ts`, `TAB_STYLE_KEYS`).
- **One change:** a single undo step restores every tab. No confirmation: the dialog applies live, and Undo is there.
- **Tabs not opened yet** are loaded first (the search sweep), so none is left out for being unopened. A tab whose
  content could not load keeps its style, as does a locked tab: neither is written. A toast says how many tabs took
  the style and which kept their own.
- **One tab:** the row is not shown: with one tab there is nothing to align.
- **Busy:** while the other tabs load, the row reads "Applying…" with a spinner and takes no second press.
- **Share roles:** an Editor of the whole design only. A Participant or Viewer never reaches the dialog, and an Editor
  in a tab-scoped session does not see the row (it would reach tabs outside their scope).
- **Telemetry:** `Tab` `Changed` `AllTabs`, once per press that styled any tab.

### Eased changes

Options do not preview on hover (tried and removed: the canvas changing under a passing pointer was distracting); a
click applies. Each pick **eases** the canvas's colours (background, fill, outline, text) over 250 ms instead of
snapping (`../packages/workbench/src/lib/tab-style-ease.ts`); the transition is switched on only for the moment of the change (a class on the
root, scoped to the canvas), so it costs nothing the rest of the time. Reduced motion snaps. On a busy canvas (more than 20 elements,
[Canvas performance](../008-canvas/canvas-performance.md) "A Tab Style change on a busy canvas eases the canvas, not its parts") the parts
snap too, the canvas's own colour still easing: easing every node of every element held a large board in long
frames a pick. The ease is then switched on on that canvas's surface alone, never the page's root, and the new colours are
worked out between frames and shown in one step, so a pick on a big board never holds the page
([Canvas performance](../008-canvas/canvas-performance.md#theme-pick-big-board) "A theme pick on a big board keeps the
page answering").

### Previews

The Text and Finish panels preview on a **sample frame** (`TabStylePreview`, `apps/live/lib/frame-preview.ts`): a
small UI screen (a title, a card, a button and the arrow between) on the background new pages start on (the paper
when the tab has none, and on a photo page), drawn by the page exporter in the tab's theme, finish and font, inside
the tab's surround colour. It is what a page of the tab will look like, and it is rebuilt only when one of those
changes. A look's card keeps the sample diagram (below).

### Text panel

The tab's typography ([Fonts](../004-interface-design/fonts.md)): a **preview** of the sample frame lettered in
the tab's font at the size new text takes; the **Typeface** specimen cards ("Aa" and the name in each face, with its
style), six to a carousel page (three to a row, two rows), "Editor default" first; and **Size of New Text** on the one
[Text Size](../004-interface-design/fonts.md#text-size) control (Scale, or a 6 to 48 px slider), the preview following the slider as
it moves. Picking a typeface or a size **applies to the whole tab at
once**: the tab's setting, and every element following it again (an element's own font is cleared, every
text-bearing element takes the size). There is no separate apply action.

### Finish panel

The tab's [Finish](../008-canvas/finish.md): a preview of the sample frame in the chosen finish, and the three
finishes as tiles with a 40 px icon each. Picking one applies to the whole tab at once (every element's own finish
cleared).

### New Page Background

The Canvas panel's place holds **New Page Background** (`NewPageBackgroundPanel`), the background every new page of
the tab starts on (`Tab.newPageBackground`, [Pages](../007-editor/pages-mode.md) "A new page's background"). Its
Fine-tune row reads it ("Like the page before", "Paper", a theme gradient's or a preset's name, "Solid colour",
"Custom gradient", "Animated", with ", dots" and so on for a pattern; on a photo page "Around the pages").

- **New pages start**: a segmented choice, **Like the Page Before** (the default, the field absent: a new page wears
  the background of the page before it) or **Choose One** (the field set; choosing it starts on the plain paper,
  `{}`).
- With **Choose One**, the page panel's own Background section (`BackgroundSection`), offering Solid, Gradient and
  Animated, never a picture (a picture is a page's own); on a logo page without a pattern, as the page panel. Each
  pick is one undo step and writes only the field: pages already made keep their own.
- **Apply to Every Page** under it gives every page of the tab that background, one undo step, each page re-inked
  for it; a logo page takes the fill alone, a photo page is passed by (it takes no background), a locked page keeps
  its own, and a notice says how many it reached and kept.
- **Around the Pages**, a small section: the canvas colour around the pages, and four calm patterns for it (Blank,
  Grid, Lines, Graph). The surround draws its pattern again, as the canvas does (the old rule that blanked it in
  Pages is gone).
- On a **photo page**, which is its picture, the panel says it takes no background and keeps only Around the Pages.
- The tab's other canvas settings (opacity, size, speed, the busy patterns) are no longer offered here; a tab keeps
  any it holds.
- A look or a theme change carries the field as it carries a page's fill: a fill of the old theme's own becomes the
  new theme's. Apply to All Tabs copies it.

### Colours panel

Every built-in theme in **one flat list**, nine to a carousel page (`ThemeBrowser`, shared with the palette accordion
and the [New-design](../007-editor/new-design-route.md) picker so they stay identical). No categories, no
shuffle. Each card previews the theme in the
viewer's half ([Light and dark halves](light-and-dark.md)).

- Clicking a theme applies it live; double-clicking applies and closes the dialog.
- There is no "reset elements to theme" action: picking a theme already moves every element still on the old
  theme's colours, and a colour someone chose is theirs.

### Element colours

A theme pick (or a look's theme) keeps every colour someone chose and moves every colour still on the old theme's to
the new one, **arrows included**: a design's hand-coloured connector is part of the design, so it is no longer reset
to the theme's stroke (livediagram's rule; owner, 2026-11-19). On the Looks home, under the carousel, **Element
Colours** asks what the next pick does to the elements already there:

- **Follow the Theme** (the default): the rule above.
- **Keep as They Are**: no element changes colour; the theme still sets the tab's backdrop, its pages' theme fills
  and the colours new elements take.

The choice is the tab's, stored on it as `keepElementColours` (`true` for Keep as They Are; absent, Follow the
Theme), so it lasts past the dialog, is saved with the tab and reaches everyone on the design as any tab style
change does (a `tab-meta` patch; the tab body is JSON, so no migration). Every theme or look pick on the tab follows
it, from the dialog or anywhere else a theme is picked, and Apply to All Tabs copies it with the rest of the style
(applying the source tab's theme to each tab under the source's choice). Changing it is one undo step, offered only
to someone who may change the tab's style (an Editor, on a tab that is not locked: the dialog is not offered to a
read-only person, and the setter refuses while edits are blocked, as every tab style setter does), and is tracked as
`UI / Changed / TabStyleElementColours`. `withThemeApplied(tab, id, appearance, { keepElementColours })` and
`withLookApplied(tab, look, { keepElementColours })` carry it (`apps/live/lib/tab-theme-apply.ts`, `tab-looks.ts`).
Import keeps an imported tab's choice.

### Formal themes / per-shape colours

A **Formal** theme colours each shape **kind** by its conventional meaning, so a diagram reads as a standard notation at a glance. UML was the one Formal theme, and it is livediagram's alone: this product retired it (owner, 2026-11-12, Work Item 696; [Retired colour schemes](retired-schemes.md#uml)), so no theme picker, Mashup or agent schema here offers it, and a tab saved on it opens on Mono.

- The mechanism stays in the shared theme engine (`@liveworkspace/element-model/themes`): a theme may define `shapeColors?: Partial<Record<ShapeKind, { fill?; stroke?; text? }>>`, which win over the single `elementFill` / `-Stroke` / `-Text` for that kind, resolved through the same `elementThemeView` path as the multi-colour branch colours. No theme this product offers defines it.
- UML's definition stays in the shared catalogue data (`@liveworkspace/element-model/themes-data`) because livediagram still offers it; this product's `THEMES` leaves it out.

## Editor chrome follows the active theme

The editor chrome **follows the active tab's theme** so it matches the diagram you're editing, in two ways. Both the brand accent and the neutral slate surfaces are Tailwind v4 CSS variables (`--color-brand-50..950`, `--color-slate-*`), so `useEditorAccent` retargets those variables for the editor session by injecting one `<style>` element:

- **Accent (both modes).** The active theme's accent (its `elementStroke`) is spun into an 11-stop ramp anchored at `600` (a pale dark-theme stroke is darkened first so white-on-`600` keeps contrast) and emitted as `html:root { --color-brand-* }`, so every `brand-*` utility (buttons, rings, focus outlines) takes the theme colour.
- **Dark mode (a darker version of the theme).** Plain dark mode is the blue-slate dark palette. The hook also emits `html.dark { --color-slate-600..950 }`, a muted-then-shaded ramp of the theme hue (the accent pulled toward neutral slate so it's a tint, not a garish saturated dark), so dark-mode panels / borders / deep backgrounds read as a dark version of the chosen theme. Only the surface stops (600–950) are retargeted; the lighter stops stay neutral so dark-mode text keeps its readable greys. The override is `.dark`-scoped, so CSS handles the mode switch with no JS detection.
- **The tint outranks the base by selector.** Dark mode's own palette ([Colour scheme](../004-interface-design/color-scheme.md#dark-palette-steel)) also retargets `--color-brand-*` and the surface stops under `.dark`, so the hook's rules are written as `html:root` (brand) and `html.dark` (surfaces): one element-type step more specific than the base, so the theme's tint wins whatever order the stylesheets load in.
- The `<style>` lives in `<head>` so body-portaled UI (context menus, dialogs, popovers, toasts) inherits both. The **Default** (`brand`) scheme and an unthemed tab have no `elementStroke`, so nothing is injected: the built-in brand stands (sky in light mode, Steel in dark) on the built-in surfaces. Switching tabs re-resolves it; leaving the editor removes the `<style>` so the rest of the app (Explorer, marketing) keeps the defaults.
- The header, the tab bar and the logo opt out ([The app's chrome](#the-apps-chrome)).
- Only the chrome retargets: element colours come from the theme applied to the elements themselves ([Multi-colour (rainbow) themes](multicolour-themes.md)), unaffected.

## The app's chrome

A tab's style tints the canvas side of the editor, never the app around it: the **header, the tab bar and the logo
keep the app's own colours** whatever the active tab's style. The logo takes no colour from the tab, and the header
and tab bar carry `data-app-chrome`, which re-declares the app's brand ramp (light and dark) and dark-mode surfaces
from its theme (the surfaces from `../packages/tailwind-config/theme.css`, the ramp from this product's `packages/tailwind-config/theme.css`), so the tint from `useEditorAccent` stops at their edge.
Custom properties inherit, so the re-declaration on the element wins over the root's tint without any selector
contest. A test (`theme-budget.test.ts`) keeps the block equal to `@theme` and `.dark`. Menus and popovers opened
from them are portaled to the body, so they follow the tab like the rest of the editor's panels.

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

## One dialog, this editor's profile

The dialog is the one every editor shares ([Tab Style dialog](../../../../liveworkspace/docs/specs/011-workbench/tab-style.md), in `@liveworkspace/workbench`):
`apps/live/components/dialogs/CanvasThemeDialog.tsx` hands it this editor's profile
(`apps/live/components/dialogs/tab-style-profile.tsx`), and the profile decides what it shows. The editor names the
**surface** as it opens the dialog; every surface here takes the profile's base, so the dialog is as this page
describes it on each.

- **Surfaces.** The kind of the page someone is on (`useCurrentPageKind`): `wireframe`, `logo` or `photo`, and
  `canvas` for a page nobody has chosen a kind for.
- **Panels and controls.** All four panels, every control, on every surface.
- **Looks.** Every look in `apps/live/lib/tab-looks.ts`; on `logo` and `photo`, those not drawn by hand
  (`lookFilter: suitsFinishedArt`).
- **Canvas panel.** New Page Background (`NewPageBackgroundPanel`, above), titled so; its row's value from
  `newPageBackgroundLabel`. On a photo page, Around the Pages alone.
- **Home extra.** Element Colours (`ElementColoursRow`, `renderHomeExtra`), between the looks and Fine-tune.
- **Preview.** The sample frame (`TabStylePreview`, `apps/live/lib/frame-preview.ts`), in the Finish and Text panels.
- **Copy.** The shared lines, but the home's ("Pick a look for the tab’s pages, then fine-tune any part of it.") and
  the Canvas panel's ("The background new pages start on, and the canvas around the pages.").
- **The door.** `CanvasThemeDialog` takes `pages` (`TabStylePages`, `tab-style-pages.ts`: the kind, the field, the
  pages Apply to Every Page reaches and its setters, and the tab's Element Colours choice with its setter), and hands
  that choice to every theme and look it applies.
- **Frame.** The shared modal, its Show Me bound in `apps/live/components/tour/TabStyleTour.tsx`.

## Reuse notes

- `CanvasStyleControls`: pattern grid + colour swatches + opacity slider. Rendered by the palette's Canvas accordion.
- `BackgroundSection`: the page panel's Background section, rendered again by New Page Background (`only`).
- `ThemeBrowser`: the flat, paged theme list. Rendered by the palette accordion, the New-design picker and the dialog's Colours panel.
- `PagedCarousel`: the carousel (arrows, page dots, nine or six to a page) the looks, themes, typefaces and patterns share. Shared from `@liveworkspace/workbench`
  (`packages/workbench/src/components/primitives/PagedCarousel.tsx`). Every page keeps its slot in the strip (so
  swiping, snapping and the dots work as before), but only the page on show and its two neighbours **mount their
  tiles**, so a slide always has the next page drawn and the dialog never builds the far pages' tiles. A move by the
  dots keeps every page it slides past mounted until it arrives, and a page holding keyboard focus stays mounted, so
  focus is never dropped. A page whose tiles are not mounted is an empty slot hidden from screen readers; each mounted
  page is a group named "<Label> page N of M", and the dots still say which page is current. The strip keeps the
  tallest mounted page's height, so mounting a page never moves the layout.
- On a screen wider than a phone (640 px and up), the dialog is a **popover flying out of the Theme & canvas button**: its
  bottom-right corner sits 8 px above the button, its right edge on the bottom-right cluster's (the right of the zoom
  controls, so it sits as far right as the cluster and covers as little of the work as it can), and it grows from that corner (the long motion
  token's `fly-up-in`; a fade alone with reduced motion), at most as tall as the room above the button. Without the
  button on screen it is the centred dialog. On a phone it is a **bottom sheet**, as the editor's other phone sheets
  are: the screen's width, rising from the bottom edge (`sheet-up`), at most 75% of the screen tall so the canvas stays
  in view above it, with the shared grab handle that drags it taller or down to close.
- The dialog follows the existing modal contract (`Portal` + `useEscape` + a full-screen click-catcher, see `SettingsDialog`), but with **no dimming / blur backdrop**: because every control applies live, the catcher is left transparent so the user can watch the canvas background + theme update behind the dialog as they click. The catcher still closes on an outside click and swallows pointer / right-click events so an edit doesn't leak to the canvas while it's open.
