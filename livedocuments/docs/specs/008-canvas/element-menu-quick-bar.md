# Element menu quick bar

The element menu (a right-click, or a long-press on a touch screen) opens on a **quick bar**: one row of glyph
buttons above its first category, holding only what gets reached for on a single element. livedocuments has no
selection toolbar ([Selection popover](canvas-and-palette.md#selection-popover)).

A long-press on a selected element's resize handles opens the menu too: on a phone a small element is mostly
handles, and the browser moves a finger near one onto it, so a press held still there is still a press on the
element. A press that moves resizes, as before.

## What it holds

The attachments it used to hold at its left (Action, Comment, Link, Note) are the **Resources** category now
([Resources](#resources)).

One row (`aria-label` "Quick actions"):

- **Assign Action**, reading **View Action** once the element has one ([Assigned actions](../012-collaboration/assigned-actions.md)).
- **Add Comment**, reading **View Comments** once it has a thread ([Comments](canvas-and-palette.md#comments)).
- At the right, apart from them, **Delete**, disabled on a locked element ("Locked. Unlock it to delete.").
- Each button has a Tooltip naming it, runs its action and closes the menu.

Assign Action and Add Comment are offered on boxed elements; an arrow's bar is Delete alone.

Nothing else sits in the bar (owner, 2026-11-04: one row, not two). What it used to hold stays a press away
elsewhere: editing text is a double-click; Duplicate is Cmd/Ctrl+D; Stack Front and Stack Back are the **Layer**
category's; Lock is Cmd/Ctrl+Shift+L (and a multi-selection's toolbar). **Add Link**, **Add Note** and **Clear Styles** are retired from the menu: an element's
existing link and note still work (a click on a linked element follows it, and a note still shows), and Clear Styles
is gone from livedocuments altogether ([Quick Style bar](quick-style-panel.md) "No Clear Styles").

There are no **Collaborate** or **Resources** categories: the quick bar is the menu's one place for Assign Action and
Add Comment.

## Resources

What attaches to the element sits in one **Resources** category, always the menu's last, opening in a side flyout as
**Appearance** does. Its rows are laid out as Appearance's **Finish** list is: a bordered list, one row each, its glyph, its
name and a quiet line under it. In this order, whichever this app offers:

- **Assign Action** ("What a click on it does"), reading **View Action** once the element has one.
- **Add Comment** ("A thread to talk it over"), reading **View Comments** once it has a thread.
- **Add Link** ("A page or tab it opens"), reading **Edit Link** once it has one. Not on a link card or a video, whose
  link is their own **Link** category's.
- **Add Note** ("Words kept behind it"), reading **Edit Note** once it has one.

A row the element already has carries a brand dot at its right. Each row runs its action and closes the menu. They are
offered only on boxed elements; arrows take none, and with none to offer the category is not drawn. Why: four glyph
buttons in a row read as noise above every menu, and their meaning hid in tooltips; named rows with a line each say
what they are at a glance, in the layout the menu already uses for a list of choices.

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
