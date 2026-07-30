# 103 — Selection Mode button

Status: **implemented**.

A canvas element that looks like a button and, when pressed, **switches whoever pressed it into a selection mode**. Which mode is configurable; it defaults to **Avatar** ([spec/101](101-avatar-mode.md)).

## Why

A diagram can now be walked around, lasered over, spotlit, or tilted — but every one of those modes lives behind a picker in the palette, which means explaining it. A button ON the canvas turns that into an invitation: put "Walk with me" next to the title of a walkthrough diagram and a visitor who has never opened the mode picker can join in with one click. It is the same instinct as the Quick Start templates: put the affordance where the user already is.

It also gives a presenter somewhere to put a control bar — a row of buttons that hand the room a laser, a spotlight, or a character.

## The element

- A **shape kind**, `mode-button`, rather than a new element type — exactly the call [spec/100](100-page-element.md) made for the Page. It inherits everything a shape already has: label, colours, border, shadow, resize, rotation, layers, groups, comments, actions, export.
- It looks like a **button**, not a labelled box: a square-ish 104x96 tile, rounded, **bold white text on a solid brand fill with a soft lift** (spec/86), with the **mode's glyph ABOVE the label** — the shape a toolbar button has. Those are ELEMENT colours, so they behave like any user-picked colour and are changeable from the menu, and the kind is **exempt from the backdrop-derived colour projection** (like a Page) because tinting a control with the diagram's node colours is exactly what made the first version read as "one more box with words in it".
- Hover brightens it and a press scales + sinks it. Hover is **desktop-only** — a touch device has no hover, and a sticky `:hover` after a tap reads as a stuck button.
- **The face text is derived: "Switch to Avatar".** It carries no default label, so re-pointing a button at another mode relabels it instead of leaving yesterday's copy on it. An author who types their own label wins — it is still a shape's label — and an empty one falls back to the derived text, so a button is never blank.
- **A button offering the mode you are already in is disabled**: the face dims, stops taking clicks, and the tooltip says "Already in Avatar" rather than leaving a live-looking control that does nothing.
- Every mode's tooltip also explains what that mode does, since the author's label ("Walk with me") doesn't have to.
- Which mode it hands out lives in **`ShapeElement.mode`** (a `SelectionMode`). Absent means `DEFAULT_BUTTON_MODE` — `'avatar'` — so a button authored without one, or by an older client, still does the thing it looks like it should.

## Pressing it

- A **left-click presses it**, switching the clicker's own canvas tool. Nobody else's mode changes: it is a control for the person who clicked, not a broadcast. The tooltip says so.
- It routes through the **same tool setter the palette picker uses**, so the mode's own rules all still apply: telemetry, the selection clear on entering Avatar / Spotlight, and the empty-canvas guard.
- **Dragging it still moves it.** The face fires on `click`, not on pointer-down, so an author can reposition a button without pressing it.
- **It stays pressable inside a pointer-inert mode.** Avatar, Spotlight, and Isometric all make the diagram layer ignore pointers; a mode button keeps `pointer-events: auto` so it still works. Without that, a button offering "Select" would be unreachable from the very mode a user most wants out of, and a presenter's control bar would be a one-way door. Right-clicking a button in those modes likewise still opens its element menu (the canvas / tab menu stays suppressed), so it can be reconfigured mid-walk.
- **Read-only surfaces**: the embed ([spec/33](33-embeds.md)) has no tool picker to drive, so it renders the face inert rather than pretending.

## Configuring it

In the palette it is **Selection Mode**, in the Tools tab's **Behaviour** group — the group for elements that DO something when someone interacts with them, rather than elements that say something. (The tile's internal id is unchanged: ids are persisted in saved favourites, so renaming one would silently drop it for anyone who had favourited it.)

Right-click the button → **Tools › Button**: a "Switches the presser to" tile grid of all eight modes (Select, Hand, Laser, Spotlight, Avatar, Eraser, Format, Isometric), the current one marked active. Tiles rather than a list so the icons match the palette's own mode picker.

The full set is deliberate. A button that hands someone the Eraser is an odd thing to build, but the author picks from a menu that names each one, and forbidding it would be us second-guessing a diagram we can't see.

## Model + validation

- `SelectionMode` and `SELECTION_MODES` live in `packages/diagram` (`selection-mode.ts`), not the editor: the vocabulary is DATA a saved element carries, so validation has to reach it. The editor's `CanvasTool` is the same vocabulary on the UI side.
- `isValidElement` **rejects** an unknown `mode` rather than coercing it. A junk value is a broken write, and the element still renders without one (absent = Avatar), so silently rewriting someone's configured mode would be the worse failure. Contrast `coerceShapeKind`, which does coerce — an unknown _kind_ would otherwise draw nothing at all.

## Telemetry

Per [spec/22](22-telemetry.md): adding one emits `Element·Added·ModeButton` (spelled that way, not `Mode-button`, for the same reason `CodeBlock` is — a hyphen would split one feature across two dashboard tokens, and the coverage test in `apps/live/lib/palette-telemetry-coverage.test.ts` enforces it). Re-pointing one at another mode emits `Element·Changed·ModeButton`. Pressing one reports as the mode it hands out (`Canvas·Used·<Mode>`) through the shared setter — a press IS picking that mode, so it belongs in the same bucket rather than a separate one.

## Implementation shape

- **`packages/diagram`**: `selection-mode.ts` (vocabulary + default + guard); `'mode-button'` in the `ShapeKind` union, `SHAPE_KINDS`, and `SHAPE_DEFAULT_SIZE`; the `mode` field on `ShapeElement`; the `createShape` branch; the `mode` check in `validate.ts`; `Mode Button` in `element-kind-label.ts`. Unit-tested.
- **`apps/live/components/canvas/ModeButtonFace.tsx`** — the pressable face (glyph + label + tooltip), and the `MODE_LABEL` map the element menu also reads.
- Wiring, one small edit each: `BoxedElementView` (render the face instead of a plain label), `CanvasElementsLayer` + `Canvas.types` + `EditorCanvasHost` (thread the press to the tool setter, and the viewer's current mode down for the disabled state), `shape-svg-overlay.ts` (the kind renders on the CSS box path — left on the SVG path it drew a TRANSPARENT box, since the overlay has no case for it, which is why the first version had no fill at all), `lib/themes.ts` (exempt from the colour projection), `palette-tile-defs.tsx` (the tile + the Behaviour group), `ElementDataSections` + `ElementAppearanceSections` + `EditorContextMenu.types` + `EditorContextMenuHost` (the Button section), `useDataShapeSetters` (the `mode` patch), `element-telemetry.ts` (the token), `draw-mode.ts` (spell a hyphenated kind out in the draw banner).

## Out of scope (v1)

- Buttons that do anything OTHER than switch a mode (open a tab, run a layout, start a poll). The element is named for what it does; a general action button is a bigger design question.
- Pressing a button FOR someone else, or a presenter forcing a mode on the room. Modes stay personal.
- Walking an Avatar character onto a button to press it — tempting, and a natural follow-up.
- A styling preset that makes a button look like the app's own buttons; it inherits shape styling like everything else.
