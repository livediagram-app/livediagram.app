# Selection Mode button: blueprint

Derived from [Selection Mode button](../mode-button.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                    | Role                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/document/src/selection-mode.ts`               | `SELECTION_MODES`, `SELECTION_MODE_LABEL`, guard, fixed size, skins |
| `packages/document/src/shape-factory.ts`                | `SHAPE_DEFAULT_SIZE['mode-button']`, the `createShape` branch       |
| `packages/document/src/colors.ts`                       | `behaviourSkin`: the unstyled skin per surface                      |
| `packages/document/src/behaviour-skin.ts`               | `ownColours`: a stamped skin reads as unset                         |
| `packages/document/src/validate.ts`                     | Rejects an unknown `mode`                                           |
| `packages/document/src/svg-render-faces.ts`             | The export face (`svgBehaviourFace`, `'mode-button'`, `keycapEdge`) |
| `apps/live/components/canvas/ModeButtonFace.tsx`        | The face: chip, derived text, press; `MODE_LABEL`                   |
| `apps/live/components/canvas/ElementFaceRouter.tsx`     | Renders the face while not editing                                  |
| `apps/live/components/canvas/BoxedElementView.tsx`      | Resolves `textColor` through `ownColours` and `defaultTextColor`    |
| `apps/live/hooks/ui/usePressWithoutDrag.ts`             | Click presses, drag stays silent                                    |
| `apps/live/lib/press-gestures.ts`                       | `isDragTravel`, `PRESS_DRAG_SLOP_PX`                                |
| `apps/live/components/canvas/Canvas.tsx`                | `pressModeButton`: records the Avatar spawn point                   |
| `apps/live/app/document/[id]/useEditorState.ts`         | `pressModeButton`: Leave, else `pickCanvasTool`                     |
| `apps/live/hooks/canvas/useCanvasTool.ts`               | `selectCanvasTool` telemetry, `toolBeforeCurrent`                   |
| `apps/live/components/canvas/EditorCanvasHost.tsx`      | Threads the press; `mode ?? DEFAULT_BUTTON_MODE`                    |
| `apps/live/components/palette/palette-tile-defs.tsx`    | Nine `tools:mode-<mode>` tiles, `tileGroup: 'mode'` [QF6]           |
| `apps/live/components/palette/ElementDataSections.tsx`  | The **Button** menu section                                         |
| `apps/live/hooks/canvas/useDataShapeSetters.ts`         | `setButtonModeSelected`                                             |
| `apps/live/lib/draw-commit.ts`, `useElementCreation.ts` | Apply the tile's `mode` at commit / drop                            |
| `apps/live/lib/element-telemetry.ts`                    | `SHAPE_TOKENS['mode-button'] = 'ModeButton'`                        |

## Domain and naming

| Term             | Identifier                               | Meaning                                             |
| ---------------- | ---------------------------------------- | --------------------------------------------------- |
| Selection Mode   | shape kind `'mode-button'`               | The element; "Selection Mode" in every UI label     |
| Mode             | `SelectionMode`, `ShapeElement.mode`     | Which canvas tool a press hands out                 |
| Default mode     | `DEFAULT_BUTTON_MODE` (`'avatar'`)       | The mode of a button with no `mode`                 |
| Current mode     | `activeMode` (the viewer's `canvasTool`) | The presser's own tool right now                    |
| Derived text     | `` `${kicker} ${MODE_LABEL[mode]}` ``    | Face text when the label is empty                   |
| Mode name        | `SELECTION_MODE_LABEL` (`MODE_LABEL`)    | One table for the face, the menu and the export     |
| Unstyled skin    | `behaviourSkin(element, surface)`        | The kind's default colours on light or dark paper   |
| Own colours      | `ownColours(el)`                         | Stored colours minus a stamped skin                 |
| Kicker           | `'Switch to'` \| `'Leave'`               | `'Leave'` when `activeMode === mode`                |
| Chip             | the `<button>` in `ModeButtonFace`       | The 36 px glyph circle; the only press target [QF2] |
| Press            | `onPress` / `pressModeButton`            | A click without drag travel on the chip             |
| Leave            | `toolBeforeCurrent()`                    | The tool a press returns to from the current mode   |
| Fixed-size shape | `FIXED_SIZE_SHAPES`, `isFixedSizeShape`  | No resize handles, drag size ignored                |

Banned synonyms: "mode switch", "toggle", "action button" (a general action button is out of
scope), "disabled state" (the current-mode button is live and reads Leave).

## Behaviour and state

The element holds one field, `mode`. Everything else is per-viewer and never persisted.

### Creating

1. A palette tile carries `action: { type: 'shape', kind: 'mode-button', mode }` [QF6]. Tap and
   drag-draw commit through `draw-commit.ts`, a palette drag-drop through `useElementCreation.ts`;
   both spread `{ mode }` over `createShape('mode-button', x, y)`.
2. `createShape` returns 104x96, `mode: DEFAULT_BUTTON_MODE`, no `label`, no stored colour,
   shadow `{ offsetX: 0, offsetY: 2, blur: 6, opacity: 0.24 }`, `borderRadius: 'lg'`,
   `textSize: 'sm'`, `textBold: true`.
3. Being fixed size, the drag dimensions are ignored and `inheritedSizeFor` never donates a
   selection's size.
4. `deriveNewBoxedColours` stores the tab's backdrop and theme colours on it like on any shape;
   only `page` and `portal` return early. On the Default scheme with the default backdrop nothing
   is stored, and every slot resolves through `behaviourSkin`: `MODE_BUTTON_SKIN` on light paper,
   `CONTROL_SKIN_DARK` on dark (D147).

### Rendering the face

1. `ElementFaceRouter` renders `ModeButtonFace` while `!isEditing`; mid-edit the ordinary label
   editor takes over.
2. `mode = element.mode ?? DEFAULT_BUTTON_MODE`. `isCurrent = activeMode === mode`.
3. Text: a non-blank label wins and fills the width; a blank label shows the kicker over
   `MODE_LABEL[mode]`.
4. Colours resolve per slot as `ownColours(el).<slot> ?? default<Slot>Color(el, surface)`. A button
   stored with exactly `MODE_BUTTON_SKIN`, or the pre-redesign trio (`isLegacyModeButtonSkin`),
   reads as unstyled and takes the surface skin, on the canvas and in exports.
5. `onPress` absent renders the inert layout (no `<button>`) [QF4].

### Pressing

1. `usePressWithoutDrag(onPress)`: `pointerdown` records the screen point; `click` stops
   propagation, then returns without pressing when `isDragTravel(dx, dy)` (D108).
2. `Canvas.pressModeButton`: if the button's mode is `avatar`, set `avatarSpawnRef` to
   `(x + width / 2, y + height + AVATAR_SPAWN_GAP)` (D110). Then call the host's handler.
3. `useEditorState.pressModeButton(mode)`:
   `pickCanvasTool(canvasTool === mode ? toolBeforeCurrent() : mode)` (D109).
4. `pickCanvasTool` applies the palette's rules unchanged: entering `spotlight` or `avatar`
   clears the selection; `selectCanvasTool` records the prior tool and emits the palette picker's
   own event for that mode, none for Select and Hand [QF7]. The empty-canvas guard (refusing
   `eraser`, `format`, `laser`, `spotlight`, `avatar`, `isometric` on an empty tab) is on the path
   but never fires for a button pressed on the active tab, which the button itself makes
   non-empty.
5. On entry to Avatar mode, `useAvatarWalk` consumes `avatarSpawnRef` once and places the feet
   there, facing down.

### Configuring

The **Button** accordion (`sectionProps('button-mode')`) shows "Switches the presser to" over a
three-column `MenuTileGrid` of every `SELECTION_MODES` entry, the current one `active`.
`setButtonModeSelected(mode)` patches only `mode-button` elements in the selection.

Invariants:

- **I1:** a press changes only the presser's `canvasTool`; nothing is written or broadcast.
- **I2:** a drag that travels at least `PRESS_DRAG_SLOP_PX` never presses.
- **I3:** a button for the current mode always has a way out: `toolBeforeCurrent()` never returns
  the current tool.
- **I4:** a stored `mode` is always in `SELECTION_MODES` (the validator rejects anything else).

## Interfaces and contracts

```ts
export const SELECTION_MODES = ['select', 'pan', 'laser', 'spotlight', 'avatar', 'eraser',
  'format', 'isometric', 'highlighter'] as const;
export type SelectionMode = (typeof SELECTION_MODES)[number];
export const DEFAULT_BUTTON_MODE: SelectionMode = 'avatar';
export function isSelectionMode(value: unknown): value is SelectionMode;
export function isFixedSizeShape(kind: string): boolean;
export const SELECTION_MODE_LABEL: Record<SelectionMode, string>;
export function isLegacyModeButtonSkin(el: { shape?: string; fillColor?: string;
  strokeColor?: string; textColor?: string }): boolean;
export const MODE_BUTTON_SKIN: { fill: '#ffffff'; stroke: '#cbd5e1'; text: '#0f172a' };
// behaviour-skin.ts
export function ownColours(el: BoxedElement): { fill?: string; stroke?: string; text?: string };

// ShapeElement
mode?: SelectionMode;

// apps/live
export const MODE_LABEL: Record<SelectionMode, string>; // = SELECTION_MODE_LABEL
export function ModeButtonFace(props: { mode: SelectionMode; label: string;
  activeMode?: SelectionMode; textColor: string; onPress?: () => void }): JSX.Element;
onPressModeButton?: (element: ShapeElement) => void; // Canvas.types, BoxedElementView.types
```

| Input                                  | Handling                              |
| -------------------------------------- | ------------------------------------- |
| `mode` absent                          | Valid; reads as `DEFAULT_BUTTON_MODE` |
| `mode` in `SELECTION_MODES`            | Valid                                 |
| `mode` any other value (string or not) | `isValidElement` returns `false`      |

## Data and persistence

- **Persisted:** `mode`, plus the ordinary shape fields. No migration: absent means Avatar.
- **Not persisted by default:** colours. A fresh button stores none; an author's pick or a themed
  tab's projection is stored and wins.
- **Never persisted:** the viewer's tool, the prior tool, the spawn point, the Leave state.
- **Undo:** changing `mode` is an ordinary commit.
- **Stamped skins:** stored colours are never rewritten; `ownColours` drops a stamped skin at
  render time only, on the canvas and in exports.

## Errors and edge cases

| #   | Case                                           | Handling                                             |
| --- | ---------------------------------------------- | ---------------------------------------------------- |
| E1  | Unknown `mode` from the API, an import, a peer | Tab write rejected by `isValidElement`               |
| E2  | Guarded mode on an empty tab                   | Unreachable from the active tab: the button is on it |
| E3  | Press while already in the mode                | Leave to `toolBeforeCurrent()`                       |
| E4  | Prior tool equals the current one (stale ref)  | Leave to `select`                                    |
| E5  | Drag that ends on the chip                     | Click swallowed (I2)                                 |
| E6  | Press inside Avatar, Spotlight or Isometric    | Chip keeps `pointer-events: auto`, press works       |
| E7  | Right-click in Avatar or Isometric             | Element menu opens [QF5]                             |
| E8  | Right-click in Spotlight                       | Shrinks the light; no menu [QF5]                     |
| E9  | Read-only embed                                | Face inert, no `<button>` [QF4]                      |
| E10 | Author's label typed, then cleared             | Derived text returns                                 |
| E11 | Resize attempt, union resize                   | No handles; the button keeps its size and moves only |
| E12 | Stored stamped skin, viewer on dark paper      | Reads as unstyled; the dark skin renders             |

## Security and trust

- A press is local UI state; there is no wire message and no write.
- `mode` arrives from any writer (guest, signed-in, API token, MCP); the validator is the gate.
- Handing out the Eraser is allowed by design; the eraser's own edit gates still apply to the
  presser.

## Presentation and UX

- **Box:** 104x96, rounded `lg`, element fill, keycap edge (`keycapEdge(textColor)`) [QF2].
  Unstyled: a white card, slate hairline and dark text on light paper; a slate card, slate border
  and light text on dark paper (D147).
- **Chip:** 36x36 circle at 14% from the top, 22 px glyph from the palette's own icons
  (`MODE_ICON`), `bg-black/[0.055]` with an inset ring (dark: `bg-white/10`).
- **Text:** derived: 9 px uppercase kicker at 70% opacity over the 13 px semibold mode name;
  author's label: 12 px semibold, centred, full width.
- **Hover:** desktop only (`sm:`), on the chip: scale 1.05, wash and inset ring.
- **Press:** chip scales to 0.92.
- **Hover card:** none on the face [QF3]; the palette tile's hover card explains the mode ("It
  changes the mode for that person only").
- **Copy:** "Switch to <Mode>", "Leave <Mode>", menu "Button", "Switches the presser to".
- **Palette:** a **Selection Mode** accordion (`tileGroup: 'mode'`) in Behaviours, one tile per
  mode with the mode's own glyph [QF6].
- **Telemetry:** placing emits `Element·Added·ModeButton`; re-pointing emits
  `Element·Changed·ModeButton` [QF7].
- **Export:** the keycap edge, the chip, the mode's glyph from `MODE_GLYPHS` at 22 px, and the
  derived text ("Switch to" over the mode name) or the author's label. The Leave state and the
  press states are live and stay out of the image.
- No loading or error state: the face is synchronous.

## Accessibility

- The chip is a native `<button type="button">`, keyboard focusable.
- `aria-label`: `"<text> — switch to <Mode> mode"`, or `"<text> — back to your previous mode"`
  when current.
- The glyph layer is `aria-hidden`.
- Motion is a 100 ms scale on hover and press only.
- The light skin's `#0f172a` on `#ffffff` and the dark skin's `#f1f5f9` on `#1e293b` both exceed
  4.5:1; themed colours follow the theme's own contrast rule.

## Web experience

- **INP:** a press is one state update plus the tool change; no layout work.
- **CLS:** the face is absolutely positioned inside a fixed box; hover and press use transforms.

## Observability

No log exists today. Proposed fingerprints (gap, see the report):

| #   | Where             | Level           | Fingerprint                                           |
| --- | ----------------- | --------------- | ----------------------------------------------------- |
| O1  | `pressModeButton` | `console.debug` | `[mode-button] press mode=<m> leave=<bool> to=<tool>` |

## Testing

| Rule                                                 | Test                                                      | File                                                |
| ---------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| Defaults: 104x96-ish, Avatar, no label, skin, shadow | `createShape (mode button, …)` block                      | `packages/document/src/factories.test.ts`           |
| Legacy skin is unset, not a choice                   | "treats the pre-redesign button skin as unset"            | `packages/document/src/factories.test.ts`           |
| Created with no stored colour                        | "are created with no stored colour"                       | `packages/document/src/behaviour-skin.test.ts`      |
| Skin follows the paper                               | "resolve light ink on dark paper and dark ink …"          | `packages/document/src/behaviour-skin.test.ts`      |
| A stamped skin reads as unset; a pick is kept        | "treat the skin …", "keep a colour the author picked"     | `packages/document/src/behaviour-skin.test.ts`      |
| Drag tolerance is 4 px, radial (D108)                | `isDragTravel` block                                      | `apps/live/lib/press-gestures.test.ts`              |
| Unknown `mode` rejected, every mode accepted (I4)    | `mode button validation` block                            | `packages/document/src/validate.test.ts`            |
| Fixed size                                           | "names the controls that never take resize handles"       | `packages/document/src/selection-mode.test.ts`      |
| No resize handles on fixed-size elements             | fixed-size block                                          | `apps/live/lib/canvas-selection.test.ts`            |
| Shared settings `…` on the face                      | "gives the shared menu to a kind with settings behind it" | `packages/document/src/behaviour-shapes.test.ts`    |
| Not votable                                          | "rejects the interactive Behaviour shapes"                | `packages/document/src/session.test.ts`             |
| Draw banner spells the kind                          | "spells out a hyphenated kind"                            | `apps/live/lib/draw-mode.test.ts`                   |
| Telemetry token `ModeButton`                         | palette census                                            | `apps/live/lib/palette-telemetry-coverage.test.ts`  |
| Export draws a face                                  | "draws more than a box and a label"                       | `packages/document/src/export-consistency.test.ts`  |
| Export names an unlabelled button by its mode        | "names an unlabelled Mode button by its destination"      | `packages/document/src/svg-render-fidelity.test.ts` |
| Drag never presses (I2)                              | none (`usePressWithoutDrag`)                              | (gap)                                               |
| Leave returns to the prior tool (I3)                 | none                                                      | (gap)                                               |
| Avatar spawns below the button                       | none                                                      | (gap)                                               |
| Press works in pointer-inert modes; right-click menu | none                                                      | (gap, e2e) [QF5]                                    |
| Embed face inert                                     | none                                                      | (gap) [QF4]                                         |

## Constants and configuration

| Name                                | Value                                                     | Provenance / safe range                     |
| ----------------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| `SHAPE_DEFAULT_SIZE['mode-button']` | `{ width: 104, height: 96 }`                              | Toolbar-button tile; thumb-sized, ≥ 72 each |
| `DEFAULT_BUTTON_MODE`               | `'avatar'`                                                | The walkthrough case; any `SelectionMode`   |
| `MODE_BUTTON_SKIN`                  | `{ fill: '#ffffff', stroke: '#cbd5e1', text: '#0f172a' }` | Light-paper skin; text ≥ 4.5:1 (D147)       |
| `CONTROL_SKIN_DARK` (private)       | `{ fill: '#1e293b', stroke: '#475569', text: '#f1f5f9' }` | Dark-paper skin; text ≥ 4.5:1 (D147)        |
| `LEGACY_BUTTON_SKIN` (private)      | `{ fill: '#0ea5e9', stroke: '#0284c7', text: '#ffffff' }` | The first stamped skin; fixed forever       |
| `PRESS_DRAG_SLOP_PX`                | `4`                                                       | Shared press tolerance, screen px; 3 to 6   |
| `AVATAR_SPAWN_GAP`                  | `12`                                                      | Canvas px below the button; 8 to 24         |
| `FIXED_SIZE_SHAPES`                 | `mode-button`, `session-button`, `done-check`             | Controls laid out for their own content     |
