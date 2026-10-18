# Editor modes blueprint

Derived from [Editor modes](../editor-modes.md). Implementation detail only; the spec owns every
design decision. Draw mode's own tools are blueprinted in
[Draw mode blueprints](../../023-draw-mode/blueprints/README.md); Pages mode's pages in
[Pages](pages-mode.md) and [Article pages](article-pages.md).

## Domain and naming

| Term                        | Identifier                                                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor mode                 | `EditorMode` (`'diagram' \| 'draw' \| 'pages' \| 'plan' \| 'workshop'`), `packages/document/src/editor-mode.ts`                                                                                                      |
| The mode catalogue          | `EDITOR_MODE_CATALOGUE` (`{ id, label, description }[]`), in interface order                                                                                                                                         |
| Every mode, in order        | `EDITOR_MODES`; the default `DEFAULT_EDITOR_MODE` (`'diagram'`)                                                                                                                                                      |
| A mode's words              | `editorModeLabel(mode)`, `editorModeDescription(mode)`                                                                                                                                                               |
| The next mode (Shift+D)     | `nextEditorMode(mode, step = 1, modes = EDITOR_MODES)`, wrapping round `modes`                                                                                                                                       |
| A stored value is a mode    | `isEditorMode(v)`; read every stored mode through `parseEditorMode(v)` (legacy `'infographic'` → `'pages'`, `LEGACY_EDITOR_MODES`)                                                                                   |
| The page look's one gate    | `hasPageLook(mode)`: true in Pages mode                                                                                                                                                                              |
| A switch as one tab edit    | `withEditorModeSwitched(tab, mode)` (`packages/document/src/editor-mode-switch.ts`), `switchedTab(tab, next, alsoChange?)` (`useEditorMode.ts`)                                                                      |
| Plan stands apart           | `crossesPlan(from, to)`, `modesBesidePlanRule(mode)` (`editor-mode.ts`); `EditorModeState.crossPlan` (an empty tab crosses), `lockedReason`, `newTabIn`                                                              |
| Leaving Pages               | `useLeavePages(editorMode, { tab, canEdit })`, `LeavePagesDialog` ([Article pages](article-pages.md))                                                                                                                |
| Legacy names elsewhere      | `parsePlacementDefaultKey`, `legacyPlacementDefaultKeys` (`packages/api-schema/src/placement-defaults.ts`); `pagesModeEnabled` / `infographicModeEnabled` / `planModeEnabled` in `RETIRED` (`legacy-preferences.ts`) |
| The tab's mode              | `Tab.opensIn?: EditorMode` (stored name kept), read through `opensInOf(tab)`                                                                                                                                         |
| Setting the mode            | `setTabOpensIn(tab, mode)`                                                                                                                                                                                           |
| A tab offers the switch     | `editorModeSwitchable(tab)`: false on an event-storming board, new or legacy, and on a Board, Sheet or Dashboard tab (always Plan)                                                                                   |
| The look's one gate         | `hasBoardLook(mode)`: true in Draw mode (the person's own pattern)                                                                                                                                                   |
| The person's effective mode | `useEditorMode(tab, { canEdit })` → `EditorModeState`                                                                                                                                                                |
| The mode resolver           | `resolveEditorMode({ tab, canEdit })`, `apps/live/lib/editor-mode-store.ts`                                                                                                                                          |
| A collaborator's switch     | `peerModeSwitchOf(op)`, `peerModeSwitchMessage(name, mode)` (`apps/live/lib/peer-mode-switch.ts`); `useRoomConnection` `receivePeerModeSwitch`                                                                       |
| May this person edit        | `useViewPreview(...).canEdit`, `apps/live/app/document/[id]/useViewPreview.ts`                                                                                                                                       |
| The mode switch             | `StartModeSwitch` (`apps/live/components/start/`), a start panel's rail: chip `ModeMenuChip`, menu `ModeMenu` + `ModePreviewArt`, `apps/live/components/chrome/editor-mode/`                                         |
| The editor's resolved mode  | `EditorModeProvider` / `useEditorModeState()`, `editor-mode-context.tsx`                                                                                                                                             |
| The tab pill's mode icon    | `TabModeIcon`, `apps/live/components/chrome/editor-mode/`                                                                                                                                                            |
| Each mode's mark            | `EDITOR_MODE_ICONS` (`packages/ui/src/icons/drawing-kinds.tsx`), one per mode, Workshop's `FlipchartIcon`, read straight by the chip, the menu rows and the pill                                                     |
| A template's opening mode   | `templateOpensIn(overrides)`, `apps/live/app/document/[id]/useTemplateFlow.ts`                                                                                                                                       |
| The tool a mode starts with | `modeDefaultTool(mode, mobile)`, `useModeDefaultTool`, `PLAN_LEFT_OUT_TOOLS`, `apps/live/hooks/editor/useModeDefaultTool.ts`                                                                                         |
| A new tab's seed            | `newTabSeed(source)`, `newTabOpening(creatorMode, mode?)`, `apps/live/lib/new-tab-seed.ts`                                                                                                                           |
| A text box's sizing         | `TextElement.sizing?: TextSizing` (`'fit' \| 'wrap'`), absent = a fixed box                                                                                                                                          |
| Ink by name                 | `INK_PEN_COLOUR` (`'ink'`), a `PenColourName`, drawn in `PEN_INK`                                                                                                                                                    |
| Legacy whiteboard migration | `migrateWhiteboardKind(tab)`, `packages/document/src/legacy-whiteboard-tab.ts`                                                                                                                                       |
| Legacy text migration       | `migrateLegacyTextSizing(elements)`, `packages/document/src/legacy-text-sizing.ts`                                                                                                                                   |

"Editor mode" in code and specs; the interface says Diagram, Draw, Workshop, Pages and Plan. "Whiteboard" names the
activity, the template and Draw mode's dock (`useWhiteboard`, `WhiteboardDock`), never a tab kind.

## Constants and configuration

| Constant                   | Value                                 | Where / provenance                               |
| -------------------------- | ------------------------------------- | ------------------------------------------------ |
| `EDITOR_MODE_CATALOGUE`    | Diagram, Draw, Workshop, Pages, Plan  | `editor-mode.ts`; spec "The mode switch"         |
| `LEGACY_EDITOR_MODES`      | `{ infographic: 'pages' }`            | `editor-mode.ts`; spec "Naming in the interface" |
| Legacy default-folder key  | `'mode:infographic'` → `'mode:pages'` | `LEGACY_PLACEMENT_DEFAULT_KEYS`; spec            |
| `DEFAULT_EDITOR_MODE`      | `'diagram'`                           | Spec: `opensIn` absent = Diagram                 |
| Retired mode store key     | `livediagram:v2:editor-mode:<tabId>`  | Per-person era; never read or written now        |
| `PEN_INK`                  | `#1c1917` light, `#e2e8f0` dark       | `pen-colours.ts`; spec "Ink is one colour"       |
| `WHITEBOARD_UNSET_PATTERN` | `'blank'`                             | Written on a migrated board with no pattern      |
| `WHITEBOARD_INKED_SHAPES`  | square, circle, triangle, diamond     | The shapes a migrated board inks                 |
| Shift+D                    | `EDITOR_MODE_KEYSHORTCUT`             | `editor-mode-copy.ts`; spec "The mode switch"    |
| `MODE_TINT`                | sky, orange, violet, pink, emerald    | `mode-menu-copy.ts`; spec "The mode switch"      |
| `MODE_TOOLS`               | 4-5 tool names per mode               | `mode-menu-copy.ts`; the preview's chips         |
| Mode menu preview width    | 288 px (`w-72`), list 192 px (`w-48`) | `ModeMenu`; shown from 640 px (`sm`)             |
| `LEGACY_WHITEBOARD_KIND`   | `'whiteboard'`                        | The stored kind read as a Draw-opening tab       |

A further mode is one catalogue entry plus its icon in `EDITOR_MODE_ICONS`
(`Record<EditorMode, …>`, so the typecheck names the missing icon).

## Behaviour and state

### The tab's mode

`resolveEditorMode({ tab, canEdit })` (pure, `editor-mode-store.ts`):

1. `mode = opensInOf(tab)`: the tab's own mode, the same for everyone; Diagram when absent or on
   an event-storming board; Plan on a Board, Sheet or Dashboard tab.
2. `canSwitch = tab && editorModeSwitchable(tab) && canEdit && tab.locked !== true`.
3. `lockedReason` ("A Board tab is always in Plan.", likewise a Sheet tab and a Dashboard) for an
   editor on a Plan kind's tab: the switch shows, and only its own mode can be picked.

Nothing is remembered per person: the old `livediagram:v2:editor-mode:<tab>` keys are never read
or written (left in place). Nothing is pinned per page.

- `useEditorMode(tab, { canEdit, commitTabs, toastInfo, newTabIn? })` resolves the mode each render
  (no store, no subscription) and returns `{ mode, setMode, canSwitch, canEdit, lockedReason?,
crossPlan?, newTabIn? }`; `crossPlan = canSwitch && tab.elements.length === 0`; `newTabIn` is
  passed only to a session that may add tabs (`!isStructureReadOnly`).
- `setMode(next, alsoChange?)`: no-op unless `canSwitch`, `next !== mode` and, across Plan's line
  (`crossesPlan(mode, next)`), `crossPlan`; else
  `track('Editor', 'Changed', MODE_EVENT[next])` first, then ONE `commitTabs` mapping the active tab
  through `switchedTab(t, next, alsoChange)`: `alsoChange` (what leaving brings, such as
  `useLeavePages`'s Turn Into Pages), then `withEditorModeSwitched`, which sets `opensIn`
  (`setTabOpensIn`) and, entering Pages, `withContentOnAPage` ([Pages
  pages](pages-mode.md) "Into pages"). When it made a page: toast "Put onto a page that fits
  it. Undo switches back to <from>." and `Tab · Changed · PageFitToContent`. One undo step: the
  history restores the whole tab, mode included, so Undo switches back for everyone and Redo
  switches again.
- **Every mode offered**: `ModeMenuChip` lists `EDITOR_MODES` whole. A row is locked when
  `lockedReason` is set and it is not the checked one, or when `crossesPlan(mode, row)` and not
  `crossPlan`; pressing a locked row asks `useConfirm` **Open a New <Mode> Tab?** (`lockedReason`,
  else "Plan works in tabs of its own." / "A Plan tab stays in Plan.", then "Its mode can’t change,
  but you can carry on in a new <Mode> tab.", confirm **New <Mode> Tab**) and calls
  `newTabIn(mode)`; without `newTabIn` locked rows are inert (`aria-disabled`, no question).
  Shift+D is `editorModeShortcut`: `nextEditorMode(mode, 1, EDITOR_MODES)` while `canSwitch && crossPlan` (an
  empty tab), else null, so a tab with content never changes mode by key.
- **Wrappers, in order** (`useEditorState`): `rawEditorMode = useEditorMode(...)`; then
  `useLeavePages(rawEditorMode, { tab, canEdit })` (asks before leaving Pages; Turn Into
  Pages passes its conversion as `alsoChange`, so the conversion and the switch are one edit). The
  resulting `editorMode` drives the start's switch, Shift+D and the canvas on the active tab.
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

- `opensInOf(tab)`: Plan on a Board, Sheet or Dashboard tab; Diagram on an event-storming board; `parseEditorMode(tab.opensIn)` when it is
  one (a stored `infographic` reads as Pages); else Diagram. `creationIntentOf` and
  `readCreationIntent` read modes the same way.
- `setTabOpensIn(tab, mode)`: the same tab when not switchable or unchanged; else
  `{ ...tab, opensIn: mode }` (written explicitly, Diagram included).
- **New tab** (`useTabActions.addTab(mode?)`): `newTabSeed(activeTab)` copies the source tab's look and
  never an `opensIn`; the mode comes from `newTabOpening(editorMode, mode)` (new-tab-seed.ts), where `editorMode` is
  the active tab's mode (`opensInOf(activeTab)`, so Plan on a Board, Sheet or Dashboard tab and Diagram on an
  event-storming board). It returns `{ opensIn: mode ?? editorMode }`, leaving `opensIn` out when
  that is Diagram (absent reads as Diagram). So the tab bar's **+** and **Create New Tab** (`addTab()`) open the
  tab in the active tab's mode, and `addTab(mode)` from `newTabIn` in the mode asked for. The mode's own start
  shows (Start Diagramming, Start Drawing,
  Start a Workshop, Start Making Pages, Start Planning). `addTab` returns before anything when
  `!canEditStructure` (a Participant, a Viewer, a tab-scoped link). A template chosen for it then decides (`useTemplateFlow`): `templateOpensIn(overrides)`
  is `overrides.opensIn` when set (the template's own mode, `templateEditorMode`), else
  `undefined` for an event-storming template (`overrides.kind` set), else `'diagram'` (Blank
  included). When
  defined it is written on the tab after `templateCanvasOverrides`, so everyone on the tab moves
  to it. A new document's first tab takes the same `templateCanvasOverrides` on `/new`, so it
  too opens in its template's mode.
- **Templates, MCP, imports**: `templateCanvasOverrides(kind)` writes `opensIn:
templateEditorMode(kind)` for every template not in Diagram (`template-modes.ts`; `'whiteboard'`
  → `{ opensIn: 'draw', backgroundPattern: 'graph' }`; the Pages ones also their `pages`),
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
export type EditorMode = 'diagram' | 'draw' | 'pages' | 'plan' | 'workshop';
export function parseEditorMode(v: unknown): EditorMode | undefined;
export type EditorModeState = {
  mode: EditorMode;
  setMode: (next: EditorMode, alsoChange?: (tab: Tab) => Tab) => void;
  canSwitch: boolean;
  canEdit: boolean;
  lockedReason?: string;
  newTabIn?: (mode: EditorMode) => void;
  crossPlan?: boolean;
};
export function useEditorMode(
  tab: (EditorModeTab & Pick<Tab, 'elements'>) | undefined,
  o: {
    canEdit: boolean;
    commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
    toastInfo: (message: string) => void;
    newTabIn?: (mode: EditorMode) => void;
  },
): EditorModeState;
export function withEditorModeSwitched<T extends Tab>(
  tab: T,
  mode: EditorMode,
): { tab: T; pagedContent: boolean };
export type TabModeChoice = { mode: EditorMode; onChange: (m: EditorMode) => void };
export function peerModeSwitchOf(op: RoomOp): { tabId: string; mode: EditorMode } | null;
export function newTabSeed(source: Tab | undefined): Partial<Tab>;
export function crossesPlan(from: EditorMode, to: EditorMode): boolean;
export function editorModeShortcut(
  s: EditorModeState,
  announce: (m: string) => void,
): (() => void) | null;
```

- `EditorModeTab = Pick<Tab, 'id' | 'kind' | 'opensIn' | 'layers' | 'locked'>`.
- `StartModeSwitch()`: reads `useEditorModeState()` and renders nothing outside a provider, when `!canEdit`, or
  when neither `canSwitch` nor `lockedReason`; else `data-start-mode-switch` around `ModeMenuChip({ mode, onChange,
newTabIn, crossPlan, lockedReason })` (`lockedReason` only while it cannot switch), each change inside a
  `start-mode` view transition.
- `ModeMenuChip`: shows the icon, the name and a chevron, is named "Tab mode: <Label>", and carries
  `data-mode-switch` (the Leave Pages card's anchor, `LeavePagesConfirm`).
- The editor marks the open tab's mode as `data-editor-mode` on its column (`EditorView`), for the e2e helpers.
- `ModeMenu({ mode, modes, keyLeadsTo, chip, initialFocus, hostZoom, onChange, onClose, crossPlan,
lockedReason?, onLockedPick? })` (`ModeMenu.tsx`), opened by `ModeMenuChip`:
  - `actionOf(option): ModeMenuAction`: `'current'` for `mode`; `'switch'` unless locked (a
    `lockedReason`, or `!crossPlan && crossesPlan(mode, option)`); else `'new-tab'` with
    `onLockedPick`, `'inert'` without. Choosing (a row's click, or Enter / Space through
    `useMenu`'s activate) does nothing when inert,
    else closes, then `onLockedPick` for `'new-tab'` or `onChange` for `'switch'`.
  - Rows: `menuitemradio`, `data-mode-row`, `aria-describedby` to a span holding
    `editorModeDescription` (plus " Opens in a new tab." on a `'new-tab'` row), visible under the
    name below `sm` and `sm:sr-only` above; a `MODE_TINT` tile, a check on the current row, an
    `OpenIcon` (`data-new-tab-mark`) on a `'new-tab'` row.
  - `shown` (initially `mode`) follows `onPointerEnter` and `onFocus` of a row.
  - `ModePreview` (`data-mode-preview`, `aria-hidden`, `hidden sm:flex`): `ModePreviewArt` on the
    tint, the name with `ModeKeyHint` when `shown === keyLeadsTo && !lockedReason`, the
    description and `MODE_TOOLS` chips; no button (choosing is the row's alone).
- Placement: only on a start panel's rail (`StartFromTemplates`, `StartPlanning`), never in `ToolbarExplorerButton`,
  the `TabPortalMenu`, the `TabBar` or the `Explorer`.
- `TabModeIcon({ tab, style? })`: the tab's mode's `EDITOR_MODE_ICON`, 12 px, `aria-hidden`;
  `TabPill` passes `style={{ color: legibleTabAccent(tab, isDark) }}`.
- `templateOpensIn(overrides: Pick<Tab, 'opensIn' | 'kind'>): EditorMode | undefined`.
- Wire: `Tab.opensIn` and `TextElement.sizing` are in the OpenAPI schema
  (`EditorMode`, `TextSizing`); `TabKind` is `'diagram' | 'event-storming'`.
- Validation: `isValidElement` accepts `sizing` of `fit` or `wrap` only and `penColour` /
  `penTextColour` of a `PenColourName`, `'ink'` included; `isValidTab` leaves `opensIn` to
  `opensInOf`, which reads anything else as Diagram.

## Data and persistence

| Field / key                          | Class                  | Notes                                                                                                                                                                                          |
| ------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab.opensIn`                        | Document, synced       | The tab's mode, the same for everyone. Absent = Diagram; written by templates, imports and an editor's switch (one undo step; never a new tab); `'infographic'` read as Pages, never rewritten |
| Per-person mode (retired)            | Device-local           | `livediagram:v2:editor-mode:<tab>` keys from before the shared mode: left in place, never read                                                                                                 |
| `drawPattern`                        | Synced user preference | The person's Draw pattern, Grid until chosen                                                                                                                                                   |
| `TextElement.sizing`                 | Document               | Replaces `autoWidth`                                                                                                                                                                           |
| `penColour` / `penTextColour: 'ink'` | Document               | Ink by name                                                                                                                                                                                    |

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
| Forged `opensIn` on an event-storming board       | `opensInOf` → Diagram; `setTabOpensIn` returns the tab                                       |
| Unknown `opensIn` value                           | Read as Diagram                                                                              |
| Legacy `opensIn: 'infographic'`                   | Read as Pages (`parseEditorMode`); not rewritten                                             |
| Switch by a visitor, on a locked tab or ES board  | `setMode` returns early: nothing written, no telemetry                                       |
| Switch to the mode the tab is in                  | No commit                                                                                    |
| Shift+D on a tab with content                     | `editorModeShortcut` returns null: nothing written, no telemetry                             |
| A locked row in a session that cannot add tabs    | Inert (`aria-disabled`): no question, no new tab                                             |
| A Board, Sheet or Dashboard tab                   | The switch shows its own mode only, with `lockedReason`; other rows offer a new tab          |
| A peer switches while I type in a label           | The editor stays open; the text commits as usual; a toast names the peer                     |
| Previewing as a viewer                            | `canEdit` false: no switch, the tab's mode, read-only                                        |
| Event-storming board, or outside an editor        | `StartModeSwitch` renders nothing; the pill icon shows Diagram                               |
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
- A switch is one commit; entering Pages adds `withContentOnAPage`, O(elements) (measured
  1.4 ms at 3000 elements, [Pages blueprint](pages-mode.md) "Performance and
  limits"). The sync is one small `tab-meta` op (`opensIn`, plus `pages` entering Pages).
- Migration returns the same tab and element objects when nothing changes (identity-preserving).

## Presentation and UX

- The chip (`ModeMenuChip`): a full-bleed `h-12` row at the top of the rail, the mode's icon, its name and a chevron
  on `TOOLBAR_TRIGGER_TONE`, its focus ring drawn inside. No hover card (it would cover the menu). The menu opens
  downward (`absolute top-full mt-1.5 left-0`), spanning the panel under `sm`. The menu opens at design size: on
  opening, the chip reads its host's effective zoom (`effectiveZoom`: `currentCSSZoom`, else screen width over
  layout width) and the menu sets `zoom: 1 / hostZoom`, undoing the panel UI scale ([UI scale](../ui-scale.md)).
  The same for everyone: power user mode does not change it.
- The tab pill leads with `TabModeIcon` (in place of the accent dot), tinted with the tab's
  accent.
- No switch beside the menu button and no Mode section in the tab menu (both retired 2026-10-18).
- No other cue marks the mode (spec "No further cue").

## Accessibility

- Chip: `aria-haspopup="menu"`, `aria-expanded`, `aria-keyshortcuts="Shift+D"`, named
  "Tab mode: <Label>"; ↑/↓ on the chip open the menu. Rows `menuitemradio` with
  `aria-checked`, focus on the checked row on opening; ↑/↓ wrap, Home/End, Enter/Space, Escape
  return focus to the chip. Tab away closes the menu: a blur closes it only when focus moves to
  another element outside it (`relatedTarget` set); a blur to nowhere is a press (Safari does not
  focus a pressed button), so the row's click still lands. A press outside is
  `useClickOutside`'s. The tab pill's icon is `aria-hidden`.
- Shift+D carries `aria-keyshortcuts`; a switch by key is announced politely
  (`announce('Draw mode')`). The key obeys the character-key shortcuts setting.
- Focus rings `MODE_SWITCH_FOCUS` (brand-600 light, brand-400 dark, at least 3:1).

## Web Experience

- CLS: the switch fills its row on the start's rail, so nothing beside it moves on a switch, and the menu card at
  the top left no longer holds it, so it never changes width with the tab.
- INP: a switch is one commit (and, entering Pages, one linear pass over the elements); no
  fetch, no remount of the canvas.
- LCP: unaffected; the mode resolves synchronously on first render from the tab.

## Observability

| Event / log                                                                       | Where                   |
| --------------------------------------------------------------------------------- | ----------------------- |
| `Editor · Changed · ModeDiagram / ModeDraw / ModePages / ModePlan / ModeWorkshop` | `useEditorMode.setMode` |
| `Editor · Changed · LeavePagesConfirmed`                                          | `useLeavePages`         |
| `Tab · Changed · PageFitToContent` and its toast                                  | `useEditorMode.setMode` |
| `Draw · …` (formerly `Whiteboard`)                                                | Draw mode's emitters    |
| `[editor-mode] switched { tabId, from, to, paged }` (debugLog)                    | `setMode`               |
| `[editor-mode] whiteboard tab migrated to Draw`                                   | `migrateWhiteboardKind` |
| `<Name> switched this tab to <Mode>.` (toast)                                     | `receivePeerModeSwitch` |

## Testing

| Spec rule                                                                  | Test                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modes, catalogue, opening mode, ES no switch                               | `packages/document/src/editor-mode.test.ts` ("are Diagram, Draw, Workshop, Pages and Plan, Diagram by default", "draws the page in Pages mode only")                                                                                                                                                                                                                                                                                                       |
| Stored whiteboard → general tab in Draw, inked                             | `legacy-whiteboard-tab.test.ts`, `stored-tab.test.ts`, api `tab-row.test.ts`                                                                                                                                                                                                                                                                                                                                                                               |
| `autoWidth` → `sizing`                                                     | `legacy-text-sizing.test.ts`, `validate.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                           |
| The tab's mode for everyone; view role; lock; ES                           | `apps/live/lib/editor-mode-store.test.ts`, `hooks/editor/useEditorMode.test.tsx`                                                                                                                                                                                                                                                                                                                                                                           |
| A switch is one tab edit, with its page                                    | `useEditorMode.test.tsx`, `packages/document/src/editor-mode-switch.test.ts`, `hooks/editor/useLeavePages.test.ts`                                                                                                                                                                                                                                                                                                                                         |
| One `canEdit`; preview hides the switch                                    | `useViewPreview.test.tsx`, `components/start/StartModeSwitch.menu.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                |
| The switch: named, menu below, rows, keys                                  | `StartModeSwitch.menu.test.tsx` "StartModeSwitch chip", `StartModeSwitch.test.tsx`, `ModeMenu.test.tsx`                                                                                                                                                                                                                                                                                                                                                    |
| A pressed row lands; Tab away closes                                       | `StartModeSwitch.menu.test.tsx` "keeps the menu open through a blur to nowhere…", "closes when focus moves outside (Tab away)"                                                                                                                                                                                                                                                                                                                             |
| No switch beside the menu button, none in the tab menu                     | `components/chrome/ToolbarExplorerButton.test.tsx` "carries no mode switch", e2e `editor-modes.spec.ts` "a tab offers no mode switch beside the menu button or in its tab menu"                                                                                                                                                                                                                                                                            |
| A Draw tool in hand never takes the press                                  | `ToolbarExplorerButton.test.tsx` "marks its card as floating chrome…"                                                                                                                                                                                                                                                                                                                                                                                      |
| The tab pill shows the tab's mode                                          | `components/chrome/TabPill.test.tsx`, `components/chrome/editor-mode/TabModeIcon.test.tsx`                                                                                                                                                                                                                                                                                                                                                                 |
| A template decides the tab's mode                                          | `app/document/[id]/useTemplateFlow.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                |
| A peer's switch is followed and named                                      | `lib/peer-mode-switch.test.ts`, e2e `editor-modes.spec.ts` "the start's switch changes the tab for everyone, and Undo switches it back"                                                                                                                                                                                                                                                                                                                    |
| Plan stands apart; an empty tab crosses; only an empty tab switches by key | `useEditorMode.test.tsx` "crosses into and out of Plan while the tab is empty, and only then", `StartModeSwitch.menu.test.tsx` "StartModeSwitch and Plan", "StartModeSwitch on a tab that keeps its mode", "StartModeSwitch for a session that cannot add tabs", `editor-mode-shortcut.test.ts` "offers nothing on a tab with content", e2e `editor-modes.spec.ts` "Shift+D moves an empty tab to the next mode", "a Plan tab with a board keeps its mode" |
| The tool a mode starts with                                                | `hooks/editor/useModeDefaultTool.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| New tab opens in its maker's mode, on its start                            | `lib/new-tab-seed.test.ts`, `hooks/persistence/useTabActions.addTab.test.tsx`, e2e `editor-modes.spec.ts` "a new tab opens in the mode it was made from"                                                                                                                                                                                                                                                                                                   |
| Entering / leaving Draw                                                    | `hooks/canvas/useWhiteboard.test.tsx`, `useWhiteboard.board-tools.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                |
| Hugging on `sizing` in both modes                                          | `lib/text-hug.test.ts`, `boxed-drag-resolve.resize.test.ts`, `useEditorDrag.shift-resize.test.tsx`, `useTextStyleSetters.test.ts`                                                                                                                                                                                                                                                                                                                          |
| Template, MCP, imports open in Draw                                        | `apps/live/lib/templates.test.ts`, `packages/templates/src/template-tab.test.ts`, `lib/board-scene/land.test.ts`, `lib/import-merge.test.ts`                                                                                                                                                                                                                                                                                                               |
| Telemetry rename and history                                               | `apps/api/src/db/legacy-migration-0061.test.ts`, telemetry app suites                                                                                                                                                                                                                                                                                                                                                                                      |
| Shift+D                                                                    | `hooks/editor/editor-mode-shortcut.test.ts`, e2e "Shift+D moves an empty tab to the next mode"                                                                                                                                                                                                                                                                                                                                                             |

Workshop mode's own rules are blueprinted in
[Workshop mode](../../012-collaboration/blueprints/workshop-mode.md).

Not covered by a unit test: `parseEditorMode`'s legacy name, `parsePlacementDefaultKey`, the
peer toast's wiring in `useRoomConnection`, and a label edit kept across a peer's switch (browser-checked with two windows). `addTab(mode)` across Plan's line
is covered by `useTabActions.addTab.test.tsx` and `new-tab-seed.test.ts`.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D15 to D22 and D59.
