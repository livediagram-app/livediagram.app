# Selection Mode button

A canvas element that looks like a button and, when pressed, **switches whoever pressed it into a selection mode**. Which mode is configurable; it defaults to the **Laser**.

## Why

A document can be lasered over, spotlit, or tilted — but every one of those modes lives behind a picker in the palette, which means explaining it. A button ON the canvas turns that into an invitation: put "Point things out" next to the title of a walkthrough document and a visitor who has never opened the mode picker can join in with one click. Put the affordance where the user already is.

It also gives a presenter somewhere to put a control bar — a row of buttons that hand the room a laser, a spotlight, or the isometric view.

## The element

- A **shape kind**, `mode-button`, rather than a new element type. It inherits everything a shape already has: label, colours, border, shadow, resize, rotation, layers, comments, actions, export.
- It looks like a **button**, not a labelled box: a square-ish 104x96 tile, rounded, with the **mode's glyph in a chip ABOVE the label** and a hairline highlight along the top edge — the shape a toolbar button has. The face itself is **untinted**: the element's own fill is the button, so an author's colour comes through instead of being muddied by a gradient wash. Unstyled, it wears a **button skin that follows the paper**: a white card with a hairline border and dark text on a light canvas, a raised slate card with light text on a dark one (`behaviourSkin` in `packages/document/src/colors.ts`). The skin is the kind's DEFAULT, not a stored colour, so the same button reads right to a viewer in light mode and one in dark mode, and a tab theme's element colours apply to it like to any shape. An author's own colour, picked from the menu, is stored and wins. A button still carrying exactly the light skin stamped on as stored colours (or the pre-redesign white-on-blue) reads as unstyled (`ownColours` in `packages/document/src/behaviour-skin.ts`), on the canvas and in exports.
- **Fixed size.** It is a control, not a box you draw: `FIXED_SIZE_SHAPES` in `packages/document` suppresses its resize handles, keeps it at its natural size through a union resize, and ignores the drag dimensions when it is drawn. Rotation, colours, and every other element affordance stay.
- Hover brightens it and a press scales + sinks it. Hover is **desktop-only** — a touch device has no hover, and a sticky `:hover` after a tap reads as a stuck button.
- **The face text is derived: "Switch to Laser".** It carries no default label, so re-pointing a button at another mode relabels it instead of leaving yesterday's copy on it. An author who types their own label wins — it is still a shape's label — and an empty one falls back to the derived text, so a button is never blank.
- **A button for the mode you are already in is the way back out.** It reads "Leave Laser" (whatever its own label: a "Point things out" that put the laser down would say the opposite of what it does) and presses you into the tool you were in before, rather than sitting there disabled. On a read-only walkthrough the button can be the only control on screen, so a one-way door would strand the viewer.
- Every mode's hover card also explains what that mode does, since the author's label ("Point things out") doesn't have to.
- Which mode it hands out lives in **`ShapeElement.mode`** (a `SelectionMode`). Absent means `DEFAULT_BUTTON_MODE` — `'laser'`, the mode a presenter most often hands the room — so a button authored without one, or by an older client, still does the thing it looks like it should. A button carrying a mode livepages does not have, such as `'avatar'` from a livediagram document, presses as the default too (`buttonMode`).

## Pressing it

- A **left-click presses it**, switching the clicker's own canvas tool. Nobody else's mode changes: it is a control for the person who clicked, not a broadcast. The hover card says so.
- It routes through the **same tool setter the palette picker uses**, so the mode's own rules all still apply: telemetry, the selection clear on entering Spotlight, and the empty-canvas guard.
- **Dragging it moves it, and does NOT press it.** The face fires on `click`, never on pointer-down — and swallows that click when the pointer travelled more than a wobble between press and release (`usePressWithoutDrag`), because a drag on an element still ends in a browser `click` event.
- **It stays pressable inside a pointer-inert mode.** Spotlight and Isometric both make the canvas layer ignore pointers; a mode button keeps `pointer-events: auto` so it still works. Without that, a button offering "Select" would be unreachable from the very mode a user most wants out of, and a presenter's control bar would be a one-way door. Right-clicking a button in those modes likewise still opens its element menu (the canvas / tab menu stays suppressed), so it can be reconfigured mid-presentation.
- **Read-only surfaces**: the embed ([Read-only embeds (`/embed`)](../013-workspace/embeds.md)) has no tool picker to drive, so it renders the face inert rather than pretending.

## Configuring it

Its tiles are **Selection Mode**, one per mode, in the **Behaviour** group (`toolGroup: 'behaviour'`): elements that DO something when someone interacts with them, rather than elements that say something. No Pages palette layout lists that group.

Right-click the button → **Button**: a "Switches the presser to" tile grid of all six modes (Select, Hand, Laser, Spotlight, Format, Isometric), the current one marked active. Tiles rather than a list so the icons match the palette's own mode picker.

The full set is deliberate. A button that hands someone the Format painter is an odd thing to build, but the author picks from a menu that names each one, and forbidding it would be us second-guessing a document we can't see. A button saved with a mode livepages does not have (`'avatar'`, `'eraser'`, `'highlighter'` from livediagram) presses as the default.

## Model + validation

- `SelectionMode` and `SELECTION_MODES` live in `packages/document` (`selection-mode.ts`), not the editor: the vocabulary is DATA a saved element carries, so validation has to reach it. The editor's `CanvasTool` is the same vocabulary on the UI side.
- `isValidElement` **rejects** an unknown `mode` rather than coercing it. A junk value is a broken write, and the element still renders without one (absent = Laser), so silently rewriting someone's configured mode would be the worse failure. Contrast `coerceShapeKind`, which does coerce — an unknown _kind_ would otherwise draw nothing at all.

## Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md): adding one emits `Element·Added·ModeButton` (spelled that way, not `Mode-button`, for the same reason `CodeBlock` is — a hyphen would split one feature across two dashboard tokens, and the coverage test in `apps/live/lib/palette-telemetry-coverage.test.ts` enforces it). Re-pointing one at another mode emits `Element·Changed·ModeButton`. Pressing one reports as the mode it hands out (`Canvas·Used·<Mode>`) through the shared setter — a press IS picking that mode, so it belongs in the same bucket rather than a separate one.

## Implementation shape

- **`packages/document`**: `selection-mode.ts` (vocabulary + default + guard); `'mode-button'` in the `ShapeKind` union, `SHAPE_KINDS`, and `SHAPE_DEFAULT_SIZE`; the `mode` field on `ShapeElement`; the `createShape` branch; the `mode` check in `validate.ts`; `Mode Button` in `element-kind-label.ts`. Unit-tested.
- **`apps/live/components/canvas/ModeButtonFace.tsx`** — the pressable face (glyph + label + hover card), and the `MODE_LABEL` map the element menu also reads.
- Wiring, one small edit each: `ElementFaceRouter` (render the face instead of a plain label), `CanvasElementsLayer` + `Canvas.types` + `EditorCanvasHost` (thread the press to the tool setter, and the viewer's current mode down for the Leave state), `shape-svg-overlay.tsx` (the kind renders on the CSS box path; the SVG overlay has no case for it and would draw a transparent box), `lib/themes.ts` (projects a tab theme's element colours onto it like any shape), `palette-tile-defs.tsx` (the tile + the Behaviour group), `ElementDataSections` + `ElementAppearanceSections` + `EditorContextMenu.types` + `EditorContextMenuHost` (the Button section), `useDataShapeSetters` (the `mode` patch), `element-telemetry.ts` (the token).

## Out of scope

- Buttons that do anything OTHER than switch a mode (open a tab, run a layout). The element is named for what it does; a general action button is a bigger design question.
- Pressing a button FOR someone else, or a presenter forcing a mode on the room. Modes stay personal.
- A styling preset that makes a button look like the app's own buttons; it inherits shape styling like everything else.
