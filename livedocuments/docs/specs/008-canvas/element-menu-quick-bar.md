# Element menu quick bar

The element menu (a right-click, or a long-press on a touch screen) opens on a **quick bar**: one row of glyph
buttons above its first category, holding only what gets reached for on a single element. livedocuments has no
selection toolbar ([Selection popover](canvas-and-palette.md#selection-popover)).

A long-press on a selected element's resize handles opens the menu too: on a phone a small element is mostly
handles, and the browser moves a finger near one onto it, so a press held still there is still a press on the
element. A press that moves resizes, as before.

## What it holds

One row (`aria-label` "Quick actions"):

- **Assign Action**, reading **View Action** once the element has one ([Assigned actions](../012-collaboration/assigned-actions.md)).
- **Add Comment**, reading **View Comments** once it has a thread ([Comments](canvas-and-palette.md#comments)).
- At the right, apart from them, **Delete**, disabled on a locked element ("Locked. Unlock it to delete.").
- A button the element already uses (it has an action or a thread) is tinted in the brand colour and pressed
  (`aria-pressed`), so the bar also says what the element carries.
- Each button has a Tooltip naming it, runs its action and closes the menu.

Assign Action and Add Comment are offered on boxed elements; an arrow's bar is Delete alone.

Nothing else sits in the bar (owner, 2026-11-04: one row, not two). What it used to hold stays a press away
elsewhere: editing text is a double-click; Duplicate is Cmd/Ctrl+D; Stack Front and Stack Back are the **Layer**
category's; Lock is Cmd/Ctrl+Shift+L (and a multi-selection's toolbar). **Add Link**, **Add Note** and **Clear Styles** are retired from the menu: an element's
existing link and note still work (a click on a linked element follows it, and a note still shows), and Clear Styles
stays in the Quick Style panel ([Quick style panel](quick-style-panel.md)).

There are no **Collaborate** or **Resources** categories: the quick bar is the menu's one place for Assign Action and
Add Comment.

## Share roles

The quick bar is an Editor's ([Share roles](../013-workspace/share-roles.md)). A Participant and a Viewer get the
element menu below instead.

## Element menu for Participants and Viewers

A right-click on an element, or a long-press on a touch screen, opens a short menu for a Participant or a Viewer too,
beside the element as an Editor's opens (a bottom sheet on a phone). It is a list of plain rows, under a header
naming the element ("Square"), each row running its action and closing the menu. It holds only what the role may do,
gated on the session's `can`:

| Row                                                   | Participant                                 | Viewer                           |
| ----------------------------------------------------- | ------------------------------------------- | -------------------------------- |
| **Add Comment** / **View Comments** (it has a thread) | Yes (`can.takePart`)                        | No                               |
| **Show Comments**                                     | No                                          | Only on an element with comments |
| **Edit Text** / **Add Text**                          | Where `can.writeText(el)` and it takes text | No                               |
| **Open Link**                                         | When the element has a link                 | When the element has a link      |
| **View Note**                                         | When the element has a note                 | When the element has a note      |
| **Copy Text**                                         | When the element has words                  | When the element has words       |

- Comments rows show only where comments are shown (never in an embed's viewer).
- **Copy Text** writes the element's words to the clipboard, so a Viewer can quote what it reads without selecting it.
- An element with nothing for the role opens no menu: a right-click selects it and does nothing more.
- An arrow offers **Copy Text** (its label) and, to a Participant, **Edit Text**; nothing attaches to an arrow.
- An element someone else holds selected still opens the menu, without **Edit Text** (its words are theirs until they
  let go).
- A multi-selection has no menu for a Participant or a Viewer.
- An image with a picture shows its **Alt Text** under the rows ([Images](../009-elements/images.md#alt-text)): a field
  for a Participant who may write it (the same gate as **Edit Text**), its words or "Not described yet" for a Viewer. So
  a Viewer's right-click on a picture always opens the menu, to read its description. This part is livedocuments'
  own, passed to the shared menu as its `children`.

Every editor (livediagram, liveplanner, livedocuments, livedesign) opens the same menu
(`ReadOnlyElementMenu` in `@liveworkspace/workbench`), with the same rows and gates.

## Implementation

- `apps/editor/components/palette/ElementMenuQuickBar.tsx`: `ElementMenuQuickBar` (`role="toolbar"`, "Quick actions",
  `data-element-quick-bar`), `quickBarItems(target, handlers)`; rendered first in `EditorContextMenu`.
- Clear Styles: `QuickStyleHost` publishes the Quick Style view's targets and its `clearStyles` to
  `../packages/workbench/src/lib/clear-styles-store.ts` (`publishClearStyles`, `useClearStyles`) whenever the targets change, the
  press running the latest; the bar shows it when the store's targets include the element. Its telemetry is the
  panel's (`Element` / `Changed` / `QuickClearStyles`).
- The Element actions row: `ElementMenuActionsRow` in `ElementMenuQuickBar.tsx`, wired from the selection
  handlers in `EditorContextMenuHost`.
- The menu for Participants and Viewers: `readOnlyElementMenuItems` (`../packages/workbench/src/lib/read-only-element-menu.ts`)
  decides the rows from the role, and `ReadOnlyElementMenu`
  (`../packages/workbench/src/components/palette/ReadOnlyElementMenu.tsx`) draws them; each editor's
  `ReadOnlyElementMenuHost` fills them from its own handlers, and `EditorCanvasHost` opens it on a right-click or a
  long-press for every role. `SelectionChromeLayer` (`apps/editor/components/canvas/element-parts.tsx`) hands each
  handle's press to the element's long-press (`onHandlePress`); tested in `SelectionGripsLayer.test.tsx`.
- Tests: `ElementMenuQuickBar.test.tsx`, `EditorContextMenu.plan-attachments.test.tsx`,
  `read-only-element-menu.test.ts`, `ReadOnlyElementMenu.test.tsx`, `ReadOnlyElementMenuHost.test.tsx`.
