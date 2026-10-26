# Quick style panel: style memory and quick swatches

liveplanner mounts **no quick style panel**: Plan shows no palette, and a tab is worked by its boards, sheets and
dashboards, each with its own tools. What this spec governs is the machinery the element menu shares with that panel's
design: **style memory** (the next element of a kind arrives dressed like the last), **quick-swatch bindings** (a
colour that follows the theme by its slot), the **floating-panel presence** signal the chrome places itself by, and
**Clear Styles**.

## Where it sits

Nowhere: no panel is mounted, on any device, so nothing sits on the canvas's left edge and nothing there takes a press
meant for the canvas or a frame. The element context menu ([Canvas and palette](canvas-and-palette.md#selection-popover))
holds every style choice.

### Collisions

The chrome that places itself around the floating panels (the Map, Collaborate, popovers) measures again when a panel
arrives or leaves with no gesture of its own: the Map arriving with the canvas's first content, Collaborate when
someone joins. A panel announces it with `announcePanelPresence()`
(`../packages/workbench/src/lib/panel-presence.ts`), a window event named by the product's `panelPresenceEvent`
binding (`PANEL_PRESENCE_EVENT`, `liveplanner:panel-presence`, in `apps/editor/lib/workbench-keys.ts`). Placement is
recomputed then, and when the chrome moves or resizes; never on a timer, and never while the chrome is still.

## Colours

`packages/project/src/quick-swatches.ts` derives seven **theme-relative** colours per colour row (stroke, fill, text):

- **First, the theme default**: the colour the theme gives a new shape.
- **Then six from the theme's own palette.** A multi-colour theme has six branch colours, used as they are: branch
  strokes for stroke, the matching branch fills for fill. A single-accent theme's one hue is spun into six (red,
  orange, yellow, green, blue and violet), each in the accent's own saturation and lightness, clamped so a grey accent
  still yields colour and a near-black one still yields visible strokes. The six run in the same order everywhere, so
  slot 4 means green on every theme.
- **Text colours are readable on the canvas**: each is stepped darker (or lighter, on dark paper) until it reads at
  4.5:1 against the canvas. A derived stroke is stepped until it reads at 3:1, and a derived fill is a wash of its hue
  thinned until the theme's label colour reads at 4.5:1 on it.

**A bound colour follows the theme.** An element can store the slot its colour came from beside the colour
(`strokeSwatch` / `fillSwatch` on a shape, `strokeSwatch` on an arrow, `textSwatch` on text, each 1 to 6;
`packages/project/src/element-types.ts`, `arrow-types.ts`). A theme change re-derives a bound colour from the new
theme's same slot (`rederiveQuickSwatches`, `quick-swatch-rederive.ts`, run last by `theme-graph.ts`), so a shape on
"green" stays green in the new theme's tone; an arrow keeps a bound colour the same way instead of snapping back to
the theme stroke. `validate.ts` accepts a slot of 1 to 6 or none, and drops anything else without failing the element.

liveplanner's editor writes no binding: its pickers set colours by value. A binding arrives with an element (an
import, a paste) and is **dropped the moment the colour is set any other way** (a picker, a preset, reset to theme,
Clear Styles: `useShapeStyleSetters.ts`, `style-presets.ts`, `reset-colours.ts`), because the slot no longer
describes it.

## Custom swatches

The `quickSwatchOverrides` user preference (per-theme replacements for the six slots) stays in the
`UserPreferences` type, marked dead, so stored blobs load; nothing reads or writes it
([User preferences](../007-editor/user-preferences.md)). Custom colours are the project's
([Colour picker](../004-interface-design/colour-picker.md)).

## Style memory

Changing a style field through the element menu remembers it for the next element of the same kind the user makes
(`apps/editor/lib/style-memory.ts`, pure; `hooks/canvas/useStyleMemory.ts`, its state and storage).

- **Per kind.** A shape's fields are remembered per `ShapeKind` (`shape:<kind>`): a circle's carry to the next
  circle, not to a square. A kind means something in a notation, so remembering across kinds would restyle shapes
  that mean something else.
- **Arrows separately**, one bucket for every arrow, and **text elements** one bucket too.
- **Field by field**, each the last value chosen for it on that kind:
  - shapes: `strokeColor`, `penColour`, `strokeSwatch`, `fillColor`, `fillSwatch`, `textColor`, `colorPreset`,
    `strokeWidth`, `strokeStyle`, `textAlignX`, `iconPosition`;
  - arrows: `strokeColor`, `penColour`, `strokeSwatch`, `strokeWidth`, `strokeStyle`, `flow`;
  - text: `textColor`, `penTextColour`, `textSwatch`.
- **The label colour travels with the background**, and a preset's binding with it, so a remembered background never
  lands under unreadable text and a remembered preset look follows the theme.
- **Theme defaults are not memories.** Setting a colour back to the theme's value forgets it (`THEME_VALUE_OF`), so a
  remembered "default" never pins one theme's colour onto a tab with another.
- **Locked elements are not recorded.**
- **User-made elements only** read it (`styleNewElement`): an element added through the editor's own creation path
  (`useElementCreation`, `addBoxedAt`'s `style`), an arrow drawn from a quick-connect ring, and a Shift-chained one
  (`useBoxedDragHandlers`, `useEditorDrag`). Paste, duplicate, templates, import and the agents never read memory:
  they carry styles of their own.
- **Per project, on this device.** Memory is kept in `localStorage` under `liveplanner:v2:style-memory:<projectId>`,
  read once per project and written back at most every `STYLE_MEMORY_WRITE_DEBOUNCE_MS` (250 ms). It is not synced,
  not in the project, and not part of [User preferences](../007-editor/user-preferences.md).

## Clear Styles

On the element menu's quick bar ([Element menu quick bar](element-menu-quick-bar.md)). It resets the selected
elements' style fields to the tab theme's default (stroke, background and label colour, width, style, text
alignment, icon alignment; on an arrow its stroke colour, width, style and flow; on a text element its text colour;
any stock colour stored by name too), drops their quick-swatch bindings, **and** forgets the memory of every kind it
touched (`forgetStyleKinds`), so the next element of those kinds is the default again. One undo step.

## Testing

- `apps/editor/lib/style-memory.test.ts` and `apps/editor/hooks/canvas/useStyleMemory.test.tsx`: per-kind recording,
  theme defaults forgotten, the storage key and the debounce.
- `packages/project/src/quick-swatches.test.ts` and `quick-swatch-rederive.test.ts`: the derivation and the re-read on
  a theme change; `validate.test.ts`: the slot bounds.
- `apps/editor/lib/style-presets.test.ts`: any other colour edit drops a binding.
- `apps/editor/components/primitives/MovablePanel.presence.test.tsx`: a panel announces its arrival and departure.
