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
- Each tab has its own independent canvas — nodes, edges, layout.
- Tabs are **ordered**; the order is part of the diagram and is editable by the user.
- A tab has a name (default `"Tab 1"`, `"Tab 2"`, etc.) and is renameable.

## Cross-tab links

Any element on any canvas can **link to** something on another tab:

- A link can target **a tab** (open that tab when clicked).
- A link can target **a specific element on another tab** (open that tab and focus/scroll-to that element).

Activating a link is a navigation action inside the diagram, not a URL.

### Use cases

- **Drill-down.** A "Database" node on the Overview tab links to the "Database internals" tab — clicking it dives into detail.
- **Mindmap deep-dives.** A leaf branch on the mindmap links to its own tab for deeper structure.
- **Cross-references.** A process step links to a related decision elsewhere in the diagram, without duplicating the content.

## Data model sketch

This is a sketch, not the final schema. The shape lives in a shared package so the prototype `localStorage` store, the future Worker/D1 store, and the editor UI all agree.

```ts
type DiagramId = string;
type TabId = string;
type ElementId = string;

type Diagram = {
  id: DiagramId;
  name: string;
  tabs: Tab[]; // ordered
  createdAt: string;
  updatedAt: string;
};

type Tab = {
  id: TabId;
  name: string;
  elements: Element[];
};

// Concrete element types (see 09-canvas-and-command-palette.md):
//   ShapeElement   { type: 'shape',  shape: 'square' | 'circle', x, y, width, height, label?, locked? }
//   TextElement    { type: 'text',   x, y, width, height, label?, locked? }
//   StickyElement  { type: 'sticky', x, y, width, height, label?, locked? }
//   ArrowElement   { type: 'arrow',  from: Endpoint, to: Endpoint, locked? }
//
// All elements may eventually carry `link?: ElementLink` for cross-tab navigation.
type Element = ShapeElement | TextElement | StickyElement | ArrowElement;

type ElementLink =
  | { kind: 'tab'; tabId: TabId }
  | { kind: 'element'; tabId: TabId; elementId: ElementId };
```

### Why element IDs are unique across the whole diagram, not per tab

Element IDs are diagram-scoped so cross-tab links are stable even if elements move between tabs (e.g. cut from Tab A, paste into Tab B). The id doesn't change; the link still resolves.

## UI implications

- The editor shows tabs at the **bottom** of the screen (see [07-live-app.md](07-live-app.md)).
- The active tab fills the canvas area.
- A "+" button on the tab bar adds a new empty tab.
- Tabs can be renamed (double-click or context menu — TBD).
- Tabs can be reordered (drag — TBD).
- Creating a cross-tab link is a future interaction (TBD); the data model is ready for it from day one.
