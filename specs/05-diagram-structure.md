# Diagram structure

A diagram is the top-level artifact users create. It is not a single canvas — it is a **collection of tabs**, each its own canvas, with **links between elements across tabs**.

## Hierarchy

```
Diagram
 ├─ Tab 1
 │   ├─ Element (node)
 │   ├─ Element (node)
 │   └─ Element (edge)
 ├─ Tab 2
 │   └─ Element (node)
 └─ ...
```

- A diagram has **one or more tabs**. New diagrams start with a single empty tab.
- Each tab has its own independent canvas — elements, layout, theme, background pattern, optional lock state.
- Tabs are **ordered**; users can drag-reorder them in the tab bar.
- A tab has a name (default `"Tab 1"`, `"Tab 2"`, etc.) and is renameable.
- **Auto-rename on first edit.** While a tab still has its default name (matching `^Tab \d+$`), editing the label of its first element renames the tab to that label. The rename only fires once: as soon as the tab name diverges from the default pattern (auto-rename or manual rename), subsequent label edits leave the tab name alone. This mirrors the diagram-name auto-fill from the default `Untitled diagram`.

## Cross-tab links

Any element on any canvas can **link to** something on another tab:

- A link can target **a tab** (open that tab when clicked).
- A link can target **a specific element on another tab** (open that tab and focus/scroll-to that element).

Activating a link is a navigation action inside the diagram, not a URL. Each linked element renders a small "Follow link" badge in its selection popover.

### Use cases

- **Drill-down.** A "Database" node on the Overview tab links to the "Database internals" tab — clicking it dives into detail.
- **Mindmap deep-dives.** A leaf branch on the mindmap links to its own tab for deeper structure.
- **Cross-references.** A process step links to a related decision elsewhere in the diagram, without duplicating the content.

## Data model

Canonical types live in **`packages/diagram/src/index.ts`** — that file is the source of truth for the cross-app shape (consumed by the live editor, the api worker, and any future code that handles diagrams). Treat the sketch below as a high-level outline; read the package for the full field list.

```ts
type Diagram = {
  id: DiagramId;
  name: string;
  shareable: boolean;
  folderId: string | null;
  tabs: Tab[]; // ordered
  // …plus owner, share code, timestamps
};

type Tab = {
  id: TabId;
  name: string;
  elements: Element[];
  // …plus theme, backgroundColor/Pattern/Opacity, patternColor, locked
};

// Concrete element kinds — see packages/diagram for the full shape of each:
//   ShapeElement   (shape: square / circle / diamond / triangle / cylinder / cloud / parallelogram)
//   TextElement
//   StickyElement
//   ArrowElement   (from + to Endpoints, arrowStyle, arrowheadSize, optional label)
//
// Most elements may carry `link?: ElementLink` for cross-tab navigation.
type Element = ShapeElement | TextElement | StickyElement | ArrowElement;

type ElementLink =
  | { kind: 'tab'; tabId: TabId }
  | { kind: 'element'; tabId: TabId; elementId: ElementId };
```

Persistence shape lives in [11-api.md](11-api.md) (per-tab rows + diagram-meta rows in D1). The `apps/live/lib/api-client.ts` boundary serialises this same in-memory shape against the api worker.

### Why element IDs are unique across the whole diagram, not per tab

Element IDs are diagram-scoped so cross-tab links are stable even if elements move between tabs (e.g. cut from Tab A, paste into Tab B). The id doesn't change; the link still resolves.

## UI implications

- The tab bar sits at the **bottom** of the editor (see [07-live-app.md](07-live-app.md)). The active tab fills the canvas area.
- A `+` button on the tab bar adds a new empty tab and switches to it.
- **Rename** a tab by double-clicking its label (inline input — Enter commits, Escape cancels). Also available via the per-tab ellipsis menu.
- **Reorder** tabs by dragging a tab to a new position in the bar.
- **Create a cross-tab link** from the selection popover, click "Link Element", pick a target tab; the link follows the element if it's moved.
