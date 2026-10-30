# Element menu quick bar

The element menu (a right-click, or a long-press on a touch screen) opens on a **quick bar**: two rows of glyph
buttons above its first category. What gets reached for on any element sits there, one press away, instead of
inside a category that has to be opened first. livedocuments has no selection toolbar
([Selection popover](canvas-and-palette.md#selection-popover)), so the menu is the one place for what it held.

## What it holds

The first row, **Element actions** (`aria-label`), holds what the selection toolbar used to:

- **Edit Text**, reading **Add Text** on an element with no words yet: on every text-capable element
  (`elementSupportsText`), entering inline text editing as a double-click does.
- **Duplicate**.
- **Stack Front** and **Stack Back**: in front of or behind everything else on the element's own layer (the Layer
  category's Bring to Front and Send to Back move it between layers).
- **Lock**, reading **Unlock** on a locked element, pressed while locked.
- At the right, apart from them, **Delete**, disabled on a locked element.

The second row, at the left, what attaches to the element, in this order:

- **Assign Action**, reading **View Action** once the element has one ([Assigned actions](../012-collaboration/assigned-actions.md)).
- **Add Comment**, reading **View Comments** once it has a thread ([Comments](canvas-and-palette.md#comments)).
- **Add Link**, reading **Edit Link** once it has one. Not on a link card or a video, whose link is their own
  **Link** category's.
- **Add Note**, reading **Edit Note** once it has one.
- At the right, apart from them, **Clear Styles**: the Quick Style panel's own Clear Styles
  ([Quick style panel](quick-style-panel.md)), the element's quick-style colours, width and line style back to the
  theme's. It shows while the element takes a quick style, whether or not the panel is on screen.
- A button the element already uses (it has an action, a thread, a link or a note) is tinted in the brand colour and
  pressed (`aria-pressed`), so the bar also says what the element carries.
- Each button has a Tooltip naming it, runs its action and closes the menu, as the tiles it replaced did.

The four attachments are offered on boxed elements; arrows take none, so an arrow's bar is its Element actions row
(and Clear Styles while it takes a quick style).

There are no **Collaborate** or **Resources** categories for Assign Action, Add Comment, Add Link and Add Note: the
quick bar is their one place in the menu.

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
  long-press for every role.
- Tests: `ElementMenuQuickBar.test.tsx`, `EditorContextMenu.plan-attachments.test.tsx`,
  `read-only-element-menu.test.ts`, `ReadOnlyElementMenu.test.tsx`, `ReadOnlyElementMenuHost.test.tsx`.
