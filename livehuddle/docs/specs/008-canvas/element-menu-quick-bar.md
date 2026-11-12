# Element menu quick bar

The element menu (a right-click, a long-press, or a toolbar's More) opens on a **quick bar**: one row of glyph
buttons above its first category. What gets reached for on any element sits there, one press away, instead of
inside a category that has to be opened first.

## What it holds

- **Clear Styles**: the element's quick-style colours, width and line style back to the theme's, forgetting the style
  memory of its kind. It shows while the element takes a quick style. livehuddle has no Quick Style panel
  ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#quick-style)), so this is the one Clear Styles.
- It has a Tooltip naming it, runs and closes the menu.

With nothing to offer (an element that takes no quick style) the bar is not drawn.

**Assign Action, Add Comment, Add Link and Add Note are gone** (owner, 2026-11-11, Work Tracker #714): livehuddle has
no comments, actions, element links or notes ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#comments-actions-links-and-notes)),
for any role. A link card keeps its own **Link** category. The other four products keep the four on their quick bars.

## Share roles

The quick bar is an Editor's ([Share roles](../013-workspace/share-roles.md)). A Participant and a Viewer get the
element menu below instead, and no selection toolbar: its one button for them, the comments, is gone.

## Element menu for Participants and Viewers

A right-click on an element, or a long-press on a touch screen, opens a short menu for a Participant or a Viewer too,
beside the element as an Editor's opens (a bottom sheet on a phone). It is a list of plain rows, under a header
naming the element ("Square"), each row running its action and closing the menu. It holds only what the role may do,
gated on the session's `can`:

| Row                          | Participant                | Viewer                     |
| ---------------------------- | -------------------------- | -------------------------- |
| **Edit Text** / **Add Text** | No (it writes on nothing)  | No                         |
| **Copy Text**                | When the element has words | When the element has words |

- There are no comment, link or note rows (**Add Comment**, **View Comments**, **Show Comments**, **Open Link**,
  **View Note**): those left livehuddle (Work Tracker #714). The shared menu still offers them in the other products;
  livehuddle's host passes `commentsShown: false` and `attachments: false`.
- **Copy Text** writes the element's words to the clipboard, so a Viewer can quote what it reads without selecting it.
- An element with nothing for the role opens no menu: a right-click selects it and does nothing more.
- An arrow offers **Copy Text** (its label).
- A Participant has no **Edit Text** row: it changes no content ([A Participant walks](../013-workspace/share-roles.md#a-participant-walks)).
  The row stays in the menu's code, gated on `can.writeText(el)`, which no read-only role holds.
- A multi-selection has no menu for a Participant or a Viewer.

Every editor (livehuddle, liveplanner, livedocuments, livedesign) opens the same menu (`ReadOnlyElementMenu` in
`@liveworkspace/workbench`, its rows from `readOnlyElementMenuItems`), each filling it from its own handlers in
`ReadOnlyElementMenuHost`.

## Implementation

- `apps/editor/components/palette/ElementMenuQuickBar.tsx`: `ElementMenuQuickBar` (`role="toolbar"`, "Quick actions",
  `data-element-quick-bar`), Clear Styles only; rendered first in `EditorContextMenu`.
- Clear Styles: `ClearStylesHost` (headless, `components/canvas/ClearStylesHost.tsx`) publishes the Quick Style view's targets and its `clearStyles` to
  `../packages/workbench/src/lib/clear-styles-store.ts` (`publishClearStyles`, `useClearStyles`) whenever the targets change, the
  press running the latest; the bar shows it when the store's targets include the element. Its telemetry is
  `Element` / `Changed` / `QuickClearStyles`.
- Tests: `ElementMenuQuickBar.test.tsx` (no Assign Action, Add Comment, Add Link or Add Note for any element),
  `ReadOnlyElementMenuHost.test.tsx`, `CanvasSelectionToolbars.comments.test.tsx` (no toolbar for a Participant or a
  Viewer).
