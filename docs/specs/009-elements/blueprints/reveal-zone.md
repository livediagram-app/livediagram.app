# Reveal zone: blueprint

Derived from [Reveal zone](../reveal-zone.md), with the baton rule from
[Facilitator](../../012-collaboration/facilitator.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                     | Role                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/document/src/shape-factory.ts`                 | 320x220, label "Hidden", transparent box, `textAlignY: 'top'` |
| `packages/document/src/validate.ts`                      | `revealed` must be a boolean                                  |
| `packages/document/src/svg-render-faces.ts`              | Export cover, omitted when `revealed === true`                |
| `apps/live/components/canvas/RevealFace.tsx`             | Cover, double press, Hide pill                                |
| `apps/live/hooks/ui/usePressWithoutDrag.ts`              | `requireDouble` and `isDoublePress`                           |
| `apps/live/hooks/canvas/useBehaviourElements.ts`         | `revealedIds`, `toggleRevealForMe`, the facilitator gate      |
| `apps/live/components/canvas/EditorCanvasHost.tsx`       | `onToggleReveal={runBlocked ? undefined : toggleRevealForMe}` |
| `apps/live/components/palette/BehaviourMenuSections.tsx` | `RevealMenuSection`                                           |
| `apps/live/hooks/canvas/usePortalSetters.ts`             | `setRevealedSelected` (`Element·Changed·Reveal`)              |
| `apps/live/components/palette/palette-tile-defs.tsx`     | `tools:reveal` in Behaviours                                  |

## Domain and naming

| Term             | Identifier                                  | Meaning                                            |
| ---------------- | ------------------------------------------- | -------------------------------------------------- |
| Reveal zone      | shape kind `'reveal'`                       | The element                                        |
| Cover            | the `RevealFace` `<button>`                 | The opaque panel drawn over what the zone overlaps |
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

| From             | Event                     | Guard       | To                         |
| ---------------- | ------------------------- | ----------- | -------------------------- |
| covered          | double press on the cover | not blocked | revealed for me            |
| revealed for me  | single press on Hide      | not blocked | covered                    |
| any              | menu **Reveal for all**   | [QF15]      | revealed for all           |
| revealed for all | menu **Hide for all**     | [QF15]      | covered or revealed for me |
| revealed for me  | reload                    |             | covered                    |

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
- **Undo:** Reveal / Hide for all is an ordinary commit; a local lift is not undoable.
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
| E7  | Lifted locally, then a facilitator takes over | Stays lifted; the Hide pill is dead [QF15]          |
| E8  | Blocked viewer uses the menu                  | **Reveal for all** still writes [QF15]              |
| E9  | Revealed for all, then Hide for all           | Viewers with a personal lift keep it                |
| E10 | Element deleted while lifted locally          | Stale id in `revealedIds`, harmless                 |

## Security and trust

- **Not a permission.** Everything beneath is in the document, the API response and the export.
  The cover hides from the eye only; the spec is the record, the UI does not claim otherwise.
- `revealed` is writable by any editor; the room drops mutations from view-role senders.
- A local lift crosses no trust boundary.

## Presentation and UX

- **Cover:** fully opaque `bg-slate-100` (dark `slate-800`), dashed 2 px border in the stroke
  colour, hatching (`Hatching`), eye glyph, label (blank reads "Hidden"), then
  "Double-click to reveal" or "Double-tap to reveal" (`useCoarsePointer`, D119).
- **No tooltip on the cover** [QF13].
- **Revealed for me:** only the Hide pill at the top right takes pointers; tooltip
  "Hide it again" / "Only affects your screen".
- **Revealed for all:** the face renders nothing; the element stays selectable by its outline.
- **Menu:** accordion **Reveal**, hint "Anyone can click the cover to peek for themselves. This
  takes it off for everyone." [QF14], tiles **Reveal for all** / **Hide for all** [QF14].
- **Telemetry:** placing emits `Element·Added·Reveal`; both menu tiles emit
  `Element·Changed·Reveal`; a local lift emits nothing.

## Accessibility

- Cover: native `<button>`, `aria-label` `"<label> — double-click to reveal"` (or double-tap).
- Hide pill: native `<button>` with visible text "Hide".
- The cover's text and eye sit on an opaque surface; `textColor` defaults to `#0f172a` on
  `slate-100`, above 4.5:1.
- Only colour transitions on hover; no motion.

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

| Rule                                          | Test                                       | File                                               |
| --------------------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| Not votable                                   | "rejects the interactive Behaviour shapes" | `packages/document/src/session.test.ts`            |
| Export draws a cover                          | "draws more than a box and a label"        | `packages/document/src/export-consistency.test.ts` |
| `revealed` must be boolean                    | none                                       | (gap)                                              |
| Double press within 450 ms, single never (I3) | none                                       | (gap, `isDoublePress` is pure)                     |
| Local lift never writes (I1)                  | none                                       | (gap)                                              |
| Blocked viewer cannot lift                    | none                                       | (gap) [QF15]                                       |
| Revealed for all hides the cover everywhere   | none                                       | (gap)                                              |

## Constants and configuration

| Name                        | Value                         | Provenance / safe range                       |
| --------------------------- | ----------------------------- | --------------------------------------------- |
| `SHAPE_DEFAULT_SIZE.reveal` | `{ width: 320, height: 220 }` | A column of notes, not one sticky             |
| Default label               | `'Hidden'`                    | Names the cover until the author does         |
| Default stroke / text       | `'#94a3b8'` / `'#0f172a'`     | Slate border, dark label                      |
| `DOUBLE_PRESS_MS`           | `450`                         | Shared double-press window; 300 to 500 (D118) |
| `PRESS_DRAG_SLOP_PX`        | `4`                           | Shared press tolerance, screen px             |
