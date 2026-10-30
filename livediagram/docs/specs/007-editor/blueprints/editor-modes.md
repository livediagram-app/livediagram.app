# Editor modes blueprint

Derived from [Editor modes](../editor-modes.md). Implementation detail only; the spec owns every
design decision. Draw mode's own tools are blueprinted in
[Draw mode blueprints](../../023-draw-mode/blueprints/README.md).

## Domain and naming

| Term                        | Identifier                                                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor mode                 | `EditorMode` (`'diagram' \| 'draw' \| 'workshop'`), `packages/document/src/editor-mode.ts`                                                                                                                                                                                                  |
| The mode catalogue          | `EDITOR_MODE_CATALOGUE` (`{ id, label, description }[]`), in interface order                                                                                                                                                                                                                |
| Every mode, in order        | `EDITOR_MODES`; the default `DEFAULT_EDITOR_MODE` (`'diagram'`)                                                                                                                                                                                                                             |
| A mode's words              | `editorModeLabel(mode)`, `editorModeDescription(mode)`                                                                                                                                                                                                                                      |
| The next mode (Shift+D)     | `nextEditorMode(mode, step = 1, modes = EDITOR_MODES)`, wrapping round `modes`                                                                                                                                                                                                              |
| A stored value is a mode    | `isEditorMode(v)`; read every stored mode through `parseEditorMode(v)` (`LEGACY_EDITOR_MODES`: a retired `'pages'`, `'plan'`, `'illustrate'` or `'infographic'` → `'diagram'`, `'facilitate'` → `'workshop'`)                                                                               |
| A switch as one tab edit    | `withEditorModeSwitched(tab, mode)` (`packages/document/src/editor-mode-switch.ts`), `switchedTab(tab, next, alsoChange?)` (`useEditorMode.ts`)                                                                                                                                             |
| Legacy names elsewhere      | `readCreationIntent` (`packages/api-schema/src/placement-defaults.ts`); `planModeEnabled` in `RETIRED` (`legacy-preferences.ts`)                                                                                                                                                            |
| The tab's mode              | `Tab.opensIn?: EditorMode` (stored name kept), read through `opensInOf(tab)`                                                                                                                                                                                                                |
| Setting the mode            | `setTabOpensIn(tab, mode)`                                                                                                                                                                                                                                                                  |
| A tab offers the switch     | `editorModeSwitchable(tab)`: false on an event-storming board, new or legacy                                                                                                                                                                                                                |
| The look's one gate         | `hasBoardLook(mode)`: true in Draw mode (the person's own pattern)                                                                                                                                                                                                                          |
| The person's effective mode | `useEditorMode(tab, { canEdit })` → `EditorModeState`                                                                                                                                                                                                                                       |
| The mode resolver           | `resolveEditorMode({ tab, canEdit })`, `apps/editor/lib/editor-mode-store.ts`                                                                                                                                                                                                               |
| A collaborator's switch     | `peerModeSwitchOf(op)`, `peerModeSwitchMessage(name, mode)` (`apps/editor/lib/peer-mode-switch.ts`); `useRoomConnection` `receivePeerModeSwitch`                                                                                                                                            |
| May this person edit        | `useViewPreview(...).canEdit`, `apps/editor/app/document/[id]/useViewPreview.ts`                                                                                                                                                                                                            |
| The mode switch             | `EditorModeSwitch` (beside the menu button, in `ToolbarExplorerButton`'s card) and `StartModeSwitch` (`apps/editor/components/start/`, a start panel's rail): chip `ModeMenuChip` (`compact`, `iconOnly`), menu `ModeMenu` + `ModePreviewArt`, `apps/editor/components/chrome/editor-mode/` |
| The editor's resolved mode  | `EditorModeProvider` / `useEditorModeState()`, `editor-mode-context.tsx`                                                                                                                                                                                                                    |
| A tab's mode icon           | `TabModeIcon`, `apps/editor/components/chrome/editor-mode/`                                                                                                                                                                                                                                 |
| Each mode's mark            | `EDITOR_MODE_ICONS` (`packages/ui/src/icons/drawing-kinds.tsx`), one per mode, Workshop's `FlipchartIcon`, read straight by the chip, the menu rows and the pill                                                                                                                            |
| A template's opening mode   | `templateOpensIn(overrides)`, `apps/editor/app/document/[id]/useTemplateFlow.ts`                                                                                                                                                                                                            |
| The tool a mode starts with | `modeDefaultTool(mobile)`, `useModeDefaultTool`, `apps/editor/hooks/editor/useModeDefaultTool.ts`                                                                                                                                                                                           |
| A new tab's seed            | `newTabSeed(source)`, `newTabOpening(creatorMode, mode?)`, `apps/editor/lib/new-tab-seed.ts`                                                                                                                                                                                                |
| A text box's sizing         | `TextElement.sizing?: TextSizing` (`'fit' \| 'wrap'`), absent = a fixed box                                                                                                                                                                                                                 |
| Ink by name                 | `INK_PEN_COLOUR` (`'ink'`), a `PenColourName`, drawn in `PEN_INK`                                                                                                                                                                                                                           |
| Legacy whiteboard migration | `migrateWhiteboardKind(tab)`, `packages/document/src/legacy-whiteboard-tab.ts`                                                                                                                                                                                                              |
| Legacy text migration       | `migrateLegacyTextSizing(elements)`, `packages/document/src/legacy-text-sizing.ts`                                                                                                                                                                                                          |

"Editor mode" in code and specs; the interface says Diagram, Draw and Workshop. "Whiteboard" names the
activity, the template and Draw mode's dock (`useWhiteboard`, `WhiteboardDock`), never a tab kind.

## Constants and configuration

| Constant                   | Value                                                                         | Where / provenance                                              |
| -------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `EDITOR_MODE_CATALOGUE`    | Diagram, Draw, Workshop                                                       | `editor-mode.ts`; spec "The mode switch"                        |
| `LEGACY_EDITOR_MODES`      | `{ pages, illustrate, infographic, plan: 'diagram', facilitate: 'workshop' }` | `editor-mode.ts`; spec "Stored tabs from other products' modes" |
| `DEFAULT_EDITOR_MODE`      | `'diagram'`                                                                   | Spec: `opensIn` absent = Diagram                                |
| Retired mode store key     | `livediagram:v2:editor-mode:<tabId>`                                          | Per-person era; never read or written now                       |
| `PEN_INK`                  | `#1c1917` light, `#e2e8f0` dark                                               | `pen-colours.ts`; spec "Ink is one colour"                      |
| `WHITEBOARD_UNSET_PATTERN` | `'blank'`                                                                     | Written on a migrated board with no pattern                     |
| `WHITEBOARD_INKED_SHAPES`  | square, circle, triangle, diamond                                             | The shapes a migrated board inks                                |
| Shift+D                    | `EDITOR_MODE_KEYSHORTCUT`                                                     | `editor-mode-copy.ts`; spec "The mode switch"                   |
| `MODE_TINT`                | sky, orange, violet, pink, emerald                                            | `mode-menu-copy.ts`; spec "The mode switch"                     |
| `MODE_TOOLS`               | 4-5 tool names per mode                                                       | `mode-menu-copy.ts`; the preview's chips                        |
| Mode menu preview width    | 288 px (`w-72`), list 192 px (`w-48`)                                         | `ModeMenu`; shown from 640 px (`sm`)                            |
| `LEGACY_WHITEBOARD_KIND`   | `'whiteboard'`                                                                | The stored kind read as a Draw-opening tab                      |

A further mode is one catalogue entry plus its icon in `EDITOR_MODE_ICONS`
(`Record<EditorMode, …>`, so the typecheck names the missing icon).

## Behaviour and state

### The tab's mode

`resolveEditorMode({ tab, canEdit })` (pure, `editor-mode-store.ts`):

1. `mode = opensInOf(tab)`: the tab's own mode, the same for everyone; Diagram when absent or on
   an event-storming board.
2. `canSwitch = tab && editorModeSwitchable(tab) && canEdit && tab.locked !== true`.

Nothing is remembered per person: the old `livediagram:v2:editor-mode:<tab>` keys are never read
or written (left in place). Nothing is pinned per page.

- `useEditorMode(tab, { canEdit, commitTabs, toastInfo })` resolves the mode each render
  (no store, no subscription) and returns `{ mode, setMode, canSwitch, canEdit }`, memoised on those four
  (`useMemo`), so the `EditorModeProvider` value keeps its identity across tab edits that leave the mode alone.
- `setMode(next, alsoChange?)`: no-op unless `canSwitch` and `next !== mode`; else
  `track('Editor', 'Changed', MODE_EVENT[next])` first, then ONE `commitTabs` mapping the active tab
  through `switchedTab(t, next, alsoChange)`: `alsoChange` (what leaving brings), then
  `withEditorModeSwitched`, which sets `opensIn` (`setTabOpensIn`). One undo step: the
  history restores the whole tab, mode included, so Undo switches back for everyone and Redo
  switches again.
- **Every mode offered**: `ModeMenuChip` lists `EDITOR_MODES` whole; every row but the current one switches.
  Shift+D is `editorModeShortcut`: `nextEditorMode(mode, 1, EDITOR_MODES)` while `canSwitch`, else null, on a tab
  with content as on an empty one.
- **One resolution** (`useEditorState`): `editorMode = useEditorMode(...)` drives the switch beside the menu button,
  the start's switch, Shift+D, the palette and the canvas on the active tab. Both switches read it through
  `useEditorModeState()` and write through its `setMode`, so on an empty tab, where both show, a switch in either
  re-renders the other, the palette and any `TabModeIcon` (which reads `opensInOf(tab)`) from the one `Tab.opensIn`.
- **Everyone follows**: a peer's switch arrives as a `tab-meta` op setting `opensIn` (or clearing
  it, back to Diagram) and is applied like any tab change, so every client re-resolves the mode.
  `useRoomConnection` also reads it with `peerModeSwitchOf(op)` and calls
  `receivePeerModeSwitch(name, tabId, mode)` with the sender's presence name
  (`nameByPresenceRef`, null when unknown); the editor toasts `peerModeSwitchMessage` when
  `tabId` is the active tab. An inline text edit stays open across the switch, so nothing typed is
  lost (browser-checked).
- **One `canEdit`**: `useViewPreview` returns `canEdit = sessionRole === 'edit' && !previewing`.
  `useEditorState` derives `isReadOnly = !canEdit` and resolves the mode once with it;
  `EditorView` provides that `EditorModeState` (`EditorModeProvider value={ctx.editorMode}`)
  and every switch reads it through `useEditorModeState()`, so a switch and the canvas cannot
  disagree. `TabModeIcon` draws `opensInOf(tab)` for its own tab.

### Opening mode

- `opensInOf(tab)`: Diagram on an event-storming board; `parseEditorMode(tab.opensIn)` when it is
  one; else Diagram (a stored Pages or Plan mode included). `creationIntentOf` and
  `readCreationIntent` read modes the same way.
- `setTabOpensIn(tab, mode)`: the same tab when not switchable or unchanged; else
  `{ ...tab, opensIn: mode }` (written explicitly, Diagram included).
- **New tab** (`useTabActions.addTab(mode?)`): `newTabSeed(activeTab)` copies the source tab's look and
  never an `opensIn`; the mode comes from `newTabOpening(editorMode, mode)` (new-tab-seed.ts), where `editorMode` is
  the active tab's mode (`opensInOf(activeTab)`, so Diagram on an event-storming board). It returns `{ opensIn: mode ?? editorMode }`, leaving `opensIn` out when
  that is Diagram (absent reads as Diagram). So the tab bar's **+** and **Create New Tab** (`addTab()`) open the
  tab in the active tab's mode, and `addTab(mode)` in the mode asked for. The mode's own start
  shows (Start Diagramming, Start Drawing,
  Start a Workshop). `addTab` returns before anything when
  `!canEditStructure` (a Participant, a Viewer, a tab-scoped link). A template chosen for it then decides (`useTemplateFlow`): `templateOpensIn(overrides)`
  is `overrides.opensIn` when set (the template's own mode, `templateEditorMode`), else
  `undefined` for an event-storming template (`overrides.kind` set), else `'diagram'` (Blank
  included). When
  defined it is written on the tab after `templateCanvasOverrides`, so everyone on the tab moves
  to it. A new document's first tab takes the same `templateCanvasOverrides` on `/new`, so it
  too opens in its template's mode.
- **Templates, MCP, imports**: `templateCanvasOverrides(kind)` writes `opensIn:
templateEditorMode(kind)` for every template not in Diagram (`template-modes.ts`; `'whiteboard'`
  → `{ opensIn: 'draw', backgroundPattern: 'graph' }`),
  used by the picker, `/new` and the MCP `buildTemplateTab`; the
  board-scene `tabPatchOf` (whiteboard profile) and `importBoardsAsDocuments` write
  `opensIn: 'draw'`; `mergeImportedTab` carries `opensIn` (imported wins).

### Gates

Every tool and rule that the tab kind once decided keys on the effective mode (`drawMode =
editorMode.mode === 'draw'` in `useEditorState`, `editorMode` prop on `Canvas`):

| Gate                                                  | Reads                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| Dock model, its keys, pen cursor, eraser mode         | `useWhiteboard({ drawMode })`                                 |
| Strip, tool panels hidden; dock or Palette Draw tools | `Canvas.editorMode` → `CanvasChrome`, `useCanvasChromePanels` |
| Still canvas: no pop-in, picking by the drawn outline | `CanvasStillProvider still`                                   |
| Type-to-edit only on notes and text                   | `useSelectionEditing({ drawMode })`                           |
| Draw style memory scope (`board:`)                    | `useStyleMemory({ board: drawMode })`                         |
| Quick style board rows                                | `useQuickStyle({ drawMode })`                                 |
| Drawn shapes unpainted, Ink; sticky opens for typing  | `useShapeDrawing({ drawMode })`                               |
| Text box placement writes `sizing`                    | `buildDrawnBoxed(..., drawMode)`                              |
| Paste and import-into-tab profile                     | `useBoardSceneInsert`, `useBoardSceneImport`                  |
| Command palette hides the format painter              | `useEditorCommands` (`ctx.editorMode`)                        |
| Empty-canvas and theme-mode banners hidden            | `EditorView`                                                  |
| The person's Draw pattern                             | `resolveViewBackdrop(tab, { mode, drawPattern })`             |

Content rules never read the mode: text hugging keys on `sizing` (`hugsText(el)` in
`apps/editor/lib/text-hug.ts`), for the canvas render (`useTextHug`), label commit, style setters,
resize (`resizedElement`) and landed text (`hugLandedText`).

### Entering and leaving Draw mode

`useWhiteboard`'s effect keys on `<tabId>:<drawMode>` and remembers the previous mode:

- Leaving Draw: a Draw-only intent (`isWhiteboardOnlyIntent`: pen, Path tool, dock shape) is
  cancelled; on a switch, a held eraser becomes Select.
- Entering Draw (a tab opened in Draw or a switch into it): on a switch a palette-armed
  intent is cancelled (a Highlighter arm among them); a held format painter, and on a switch the eraser, become
  Select; then, unless edits are blocked or a Draw intent is held, an empty tab gets the active
  pen in hand and a tab with content keeps Select.

### Text box sizing

- Placement in Draw mode (`placedTextBox`): a tap writes `sizing: 'fit'`, a drag `'wrap'`.
- `hugResizedText`: a side or corner handle without Shift sets `sizing: 'wrap'` and the width;
  top and bottom handles and Shift keep the sizing; Shift scales `textScale`.
- A fixed box (no `sizing`) takes resize bounds as they are and is never hugged.
- A hugging box left empty on commit is removed (`hugCommittedText` → null).

## Interfaces and contracts

```ts
export type EditorMode = 'diagram' | 'draw' | 'workshop';
export function parseEditorMode(v: unknown): EditorMode | undefined;
export type EditorModeState = {
  mode: EditorMode;
  setMode: (next: EditorMode, alsoChange?: (tab: Tab) => Tab) => void;
  canSwitch: boolean;
  canEdit: boolean;
  emptyTab?: boolean;
};
export function useEditorMode(
  tab: (EditorModeTab & Pick<Tab, 'elements'>) | undefined,
  o: {
    canEdit: boolean;
    commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
    toastInfo: (message: string) => void;
  },
): EditorModeState;
export function withEditorModeSwitched<T extends Tab>(
  tab: T,
  mode: EditorMode,
): EditorModeSwitch<T>; // { tab }
export type TabModeChoice = { mode: EditorMode; onChange: (m: EditorMode) => void };
export function peerModeSwitchOf(op: RoomOp): { tabId: string; mode: EditorMode } | null;
export function newTabSeed(source: Tab | undefined): Partial<Tab>;
export function editorModeShortcut(
  s: EditorModeState,
  announce: (m: string) => void,
): (() => void) | null;
```

- `EditorModeTab = Pick<Tab, 'id' | 'kind' | 'opensIn' | 'layers' | 'locked'>`.
- `StartModeSwitch()`: reads `useEditorModeState()` and renders nothing outside a provider, when `!canEdit`, or
  when not `canSwitch`; else `data-start-mode-switch` around `ModeMenuChip({ mode, onChange })`, each change inside a
  `start-mode` view transition.
- `ModeMenuChip`: shows the icon, the name and a chevron, is named "Tab mode: <Label>", and carries
  `data-mode-switch`.
- The editor marks the open tab's mode as `data-editor-mode` on its column (`EditorView`), for the e2e helpers.
- `ModeMenu({ mode, modes, keyLeadsTo, chip, initialFocus, hostZoom, onChange, onClose, fill? })` (`ModeMenu.tsx`), opened by `ModeMenuChip`:
  - `actionOf(option): ModeMenuAction`: `'current'` for `mode`, else `'switch'`. Choosing (a row's click, or
    Enter / Space through `useMenu`'s activate) closes, then calls `onChange` for `'switch'`.
  - Rows: `menuitemradio`, `data-mode-row`, `aria-describedby` to a span holding
    `editorModeDescription`, visible under the
    name below `sm` and `sm:sr-only` above; a `MODE_TINT` tile, a check on the current row.
  - `shown` (initially `mode`) follows `onPointerEnter` and `onFocus` of a row.
  - `ModePreview` (`data-mode-preview`, `aria-hidden`, `hidden sm:flex`): `ModePreviewArt` on the
    tint, the name with `ModeKeyHint` when `shown === keyLeadsTo`, the
    description and `MODE_TOOLS` chips; no button (choosing is the row's alone).
- Placement: only on a start panel's rail (`StartFromTemplates`), never in `ToolbarExplorerButton`,
  the `TabPortalMenu`, the `TabBar` or the `Explorer`.
- `TabModeIcon({ tab, style? })`: the tab's mode's `EDITOR_MODE_ICONS` entry, 12 px, `aria-hidden`;
  `TabPill` passes `style={{ color: legibleTabAccent(tab, isDark) }}`.
- `templateOpensIn(overrides: Pick<Tab, 'opensIn' | 'kind'>): EditorMode | undefined`.
- Wire: `Tab.opensIn` and `TextElement.sizing` are in the OpenAPI schema
  (`EditorMode`, `TextSizing`); `TabKind` is `'diagram' | 'event-storming'`.
- Validation: `isValidElement` accepts `sizing` of `fit` or `wrap` only and `penColour` /
  `penTextColour` of a `PenColourName`, `'ink'` included; `isValidTab` leaves `opensIn` to
  `opensInOf`, which reads anything else as Diagram.

## Data and persistence

| Field / key                          | Class                  | Notes                                                                                                                                                                                                  |
| ------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Tab.opensIn`                        | Document, synced       | The tab's mode, the same for everyone. Absent = Diagram; written by templates, imports and an editor's switch (one undo step; never a new tab); a retired Pages value read as Diagram, never rewritten |
| Per-person mode (retired)            | Device-local           | `livediagram:v2:editor-mode:<tab>` keys from before the shared mode: left in place, never read                                                                                                         |
| `drawPattern`                        | Synced user preference | The person's Draw pattern, Grid until chosen                                                                                                                                                           |
| `TextElement.sizing`                 | Document               | Replaces `autoWidth`                                                                                                                                                                                   |
| `penColour` / `penTextColour: 'ink'` | Document               | Ink by name                                                                                                                                                                                            |

Migration on read, in every entry point (`migrateStoredTab` / `migrateIncomingTab`: api
`rowToTab`, thumbnails, offline store, file import, realtime ops, api writes), never in
`stampTabKind`:

- `migrateWhiteboardKind`: `kind: 'whiteboard'` → `kind: 'diagram'`, `opensIn: 'draw'`, an unset
  `backgroundPattern` → `'blank'`. Elements: an inked shape with no outline gets
  `penColour: 'ink'`, no fill → `fillColor: 'transparent'`, no label colour →
  `penTextColour: 'ink'`; a path gets Ink and no fill; an arrow Ink; a non-highlighter stroke
  loses a fill it never showed; a text box gets `sizing` (`'fit'` for `autoWidth: true`, else
  `'wrap'`). Logs `[editor-mode] whiteboard tab migrated to Draw { tabId, inked }`.
- `migrateLegacyTextSizing` (in `migrateStoredElements`): `autoWidth: true` → `sizing: 'fit'`,
  `autoWidth: false` dropped; a stored `sizing` wins.
- Telemetry history: the stored `Whiteboard` category was renamed to `Draw`, so the lines continue.

## Errors and edge cases

| Case                                                                | Handling                                                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A key from the per-person era in storage                            | Never read; the tab's mode wins                                                                                                          |
| A peer's op with no presence name yet                               | The toast says "Someone"                                                                                                                 |
| Undo or redo across a switch                                        | The snapshot restores `opensIn`; everyone moves to that mode, no toast for the one who undid                                             |
| Forged `opensIn` on an event-storming board                         | `opensInOf` → Diagram; `setTabOpensIn` returns the tab                                                                                   |
| Unknown `opensIn` value                                             | Read as Diagram                                                                                                                          |
| Retired `opensIn: 'pages'` (or `'illustrate'`, `'infographic'`)     | Read as Diagram (`parseEditorMode`, `LEGACY_EDITOR_MODES`); `dropRetiredPages` drops its pages, articles and Pages-only elements on read |
| Retired `opensIn: 'plan'`, or a Board, Sheet, Dashboard or Form tab | Read as Diagram; `dropRetiredPlan` drops its `kind`, Plan-only fields, Plan board and Sheet elements on read                             |
| A tab upgraded for the migration (`migrateStoredTabKeepingRetired`) | Every other stored-tab upgrade runs; `opensIn`, `kind`, pages, articles, dashboard, form and their elements are kept                     |
| Switch by a visitor, on a locked tab or ES board                    | `setMode` returns early: nothing written, no telemetry                                                                                   |
| Switch to the mode the tab is in                                    | No commit                                                                                                                                |
| Shift+D on a tab with content                                       | `editorModeShortcut` returns null: nothing written, no telemetry                                                                         |
| A peer switches while I type in a label                             | The editor stays open; the text commits as usual; a toast names the peer                                                                 |
| Previewing as a viewer                                              | `canEdit` false: no switch, the tab's mode, read-only                                                                                    |
| Event-storming board, or outside an editor                          | `StartModeSwitch` renders nothing; its mode is Diagram                                                                                   |
| A tab switched while a paste's images upload                        | The paste is dropped (unchanged board-scene rule)                                                                                        |
| Stale client sends a `Whiteboard` telemetry event                   | Refused by the closed category list                                                                                                      |

## Security and trust

- The mode is presentation: the api never reads it; edits stay guarded by role and lock.
- `opensIn` arrives untrusted; it is never validated as an enum because every reader goes through
  `opensInOf`, which cannot yield anything but a mode.
- A switch writes `opensIn` only for an editor (`canEdit`) on an unlocked, switchable tab, as one
  commit; the room enforces the edit role on its sync like any tab edit. A forged `opensIn` from a
  peer can only ever read as a mode (`opensInOf`). The peer toast names the sender by their
  presence name, never by anything in the op.
- Telemetry carries the mode name only, never a tab or document id.

## Performance and limits

- The mode resolves per render from the tab (`opensInOf`): no store, no subscription, no storage
  read. The resolved state is memoised, so the two switches (context consumers) re-render on a switch or a role
  change, not on every edit of the tab. The switch adds no dependency, but it brings `ModeMenu` and its preview art
  into the document page's first load: measured on the static export, first-load JS went from 3,958,639 to
  3,968,623 bytes (1,369,987 to 1,375,064 gzipped, +5.0 KB, +0.37%). Should that budget tighten, `ModeMenu` can load
  on demand, preloaded when the pointer reaches the chip.
- A switch is one commit. The sync is one small `tab-meta` op (`opensIn`).
- Migration returns the same tab and element objects when nothing changes (identity-preserving).

## Presentation and UX

- `EditorModeSwitch`: rendered by `ToolbarExplorerButton` right after the menu button's `HoverCard` and before
  `TabNameInBox`, in the same `ToolbarMenuCard` (so it follows the card into the strip's row on a phone and into the
  corner on a Draw tab or for a read-only visitor). Nothing unless `canEdit && canSwitch`. A content-width slot
  (`data-editor-mode-switch`), the name dropped with `iconOnly` (`useIsMobileViewport() || inline`).
  Its chip is `ModeMenuChip compact`: `h-9 rounded-md px-2 gap-1.5`, the icon, the name unless `iconOnly`, the
  chevron, on `TOOLBAR_TRIGGER_TONE` with `MODE_SWITCH_FOCUS`; its menu opens with `fill={false}`, so it mounts in a `Portal`, fixed 6px below the chip and clamped
  `POPOVER_VIEWPORT_MARGIN` inside the viewport (re-placed on resize); the chip's outside-press check counts
  `[data-mode-menu]` as inside. In the card it sat under the empty tab's tray and ran off a phone's edge.
- The start's chip (`ModeMenuChip`): a full-bleed `h-12` row at the top of the rail, the mode's icon, its name and a chevron
  on `TOOLBAR_TRIGGER_TONE`, its focus ring drawn inside. No hover card (it would cover the menu). The menu opens
  downward (`absolute top-full mt-1.5 left-0`), spanning the panel under `sm`. The menu opens at design size: on
  opening, the chip reads its host's effective zoom (`effectiveZoom`: `currentCSSZoom`, else screen width over
  layout width) and the menu sets `zoom: 1 / hostZoom`, undoing the panel UI scale ([UI scale](../ui-scale.md)).
  The same for everyone: power user mode does not change it.
- The tab pill shows no mode icon (its name alone); `TabModeIcon` marks the split view's chip.
- No Mode section in the tab menu.
- No other cue marks the mode (spec "No further cue").

## Accessibility

- Chip: `aria-haspopup="menu"`, `aria-expanded`, `aria-keyshortcuts="Shift+D"`, named
  "Editor mode: <Label>" beside the menu button (`compact`, also when `iconOnly`) and "Tab mode: <Label>" on a start; ↑/↓ on the chip open the menu. Rows `menuitemradio` with
  `aria-checked`, focus on the checked row on opening; ↑/↓ wrap, Home/End, Enter/Space, Escape
  return focus to the chip. Tab away closes the menu: a blur closes it only when focus moves to
  another element outside it (`relatedTarget` set); a blur to nowhere is a press (Safari does not
  focus a pressed button), so the row's click still lands. A press outside is
  `useClickOutside`'s. `TabModeIcon` is `aria-hidden`.
- Shift+D carries `aria-keyshortcuts`; a switch by key is announced politely
  (`announce('Draw mode')`). The key obeys the character-key shortcuts setting.
- Focus rings `MODE_SWITCH_FOCUS` (brand-600 light, brand-400 dark, at least 3:1).

## Web Experience

- CLS: the switch fills its row on the start's rail; beside the menu button it takes its content's width, so the tab
  name shifts a little on a switch (a user action, so it is not counted as layout shift). The Draw dock re-measures
  the card through its ResizeObserver.
- INP: a switch is one commit; no fetch, no remount of the canvas.
- LCP: unaffected; the mode resolves synchronously on first render from the tab.

## Observability

| Event / log                                                | Where                   |
| ---------------------------------------------------------- | ----------------------- |
| `Editor · Changed · ModeDiagram / ModeDraw / ModeWorkshop` | `useEditorMode.setMode` |
| `Draw · …` (formerly `Whiteboard`)                         | Draw mode's emitters    |
| `[editor-mode] switched { tabId, from, to }` (debugLog)    | `setMode`               |
| `[editor-mode] whiteboard tab migrated to Draw`            | `migrateWhiteboardKind` |
| `<Name> switched this tab to <Mode>.` (toast)              | `receivePeerModeSwitch` |

## Testing

| Spec rule                                        | Test                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Modes, catalogue, opening mode, ES no switch     | `packages/document/src/editor-mode.test.ts`                                        |
| Stored whiteboard → general tab in Draw, inked   | `legacy-whiteboard-tab.test.ts`, `stored-tab.test.ts`, api `tab-row.test.ts`       |
| `autoWidth` → `sizing`                           | `legacy-text-sizing.test.ts`, `validate.test.ts`                                   |
| The tab's mode for everyone; view role; lock; ES | `apps/editor/lib/editor-mode-store.test.ts`, `hooks/editor/useEditorMode.test.tsx` |
| A switch is one tab edit                         | `useEditorMode.test.tsx`, `packages/document/src/editor-mode-switch.test.ts`       |

| One `canEdit`; preview hides the switch | `useViewPreview.test.tsx`, `components/start/StartModeSwitch.menu.test.tsx` |
| The switch: named, menu below, rows, keys | `StartModeSwitch.menu.test.tsx` "StartModeSwitch chip", `StartModeSwitch.test.tsx`, `ModeMenu.test.tsx` |
| A pressed row lands; Tab away closes | `StartModeSwitch.menu.test.tsx` "keeps the menu open through a blur to nowhere…", "closes when focus moves outside (Tab away)" |
| The switch beside the menu button, in its card; icon only on a phone; none in the tab menu | `components/chrome/editor-mode/EditorModeSwitch.test.tsx`, `ToolbarExplorerButton.test.tsx` "carries the mode switch right of the menu button…", "drops the label on a phone…", e2e `editor-modes.spec.ts` "a tab offers the mode switch beside the menu button, and none in its tab menu" |
| Only an Editor switches (Participant, Viewer, locked, event storming get none) | `EditorModeSwitch.test.tsx` "by share role", `ToolbarExplorerButton.test.tsx` "carries no switch for a session that cannot edit", `useEditorMode.test.tsx` |
| The two switches agree on an empty tab, with the tab icon | `EditorModeSwitch.test.tsx` "EditorModeSwitch and the start switch on an empty tab", e2e `editor-modes.spec.ts` "on an empty tab the switch beside the menu button and the start's agree" |
| One context value across edits | `useEditorMode.test.tsx` "returns the same object across an edit that leaves the mode alone" |
| A Draw tool in hand never takes the press | `ToolbarExplorerButton.test.tsx` "marks its card as floating chrome…" |
| The tab pill shows no mode icon | `components/chrome/TabPill.shape.test.tsx`; the icon itself `components/chrome/editor-mode/TabModeIcon.test.tsx` |
| A template decides the tab's mode | `app/document/[id]/useTemplateFlow.test.ts` |
| A peer's switch is followed and named | `lib/peer-mode-switch.test.ts`, e2e `editor-modes.spec.ts` "the start's switch changes the tab for everyone, and Undo switches it back" |
| A tab with content switches, losslessly, by the switch and by key | `EditorModeSwitch.test.tsx` "lets an Editor switch a tab with content, losslessly", `editor-mode-shortcut.test.ts`, e2e `editor-modes.spec.ts` "a drawn-on tab switches to Diagram beside the menu button, keeping its strokes, and back by Shift+D" |
| The tool a mode starts with | `hooks/editor/useModeDefaultTool.test.ts` |
| New tab opens in its maker's mode, on its start | `lib/new-tab-seed.test.ts`, `hooks/persistence/useTabActions.addTab.test.tsx`, e2e `editor-modes.spec.ts` "a new tab opens in the mode it was made from" |
| Entering / leaving Draw | `hooks/canvas/useWhiteboard.test.tsx`, `useWhiteboard.board-tools.test.tsx` |
| Hugging on `sizing` in both modes | `lib/text-hug.test.ts`, `boxed-drag-resolve.resize.test.ts`, `useEditorDrag.shift-resize.test.tsx`, `useTextStyleSetters.test.ts` |
| Template, MCP, imports open in Draw | `apps/editor/lib/templates.test.ts`, `packages/templates/src/template-tab.test.ts`, `lib/board-scene/land.test.ts`, `lib/import-merge.test.ts` |
| Telemetry rename and history | Telemetry app suites |
| Shift+D | `hooks/editor/editor-mode-shortcut.test.ts`, e2e "Shift+D moves an empty tab to the next mode" |

Workshop mode's own rules are blueprinted in
[Workshop mode](../../012-collaboration/blueprints/workshop-mode.md).

Not covered by a unit test: `parseEditorMode`'s legacy name, the
peer toast's wiring in `useRoomConnection`, and a label edit kept across a peer's switch (browser-checked with two windows). `addTab(mode)` is covered by
`useTabActions.addTab.test.tsx` and `new-tab-seed.test.ts`.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D15 to D22.
