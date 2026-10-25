# Element menu quick bar

The element menu (a right-click, a long-press, or a toolbar's More) opens on a **quick bar**: one row of glyph
buttons above its first category. What gets reached for on any element sits there, one press away, instead of
inside a category that has to be opened first.

## What it holds

- At the left, what attaches to the element, in this order:
  - **Assign Action**, reading **View Action** once the element has one ([Assigned actions](../012-collaboration/assigned-actions.md)).
  - **Add Comment**, reading **View Comments** once it has a thread ([Comment pins](../012-collaboration/comment-pin.md)).
  - **Add Link**, reading **Edit Link** once it has one. Not on a link card or a video, whose link is their own
    **Link** category's.
  - **Add Note**, reading **Edit Note** once it has one.
- At the right, apart from them, **Clear Styles**: the Quick Style panel's own Clear Styles
  ([Quick style panel](quick-style-panel.md)), the element's quick-style colours, width and line style back to the
  theme's. It shows while the element takes a quick style, whether or not the panel is on screen.
- A button the element already uses (it has an action, a thread, a link or a note) is tinted in the brand colour and
  pressed (`aria-pressed`), so the bar also says what the element carries.
- Each button has a Tooltip naming it, runs its action and closes the menu, as the tiles it replaced did.

The four attachments are offered only on boxed elements other than Plan items, as before
([Plan mode](../026-plan/plan-mode.md) "Nothing attached to Plan items"); arrows take none. With nothing to offer (an
arrow that takes no quick style) the bar is not drawn.

They had their own categories, **Collaborate** (Assign Action, Add Comment) and **Resources** (Add Link, Add Note), at
the foot of the menu. Those categories are gone: the quick bar is their one place in the menu.

## Share roles

The element menu is an Editor's ([Share roles](../013-workspace/share-roles.md)): a Participant and a Viewer have no
element menu, so no quick bar. A Participant still comments from the selection toolbar's **Add Comment**, as before.

## Implementation

- `apps/editor/components/palette/ElementMenuQuickBar.tsx`: `ElementMenuQuickBar` (`role="toolbar"`, "Quick actions",
  `data-element-quick-bar`), `quickBarItems(target, handlers)`; rendered first in `EditorContextMenu`.
- Clear Styles: `QuickStyleHost` publishes the Quick Style view's targets and its `clearStyles` to
  `../packages/workbench/src/lib/clear-styles-store.ts` (`publishClearStyles`, `useClearStyles`) whenever the targets change, the
  press running the latest; the bar shows it when the store's targets include the element. Its telemetry is the
  panel's (`Element` / `Changed` / `QuickClearStyles`).
- Tests: `ElementMenuQuickBar.test.tsx`, `EditorContextMenu.plan-attachments.test.tsx`.
