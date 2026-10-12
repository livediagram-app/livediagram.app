# Tidy Up: blueprint

Derived from [Layout cleanup](../layout-cleanup.md#the-tidy-up-button). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                                              | Role                                                                                       |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `apps/live/lib/auto-layout-choices.ts`                                            | Each choice's tile name and line, beside its command name, options and telemetry type      |
| `apps/live/lib/tab-cleanup.ts`                                                    | `cleanupElements`: the one transform the preview and the press both run (unchanged)        |
| `apps/live/hooks/canvas/useCleanupPreview.ts`                                     | `previewCleanup(kind)` / `endCleanupPreview()`: snapshot, present-only ticks, revert       |
| `apps/live/components/canvas/tidy-up-actions.ts`                                  | `TidyUpActions` and the pure gate `tidyUpOffered`                                          |
| `apps/live/components/canvas/TidyUpPopover.tsx`                                   | The popover: the Auto Layout tiles, the Auto-align row, the empty and locked notes, Escape |
| `apps/live/components/canvas/tidy-up-drawings.tsx`                                | The five tile drawings                                                                     |
| `packages/ui/src/icons/editor-chrome.tsx`                                         | `TidyUpIcon`: Lucide `brush-cleaning` at the cluster's 20 px                               |
| `apps/live/components/canvas/LayersThemeStrip.tsx`                                | The Tidy Up segment, first in the strip                                                    |
| `apps/live/hooks/canvas/useDockPopovers.ts`                                       | `'tidy-up'` in `DockPanel`, its width, its `UI·Opened·TidyUp`                              |
| `apps/live/components/canvas/useCanvasChromePanels.tsx`                           | `tidyUpPopoverEl`, and closing it when the button goes                                     |
| `apps/live/components/canvas/CanvasChrome.tsx`                                    | Passes the segment to the strip, renders the popover beside the corner layer               |
| `apps/live/components/canvas/Canvas.types.ts`                                     | `tidyUp?: TidyUpActions`: present only when the session offers the button                  |
| `apps/live/components/canvas/EditorCanvasHost.tsx`                                | Builds `tidyUp` from the editor state                                                      |
| `apps/live/app/document/[id]/useEditorState.ts`                                   | Mounts `useCleanupPreview` and returns its two functions                                   |
| `apps/live/lib/help-articles.ts`                                                  | `layoutCleanup` → `tools/layout-cleanup`, the popover's help link                          |
| `apps/telemetry/app/catalogue/features.ts`, `content.ts`, `event-explanations.ts` | `TIDY_UP_OPENED` in Tab Actions, and its sentence                                          |

## Domain and naming

| Term            | Identifier                                              | Meaning                                           |
| --------------- | ------------------------------------------------------- | ------------------------------------------------- |
| Tidy Up button  | segment label `Tidy Up`, `data-tour-id="tidy-up"`       | The cluster segment left of Layers                |
| Tidy Up popover | `TidyUpPopover`, dock panel `'tidy-up'`                 | What the button opens                             |
| Tidier          | `CleanupKind = 'align' \| AutoLayoutChoice`             | Auto-align or one Auto Layout style               |
| Tile            | one `AutoLayoutChoice`, in `AUTO_LAYOUT_TILE_ORDER`     | A style's button in the grid                      |
| Tidy Up actions | `TidyUpActions = { run, preview, endPreview, blocked }` | What the chrome is handed; absent means no button |

"Cleanup" stays the name of the transform (`cleanupElements`, `useCleanupPreview`); "Tidy Up" is only the
surface.

## Behaviour and state

- **Offered** when, all together: `editorMode === 'diagram'`, not `isReadOnly` (a Participant and a Viewer are
  read-only for structure), not `isMobile`, not `zenMode`, not an embed. `EditorCanvasHost` passes `tidyUp` only
  for an Editor's non-embed session; `tidyUpOffered` adds the mode, phone and Zen gates.
- **Open state** is the dock slot: `activeDockPanel === 'tidy-up'`. Leaving Diagram mode or the button
  disappearing closes it (an effect in `useCanvasChromePanels`, as Slides and the Plan popovers do).
- **Blocked**: `tidyUp.blocked = activeTabLocked`. The popover renders every tile `disabled` under the locked
  note.
- **Empty**: no element on the active tab. Every tile `disabled` under the empty note. (A tab with elements but no
  arrows still offers Auto Layout: the transform passes unwired elements through unchanged, D81.)
- **Preview** (desktop mouse only, `onMouseHover`): `pointerenter` on a tile → `preview(kind)`; `pointerleave` →
  `endPreview()`. The popover calls `useRevertOnUnmount(endPreview)` so closing mid-hover reverts.
- **Press**: `endPreview()` then `run(kind)` then `onClose()`, in that order in one handler, so the revert and the
  commit are two updaters in one React batch and undo lands on the pre-hover layout.
- `useCleanupPreview` state: `originalsRef: { tabId, elements } | null`. First preview snapshots the active tab;
  later previews reuse it while the tab id matches; `endCleanupPreview` restores only the tab it snapshotted and
  clears the ref. `previewingRef` is true from the first preview to the revert.

## Interfaces and contracts

```ts
type TidyUpActions = {
  run: (kind: CleanupKind) => void; // autoAlignTab() for 'align', autoLayoutTab(kind) otherwise
  preview: (kind: CleanupKind) => void;
  endPreview: () => void;
  blocked: boolean;
};
```

`tidyUpOffered({ actions, editorMode, isMobile, zenMode }): boolean` is the one gate, read by both
`CanvasChrome` (the segment) and `useCanvasChromePanels` (the popover and its auto-close).

`TidyUpPopover` props: `{ actions: TidyUpActions; empty: boolean; anchor?: DockAnchor; onClose: () => void }`.
Escape: a `window` `keydown` listener while mounted calls `onClose` (the cluster popovers have no Escape of
their own; D86).
`ChoiceSpec` gains `tileName: string` and `tileLine: string` (the spec's table, verbatim). The Auto-align row's
copy lives in `TidyUpPopover` as `ALIGN_NAME` / `ALIGN_LINE`.

## Data and persistence

Nothing new is stored. A preview mutates `tabs` in the present only (`tickTabs`); autosave skips while
`previewingRef` is set; a press persists exactly as the command palette's command does.

## Errors and edge cases

- Tab switch with a preview on screen: the revert writes the snapshot back to its own tab id only.
- Preview called with `editsBlocked`: no-op. Preview on an empty tab: no-op (no snapshot taken).
- `endPreview` with nothing in flight: no-op.
- The popover closing by outside press, Escape, a second press of the button, or a mode switch: unmount reverts.
- A remote edit arriving mid-preview: the revert restores the snapshot, which drops that edit from the present
  until the room's next state; same trade the style preview accepts (D82).

## Security and trust

Presentation only. The room and the api decide what a session may write; a Participant who forced the popover
open would still have its element moves refused by `applyParticipantOp`.

## Performance and limits

- Opening the popover costs one render of six buttons and five static SVGs; nothing is computed until a hover.
- A hover runs `cleanupElements` once over the tab. Measured in `tab-cleanup.perf.test.ts` (D83): budget
  `TIDY_PREVIEW_BUDGET_MS` per run at `TIDY_PREVIEW_WORST_CASE_NODES` wired nodes. Measured on an M-series Mac,
  best of three: Smart 16 ms, Flowchart 15 ms, Tree 1.2 ms, Mindmap 1.4 ms, Auto-align 0.1 ms.
- The popover is loaded with `next/dynamic`, like `SessionPopover`, so a visit that never opens it pays
  nothing for it (D84). What the main chunk gains is `tidy-up-actions.ts` and one 20 px glyph.

## Presentation and UX

- Popover: `MovablePanel` as a popover, title `Tidy Up`, help article `layoutCleanup`, width `w-80` (320 px,
  `POPOVER_WIDTHS['tidy-up'] = 320`).
- Group 1: caption "Rearrange shapes from the arrows between them." then a `grid-cols-2 gap-2` of tiles. Tile:
  rounded-lg border, a 72×44 drawing on a tinted ground, the name (Title Case, `text-sm font-medium`), the
  line (`text-xs` muted). Hover: brand border and ground; focus: the brand `focus-visible` ring. Smart spans both
  columns with its drawing beside its words (D85).
- Group 2: hairline, then the Auto-align row: glyph, name, line, full width.
- Notes: the empty note and the locked note replace the caption, in muted text.
- Button glyph: Lucide `brush-cleaning` at 20 px, the cluster step.

## Accessibility

- Every tile is a `<button type="button">` with its name as accessible name and its line as
  `aria-describedby`; drawings are `aria-hidden`.
- Disabled tiles use the `disabled` attribute (skipped by Tab, announced as dimmed).
- Focus ring: the shared `focus-visible` brand ring. Contrast: names on slate-900 / slate-50, lines on
  slate-500 / slate-400, both ≥ 4.5:1 on their ground.
- No motion beyond the colour transition, which `prefers-reduced-motion` drops.

## Web Experience

No layout shift: the popover is portalled above the cluster. INP: a hover's work is one `cleanupElements` plus a
present-only tick, inside the budget above. No LCP impact (lazy).

## Observability

- Open: `track('UI', 'Opened', 'TidyUp')` in `trackDockPanelOpened`.
- Press: the tidier's existing `Tab·Aligned[·type]` from `autoLayoutTab` / `autoAlignTab`.

## Testing

| Spec rule                                  | Test                                        |
| ------------------------------------------ | ------------------------------------------- |
| Button left of Layers, only when offered   | `LayersThemeStrip.test.tsx`                 |
| Diagram-only, Editor-only, not phone / Zen | `tidy-up-actions.test.ts` (`tidyUpOffered`) |
| Five tiles in order + Auto-align row       | `TidyUpPopover.test.tsx`                    |
| Press ends preview, runs, closes, in order | `TidyUpPopover.test.tsx`                    |
| Mouse hover previews, touch does not       | `TidyUpPopover.test.tsx`                    |
| Unmount reverts                            | `TidyUpPopover.test.tsx`                    |
| Empty and locked notes, tiles disabled     | `TidyUpPopover.test.tsx`                    |
| Snapshot, no stacking, tab-scoped revert   | `useCleanupPreview.test.ts`                 |
| Telemetry on open                          | `useDockPopovers.test.tsx`                  |
| Hover budget at the worst case             | `tab-cleanup.perf.test.ts`                  |

## Constants and configuration

| Constant                        | Value | Provenance                          | Safe range |
| ------------------------------- | ----- | ----------------------------------- | ---------- |
| `POPOVER_WIDTHS['tidy-up']`     | 320   | Two 152 px tiles, gap and padding   | 288–384    |
| `TIDY_PREVIEW_WORST_CASE_NODES` | 300   | A dense hand-drawn diagram (D83)    | —          |
| `TIDY_PREVIEW_BUDGET_MS`        | 100   | One hover must feel immediate (D83) | 50–200     |

## Defaults ledger

D81 to D86 in [DEFAULTS.md](DEFAULTS.md).
