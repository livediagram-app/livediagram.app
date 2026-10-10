# Reveal zone: blueprint

Derived from [Reveal zone](../reveal-zone.md), with the baton rule from
[Facilitator](../../012-collaboration/facilitator.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                     | Role                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/document/src/shape-factory.ts`                 | 320x220, label "Hidden", `textAlignY: 'top'`, no stored colour  |
| `packages/document/src/colors.ts`                        | `behaviourSkin` (accent and ink per paper), `REVEAL_COVER_BASE` |
| `packages/document/src/validate.ts`                      | `revealed` must be a boolean                                    |
| `packages/document/src/svg-render-faces.ts`              | `revealCover`, omitted when `revealed === true`                 |
| `apps/live/components/canvas/RevealFace.tsx`             | Cover, double press, Hide pill                                  |
| `apps/live/components/canvas/ElementFaceRouter.tsx`      | Resolves the accent: `ownColours(element).stroke` or default    |
| `apps/live/app/qa-board.css`                             | `.reveal-sweep`, `.reveal-cover` hover                          |
| `apps/live/hooks/ui/usePressWithoutDrag.ts`              | `requireDouble` and `isDoublePress`                             |
| `apps/live/lib/double-press.ts`                          | `DOUBLE_PRESS_MS`                                               |
| `apps/live/hooks/canvas/useBehaviourElements.ts`         | `revealedIds`, `toggleRevealForMe`, the facilitator gate        |
| `apps/live/components/canvas/EditorCanvasHost.tsx`       | `onToggleReveal={runBlocked ? undefined : toggleRevealForMe}`   |
| `apps/live/components/palette/BehaviourMenuSections.tsx` | `RevealMenuSection`                                             |
| `apps/live/hooks/canvas/usePortalSetters.ts`             | `setRevealedSelected` (`Element·Changed·Reveal`)                |
| `apps/live/components/palette/palette-tile-defs.tsx`     | `tools:reveal` in Behaviours                                    |

## Domain and naming

| Term             | Identifier                                  | Meaning                                            |
| ---------------- | ------------------------------------------- | -------------------------------------------------- |
| Reveal zone      | shape kind `'reveal'`                       | The element                                        |
| Cover            | the `RevealFace` `<button>`                 | The opaque panel drawn over what the zone overlaps |
| Accent           | the resolved `strokeColor`                  | Tints the glows, the border and the lock disc      |
| Cover base       | `REVEAL_COVER_BASE[surface]`                | The cover's opaque tone, from the paper under it   |
| Revealed for all | `ShapeElement.revealed === true`            | Shared, persisted; the cover is off for everyone   |
| Revealed for me  | `revealedIds.has(id)`                       | Per-viewer, session-only lift                      |
| Uncovered        | `revealedForAll \|\| revealedForMe`         | No cover drawn for this viewer                     |
| Hide pill        | the second `<button>` in `RevealFace`       | Puts a personal lift back                          |
| Double press     | `usePressWithoutDrag(…, { requireDouble })` | Two un-dragged clicks within `DOUBLE_PRESS_MS`     |
| Blocked          | `sessionToolsBlocked` / `runBlocked`        | Someone else holds the facilitator baton           |

Banned synonyms: "spoiler" (search keyword only), "blur", "lock", "private" (it is not a
permission), "unhide".

## Behaviour and state

States per viewer: **covered**, **revealed for me**, **revealed for all**.

| From             | Event                     | Guard       | To                          |
| ---------------- | ------------------------- | ----------- | --------------------------- |
| covered          | double press on the cover | not blocked | revealed for me             |
| revealed for me  | single press on Hide      | not blocked | covered (unreachable, GF16) |
| any              | menu **Reveal for All**   | [QF15]      | revealed for all            |
| revealed for all | menu **Hide for All**     | [QF15]      | covered or revealed for me  |
| revealed for me  | reload                    |             | covered                     |

1. **Double press.** `onClick` swallows a dragged click (`isDragTravel`), then pairs presses with
   `isDoublePress(last, now)`: `now - last <= DOUBLE_PRESS_MS && now >= last` (D118). The first
   press arms, the second fires and disarms. `onDoubleClick` stops propagation, so the canvas never
   opens the label editor.
2. **Local lift.** `toggleRevealForMe(id)` toggles membership of `revealedIds` (React state in
   `useBehaviourElements`), unless `sessionToolsBlocked`.
3. **Room lift.** `setRevealedSelected(revealed)` patches `revealed` on every selected or targeted
   `reveal` on the active tab through `commitTabs`: synced, persisted, undoable.
4. **Blocked.** While someone else facilitates, `onToggleReveal` is `undefined`: presses do nothing
   [QF15]. The facilitator can still lift privately (D121).
5. **Precedence.** Revealed for all wins over any personal state; a personal lift survives a
   room-wide Hide, because `revealedIds` is untouched by it.

Invariants:

- **I1:** a local lift never writes the document or the wire.
- **I2:** the zone never moves, hides or locks the elements beneath it.
- **I3:** a single stray click never uncovers.

## Interfaces and contracts

```ts
// ShapeElement
revealed?: boolean;

export function isDoublePress(last: number | null, now: number): boolean;
export function usePressWithoutDrag(onPress?: () => void,
  opts?: { requireDouble?: boolean }): { onDoubleClick; onPointerDown; onClick };
export function RevealFace(props: { label: string; textColor: string; strokeColor: string;
  revealedForAll: boolean; revealedForMe: boolean; onToggleForMe?: () => void }): JSX.Element | null;
toggleRevealForMe: (elementId: string) => void;          // useBehaviourElements
setRevealedSelected: (revealed: boolean) => void;        // usePortalSetters
```

| Input                     | Handling                         |
| ------------------------- | -------------------------------- |
| `revealed` absent         | Valid; covered                   |
| `revealed` boolean        | Valid                            |
| `revealed` any other type | `isValidElement` returns `false` |

## Data and persistence

- **Persisted:** `revealed`, `label`, colours.
- **Session only:** `revealedIds`; lost on reload by design.
- **Undo:** Reveal / Hide for All is an ordinary commit; a local lift is not undoable.
- **Export:** covered unless `revealed === true` (D120); the content beneath is in the export
  either way.

## Errors and edge cases

| #   | Case                                          | Handling                                            |
| --- | --------------------------------------------- | --------------------------------------------------- |
| E1  | Single click                                  | Arms only; nothing uncovers (I3)                    |
| E2  | Two clicks more than 450 ms apart             | Each arms again                                     |
| E3  | Drag across the cover                         | Swallowed, disarms nothing                          |
| E4  | Double tap on touch                           | Same path as a click; no `dblclick` dependency      |
| E5  | Content added above the zone later            | Paints over the cover (document order) [QF12]       |
| E6  | Blocked viewer presses the cover              | Nothing happens; copy still says "to reveal" [QF15] |
| E7  | Lifted locally, then a facilitator takes over | Stays lifted; `onToggleForMe` is absent [QF15]      |
| E11 | Hide pill pressed                             | Takes no pointer: the click passes through (GF16)   |
| E8  | Blocked viewer uses the menu                  | **Reveal for All** still writes [QF15]              |
| E9  | Revealed for all, then Hide for All           | Viewers with a personal lift keep it                |
| E10 | Element deleted while lifted locally          | Stale id in `revealedIds`, harmless                 |

## Security and trust

- **Not a permission.** Everything beneath is in the document, the API response and the export.
  The cover hides from the eye only; the help article
  (`apps/help/app/palette/behaviour/reveal-zones/page.mdx`) says so, the spec is the record, and
  the UI does not claim otherwise.
- `revealed` is writable by any editor; the room drops mutations from view-role senders.
- A local lift crosses no trust boundary.

## Presentation and UX

- **Cover:** fully opaque, `REVEAL_COVER_BASE[paper]` from `useCanvasSurface()` (the paper, not
  the app's appearance), two radial glows of the accent (`tint(accent, 0.22)` from the top left,
  `tint(accent, 0.16)` from the bottom right), a solid 1.5 px border at `tint(accent, 0.55)`.
- **Sweep:** `.reveal-sweep`, a 45%-wide band of white at 0.14 crossing every 5.5 s (D145).
- **Middle column**, 8 px apart: a 40 px `GlyphDisc` with `LockGlyph` (18 px) in the accent on
  `tint(accent, 0.14)` with a 6 px halo; the label at 14 px semibold (blank reads "Hidden"); a
  pill "Double-click to reveal" or "Double-tap to reveal" (`useCoarsePointer`, D119) at 10.5 px on
  `tint(textColor, 0.07)`.
- **Unstyled accent and ink** (`behaviourSkin`): light paper `#0ea5e9` over `#0f172a` text; dark
  paper `#64748b` over `#ffffff` (D144).
- **No hover card** on the cover or the pill; the help article carries the honesty line.
- **Revealed for me:** only the Hide pill: blurred dark glass (`bg-slate-900/75`, `backdrop-blur`),
  an eye with a slash, "Hide" at 10 px. The spec puts it in the corner; the code gives it no
  position and no pointer events (GF16).
- **Revealed for all:** the face renders nothing; the element stays selectable by its outline.
- **Export:** `revealCover` draws the base, both glows, the border, the lock disc, the label and
  "Double-click to reveal" (an export has no pointer), on the wrapper's `REVEAL_RADIUS_PX`
  corners; the sweep is motion and stays out.
- **Menu:** accordion **Reveal**, hint "Anyone can click the cover to peek for themselves. This
  takes it off for everyone." [QF14], tiles **Reveal for All** / **Hide for All** [QF14].
- **Palette:** tile `tools:reveal` ("Add reveal zone") in the **Tools** accordion
  (`tileGroup: 'facilitate'`); blurb "Double-click to look underneath"; its hover card reads "Click
  it to uncover it just for you" although a single click never uncovers [QF14].
- **Telemetry:** placing emits `Element·Added·Reveal`; both menu tiles emit
  `Element·Changed·Reveal`; a local lift emits nothing.

## Accessibility

- Cover: native `<button>`, `aria-label` `"<label>, double-click to reveal"` (or double-tap).
- Hide pill: native `<button>` with visible text "Hide".
- The cover's text sits on an opaque surface: `#0f172a` on `#f1f5f9` and `#ffffff` on `#172131`,
  both above 4.5:1 under the 0.22 accent glow.
- Motion: the sweep loops and the hover is a 150 ms `brightness(1.04)`; both collapse under the
  reduced-motion rules in `globals.css`.

## Web experience

- **INP:** a lift is one set update; a room lift is one commit.
- **CLS:** the pill is absolutely positioned; the cover fills its fixed box.

## Observability

No log exists today. Proposed fingerprints (gap, see the report):

| #   | Where                 | Level           | Fingerprint                                   |
| --- | --------------------- | --------------- | --------------------------------------------- |
| O1  | `toggleRevealForMe`   | `console.debug` | `[reveal] local id=<id> open=<bool>`          |
| O2  | blocked press         | `console.debug` | `[reveal] blocked id=<id> reason=facilitator` |
| O3  | `setRevealedSelected` | `console.debug` | `[reveal] room ids=<n> revealed=<bool>`       |

## Testing

| Rule                                             | Test                                                           | File                                                |
| ------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------- |
| Not votable                                      | "rejects the interactive Behaviour shapes"                     | `packages/document/src/session.test.ts`             |
| Export draws a cover                             | "draws more than a box and a label"                            | `packages/document/src/export-consistency.test.ts`  |
| Export cover carries the gesture chip            | "covers a Reveal with the gesture chip, on the wrapper radius" | `packages/document/src/svg-render-fidelity.test.ts` |
| Cover base follows the paper                     | "draws the Reveal cover on the base the canvas face uses"      | `packages/document/src/svg-render-surface.test.ts`  |
| `revealed` must be boolean                       | none                                                           | (gap)                                               |
| Double press within 450 ms, single never (I3)    | none                                                           | (gap, `isDoublePress` is pure)                      |
| Local lift never writes (I1)                     | none                                                           | (gap)                                               |
| Blocked viewer cannot lift                       | none                                                           | (gap) [QF15]                                        |
| Revealed for all hides the cover everywhere      | none                                                           | (gap)                                               |
| Hide pill takes the press and restores the cover | none                                                           | (gap GF16)                                          |

## Constants and configuration

| Name                        | Value                                                           | Provenance / safe range                       |
| --------------------------- | --------------------------------------------------------------- | --------------------------------------------- |
| `SHAPE_DEFAULT_SIZE.reveal` | `{ width: 320, height: 220 }`                                   | A column of notes, not one sticky             |
| Default label               | `'Hidden'`                                                      | Names the cover until the author does         |
| Unstyled accent / text      | light `'#0ea5e9'` / `'#0f172a'`; dark `'#64748b'` / `'#ffffff'` | `behaviourSkin`; not stored (D144)            |
| `REVEAL_COVER_BASE`         | `{ light: '#f1f5f9', dark: '#172131' }`                         | Opaque paper tones; shared with the export    |
| Sweep period                | `5.5s` (`reveal-sweep`)                                         | "Every few seconds"; 4 to 8 s (D145)          |
| `REVEAL_RADIUS_PX`          | `4`                                                             | Export corners, the self-painting wrapper's   |
| `DOUBLE_PRESS_MS`           | `450`                                                           | Shared double-press window; 300 to 500 (D118) |
| `PRESS_DRAG_SLOP_PX`        | `4`                                                             | Shared press tolerance, screen px             |
