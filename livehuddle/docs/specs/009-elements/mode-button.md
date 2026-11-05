# Selection Mode button

A canvas element that looks like a button and, when pressed, **switches whoever pressed it into [Avatar mode](../008-canvas/avatar-mode.md)**. In livehuddle Avatar is the one mode a button hands out: the Select, Hand, Eraser and Format buttons are gone (see [Only Avatar](#only-avatar)).

## Why

A Space can be walked around, but that mode lives behind a picker in the palette, which means explaining it. A button ON the canvas turns that into an invitation: put "Walk with me" next to the title of a walkthrough document and a visitor who has never opened the mode picker can join in with one click. It is the same instinct as the Quick Start templates: put the affordance where the user already is.

It is how people get into a Space, which is why its tile sits in the palette's **Travel** category beside the Portal, Bring Focus and the Avatar Pad.

## The element

- A **shape kind**, `mode-button`, rather than a new element type: exactly the call [The Page element](page-element.md) made for the Page. It inherits everything a shape already has: label, colours, border, shadow, resize, rotation, groups, comments, actions, export.
- It looks like a **button**, not a labelled box: a square-ish 104x96 tile, rounded, with the **mode's glyph in a chip ABOVE the label** and a hairline highlight along the top edge: the shape a toolbar button has. The face itself is **untinted**: the element's own fill is the button, so an author's colour comes through instead of being muddied by a gradient wash. Unstyled, it wears a **button skin that follows the paper**: a white card with a hairline border and dark text on a light canvas, a raised slate card with light text on a dark one (`behaviourSkin` in `packages/document/src/colors.ts`). The skin is the kind's DEFAULT, not a stored colour, so the same button reads right to a viewer in light mode and one in dark mode, and a tab theme's element colours apply to it like to any shape. An author's own colour, picked from the menu, is stored and wins. The session button (the timer, vote and poll), the picker, the reveal cover and the chair follow the same rule. They were once created with the light skin stamped on as stored colours, which left them white on a dark canvas; an element still carrying exactly that stamped skin (or the pre-redesign white-on-blue) reads as unstyled (`ownColours` in `packages/document/src/behaviour-skin.ts`), on the canvas and in exports.
- **Fixed size.** It is a control, not a box you draw: `FIXED_SIZE_SHAPES` in `packages/document` suppresses its resize handles, keeps it at its natural size through a union resize, and ignores the drag dimensions when it is drawn. Rotation, colours, and every other element affordance stay.
- Hover brightens it and a press scales + sinks it. Hover is **desktop-only**: a touch device has no hover, and a sticky `:hover` after a tap reads as a stuck button.
- **The face text is derived: "Switch to Avatar".** It carries no default label, so the face names what it does without an author typing it. An author who types their own label wins: it is still a shape's label, and an empty one falls back to the derived text, so a button is never blank.
- **A button for the mode you are already in is the way back out.** It reads "Leave Avatar" (whatever its own label: a "Walk In" that walked you out would say the opposite of what it does) and presses you into the tool you were in before, rather than sitting there disabled. On a read-only walkthrough the button can be the only control on screen, so a one-way door would strand the viewer.
- The tile's hover card also explains what Avatar mode does, since the author's label ("Walk with me") doesn't have to.
- Which mode it hands out lives in **`ShapeElement.mode`** (a `SelectionMode`, which in livehuddle is only `'avatar'`). Absent means `DEFAULT_BUTTON_MODE` (`'avatar'`), so a button authored without one, or by an older client, still does the thing it looks like it should.

## Pressing it

- A **left-click presses it**, switching the clicker's own canvas tool. Nobody else's mode changes: it is a control for the person who clicked, not a broadcast. The hover card says so.
- **It hands out its mode in any editor mode.** For Avatar it is the only way in: the palette picker, the keyboard and search do not offer Avatar ([Avatar mode](../008-canvas/avatar-mode.md) "Where it lives").
- It routes through the **same tool setter the palette picker uses**, so the mode's own rules all still apply: telemetry, the selection clear on entering Avatar, and the empty-canvas guard.
- **Dragging it moves it, and does NOT press it.** The face fires on `click`, never on pointer-down, and swallows that click when the pointer travelled more than a wobble between press and release (`usePressWithoutDrag`), because a drag on an element still ends in a browser `click` event.
- **A button that hands out Avatar mode spawns the character at the button**, just below it (the whole figure clear of the button, so its label stays readable), rather than at the viewport centre: you pressed a thing on the canvas, so the character should appear where you pressed it. An [Avatar Pad](avatar-pad.md) on the tab wins over the button: everyone starts on the pad.
- **It stays pressable inside a pointer-inert mode.** Avatar makes the canvas layer ignore pointers; a mode button keeps `pointer-events: auto` so it still works. Without that, the button would be unreachable from the very mode it is the way out of (it reads "Leave Avatar" while you walk). Right-clicking a button in those modes likewise still opens its element menu (the canvas / tab menu stays suppressed), so it can be reconfigured mid-walk.
- **Read-only surfaces**: the embed ([Read-only embeds (`/embed`)](../013-workspace/embeds.md)) has no tool picker to drive, so it renders the face inert rather than pretending.

## Configuring it

In the palette it is **Avatar Button**, in the meeting palette's **Travel** category (`tileGroup: 'travel'`), after the Avatar Pad: the pieces that take people somewhere ([The Space categories](../010-palette/palette-top-level-categories.md#the-space-categories)). The tile's internal id, `tools:mode-avatar`, is unchanged: palette layouts and search address tiles by id.

There is nothing to configure beyond what every shape has (label, colours, border). The element menu has no **Button** section: with one mode there is no choice to offer.

## Only Avatar

The palette once had a **Selection Mode** category (bar name "Modes") with one button per mode: Avatar, Select, Hand, Eraser and Format, and the element menu's **Button** section re-pointed a button at any of them. livehuddle is a meeting product: the button that matters is the one that walks people into a Space, and a control bar of tool buttons was a builder's idea that the Selection Mode picker already covers. So the category is gone, the Avatar button moved to Travel, and `SELECTION_MODES` is `['avatar']`.

**Old documents still load.** A button saved with `mode: 'select'`, `'pan'`, `'eraser'` or `'format'` loads with the field dropped, the same way the retired modes before them did, and reads as the default mode: it becomes an Avatar button. The **Highlighter** was a mode while it was held; it is a Draw tile now ([Highlighter](../008-canvas/highlighter.md)), so a button saved with `mode: 'highlighter'` loads the same way. The Laser, the Spotlight and Isometric left livehuddle earlier ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-presenting-tools-isometric-and-zen)): a button saved with `mode: 'laser'`, `'spotlight'` or `'isometric'` loads with the field dropped too. The drop runs where stored elements enter (`migrateLegacyModeButtons`), before validation, so none of these takes its tab down with it.

## Model + validation

- `SelectionMode` and `SELECTION_MODES` live in `packages/document` (`selection-mode.ts`), not the editor: the vocabulary is DATA a saved element carries, so validation has to reach it. The editor's `CanvasTool` is the same vocabulary on the UI side.
- `isValidElement` **rejects** an unknown `mode` rather than coercing it (a stored retired mode never reaches it: the load migration drops it first). A junk value is a broken write, and the element still renders without one (absent = Avatar), so silently rewriting someone's configured mode would be the worse failure. Contrast `coerceShapeKind`, which does coerce: an unknown _kind_ would otherwise draw nothing at all.

## Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md): adding one emits `Element·Added·ModeButton` (spelled that way, not `Mode-button`, for the same reason `CodeBlock` is: a hyphen would split one feature across two dashboard tokens, and the coverage test in `apps/editor/lib/palette-telemetry-coverage.test.ts` enforces it). Pressing one reports as the mode it hands out (`Canvas·Used·<Mode>`) through the shared setter: a press IS picking that mode, so it belongs in the same bucket rather than a separate one.

## Implementation shape

- **`packages/document`**: `selection-mode.ts` (vocabulary + default + guard); `'mode-button'` in the `ShapeKind` union, `SHAPE_KINDS`, and `SHAPE_DEFAULT_SIZE`; the `mode` field on `ShapeElement`; the `createShape` branch; the `mode` check in `validate.ts`; `Mode Button` in `element-kind-label.ts`. Unit-tested.
- **`apps/editor/components/canvas/ModeButtonFace.tsx`**: the pressable face (glyph + label + hover card), and the `MODE_LABEL` map the element menu also reads.
- Wiring, one small edit each: `ElementFaceRouter` (render the face instead of a plain label), `CanvasElementsLayer` + `Canvas.types` + `EditorCanvasHost` (thread the press to the tool setter, and the viewer's current mode down for the Leave state), `shape-svg-overlay.tsx` (the kind renders on the CSS box path; the SVG overlay has no case for it and would draw a transparent box), `lib/themes.ts` (projects a tab theme's element colours onto it like any shape), `palette-tile-defs.tsx` (the tile, in the Travel group), `legacy-mode-buttons.ts` (the load migration), `element-telemetry.ts` (the token), `draw-mode.ts` (spell a hyphenated kind out in the draw banner).

## Out of scope

- Buttons that do anything OTHER than switch a mode (open a tab, run a layout, start a poll). The element is named for what it does; a general action button is a bigger design question.
- Pressing a button FOR someone else, or a presenter forcing a mode on the room. Modes stay personal.
- Walking an Avatar character onto a button to press it: tempting, and a natural follow-up.
- A styling preset that makes a button look like the app's own buttons; it inherits shape styling like everything else.
