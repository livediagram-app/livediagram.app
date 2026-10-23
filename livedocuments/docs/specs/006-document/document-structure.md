# Document structure

A document is the top-level artifact users create. It is not a single canvas — it is a **collection of tabs**, each its own run of pages, with **links between elements across tabs**.

## Hierarchy

```
Document
 ├─ Tab 1
 │   ├─ Page
 │   │   ├─ Element
 │   │   └─ Element
 │   └─ Page
 │       └─ Element
 ├─ Tab 2
 │   └─ Page
 └─ ...
```

- A document has **one or more tabs**. New documents start with a single empty tab.
- Each tab has its own independent canvas — pages, elements, layout, theme, optional lock state. Pages are themselves elements on the tab's canvas ([Pages mode](../007-editor/pages-mode.md)).
- Tabs are **ordered**; users can drag-reorder them in the tab bar.
- A tab has a name (default `"Tab 1"`, `"Tab 2"`, etc.) and is renameable.
- **Auto-rename on first edit.** While a tab still has its default name (matching `^Tab \d+$`), editing the label of its first element renames the tab to that label. The rename only fires once: as soon as the tab name diverges from the default pattern (auto-rename or manual rename), subsequent label edits leave the tab name alone. This mirrors the document-name auto-fill from the default `Untitled document`.

## Cross-tab links

Any element on any canvas can **link to** something on another tab:

- A link can target **a tab** (open that tab when clicked).
- A link can target **a specific element on another tab** (open that tab and focus/scroll-to that element).
- A link can target **another document** (`document` kind) or **an external URL** (`url` kind, opens in a new tab).

Activating a tab/element/document link is a navigation action; a `url` link opens the external address. Each linked element renders a small "Follow link" badge whose hover card names the target ([Canvas and palette](../008-canvas/canvas-and-palette.md)).

### Use cases

- **Drill-down.** A summary slide's "Results" box links to the tab holding the full report — clicking it dives into detail.
- **Cross-references.** A step in an infographic links to the article page that explains it, without duplicating the content.

## Data model

Canonical types live in **`@livedocuments/document`** — that package is the source of truth for the cross-app shape (consumed by the live editor, the api worker, and any future code that handles documents). Everything is re-exported through `src/index.ts`, so consumers import from the package and never from a file inside it; the split below is for readability only and can change without touching a caller.

| File               | Holds                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| `index.ts`         | the public surface, plus the shared enums every element family draws on |
| `element-types.ts` | the boxed elements (shape, text, table, sticky, image, freehand, …)     |
| `arrow-types.ts`   | anchors, endpoints, arrowheads, `ArrowElement`                          |
| `shape-kind.ts`    | `ShapeKind`, the closed vocabulary of shapes                            |

**The vocabularies exist twice, and tests hold them together.** `Element`'s
`type` discriminants and `ShapeKind`'s members are compile-time unions, while
`validate.ts` keeps each as a runtime set (`ELEMENT_TYPES`, `SHAPE_KINDS`) so it
can gate input crossing a trust boundary — the api worker, the MCP server, the AI
panel. Nothing in the compiler makes a union and a set agree, and both drift
silently:

- A shape kind missing from `SHAPE_KINDS` is coerced to a square by
  `coerceShapeKind`. Wrong, visible, recoverable.
- An element type missing from `ELEMENT_TYPES` fails `isValidElement`, and
  `isValidTab` fails a tab if **any** element does — so the api answers
  `400 invalid tab` and the tab stops persisting at all. Add an element type,
  wire it through the editor, forget the set, and the feature works until the
  first save. `ELEMENT_TYPES` is also the list of types the MCP hands the calling
  model, so the gap is invisible to AI callers too.

`shape-kind.test.ts` and `element-type-vocabulary.test.ts` read the union members
out of the source (the members cannot be enumerated at runtime) and compare them
against the sets in both directions, each with a check that the extraction itself
still matches so the comparison can't pass vacuously. The element guard also
builds a minimal element of every type and runs it through the real validator,
because two agreeing lists still would not prove the validator handles each type.

Treat the sketch below as a high-level outline; read the package for the full field list.

```ts
type LiveDoc = {
  id: DocumentId;
  name: string;
  shareable: boolean;
  folderId: string | null;
  tabs: Tab[]; // ordered
  // …plus owner, share code, timestamps
};

type Tab = {
  id: TabId;
  name: string;
  kind?: TabKind; // 'diagram', the one general tab kind; any other stored kind reads as it
  // The tab's editor mode: always 'pages'. A stored livediagram mode reads as 'pages'
  // (docs/specs/003-system-architecture/domain-language.md "Mode").
  opensIn?: EditorMode; // 'pages'
  elements: Element[];
  // …plus theme, backgroundColor/Pattern/Opacity, patternColor, locked
};

// Concrete element kinds, see packages/document for the full shape of each:
//   ShapeElement     (shape: square / circle / diamond / cylinder / parallelogram / hexagon
//                            / document / stadium / actor / cloud / browser / monitor / laptop
//                            / phone / tablet)
//   TextElement      (optionally sizing: 'fit' | 'wrap', how the box hugs its text, absent = a
//                     fixed box; and
//                     textScale, the Shift-resize scale. A stored autoWidth: true reads as 'fit')
//   ImageElement     (boxed, references an R2-stored bitmap by imageId, see docs/specs/009-elements/images.md)
//   ArrowElement     (from + to Endpoints, arrowStyle, arrowheadSize, optional label)
//   FreehandElement  (boxed, carries its points as one packed block, docs/specs/006-document/stroke-points.md,
//                     + optional auto-close flag for
//                     filled custom shapes; rendered as an SVG path inside its bounding box;
//                     drawn by the polygon tool, see docs/specs/008-canvas/polygon-tool.md)
//
// Most elements may carry `link?: ElementLink` for cross-tab navigation.
type Element =
  ShapeElement | TextElement | StickyElement | ImageElement | ArrowElement | FreehandElement;

type ElementLink =
  | { kind: 'tab'; tabId: TabId }
  | { kind: 'element'; tabId: TabId; elementId: ElementId }
  | { kind: 'document'; documentId: string; name: string }
  | { kind: 'url'; url: string }; // external address, opens in a new tab
```

Persistence shape lives in [Api](../015-api/api.md) (per-tab rows + `documents` rows in D1). The `apps/live/lib/api-client.ts` boundary serialises this same in-memory shape against the api worker.

### Colours are colours

Every colour an element stores (its fill, stroke, text colour, a row's or a series' colour, a comment author's) is
painted into CSS, some of it inside a `background` or a gradient. A colour that could load something from outside
the document (a `url(...)`, an `image-set(...)`, an escape, or anything that leaves its CSS value) is no colour:
the stored-element migrations drop it wherever elements enter (a load, a peer's op, a paste, a file, an agent's
write, the api's own reads and writes), and the element paints with that colour's default. Nothing in livedocuments
fetches from outside a document ([Images](../009-elements/images.md) "External-URL images"), and a colour must not
become the way it does. The same rule holds for a participant's colour (refused by `PUT /api/participants/<id>`,
blanked in a room hello) and a custom theme's colours (refused on save).

### Styles have their types

An element's style fields are read by name or done arithmetic with: `padding`, `borderRadius`, `strokeStyle`,
`textAlignX` and `textAlignY` are names, `textSize` a name or a size in px, `rotation` and `opacity` numbers,
`shadow` its offsets, blur and strength, and `strokeWidth` a named weight (px on an arrow). One of the wrong type
(`padding: 12`, `opacity: "50%"`) is dropped by the stored-element migrations wherever elements enter, as a colour
that is no colour is, and the element draws with that style's default. Only the type is checked: a name this build
does not know is still a name and is kept, so an older browser never drops what a newer one wrote.

### Text type

A text element carries four optional fields that set its type. They render wherever the text is (on any page,
in every export); page layouts set them (a poster's spaced capitals), and an element keeps them when copied. A
value out of its range is refused by the document's validation, as any malformed field is.

- **Tracking** (`letterSpacing`): the space added between letters, in em, from -0.2 to 1 (absent is 0).
- **Weight** (`fontWeight`): 400, 500 or 700, the weights every catalogue font loads. When present it wins over
  `textBold`.
- **Case** (`textCase`): `upper` or `lower` (absent is as typed). The text keeps what was typed; only its display
  changes.
- **Arc** (`textArc`): bends the text along a circle, from -360 to 360 degrees (absent is flat). Positive bows up
  (text over the top of a circle, letters outward), negative bows down (text along the bottom, letters upright).
  The arc's span is set by the element's box: under 180 degrees the arc's ends meet the box's sides; from 180 its
  circle is the largest that fits the box; at 360 the text may run the whole circle. The text is centred on the
  arc's midpoint at the element's size. Arched text is one line: line breaks are read as spaces and per-range
  formatting yields to the element's own. Editing arched text shows it flat in the editor; the arc returns when
  editing ends.

### Why element IDs are unique across the whole document, not per tab

Element IDs are document-scoped so cross-tab links are stable even if elements move between tabs (e.g. cut from Tab A, paste into Tab B). The id doesn't change; the link still resolves.

## UI implications

- The tab bar sits at the **bottom** of the editor (see [07-live-app.md](../007-editor/live-app.md)). The active tab fills the canvas area.
- A `+` button on the tab bar adds a new empty tab and switches to it.
- **Rename** a tab by double-clicking its label (inline input — Enter commits, Escape cancels). Also available via the per-tab ellipsis menu.
- **Reorder** tabs by dragging a tab to a new position in the bar.
- **Create a link** from the element's right-click context menu, click "Link Element", and pick a target (tab, element, another document, or an external URL); the link follows the element if it's moved.
