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

**Everything in Resources happens inside its dialog** (owner, 2026-11-23). The list opens with a picture of the element
wearing the badges its resources give it on the canvas, over the options as one grouped list (owner,
2026-11-24). **Assign an Action** opens as a screen of the dialog under a back
bar (its own dialog draws in the slot the screen holds, never over it). **Link** offers a web address, a tab, then a
file of each product, this app's first, each named by the product's logo and wordmark over what it calls a file
(livediagram Canvas, liveplanner Plan, livedocuments Document, livedesign Design, livehuddle Space); a product's
step lists that person's recent files of it with a search, and every one reads the same when empty ("No plans
yet"), when nothing matches (the shared no-matches line with Clear) and when the list could not be read (Try
Again). Another product's file is linked by its address.
A product's step is named on the back bar by what it calls a file alone ("Knowledgebase"), and its messages
write that word as the product does ("No Knowledgebases Yet").

What attaches to the element sits behind one **Resources** row, always the menu's last. It looks like its neighbours
and wears the small window mark of a row that opens a dialog
([A category that opens a dialog](canvas-and-palette.md)): a press closes the menu and opens the **Resources** modal
(owner, 2026-11-23). Nothing Resources offers sits loose in the menu's list.

The modal is a centred card, a bottom sheet on a phone, under the dialog hero header (two sheets held by a paperclip),
titled **Resources** with a line naming the element ("What is attached to this Square."). Its height is the first screen's,
which shows whole on a desktop, never scrolling; every other screen keeps that height and scrolls inside it, so the
card never jumps (a hosted Assign an Action takes the room its form needs). On a phone it is a drawer docked to the
bottom edge with a grab handle, as tall as the same first screen. **Done** closes it.

**Its first screen** lists each option as a row of its own, in this order, whichever this app offers:

| Option       | What it is                 | What the element has now                                         |
| ------------ | -------------------------- | ---------------------------------------------------------------- |
| **Action**   | "Work assigned to someone" | The action's name ("Done: " or "Won't Do: " before a closed one) |
| **Comments** | "A thread to talk it over" | "2 comments"                                                     |
| **Link**     | "A page or tab it opens"   | Where it goes: the address, "Tab: Roadmap", a file's name        |
| **Note**     | "Words kept behind it"     | The note's first line                                            |

- Each row shows the option's glyph on a plate and its name, then at its right what the element has now, or the
  verb that adds one in the accent (**Assign Action**, **Add Comment**, **Add Link**, **Add Note**), then a chevron.
  An option the element has fills its plate, and the picture above wears its glyph as a badge. A screen reader hears
  the verb a press runs on a row that has one.
- **Link** is not offered on a link card or a video, whose link is their own **Link** category's.
- After them, where this session may: **Live Status** ("Whether its service is up", the status address it is bound
  to, or "No status URL yet"; [Live status](../009-elements/live-status.md)), for an Editor on a shape that can be
  bound, and **Send to Plan** ("A card for it in liveplanner", "Sent: " and where the card stands once sent, or "Not
  sent yet"; [Send to Plan](../013-workspace/send-to-plan.md)), on an element with words. Each closes the modal and
  opens its own dialog.
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
- Resources: `elementResourceOptions` (`../packages/workbench/src/components/palette/element-resources.tsx`) builds
  the options every editor shares, an option offered when its handler is given; `quickBarItems(target, handlers)` in
  `ElementMenuQuickBar.tsx` binds it to this app. `EditorContextMenu` draws the row (`MenuDialogSection`),
  `EditorContextMenuHost` closes the menu and sets `resourcesOpenForId` (`editor-ui-state.ts`), and
  `apps/editor/components/dialogs/ElementResourcesDialog.tsx` (from `EditorElementDialogs`) hands this
  editor's profile (the element the row took, its `quickBarItems`, where its links go) to the workbench's one copy,
  `../packages/workbench/src/components/dialogs/ElementResourcesDialog.tsx`, which keeps it closed once its element
  is gone, builds the link places' steps and renders `ResourcesDialog`
  (`../packages/workbench/src/components/dialogs/ResourcesDialog.tsx`). Tests: `ElementResourcesDialog.test.tsx`,
  `ResourcesDialog.test.tsx`, `element-resources.test.tsx`.
- Tests: `ElementMenuQuickBar.test.tsx`, `EditorContextMenu.plan-attachments.test.tsx`.

## Kind tools (owner, 2026-11-16)

**Collaboration elements bring their main controls** (owner, 2026-11-23). What a collaboration element's own
"..." menu does is also a kind tool, so it is in the Quick Style panel's Tools row and the menu's bar: a quiz's
**Edit Question**, **Start**, **Lock Now**, **Reveal Answer** and **Reset** (whichever its phase allows), an agenda's
**Reset Agenda**, a done check's **Clear My Mark** and **Reset Everyone**, an idea box's **Empty the Box**, a
temperature check's **Reset Answers**, and a Q&A board's **Clear the Spotlight** and **Empty the Board**. The face
says what it can do now, so the tools follow it; a Viewer and a locked element get none.

An element kind's own verbs are not on the floating selection toolbar, which keeps the same buttons on every element.
They sit in a bar of glyph buttons at the top of the element menu, above its first category: a mind node's Add Child and
Add Sibling, a flowchart step's Add Step, Add Branch, Step Type and Lane, a relationship's cardinality, a concept graphic's
add while it has room (Add Layer, Add Tier, Add Step, Add Satellite, Add Ring, Add Stage, Add Milestone; owner,
2026-11-19), which the Quick Style panel shows too, as it shows a mind node's, and the button that
opens the element's own edit dialog, on every kind that has one (owner, 2026-11-23): **Edit Fields** (an entity),
**Edit Code** (a code block), **Edit Data** (a line chart no sheet fills), **Edit Flows** (a Sankey), **Edit
Sequence** (a sequence diagram) and **Edit Outline** (a mind map's root). Also **Edit Checklist**, **Edit Legend**,
**Edit Data** on a pie, column or bar chart, **Edit Segments** (an agenda), **Edit Table**, and the rows dialog named
for what it holds (**Edit Stats**, **Edit Steps**, **Edit Links**, **Edit Tags**, **Edit Pyramid**, **Edit Layer
Stack** ...); a table has **Add Row** and **Add Column** before it, the quick-connect ring's adds as buttons. The same
button shows in the Quick Style panel's Tools row, for whoever may open the dialog, on an unlocked element. Each names
itself in a hover card; a verb closes the menu as it runs, and a dropdown closes it on its pick. An element with none
has no bar. Tab and Enter still grow a mind map, and the quick-connect ring still offers Add Child and Add Sibling.

The bar sits above the menu's rows in the stacking order, so a dropdown it opens (Step Type, Lane, cardinality) draws
over the categories below it rather than under them.

**Save to Library** moved here too, off the selection toolbar: at the bar's right end, its place there setting it apart
(no rule). Since every element can be saved, the bar shows on every element an Editor opens the menu on.

**Clear Styles** sits last, right of Save to Library, on an element whose look the Quick Style panel can reset. In the
Quick Style panel's Tools row the kind's buttons carry their names beside their glyphs (there is room for words there).
