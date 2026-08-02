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
- A link can target **another diagram** (`diagram` kind) or **an external URL** (`url` kind, opens in a new tab).

Activating a tab/element/diagram link is a navigation action; a `url` link opens the external address. Each linked element renders a small "Follow link" badge whose tooltip names the target (spec/09).

### Use cases

- **Drill-down.** A "Database" node on the Overview tab links to the "Database internals" tab — clicking it dives into detail.
- **Mindmap deep-dives.** A leaf branch on the mindmap links to its own tab for deeper structure.
- **Cross-references.** A process step links to a related decision elsewhere in the diagram, without duplicating the content.

## Data model

Canonical types live in **`@livediagram/diagram`** — that package is the source of truth for the cross-app shape (consumed by the live editor, the api worker, and any future code that handles diagrams). Everything is re-exported through `src/index.ts`, so consumers import from the package and never from a file inside it; the split below is for readability only and can change without touching a caller.

| File               | Holds                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| `index.ts`         | the public surface, plus the shared enums every element family draws on |
| `element-types.ts` | the boxed elements (shape, text, table, sticky, image, freehand, …)     |
| `arrow-types.ts`   | anchors, endpoints, arrowheads, `ArrowElement`                          |
| `shape-kind.ts`    | `ShapeKind`, the closed vocabulary of shapes                            |

Treat the sketch below as a high-level outline; read the package for the full field list.

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

// Concrete element kinds, see packages/diagram for the full shape of each:
//   ShapeElement     (shape: square / circle / diamond / cylinder / parallelogram / hexagon
//                            / document / stadium / actor / cloud / browser / monitor / laptop
//                            / phone / tablet)
//   TextElement
//   StickyElement
//   ImageElement     (boxed, references an R2-stored bitmap by imageId, see spec/19)
//   ArrowElement     (from + to Endpoints, arrowStyle, arrowheadSize, optional label)
//   FreehandElement  (boxed, carries a normalised polyline + optional auto-close flag for
//                     filled custom shapes; rendered as an SVG path inside its bounding box;
//                     see spec/09's Pencil (freehand) subsection)
//
// Most elements may carry `link?: ElementLink` for cross-tab navigation.
type Element =
  | ShapeElement
  | TextElement
  | StickyElement
  | ImageElement
  | ArrowElement
  | FreehandElement;

type ElementLink =
  | { kind: 'tab'; tabId: TabId }
  | { kind: 'element'; tabId: TabId; elementId: ElementId }
  | { kind: 'diagram'; diagramId: string; name: string }
  | { kind: 'url'; url: string }; // external address, opens in a new tab
```

Persistence shape lives in [11-api.md](11-api.md) (per-tab rows + diagram-meta rows in D1). The `apps/live/lib/api-client.ts` boundary serialises this same in-memory shape against the api worker.

### Why element IDs are unique across the whole diagram, not per tab

Element IDs are diagram-scoped so cross-tab links are stable even if elements move between tabs (e.g. cut from Tab A, paste into Tab B). The id doesn't change; the link still resolves.

## UI implications

- The tab bar sits at the **bottom** of the editor (see [07-live-app.md](07-live-app.md)). The active tab fills the canvas area.
- A `+` button on the tab bar adds a new empty tab and switches to it.
- **Rename** a tab by double-clicking its label (inline input — Enter commits, Escape cancels). Also available via the per-tab ellipsis menu.
- **Reorder** tabs by dragging a tab to a new position in the bar.
- **Create a link** from the element's right-click context menu, click "Link Element", and pick a target (tab, element, another diagram, or an external URL); the link follows the element if it's moved.
