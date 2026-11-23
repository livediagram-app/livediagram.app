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

The three attachments are offered only on boxed elements other than Plan items, as before
([Plan mode](../026-plan/plan-mode.md) "Nothing attached to Plan items"); arrows take none. There is no **Add Comment**:
comment threads on canvas elements are retired ([Plan mode](../026-plan/plan-mode.md) "No comment thread on any canvas
element"); comments live on cards and Sheet cells. With nothing to offer (an
arrow that takes no quick style) the bar is not drawn.

They had their own categories, **Collaborate** (Assign Action, Add Comment) and **Resources** (Add Link, Add Note), at
the foot of the menu. Those categories are gone: the quick bar is their one place in the menu.

## Resources

What attaches to the element sits behind one **Resources** row, always the menu's last. It looks like its neighbours
and wears the small window mark of a row that opens a dialog
([A category that opens a dialog](canvas-and-palette.md)): a press closes the menu and opens the **Resources** modal
(owner, 2026-11-23). Nothing Resources offers sits loose in the menu's list.

The modal is a centred card, a bottom sheet on a phone, under the dialog hero header (two sheets held by a paperclip),
titled **Resources** with a line naming the element ("What is attached to this Square."). It keeps one height on
every screen, so it never jumps as its screens change. **Done** closes it.

**Its first screen** lists each option as a row of its own, in this order, whichever this app offers:

| Option       | What it is                 | What the element has now                                         |
| ------------ | -------------------------- | ---------------------------------------------------------------- |
| **Action**   | "Work assigned to someone" | The action's name ("Done: " or "Won't Do: " before a closed one) |
| **Comments** | "A thread to talk it over" | "2 comments"                                                     |
| **Link**     | "A page or tab it opens"   | Where it goes: the address, "Tab: Roadmap", a file's name        |
| **Note**     | "Words kept behind it"     | The note's first line                                            |

- Each row shows the option's glyph on a plate, its name, the line saying what it is, and under them what the element
  has now, or "No action yet", "No comments yet", "No link yet", "No note yet". An option the element has fills its
  plate and wears an **Added** badge.
- **Link** is not offered on a link card or a video, whose link is their own **Link** category's.
- At the row's right is what a press does: the verb it runs (**Assign Action** or **View Action**, **Add Comment** or
  **View Comments**, **Add Note**), or a chevron where the option has options of its own.
- Up, Down, Home and End move between the rows; Tab does too.

**An option with options of its own** opens its screen inside the modal. At its top is the back bar
([Back bar](../004-interface-design/back-bar.md)) reading **Resources**, with the option's name as its chip: a press
goes back to the list, focus returning to the option's row. Under it is what the element has now, in full (a note's
words, up to four lines), then the option's own rows:

- **Link**: where it can go, as the link picker names them: **External URL**, **Tab** and this app's own file. Each
  opens the link picker on that place. The place the link goes to now wears a **Current** badge. On a linked element
  **Remove Link** sits last, under a rule.
- **Note**, once written: **Edit Note** and, under a rule, **Remove Note**. A note not written yet has nothing to
  choose between, so its row opens the note to write.

**Action** and **Comments** have no options of their own: the row opens the action (the assign dialog, or the
action's popover once it has one) or the thread, as the old rows did.

A row that opens another surface (the assign dialog, the thread, the note, the link picker) closes the modal first,
so the two never stack. **Remove Link** and **Remove Note** run inside the modal, which goes back to its list, where
the row now reads as empty; undo brings either back.

They are offered only on boxed elements; arrows take none, and with none to offer the row is not drawn. A locked
element takes them as an unlocked one does. If the element goes while the modal is open (deleted, undone away, the
tab changed), the modal closes. Why a modal: a side flyout had room for a name and a line, not for what the element
already has or for an option's own choices, and each choice had to be found by opening the surface behind it.

## Share roles

The quick bar is an Editor's ([Share roles](../013-workspace/share-roles.md)). A Participant and a Viewer get the
element menu below instead. Neither has a comment button on the selection toolbar.

## Element menu for Participants and Viewers

A right-click on an element, or a long-press on a touch screen, opens a short menu for a Participant or a Viewer too,
beside the element as an Editor's opens (a bottom sheet on a phone). It is a list of plain rows, under a header
naming the element ("Square"), each row running its action and closing the menu. It holds only what the role may do,
gated on the session's `can`:

| Row                          | Participant                                 | Viewer                      |
| ---------------------------- | ------------------------------------------- | --------------------------- |
| **Edit Text** / **Add Text** | Where `can.writeText(el)` and it takes text | No                          |
| **Open Link**                | When the element has a link                 | When the element has a link |
| **View Note**                | When the element has a note                 | When the element has a note |
| **Copy Text**                | When the element has words                  | When the element has words  |

- No comment row, for either role: comment threads on canvas elements are retired.
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
- Resources: `elementResourceOptions` (`../packages/workbench/src/components/palette/element-resources.tsx`) builds
  the options every editor shares, an option offered when its handler is given; `quickBarItems(target, handlers)` in
  `ElementMenuQuickBar.tsx` binds it to this app. `EditorContextMenu` draws the row (`MenuDialogSection`),
  `EditorContextMenuHost` closes the menu and sets `resourcesOpenForId` (`editor-ui-state.ts`), and
  `apps/editor/components/dialogs/ElementResourcesDialog.tsx` renders `ResourcesDialog`
  (`../packages/workbench/src/components/dialogs/ResourcesDialog.tsx`) from `EditorElementDialogs`. Tests:
  `ResourcesDialog.test.tsx`, `element-resources.test.tsx`.
- Tests: `ElementMenuQuickBar.test.tsx`, `EditorContextMenu.plan-attachments.test.tsx`.
