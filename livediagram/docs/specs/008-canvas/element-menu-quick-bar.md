# Element menu quick bar

The element menu (a right-click, a long-press, or a toolbar's More) opens on a **quick bar**: one row of glyph
buttons above its first category. What gets reached for on any element sits there, one press away, instead of
inside a category that has to be opened first.

## What it holds

The attachments it used to hold at its left (Action, Comment, Link, Note) are the **Resources** category now
([Resources](#resources)).

- At its right, **Clear Styles**: the Quick Style panel's own Clear Styles
  ([Quick style panel](quick-style-panel.md)), the element's quick-style colours, width and line style back to the
  theme's. It shows while the element takes a quick style, whether or not the panel is on screen.
- Each button has a Tooltip naming it, runs its action and closes the menu, as the tiles it replaced did.

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
element menu below instead, and keep the selection toolbar's **Add Comment** (**Show Comments** for a Viewer).

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

Every editor (livediagram, liveplanner, livedocuments, livedesign) opens the same menu (`ReadOnlyElementMenu` in
`@liveworkspace/workbench`, its rows from `readOnlyElementMenuItems`), each filling it from its own handlers in
`ReadOnlyElementMenuHost`.

## Implementation

- `apps/editor/components/palette/ElementMenuQuickBar.tsx`: `ElementMenuQuickBar` (`role="toolbar"`, "Quick actions",
  `data-element-quick-bar`), `quickBarItems(target, handlers)`; rendered first in `EditorContextMenu`.
- Clear Styles: `QuickStyleHost` publishes the Quick Style view's targets and its `clearStyles` to
  `../packages/workbench/src/lib/clear-styles-store.ts` (`publishClearStyles`, `useClearStyles`) whenever the targets change, the
  press running the latest; the bar shows it when the store's targets include the element. Its telemetry is the
  panel's (`Element` / `Changed` / `QuickClearStyles`).
- Tests: `ElementMenuQuickBar.test.tsx`, `EditorContextMenu.plan-attachments.test.tsx`.

## Kind tools (owner, 2026-11-16)

An element kind's own verbs are not on the floating selection toolbar, which keeps the same buttons on every element.
They sit in a bar of glyph buttons at the top of the element menu, above its first category: a mind node's Add Child and
Add Sibling, a flowchart step's Add Step, Add Branch, Step Type and Lane, a relationship's cardinality. Each names
itself in a hover card; a verb closes the menu as it runs, and a dropdown closes it on its pick. An element with none
has no bar. Tab and Enter still grow a mind map, and the quick-connect ring still offers Add Child and Add Sibling.

**Save to Library** moved here too, off the selection toolbar: at the bar's right end, its place there setting it apart
(no rule). Since every element can be saved, the bar shows on every element an Editor opens the menu on.

**Clear Styles** sits last, right of Save to Library, on an element whose look the Quick Style panel can reset. In the
Quick Style panel's Tools row the kind's buttons carry their names beside their glyphs (there is room for words there).
