# Element menu quick bar

The other four products open the element menu (a right-click, a long-press, or a toolbar's More) on a **quick bar**:
one row of glyph buttons above its first category, holding Assign Action, Add Comment, Add Link, Add Note and Clear
Styles. **livehuddle has no quick bar** (Work Tracker 739): once its four attachment buttons left, the bar was a
full-width band holding one eraser, so its one button moved into the menu as a row and the band is gone.

## Clear Styles

- **Clear Styles** puts the element's quick-style colours, width and line style back to the theme's, forgetting the
  style memory of its kind. livehuddle has no Quick Style panel
  ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#quick-style)), so this is the one Clear Styles.
- It is a row of the menu's **Appearance** group, directly under the **Style** row whose colours and border it resets,
  drawn as the menu's other rows are (the eraser in the icon slot, the label in the category rhythm). It runs on one
  press and closes the menu, so it stays one click away.
- It shows while the element takes a quick style (a shape or a text element that is not retired). On any other
  element there is no row and nothing in its place.

**Assign Action, Add Comment, Add Link and Add Note are gone** (owner, 2026-11-11, Work Tracker #714): livehuddle has
no comments, actions, element links or notes ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#comments-actions-links-and-notes)),
for any role. A link card keeps its own **Link** category. The other four products keep the four on their quick bars,
unchanged.

## Share roles

Clear Styles is an Editor's ([Share roles](../013-workspace/share-roles.md)). A Participant and a Viewer get the
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

- `apps/editor/components/palette/ElementMenuClearStyles.tsx`: `ElementMenuClearStyles`, a `MenuActionRow`
  (`@liveworkspace/workbench`'s `PortalMenu`) named "Clear Styles"; rendered by `ElementAppearanceSections` right after
  the Style flyout. Only livehuddle's own menu files change; the shared menu primitives do not.
- Clear Styles: `ClearStylesHost` (headless, `components/canvas/ClearStylesHost.tsx`) publishes the Quick Style view's targets and its `clearStyles` to
  `../packages/workbench/src/lib/clear-styles-store.ts` (`publishClearStyles`, `useClearStyles`) whenever the targets change, the
  press running the latest; the row shows when the store's targets include the element. Its telemetry is
  `Element` / `Changed` / `QuickClearStyles`.
- Tests: `ElementMenuClearStyles.test.tsx` (no Assign Action, Add Comment, Add Link or Add Note for any element; the
  row runs and closes; no row off a quick-style target), `EditorContextMenu.clear-styles.test.tsx` (no quick bar band;
  the row sits under Style),
  `ReadOnlyElementMenuHost.test.tsx`, `CanvasSelectionToolbars.comments.test.tsx` (no toolbar for a Participant or a
  Viewer).
