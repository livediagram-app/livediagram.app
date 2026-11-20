# Ask UI blueprint

Derived from [Search and Ask](../search-and-ask.md) "The three views" and "Ask": the switch between the
knowledgebase's views, the surface Ask and AI Knowledge are drawn on, AI Settings and the Ask view, over the client
the [knowledge UI blueprint](knowledge-ui.md) describes. **Nothing here is verified in a browser.**

## The three views

| Piece                                | File                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| the view in the address              | `lib/knowledge-ask/knowledge-view.ts`                                                              |
| the view as React state              | `lib/knowledge-ask/useKnowledgeView.ts`                                                            |
| the switch                           | `components/ask/KnowledgeViewSwitch.tsx`                                                           |
| who is offered the views             | `components/ask/useKnowledgeViewsOffered.ts`                                                       |
| the switch's places, the view's host | `components/ask/KnowledgeViewHost.tsx`                                                             |
| the surface a view is drawn on       | `components/ask/KnowledgeViewFrame.tsx`                                                            |
| the hook-ins                         | `editor-view-bars.tsx` (`leadAction`), `EditorView.tsx` (`KNOWLEDGE_SWITCH_ROW`, `KNOWLEDGE_VIEW`) |

- **`KnowledgeView`** is `'pages' | 'ask' | 'ai'`. `knowledgeViewOf(search)` reads `?view=`; anything else is
  `pages`. `knowledgeViewHref(href, view)` sets or removes the parameter and keeps the path, the rest of the query
  (a share link's `s`) and the hash (`#t=<page>`).
- **Why the query and not the hash:** `useTabEntryEffects` rewrites the whole hash to `#t=<id>` whenever it is not
  exactly that, so a view kept there would be lost on the first load.
- **`showKnowledgeView(view, { replace })`** is `history.pushState` (or `replaceState`) with the router's own state
  handed back, then a notify. `subscribeKnowledgeView` also hears `popstate`, so Back and Forward move the view.
  `useKnowledgeView()` is `useSyncExternalStore` over the two; on the server it is `pages`.
- **The switch** is a `nav` named "Knowledgebase Views" holding three links, each inside a `HoverCard` (its name and
  one line). The showing view has `aria-current="page"`. A plain left press moves in place and sends
  `UI·Opened·AskView`, `AiKnowledgeView` or `PagesView`; a press with a modifier or another button is the link's.
  The track is `slate-100` (`slate-800` dark) with 2px of padding; the showing segment is white (`slate-600` dark)
  with `shadow-sm`. Colour changes run on `duration-micro` under `motion-safe`.
  - `corner`: in `EditorCornerActions`' `leadAction` slot, segments 32px tall, the track the card's buttons' 36px.
    When the card goes compact (`data-compact`) the names become screen-reader text and the glyphs stay. Hidden on a
    phone (`phone:hidden`).
  - `row`: a phone's row in the editor's column, after the approver's banner and before the top row's layer, so the
    top row's card and the canvas chrome both start under it. Segments are 44px tall and share the width.
- **Offered** (`useKnowledgeViewsOffered`): `hydrated`, a `documentId`, `appChrome`, and none of `embedMode`,
  `zenMode`, `anyWelcomeOpen`, a `workbench`, a `sessionCommunity`, a `sessionTabScope`. Not offered, the switch
  draws nothing and the host shows Pages whatever the address says.
- **The frame** is `fixed`, from the anchor's top (`data-knowledge-view-anchor`, a zero-height mark after the phone
  row) to the window's foot, at `--z-canvas-modal` (45): over the canvas, the page tree, the toolbar and an empty
  page's template start, under the top row's layer (`--z-modal`) and every dialog. It is a `region` named for its
  view and takes the focus when it opens.
  - `useEditorInert`: every child of the editor's column that holds a `data-region` (the canvas, the bars) and not
    the top row's card is made `inert` for as long as the frame shows, and given back after. Children marked
    `data-knowledge-view-keep` (the phone row) are left alone. Dialogs, toasts and hover cards are portals outside
    the column.
  - `useModalGuard(true)`: the editor's window-level shortcut and paste listeners stand down, as behind a dialog.
  - `KnowledgeViewHeader` is 70px tall at least (the top row's 12px, 46px and 12px) and pads its right by the top
    row's card's measured width plus 12px (`useChromeBox`: one `ResizeObserver` on the card and on the column child
    above the anchor, and the window's `resize`), so its controls never sit under the card.
- **Loading:** each view is `next/dynamic` with `ssr: false`, fetched when first shown. A view's render crash stays
  in the `KnowledgeView` error area.

### Tests

`lib/knowledge-ask/knowledge-view.test.ts` (the address, the history entry, Back), and
`components/ask/KnowledgeViewHost.test.tsx` (the links and `aria-current`, the plain and the modified press, each
case the views are not offered in, the inert editor, the modal guard, the way back).

### Not known

- An approver's banner or the phone row changing height while a view shows moves the frame's top on the next
  `ResizeObserver` turn, one frame late.
- `inert` is set on DOM the editor's components own. React does not write that attribute for them, so nothing
  fights over it; a column child mounted while a view shows is not made inert.
