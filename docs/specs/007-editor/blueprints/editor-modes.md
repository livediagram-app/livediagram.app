# Editor modes blueprint

Derived from [Editor modes](../editor-modes.md). Implementation detail only; the spec owns every
design decision. Draw mode's own tools are blueprinted in
[Draw mode blueprints](../../023-draw-mode/blueprints/README.md).

## Domain and naming

| Term                        | Identifier                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------ |
| Editor mode                 | `EditorMode` (`'diagram' \| 'draw'`), `packages/document/src/editor-mode.ts`         |
| The mode catalogue          | `EDITOR_MODE_CATALOGUE` (`{ id, label, description }[]`), in interface order         |
| Every mode, in order        | `EDITOR_MODES`; the default `DEFAULT_EDITOR_MODE` (`'diagram'`)                      |
| A mode's words              | `editorModeLabel(mode)`, `editorModeDescription(mode)`                               |
| The next mode (Shift+D)     | `nextEditorMode(mode, step = 1)`, wrapping round the catalogue                       |
| A stored value is a mode    | `isEditorMode(v)`                                                                    |
| The opening mode            | `Tab.opensIn?: EditorMode`, read through `opensInOf(tab)`                            |
| Setting the opening mode    | `setTabOpensIn(tab, mode)`                                                           |
| A tab offers the switch     | `editorModeSwitchable(tab)`: false on an event-storming board, new or legacy         |
| The look's one gate         | `hasBoardLook(mode)`: true in Draw mode (the person's own pattern)                   |
| The person's effective mode | `useEditorMode(tab, { canEdit })` → `EditorModeState`                                |
| The mode store              | `apps/live/lib/editor-mode-store.ts`                                                 |
| May this person edit        | `useViewPreview(...).canEdit`, `apps/live/app/document/[id]/useViewPreview.ts`       |
| The mode switch             | `EditorModeSwitch` (chip `ModeMenuChip`), `apps/live/components/chrome/editor-mode/` |
| The editor's resolved mode  | `EditorModeProvider` / `useEditorModeState()`, `editor-mode-context.tsx`             |
| The tab pill's mode icon    | `TabModeIcon`, `apps/live/components/chrome/editor-mode/`                            |
| A template's opening mode   | `templateOpensIn(overrides)`, `apps/live/app/document/[id]/useTemplateFlow.ts`       |
| Opens in                    | `useTabOpensIn` (`apps/live/hooks/editor/`), `OpensInMenuSection` (chrome)           |
| A new tab's seed            | `newTabSeed(source)`, `apps/live/lib/new-tab-seed.ts`                                |
| A text box's sizing         | `TextElement.sizing?: TextSizing` (`'fit' \| 'wrap'`), absent = a fixed box          |
| Ink by name                 | `INK_PEN_COLOUR` (`'ink'`), a `PenColourName`, drawn in `PEN_INK`                    |
| Legacy whiteboard migration | `migrateWhiteboardKind(tab)`, `packages/document/src/legacy-whiteboard-tab.ts`       |
| Legacy text migration       | `migrateLegacyTextSizing(elements)`, `packages/document/src/legacy-text-sizing.ts`   |

"Editor mode" in code and specs; the interface says Diagram and Draw. "Whiteboard" names the
activity, the template and Draw mode's dock (`useWhiteboard`, `WhiteboardDock`), never a tab kind.

## Constants and configuration

| Constant                   | Value                                | Where / provenance                             |
| -------------------------- | ------------------------------------ | ---------------------------------------------- |
| `EDITOR_MODE_CATALOGUE`    | Diagram, Draw (label + description)  | `editor-mode.ts`; spec "The mode switch"       |
| `DEFAULT_EDITOR_MODE`      | `'diagram'`                          | Spec: `opensIn` absent = Diagram               |
| Mode store key             | `livediagram:v2:editor-mode:<tabId>` | `editorModeKey`; one key per tab, device-local |
| Switch slot width          | 48 px (`w-12`); labelled 104 px      | `EditorModeSwitch` `SLOT_WIDTH`; zero shift    |
| `PEN_INK`                  | `#1c1917` light, `#e2e8f0` dark      | `pen-colours.ts`; spec "Ink is one colour"     |
| `WHITEBOARD_UNSET_PATTERN` | `'blank'`                            | Written on a migrated board with no pattern    |
| `WHITEBOARD_INKED_SHAPES`  | square, circle, triangle, diamond    | The shapes a migrated board inks               |
| Shift+D                    | `EDITOR_MODE_KEYSHORTCUT`            | `editor-mode-copy.ts`; spec "The mode switch"  |
| `LEGACY_WHITEBOARD_KIND`   | `'whiteboard'`                       | The stored kind read as a Draw-opening tab     |

A further mode is one catalogue entry plus its icon in `EDITOR_MODE_ICON`
(`Record<EditorMode, …>`, so the typecheck names the missing icon).

## Behaviour and state

### The effective mode

`resolveEditorMode({ tab, remembered, opened, canEdit })` (pure, `editor-mode-store.ts`):

1. `switchable = tab && editorModeSwitchable(tab)`.
2. `opening = (switchable ? opened : null) ?? opensInOf(tab)`.
3. `canSwitch = switchable && canEdit`.
4. `mode = canSwitch ? (remembered ?? opening) : opening`.

So: an event-storming board is always Diagram; a visitor who cannot edit gets the opening mode;
an editor gets their remembered choice, else the mode the tab opened in on this page, else
`opensIn`, else Diagram.

- **Remembered** (`readRememberedMode`, `rememberMode`): `localStorage`, one key per tab, read
  once per tab into a memory cache. A value that is not a mode reads as nothing remembered. A
  `storage` event for a key under the prefix (another window) drops that tab's cache entry and
  notifies subscribers.
- **Opened** (`pinOpening`, `releaseOpening`, `openedMode`): memory only, per page. Pinned once
  the active tab's content has loaded (`usePinTabOpening(activeTab, loadState === 'ready')`), so
  a later `opensIn` change, by anyone, moves nobody. `pinOpening` is a no-op when a pin exists.
  Released when an applied template decides the tab's opening mode (`templateOpensIn` is defined,
  `useTemplateFlow`); the next render re-pins the new opening mode.
- `useEditorMode` reads both through one `useSyncExternalStore` snapshot (`'<remembered>|<opened>'`)
  so every caller on the page (the editor, the switch, every tab pill's `TabModeIcon`) shares one
  value.
- `setMode(next)`: no-op unless `canSwitch` and `next !== mode`; else track (see Observability),
  then `rememberMode(tabId, next)`. Never writes the tab.
- **One `canEdit`**: `useViewPreview` returns `canEdit = sessionRole === 'edit' && !previewing`.
  `useEditorState` derives `isReadOnly = !canEdit` and resolves the mode once with it;
  `EditorView` provides that `EditorModeState` (`EditorModeProvider value={ctx.editorMode}`)
  and every switch reads it through `useEditorModeState()`, so a switch and the canvas cannot
  disagree. `TabModeIcon` takes only `canEdit` from it and resolves its own tab with
  `useEditorMode(tab, { canEdit })` (`false` outside a provider).

### Opening mode

- `opensInOf(tab)`: Diagram on an event-storming board; `tab.opensIn` when it is a mode; else
  Diagram.
- `setTabOpensIn(tab, mode)`: the same tab when not switchable or unchanged; else
  `{ ...tab, opensIn: mode }` (written explicitly, Diagram included).
- **Opens in** (`useTabOpensIn({ tabs, canEdit, commitTabs, activeId, switchMode })`,
  `switchMode` being `useEditorMode.setMode`): `choiceFor(tab)` is `undefined` unless
  `canEdit && editorModeSwitchable(tab)`; else `{ mode: opensInOf(tab), onChange, disabled:
tab.locked }`. `setOpensIn` refuses a missing or locked tab (or `!canEdit`). Otherwise, when
  `tabId === activeId` it first calls `switchMode(mode)`, so the chooser lands in the chosen mode
  even when the opening mode is unchanged (the checked row); a stale menu on another tab switches
  nothing. An unchanged opening mode then stops there; else one `commitTabs` (one undo step,
  synced). `OpensInMenuSection` passes a press on the checked row through to `onChange` for this.
- **New tab** (`useTabActions.addTab`): `newTabSeed(activeTab)` copies the source tab's look
  and never an `opensIn`, so the tab opens in Diagram whatever its creator's mode. A template
  chosen for it then decides (`useTemplateFlow`): `templateOpensIn(overrides)` is
  `overrides.opensIn` when set (`'draw'` for `whiteboard`), else `undefined` for an
  event-storming template (`overrides.kind` set), else `'diagram'` (Blank included). When
  defined it is written on the tab after `templateCanvasOverrides` and `releaseOpening(activeId)`
  runs. A new document's first tab takes the same `templateCanvasOverrides` on `/new`, so it
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
export type EditorMode = 'diagram' | 'draw';
export type EditorModeState = {
  mode: EditorMode;
  setMode: (next: EditorMode) => void;
  canSwitch: boolean;
  canEdit: boolean;
};
export function useEditorMode(
  tab: EditorModeTab | undefined,
  o: { canEdit: boolean },
): EditorModeState;
export function usePinTabOpening(tab: EditorModeTab | undefined, loaded: boolean): void;
export type OpensInChoice = {
  mode: EditorMode;
  onChange: (m: EditorMode) => void;
  disabled: boolean;
};
export function newTabSeed(source: Tab | undefined): Partial<Tab>;
export function editorModeShortcut(
  s: EditorModeState,
  announce: (m: string) => void,
): (() => void) | null;
```

- `EditorModeTab = Pick<Tab, 'id' | 'kind' | 'opensIn' | 'layers'>`.
- `EditorModeSwitch({ className?, align?: 'left' | 'right', labelled? })` (defaults `left`,
  `false`): reads `useEditorModeState()` and renders nothing outside a provider, when `!canEdit`
  or when `!canSwitch`; else a fixed slot (`data-editor-mode-switch`, `w-12`, or `w-[6.5rem]`
  when `labelled`) around `ModeMenuChip({ mode, onChange, align, labelled })`.
- Placement: inside `ToolbarExplorerButton`, after the menu button, in its corner card or inline
  in the phone strip (icon-only, `align` left). That card carries `data-floating-panel`, so the
  canvas's capture-phase pen gesture (`useCanvasSurfaceGestures`) skips a press there: with a Draw
  tool in hand, a press on the chip or its menu switches rather than starting a stroke. In the
  Floating layout, `CommandPalette` passes
  `<EditorModeSwitch labelled align="right" />` as its `MovablePanel` `headerActions`, so it
  sits in the Palette panel's title row beside help and minimise, in Diagram and in Draw (the
  panel stays up in Draw mode, showing Draw's tools). Not in `TabBar` (which no longer takes the
  mode) nor the `Explorer`.
- `TabModeIcon({ tab, style? })`: the effective mode's `EDITOR_MODE_ICON`, 12 px, `aria-hidden`;
  `TabPill` passes `style={{ color: legibleTabAccent(tab, isDark) }}`.
- `templateOpensIn(overrides: Pick<Tab, 'opensIn' | 'kind'>): EditorMode | undefined`.
- `PortalMenu.opensIn?: OpensInChoice`: absent, no Opens in section.
- Wire: `Tab.opensIn` and `TextElement.sizing` are in the OpenAPI schema
  (`EditorMode`, `TextSizing`); `TabKind` is `'diagram' | 'event-storming'`.
- Validation: `isValidElement` accepts `sizing` of `fit` or `wrap` only and `penColour` /
  `penTextColour` of a `PenColourName`, `'ink'` included; `isValidTab` leaves `opensIn` to
  `opensInOf`, which reads anything else as Diagram.

## Data and persistence

| Field / key                          | Class                  | Notes                                                                          |
| ------------------------------------ | ---------------------- | ------------------------------------------------------------------------------ |
| `Tab.opensIn`                        | Document, synced       | Absent = Diagram; written by templates, imports and Opens in (never a new tab) |
| Remembered mode                      | Device-local, per tab  | `localStorage`, never synced, never on the tab                                 |
| Opened mode                          | Memory, per page       | Lost on reload by design                                                       |
| `drawPattern`                        | Synced user preference | The person's Draw pattern, Grid until chosen                                   |
| `TextElement.sizing`                 | Document               | Replaces `autoWidth`                                                           |
| `penColour` / `penTextColour: 'ink'` | Document               | Ink by name                                                                    |

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

| Case                                              | Handling                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| Unreadable remembered mode                        | Ignored, `[editor-mode] remembered mode unreadable, ignored`                |
| Storage throws (private mode)                     | `readLocalStorageSafe` / `writeLocalStorageSafe`: in-memory for the session |
| Tab not loaded yet                                | Not pinned; the mode follows `opensIn` until it loads                       |
| Opens in on a locked tab                          | Choices shown, `disabled`; `setOpensIn` refuses                             |
| Opens in for the current opening mode             | Switches the chooser on the active tab; no commit, no telemetry             |
| Forged `opensIn` on an event-storming board       | `opensInOf` → Diagram; `setTabOpensIn` returns the tab                      |
| Unknown `opensIn` value                           | Read as Diagram                                                             |
| View-role visitor with a remembered choice        | Opening mode; `setMode` is a no-op                                          |
| Previewing as a viewer                            | `canEdit` false: no switch, opening mode, read-only                         |
| Event-storming board, or outside an editor        | `EditorModeSwitch` renders nothing (no slot); the pill icon shows Diagram   |
| A tab switched while a paste's images upload      | The paste is dropped (unchanged board-scene rule)                           |
| Stale client sends a `Whiteboard` telemetry event | Refused by the closed category list                                         |

## Security and trust

- The mode is presentation: the api never reads it; edits stay guarded by role and lock.
- `opensIn` arrives untrusted; it is never validated as an enum because every reader goes through
  `opensInOf`, which cannot yield anything but a mode.
- The remembered mode is read from `localStorage` and validated with `isEditorMode`.
- Telemetry carries the mode name only, never a tab or document id.

## Performance and limits

- `getSnapshot` is served from the memory cache: no storage read per render.
- One store subscription per caller; the `storage` listener is attached while any caller exists.
- Migration returns the same tab and element objects when nothing changes (identity-preserving).
- One `localStorage` key per tab a person switched on (a few bytes each).

## Presentation and UX

- The chip (`ModeMenuChip`): the mode's icon and a chevron on `TOOLBAR_TRIGGER_TONE`, filling
  its fixed slot. Icon-only (the Toolbar layout): `h-9`, the 36 px menu button's height, centred,
  in the `w-12` slot.
  `labelled` (the Floating layout's Palette header): `h-6`, left-aligned, the mode's label
  (`text-xs font-medium`) between the icon and the chevron, in the `w-[6.5rem]` slot. No hover
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
- Opens in is an accordion section of the tab menu (`OpensInMenuSection`), after Content: one
  `menuitemradio` row per catalogue entry with its icon, name, description and a dot on the
  checked one; disabled rows use the menu's disabled greys.
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
- Opens in: `role="group"` named "Opens in", `menuitemradio` rows, `aria-disabled` when locked.
- Focus rings `MODE_SWITCH_FOCUS` (brand-600 light, brand-400 dark, at least 3:1).

## Web Experience

- CLS: the switch's slot has one fixed width per form (`w-12`, or `w-[6.5rem]` labelled, wide
  enough for "Diagram"), so nothing beside it moves on a switch.
  On a tab without a switch (an event-storming board) it renders nothing, so the menu card
  narrows on that tab change; a mode switch never moves anything.
- INP: a switch is a `localStorage` write and one store notification; no fetch, no document
  write, no remount of the canvas.
- LCP: unaffected; the mode resolves synchronously on first render from the memory cache.

## Observability

| Event / log                                                  | Where                      |
| ------------------------------------------------------------ | -------------------------- |
| `Editor · Changed · ModeDiagram / ModeDraw`, before applying | `useEditorMode.setMode`    |
| `Tab · Changed · OpensInDiagram / OpensInDraw`               | `useTabOpensIn.setOpensIn` |
| `Draw · …` (formerly `Whiteboard`)                           | Draw mode's emitters       |
| `[editor-mode] switched { from, to }` (debugLog)             | `setMode`                  |
| `[editor-mode] opens-in set` / `opens-in unchanged`          | `useTabOpensIn`            |
| `[editor-mode] whiteboard tab migrated to Draw`              | `migrateWhiteboardKind`    |
| `[editor-mode] remembered mode unreadable, ignored` (warn)   | `readRememberedMode`       |

## Testing

| Spec rule                                      | Test                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Modes, catalogue, opening mode, ES no switch   | `packages/document/src/editor-mode.test.ts`                                                                                                |
| Stored whiteboard → general tab in Draw, inked | `legacy-whiteboard-tab.test.ts`, `stored-tab.test.ts`, api `tab-row.test.ts`                                                               |
| `autoWidth` → `sizing`                         | `legacy-text-sizing.test.ts`, `validate.test.ts`                                                                                           |
| Per person, per tab; view role; ES             | `apps/live/lib/editor-mode-store.test.ts`, `hooks/editor/useEditorMode.test.tsx`                                                           |
| Opening mode pinned; template releases         | `useEditorMode.test.tsx`                                                                                                                   |
| One `canEdit`; preview hides the switch        | `useViewPreview.test.tsx`, `components/chrome/editor-mode/EditorModeSwitch.test.tsx`                                                       |
| The switch: icon only, menu below, rows, keys  | `EditorModeSwitch.test.tsx` "EditorModeSwitch chip"                                                                                        |
| A pressed row lands; Tab away closes           | `EditorModeSwitch.test.tsx` "keeps the menu open through a blur to nowhere…", "closes when focus moves outside (Tab away)"                 |
| Labelled in the Palette header                 | `EditorModeSwitch.test.tsx` "names the mode when labelled…", e2e "a general tab opens in Diagram, with the chip in the Palette header"     |
| The switch beside the menu button              | `components/chrome/ToolbarExplorerButton.test.tsx`, `apps/live/e2e/editor-modes.spec.ts`                                                   |
| A Draw tool in hand never takes the press      | `ToolbarExplorerButton.test.tsx` "marks its card as floating chrome…", e2e "switches back to Diagram with a marker in hand" (both layouts) |
| The tab pill shows your mode on it             | `components/chrome/TabPill.test.tsx`                                                                                                       |
| A template decides the tab's mode              | `app/document/[id]/useTemplateFlow.test.ts`                                                                                                |
| Opens in                                       | `hooks/editor/useTabOpensIn.test.tsx`, `components/chrome/OpensInMenuSection.test.tsx`                                                     |
| New tab opens in Diagram                       | `lib/new-tab-seed.test.ts`, e2e `editor-modes.spec.ts` "a new tab opens in Diagram, even when made in Draw mode"                           |
| Entering / leaving Draw                        | `hooks/canvas/useWhiteboard.test.tsx`, `useWhiteboard.board-tools.test.tsx`                                                                |
| Hugging on `sizing` in both modes              | `lib/text-hug.test.ts`, `boxed-drag-resolve.resize.test.ts`, `useEditorDrag.shift-resize.test.tsx`, `useTextStyleSetters.test.ts`          |
| Template, MCP, imports open in Draw            | `apps/live/lib/templates.test.ts`, `apps/mcp/src/tab-builders.test.ts`, `lib/board-scene/land.test.ts`, `lib/import-merge.test.ts`         |
| Telemetry rename and history                   | `apps/api/src/db/legacy-migration-0061.test.ts`, telemetry app suites                                                                      |
| Shift+D                                        | `hooks/editor/editor-mode-shortcut.test.ts`                                                                                                |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D15 to D22.
