# Editor modes blueprint

Derived from [Editor modes](../editor-modes.md). Implementation detail only; the spec owns every
design decision. Draw mode's own tools are blueprinted in
[Draw mode blueprints](../../023-draw-mode/blueprints/README.md); Illustrate mode's pages in
[Illustrate pages](illustrate-pages.md) and [Article pages](article-pages.md).

## Domain and naming

| Term                        | Identifier                                                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor mode                 | `EditorMode` (`'diagram' \| 'draw' \| 'illustrate'`), `packages/document/src/editor-mode.ts`                                                                                                                              |
| The mode catalogue          | `EDITOR_MODE_CATALOGUE` (`{ id, label, description }[]`), in interface order                                                                                                                                              |
| Every mode, in order        | `EDITOR_MODES`; the default `DEFAULT_EDITOR_MODE` (`'diagram'`)                                                                                                                                                           |
| A mode's words              | `editorModeLabel(mode)`, `editorModeDescription(mode)`                                                                                                                                                                    |
| The next mode (Shift+D)     | `nextEditorMode(mode, step = 1)`, wrapping round the catalogue                                                                                                                                                            |
| A stored value is a mode    | `isEditorMode(v)`; read every stored mode through `parseEditorMode(v)` (legacy `'infographic'` → `'illustrate'`, `LEGACY_EDITOR_MODES`)                                                                                   |
| The page look's one gate    | `hasPageLook(mode)`: true in Illustrate mode                                                                                                                                                                              |
| A switch as one tab edit    | `withEditorModeSwitched(tab, mode)` (`packages/document/src/editor-mode-switch.ts`), `switchedTab(tab, next, alsoChange?)` (`useEditorMode.ts`)                                                                           |
| Leaving Illustrate          | `useLeaveIllustrate(editorMode, { tab, canEdit, commitTabs })`, `LeaveIllustrateDialog` ([Article pages](article-pages.md))                                                                                               |
| Legacy names elsewhere      | `parsePlacementDefaultKey`, `legacyPlacementDefaultKeys` (`packages/api-schema/src/placement-defaults.ts`); `illustrateModeEnabled` / `infographicModeEnabled` / `planModeEnabled` in `RETIRED` (`legacy-preferences.ts`) |
| The tab's mode              | `Tab.opensIn?: EditorMode` (stored name kept), read through `opensInOf(tab)`                                                                                                                                              |
| Setting the mode            | `setTabOpensIn(tab, mode)`                                                                                                                                                                                                |
| A tab offers the switch     | `editorModeSwitchable(tab)`: false on an event-storming board, new or legacy                                                                                                                                              |
| The look's one gate         | `hasBoardLook(mode)`: true in Draw mode (the person's own pattern)                                                                                                                                                        |
| The person's effective mode | `useEditorMode(tab, { canEdit })` → `EditorModeState`                                                                                                                                                                     |
| The mode resolver           | `resolveEditorMode({ tab, canEdit })`, `apps/live/lib/editor-mode-store.ts`                                                                                                                                               |
| A collaborator's switch     | `peerModeSwitchOf(op)`, `peerModeSwitchMessage(name, mode)` (`apps/live/lib/peer-mode-switch.ts`); `useRoomConnection` `receivePeerModeSwitch`                                                                            |
| May this person edit        | `useViewPreview(...).canEdit`, `apps/live/app/document/[id]/useViewPreview.ts`                                                                                                                                            |
| The mode switch             | `EditorModeSwitch` (chip `ModeMenuChip`), `apps/live/components/chrome/editor-mode/`                                                                                                                                      |
| The editor's resolved mode  | `EditorModeProvider` / `useEditorModeState()`, `editor-mode-context.tsx`                                                                                                                                                  |
| The tab pill's mode icon    | `TabModeIcon`, `apps/live/components/chrome/editor-mode/`                                                                                                                                                                 |
| Each mode's mark            | `EDITOR_MODE_ICON` (`editor-mode-copy.ts`): `FlowchartIcon`, `MarkerIcon`, `IllustrateIcon` (`packages/ui/src/icons/drawing-kinds.tsx`)                                                                                   |
| A template's opening mode   | `templateOpensIn(overrides)`, `apps/live/app/document/[id]/useTemplateFlow.ts`                                                                                                                                            |
| The tab menu's Mode         | `useTabModeMenu` (`apps/live/hooks/editor/`), `TabModeMenuSection` (chrome)                                                                                                                                               |
| A new tab's seed            | `newTabSeed(source)`, `apps/live/lib/new-tab-seed.ts`                                                                                                                                                                     |
| A text box's sizing         | `TextElement.sizing?: TextSizing` (`'fit' \| 'wrap'`), absent = a fixed box                                                                                                                                               |
| Ink by name                 | `INK_PEN_COLOUR` (`'ink'`), a `PenColourName`, drawn in `PEN_INK`                                                                                                                                                         |
| Legacy whiteboard migration | `migrateWhiteboardKind(tab)`, `packages/document/src/legacy-whiteboard-tab.ts`                                                                                                                                            |
| Legacy text migration       | `migrateLegacyTextSizing(elements)`, `packages/document/src/legacy-text-sizing.ts`                                                                                                                                        |

"Editor mode" in code and specs; the interface says Diagram and Draw. "Whiteboard" names the
activity, the template and Draw mode's dock (`useWhiteboard`, `WhiteboardDock`), never a tab kind.

## Constants and configuration

| Constant                   | Value                                      | Where / provenance                               |
| -------------------------- | ------------------------------------------ | ------------------------------------------------ |
| `EDITOR_MODE_CATALOGUE`    | Diagram, Draw, Illustrate                  | `editor-mode.ts`; spec "The mode switch"         |
| `LEGACY_EDITOR_MODES`      | `{ infographic: 'illustrate' }`            | `editor-mode.ts`; spec "Naming in the interface" |
| Legacy default-folder key  | `'mode:infographic'` → `'mode:illustrate'` | `LEGACY_PLACEMENT_DEFAULT_KEYS`; spec            |
| `DEFAULT_EDITOR_MODE`      | `'diagram'`                                | Spec: `opensIn` absent = Diagram                 |
| Mode store key             | `livediagram:v2:editor-mode:<tabId>`       | `editorModeKey`; one key per tab, device-local   |
| Switch slot width          | 48 px (`w-12`)                             | `EditorModeSwitch` `SLOT_WIDTH`; zero shift      |
| `PEN_INK`                  | `#1c1917` light, `#e2e8f0` dark            | `pen-colours.ts`; spec "Ink is one colour"       |
| `WHITEBOARD_UNSET_PATTERN` | `'blank'`                                  | Written on a migrated board with no pattern      |
| `WHITEBOARD_INKED_SHAPES`  | square, circle, triangle, diamond          | The shapes a migrated board inks                 |
| Shift+D                    | `EDITOR_MODE_KEYSHORTCUT`                  | `editor-mode-copy.ts`; spec "The mode switch"    |
| `LEGACY_WHITEBOARD_KIND`   | `'whiteboard'`                             | The stored kind read as a Draw-opening tab       |

A further mode is one catalogue entry plus its icon in `EDITOR_MODE_ICON`
(`Record<EditorMode, …>`, so the typecheck names the missing icon).

## Behaviour and state

### The tab's mode

`resolveEditorMode({ tab, canEdit })` (pure, `editor-mode-store.ts`):

1. `mode = opensInOf(tab)`: the tab's own mode, the same for everyone; Diagram when absent or on
   an event-storming board.
2. `canSwitch = tab && editorModeSwitchable(tab) && canEdit && tab.locked !== true`.

Nothing is remembered per person: the old `livediagram:v2:editor-mode:<tab>` keys are never read
or written (left in place). Nothing is pinned per page.

- `useEditorMode(tab, { canEdit, commitTabs, toastInfo })` resolves the mode each render (no store,
  no subscription) and returns `{ mode, setMode, canSwitch, canEdit }`.
- `setMode(next, alsoChange?)`: no-op unless `canSwitch` and `next !== mode`; else
  `track('Editor', 'Changed', MODE_EVENT[next])` first, then ONE `commitTabs` mapping the active tab
  through `switchedTab(t, next, alsoChange)`: `alsoChange` (what leaving brings, such as
  `useLeaveIllustrate`'s Turn Into Pages), then `withEditorModeSwitched`, which sets `opensIn`
  (`setTabOpensIn`) and, entering Illustrate, `withContentOnAPage` ([Illustrate
  pages](illustrate-pages.md) "Into pages"). When it made a page: toast "Put onto a page that fits
  it. Undo switches back to <from>." and `Tab · Changed · PageFitToContent`. One undo step: the
  history restores the whole tab, mode included, so Undo switches back for everyone and Redo
  switches again.
- **Every mode offered**: `ModeMenuChip` and `TabModeMenuSection` list `EDITOR_MODE_CATALOGUE`
  whole; Shift+D is `nextEditorMode(mode, 1)`.
- **Wrappers, in order** (`useEditorState`): `rawEditorMode = useEditorMode(...)`; then
  `useLeaveIllustrate(rawEditorMode, { tab, canEdit })` (asks before leaving Illustrate; Turn Into
  Pages passes its conversion as `alsoChange`, so the conversion and the switch are one edit). The
  resulting `editorMode` drives the switch, Shift+D, the canvas and the tab menu's Mode on the
  active tab.
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
  one (a stored `infographic` reads as Illustrate); else Diagram. `creationIntentOf` and
  `readCreationIntent` read modes the same way.
- `setTabOpensIn(tab, mode)`: the same tab when not switchable or unchanged; else
  `{ ...tab, opensIn: mode }` (written explicitly, Diagram included).
- **The tab menu's Mode** (`useTabModeMenu({ canEdit, commitTabs, activeId, switchActive })`,
  `switchActive` being the editor's `editorMode.setMode`): `choiceFor(tab)` is `undefined` unless
  `canEdit && editorModeSwitchable(tab) && !tab.locked`; else `{ mode: opensInOf(tab), onChange }`.
  A choice of the tab's mode does nothing (`TabModeMenuSection` drops a press on the checked row).
  The active tab switches through `switchActive` (with the Leave Illustrate questions); another
  tab gets `Editor · Changed · Mode<Next>` and one `commitTabs` of `switchedTab(t, mode)`.
- **New tab** (`useTabActions.addTab`): `newTabSeed(activeTab)` copies the source tab's look
  and never an `opensIn`, so the tab opens in Diagram whatever its creator's mode, except Plan:
  `newTabOpening(editorMode)` (new-tab-seed.ts) gives `{ opensIn: 'plan', quickStart: false }` from
  Plan (the tab is made with `opensIn: 'plan'` and `setTemplatePickerMode` is not called), else
  `{ quickStart: true }` (the Quick Start opens, as before). A template
  chosen for it then decides (`useTemplateFlow`): `templateOpensIn(overrides)` is
  `overrides.opensIn` when set (`'draw'` for `whiteboard`), else `undefined` for an
  event-storming template (`overrides.kind` set), else `'diagram'` (Blank included). When
  defined it is written on the tab after `templateCanvasOverrides`, so everyone on the tab moves
  to it. A new document's first tab takes the same `templateCanvasOverrides` on `/new`, so it
  too opens in Diagram unless it is a Whiteboard.
- **Templates, MCP, imports**: `templateCanvasOverrides('whiteboard')` → `{ opensIn: 'draw',
backgroundPattern: 'graph' }`, used by the picker, `/new` and the MCP `buildTemplateTab`; the
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
`apps/live/lib/text-hug.ts`), for the canvas render (`useTextHug`), label commit, style setters,
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
export type EditorMode = 'diagram' | 'draw' | 'illustrate';
export function parseEditorMode(v: unknown): EditorMode | undefined;
export type EditorModeState = {
  mode: EditorMode;
  setMode: (next: EditorMode, alsoChange?: (tab: Tab) => Tab) => void;
  canSwitch: boolean;
  canEdit: boolean;
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
): { tab: T; pagedContent: boolean };
export type TabModeChoice = { mode: EditorMode; onChange: (m: EditorMode) => void };
export function peerModeSwitchOf(op: RoomOp): { tabId: string; mode: EditorMode } | null;
export function newTabSeed(source: Tab | undefined): Partial<Tab>;
export function editorModeShortcut(
  s: EditorModeState,
  announce: (m: string) => void,
): (() => void) | null;
```

- `EditorModeTab = Pick<Tab, 'id' | 'kind' | 'opensIn' | 'layers' | 'locked'>`.
- `EditorModeSwitch({ className?, align?: 'left' | 'right' })` (default `left`): reads
  `useEditorModeState()` and renders nothing outside a provider, when `!canEdit` or when
  `!canSwitch`; else a fixed slot (`data-editor-mode-switch`, `w-12`) around
  `ModeMenuChip({ mode, onChange, align })`.
- Placement: inside `ToolbarExplorerButton`, after the menu button, in its corner card or inline
  in the phone strip (icon-only, `align` left). That card carries `data-floating-panel`, so the
  canvas's capture-phase pen gesture (`useCanvasSurfaceGestures`) skips a press there: with a Draw
  tool in hand, a press on the chip or its menu switches rather than starting a stroke. Not in `TabBar` (which no longer takes the
  mode) nor the `Explorer`.
- `TabModeIcon({ tab, style? })`: the tab's mode's `EDITOR_MODE_ICON`, 12 px, `aria-hidden`;
  `TabPill` passes `style={{ color: legibleTabAccent(tab, isDark) }}`.
- `templateOpensIn(overrides: Pick<Tab, 'opensIn' | 'kind'>): EditorMode | undefined`.
- `TabPortalMenu.modeChoice?: TabModeChoice`: absent, no Mode section.
- Wire: `Tab.opensIn` and `TextElement.sizing` are in the OpenAPI schema
  (`EditorMode`, `TextSizing`); `TabKind` is `'diagram' | 'event-storming'`.
- Validation: `isValidElement` accepts `sizing` of `fit` or `wrap` only and `penColour` /
  `penTextColour` of a `PenColourName`, `'ink'` included; `isValidTab` leaves `opensIn` to
  `opensInOf`, which reads anything else as Diagram.

## Data and persistence

| Field / key                          | Class                  | Notes                                                                                                                                                                                               |
| ------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab.opensIn`                        | Document, synced       | The tab's mode, the same for everyone. Absent = Diagram; written by templates, imports and an editor's switch (one undo step; never a new tab); `'infographic'` read as Illustrate, never rewritten |
| Per-person mode (retired)            | Device-local           | `livediagram:v2:editor-mode:<tab>` keys from before the shared mode: left in place, never read                                                                                                      |
| Opened mode                          | Memory, per page       | Lost on reload by design                                                                                                                                                                            |
| `drawPattern`                        | Synced user preference | The person's Draw pattern, Grid until chosen                                                                                                                                                        |
| `TextElement.sizing`                 | Document               | Replaces `autoWidth`                                                                                                                                                                                |
| `penColour` / `penTextColour: 'ink'` | Document               | Ink by name                                                                                                                                                                                         |

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
- Telemetry history: D1 migration `apps/api/migrations/0061_draw_telemetry.sql` renames the
  `Whiteboard` category to `Draw`.

## Errors and edge cases

| Case                                              | Handling                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A key from the per-person era in storage          | Never read; the tab's mode wins                                                              |
| A peer's op with no presence name yet             | The toast says "Someone"                                                                     |
| Undo or redo across a switch                      | The snapshot restores `opensIn`; everyone moves to that mode, no toast for the one who undid |
| The tab menu on a locked tab                      | Not offered (`choiceFor` undefined)                                                          |
| The tab menu's checked mode                       | No call, no commit, no telemetry                                                             |
| Forged `opensIn` on an event-storming board       | `opensInOf` → Diagram; `setTabOpensIn` returns the tab                                       |
| Unknown `opensIn` value                           | Read as Diagram                                                                              |
| Legacy `opensIn: 'infographic'`                   | Read as Illustrate (`parseEditorMode`); not rewritten                                        |
| Switch by a visitor, on a locked tab or ES board  | `setMode` returns early: nothing written, no telemetry                                       |
| Switch to the mode the tab is in                  | No commit                                                                                    |
| A peer switches while I type in a label           | The editor stays open; the text commits as usual; a toast names the peer                     |
| Previewing as a viewer                            | `canEdit` false: no switch, the tab's mode, read-only                                        |
| Event-storming board, or outside an editor        | `EditorModeSwitch` renders nothing (no slot); the pill icon shows Diagram                    |
| A tab switched while a paste's images upload      | The paste is dropped (unchanged board-scene rule)                                            |
| Stale client sends a `Whiteboard` telemetry event | Refused by the closed category list                                                          |

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
  read.
- A switch is one commit; entering Illustrate adds `withContentOnAPage`, O(elements) (measured
  1.4 ms at 3000 elements, [Illustrate pages blueprint](illustrate-pages.md) "Performance and
  limits"). The sync is one small `tab-meta` op (`opensIn`, plus `pages` entering Illustrate).
- Migration returns the same tab and element objects when nothing changes (identity-preserving).

## Presentation and UX

- The chip (`ModeMenuChip`): the mode's icon and a chevron on `TOOLBAR_TRIGGER_TONE`, filling
  its fixed slot, icon-only: `h-9`, the 36 px menu button's height, centred, in the `w-12` slot. No hover
  card (it would cover the menu). The menu opens downward (`absolute top-full mt-1.5`, `left-0`, or `right-0` for
  `align="right"`), `min-w-36`, one compact row per catalogue entry: the 16 px icon, the name
  (`text-xs`), a check on the current row and the `⇧D` hint (`ModeKeyHint`) on the row
  `nextEditorMode(mode)` leads to; no descriptions. The menu opens at design size: on opening,
  the chip reads its host's effective zoom (`effectiveZoom`: `currentCSSZoom`, else screen width
  over layout width) and the menu sets `zoom: 1 / hostZoom`, undoing the toolbar or panel UI
  scale ([UI scale](../ui-scale.md)). Tour anchors: `data-tour-id="editor-mode"` on the chip,
  `"editor-mode-menu"` on the menu ([Editor tour](../editor-tour.md) step 4). The same for
  everyone: power user mode does not change it.
- The tab pill leads with `TabModeIcon` (in place of the accent dot), tinted with the tab's
  accent.
- Mode is an accordion section of the tab menu (`TabModeMenuSection`), after Content: one row per
  catalogue entry with its icon, name, description and a dot on the checked one. Offered only
  where a switch is (no disabled state).
- No other cue marks the mode (spec "No further cue").

## Accessibility

- Chip: `aria-haspopup="menu"`, `aria-expanded`, `aria-keyshortcuts="Shift+D"`, named
  "Editor mode: <Label>"; ↑/↓ on the chip open the menu. Rows `menuitemradio` with
  `aria-checked`, focus on the checked row on opening; ↑/↓ wrap, Home/End, Enter/Space, Escape
  return focus to the chip. Tab away closes the menu: a blur closes it only when focus moves to
  another element outside it (`relatedTarget` set); a blur to nowhere is a press (Safari does not
  focus a pressed button), so the row's click still lands. A press outside is
  `useClickOutside`'s. The tab pill's icon is `aria-hidden`.
- Shift+D carries `aria-keyshortcuts`; a switch by key is announced politely
  (`announce('Draw mode')`). The key obeys the character-key shortcuts setting.
- The tab menu's Mode: `role="group"` named "Mode", toggle buttons (`aria-pressed`) in the Tab control
  menu, `menuitemradio` rows in a command menu.
- Focus rings `MODE_SWITCH_FOCUS` (brand-600 light, brand-400 dark, at least 3:1).

## Web Experience

- CLS: the switch's slot has one fixed width (`w-12`), so nothing beside it moves on a switch.
  On a tab without a switch (an event-storming board) it renders nothing, so the menu card
  narrows on that tab change; a mode switch never moves anything.
- INP: a switch is one commit (and, entering Illustrate, one linear pass over the elements); no
  fetch, no remount of the canvas.
- LCP: unaffected; the mode resolves synchronously on first render from the tab.

## Observability

| Event / log                                                    | Where                   |
| -------------------------------------------------------------- | ----------------------- |
| `Editor · Changed · ModeDiagram / ModeDraw / ModeIllustrate`   | `useEditorMode.setMode` |
| `Editor · Changed · Mode*` from the tab menu (another tab)     | `useTabModeMenu`        |
| `Tab · Changed · PageFitToContent` and its toast               | `useEditorMode.setMode` |
| `Draw · …` (formerly `Whiteboard`)                             | Draw mode's emitters    |
| `[editor-mode] switched { tabId, from, to, paged }` (debugLog) | `setMode`               |
| `[editor-mode] switched from the tab menu { tabId, mode }`     | `useTabModeMenu`        |
| `[editor-mode] whiteboard tab migrated to Draw`                | `migrateWhiteboardKind` |
| `<Name> switched this tab to <Mode>.` (toast)                  | `receivePeerModeSwitch` |

## Testing

| Spec rule                                        | Test                                                                                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Modes, catalogue, opening mode, ES no switch     | `packages/document/src/editor-mode.test.ts` ("are Diagram, Draw and Illustrate", "draws the page in Illustrate mode only")                   |
| Stored whiteboard → general tab in Draw, inked   | `legacy-whiteboard-tab.test.ts`, `stored-tab.test.ts`, api `tab-row.test.ts`                                                                 |
| `autoWidth` → `sizing`                           | `legacy-text-sizing.test.ts`, `validate.test.ts`                                                                                             |
| The tab's mode for everyone; view role; lock; ES | `apps/live/lib/editor-mode-store.test.ts`, `hooks/editor/useEditorMode.test.tsx`                                                             |
| A switch is one tab edit, with its page          | `useEditorMode.test.tsx`, `packages/document/src/editor-mode-switch.test.ts`, `hooks/editor/useLeaveIllustrate.test.ts`                      |
| One `canEdit`; preview hides the switch          | `useViewPreview.test.tsx`, `components/chrome/editor-mode/EditorModeSwitch.test.tsx`                                                         |
| The switch: icon only, menu below, rows, keys    | `EditorModeSwitch.test.tsx` "EditorModeSwitch chip"                                                                                          |
| A pressed row lands; Tab away closes             | `EditorModeSwitch.test.tsx` "keeps the menu open through a blur to nowhere…", "closes when focus moves outside (Tab away)"                   |
| The switch beside the menu button                | `components/chrome/ToolbarExplorerButton.test.tsx`, `apps/live/e2e/editor-modes.spec.ts`                                                     |
| A Draw tool in hand never takes the press        | `ToolbarExplorerButton.test.tsx` "marks its card as floating chrome…", e2e "switches back to Diagram with a marker in hand"                  |
| The tab pill shows the tab's mode                | `components/chrome/TabPill.test.tsx`                                                                                                         |
| A template decides the tab's mode                | `app/document/[id]/useTemplateFlow.test.ts`                                                                                                  |
| The tab menu's Mode                              | `hooks/editor/useTabModeMenu.test.tsx`, `components/chrome/TabModeMenuSection.test.tsx`                                                      |
| A peer's switch is followed and named            | `lib/peer-mode-switch.test.ts`, e2e `editor-modes.spec.ts` "the tab menu's Mode switches the tab for everyone, and Undo switches it back"    |
| New tab opens in Diagram                         | `lib/new-tab-seed.test.ts`, e2e `editor-modes.spec.ts` "a new tab opens in Diagram, even when made in Draw mode"                             |
| Entering / leaving Draw                          | `hooks/canvas/useWhiteboard.test.tsx`, `useWhiteboard.board-tools.test.tsx`                                                                  |
| Hugging on `sizing` in both modes                | `lib/text-hug.test.ts`, `boxed-drag-resolve.resize.test.ts`, `useEditorDrag.shift-resize.test.tsx`, `useTextStyleSetters.test.ts`            |
| Template, MCP, imports open in Draw              | `apps/live/lib/templates.test.ts`, `packages/templates/src/template-tab.test.ts`, `lib/board-scene/land.test.ts`, `lib/import-merge.test.ts` |
| Telemetry rename and history                     | `apps/api/src/db/legacy-migration-0061.test.ts`, telemetry app suites                                                                        |
| Shift+D                                          | `hooks/editor/editor-mode-shortcut.test.ts`, e2e "Shift+D moves to the next mode and wraps"                                                  |

Not covered by a unit test: `parseEditorMode`'s legacy name, `parsePlacementDefaultKey`, the
peer toast's wiring in `useRoomConnection` and a label edit kept across a peer's switch
(browser-checked with two windows).

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D15 to D22 and D59.
