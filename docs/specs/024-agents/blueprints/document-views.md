# Document views: blueprint

Derived from [Document views](../document-views.md), with the selector vocabulary and rejection codes of
[Edit operations](../edit-operations.md), the tab revision of [Agent changesets](../agent-changesets.md), the findings
of [Diagram lint](../diagram-lint.md), the route row of [API](../../015-api/api.md) ("Agents"), `read_document` of
[MCP server](../../015-api/mcp-server.md) §4.2, the anonymous events of [Telemetry](../../017-telemetry/telemetry.md)
and the terms of [Domain language](../../003-system-architecture/domain-language.md#agents). The spec decides; this
file only adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `VWn`.

Scope, by file:

| File                                                                    | Role                                                                                                                        |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/element-refs.ts` (planned)                       | Refs, slug ids and kind words: `computeRefs`, `resolveRef`, `isSlugId`, `slugIdFor`, `kindWordOf`, `isKnownElement`         |
| `packages/document/src/containment.ts` (planned)                        | The centre rule and the content origin: `boxCentre`, `boxHoldsPoint`, `smallestHolder`, `deriveContainers`, `contentOrigin` |
| `packages/document/src/style-keys.ts` (planned)                         | `STYLE_KEYS`, `styleKeysFor`: the style keys views print and edit operations write                                          |
| `packages/document/src/mermaid-serialise.ts`                            | `mermaidFromTab` calls `smallestHolder` over frames; its output is byte-identical                                           |
| `packages/document/src/index.ts`                                        | Re-exports `./element-refs`, `./containment` and `./style-keys`                                                             |
| `packages/api-schema/src/document-views.ts` (planned)                   | `VIEW_NAMES`, `ViewName`, `VIEW_QUERY`, `ViewDoor`, every view's JSON wire type, `UNKNOWN_VIEW_ERROR`                       |
| `packages/api-schema/src/ref-errors.ts` (planned)                       | `TARGET_NOT_FOUND_ERROR`, `TARGET_AMBIGUOUS_ERROR`, `RefCandidate`, `RefErrorBody`                                          |
| `packages/api-schema/src/telemetry-schema.ts`                           | `TELEMETRY_ACTIONS` gains `Viewed`                                                                                          |
| `packages/api-schema/src/index.ts`                                      | Re-exports both new files                                                                                                   |
| `packages/document-views/{package.json,tsconfig.json,eslint.config.js}` | The new package `@livediagram/document-views` (depends on `document`, `api-schema`), shaped like `explorer-lens`            |
| `packages/document-views/vitest.config.ts` (planned)                    | 100% line, branch, function and statement thresholds                                                                        |
| `packages/document-views/src/index.ts` (planned)                        | The public surface: `renderView`, every view function, the budget                                                           |
| `packages/document-views/src/constants.ts` (planned)                    | The view constants in [Constants and configuration](#constants-and-configuration)                                           |
| `packages/document-views/src/text.ts` (planned)                         | `cutAtWord`, `jsonString`, `attrValue`, `cellText`                                                                          |
| `packages/document-views/src/visibility.ts` (planned)                   | `partitionVisible`: printed elements, hidden-layer elements                                                                 |
| `packages/document-views/src/tree.ts` (planned)                         | `buildViewTree`: `deriveContainers`, then reading order per container                                                       |
| `packages/document-views/src/reading-order.ts` (planned)                | `readingOrder`, `rowsOf`                                                                                                    |
| `packages/document-views/src/freehand-runs.ts` (planned)                | `freehandRuns`: consecutive bare strokes folded into one line                                                               |
| `packages/document-views/src/content-summary.ts` (planned)              | `contentSummaryOf`: entity, table, code block, charts, checklist                                                            |
| `packages/document-views/src/state-attribute.ts` (planned)              | `stateAttributeOf`: the one state attribute of each content kind that has one                                               |
| `packages/document-views/src/attributes.ts` (planned)                   | `attributesOf`: the ordered attribute list of one element                                                                   |
| `packages/document-views/src/style-attributes.ts` (planned)             | `styleAttributesOf` for `style`                                                                                             |
| `packages/document-views/src/edges.ts` (planned)                        | `edgesOf`: outgoing arrows per source, own-line arrows, end rendering                                                       |
| `packages/document-views/src/header.ts` (planned)                       | `countElements`, `viewHeader`, `headerLine`                                                                                 |
| `packages/document-views/src/model.ts` (planned)                        | `buildViewModel(tab, context)`: the one model every tab view reads                                                          |
| `packages/document-views/src/{outline,graph,layout,comments}.ts`        | One view each                                                                                                               |
| `packages/document-views/src/{show,find,diff,overview}.ts`              | One view each                                                                                                               |
| `packages/document-views/src/budget.ts` (planned)                       | `estimateTokens`, `fitOutline`, `fitLines`                                                                                  |
| `packages/document-views/src/elision.ts` (planned)                      | `elisionLine`, in the reading door's own syntax                                                                             |
| `packages/document-views/src/render-view.ts` (planned)                  | `renderView(request, tab, context)`: the dispatcher the api and the CLI call                                                |
| `packages/document-views/src/__fixtures__/*.ts`                         | The checkout tab, its "after" twin, the three-tab document, the agent-built tab, the 300-element tab, the edge cases        |
| `packages/document-views/src/__fixtures__/golden/*`                     | One golden file per view (see [Testing](#testing))                                                                          |
| `apps/api/package.json`                                                 | Depends on `@livediagram/document-views`                                                                                    |
| `apps/api/src/responses.ts`                                             | `textPlain(body, init)`                                                                                                     |
| `apps/api/src/routes/document-views-route.ts` (planned)                 | `parseViewQuery`, `answerTabView`, `answerOverview`, the `Agent·Viewed` event                                               |
| `apps/api/src/routes/document-subresource-routes.ts`                    | The tab GET hands a `view` query to `answerTabView` after its gate and redaction                                            |
| `apps/api/src/routes/documents.ts`                                      | The document GET hands `view=overview` to `answerOverview` after its gate and redaction                                     |
| `apps/api/src/db/tabs.ts`                                               | `tabBodiesInOrder(env, documentId, offset, limit)`                                                                          |
| `apps/api/src/openapi/{manifest,document,types}.ts`                     | The view query parameters; `textResponse` on the two GETs                                                                   |
| `apps/api/scripts/gen-openapi-schemas.mjs`                              | The view wire types join `ROOT_TYPES`                                                                                       |
| `apps/mcp/src/api.ts`                                                   | `apiText`                                                                                                                   |
| `apps/mcp/src/tool-helpers.ts`                                          | `viewResult`: the view text first, then its one-line JSON                                                                   |
| `apps/mcp/src/{tools,schema,output-schema}.ts`                          | `read_document` reads a view (the outline by default); `format: "json"`, `image: true`                                      |
| `apps/telemetry/app/catalogue/connections.ts`                           | The `Agent·Viewed` chart, by view                                                                                           |
| `docs/development/architecture.md`, `README.md`                         | The new package in the layout and the package list                                                                          |
| `@livediagram/edit-operations`, `@livediagram/diagram-lint` (own)       | Import refs, slug ids, kind words, `deriveContainers` and `contentOrigin` from `@livediagram/document`                      |
| The cross-tab comments route (agent-presence's blueprint)               | Imports `computeRefs` from `@livediagram/document`                                                                          |

The repo layout block in `AGENTS.md` gains the package only with the operator's permission (agent files are not
edited without it); the change names the gap.

## Domain and naming

| Term            | Identifier                                                               | Meaning                                                                        |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| View            | `ViewName`, `VIEW_NAMES`, query `view`                                   | One read-only text projection; `overview` of a document, the rest of a tab     |
| Door            | `ViewDoor` (`cli`, `mcp`), query `door`                                  | The front door a view is read through; it chooses the elision command's syntax |
| Ref             | `RefTable` (`refOf(id)`), `computeRefs`                                  | The short name a view prints for an element or tab                             |
| Slug id         | `isSlugId`, `SLUG_ID_PATTERN`, `slugIdFor`                               | An id matching `^[a-z][a-z0-9_-]{0,23}$`; printed verbatim as its ref          |
| Resolve         | `resolveRef(input, refs) → RefResolution`                                | Input to one element, or a named refusal                                       |
| Kind word       | `kindWordOf(el)`                                                         | The first word of a line: the shape, the notation, or the element type         |
| Unknown kind    | `isKnownElement`, `UNKNOWN_KIND_MARK` (`?`)                              | An element type or shape kind `@livediagram/document` does not know            |
| Container       | `deriveContainers`, `ViewNode.container`                                 | The frame, lane or mind-map parent an element nests under                      |
| Reading order   | `readingOrder`, `rowsOf`                                                 | Rows top to bottom, then left to right                                         |
| Freehand run    | `FreehandRun`, `freehandRuns`                                            | Consecutive bare strokes in one container, printed as one counted line         |
| Content summary | `contentSummaryOf`                                                       | What a content kind holds, briefly                                             |
| State attribute | `stateAttributeOf`                                                       | The one attribute saying where a live element stands (`votes=4 revealed`)      |
| Attribute       | `ViewAttribute { key, value }`, `attributesOf`                           | One `key=value` or flag after the label                                        |
| Edge            | `ViewEdge`                                                               | An arrow as printed on its source line                                         |
| Own-line arrow  | `ViewModel.ownLineArrows`                                                | An arrow without a printed source, on its own line                             |
| Header line     | `viewHeader`, `headerLine`, `ViewHeader`                                 | The first line of every tab view                                               |
| Counts          | `ElementCounts { boxes, frames, lanes, arrows }`                         | The header's element buckets                                                   |
| Hidden          | `ViewModel.hidden`                                                       | Elements left out because they sit on a hidden layer                           |
| Budget          | `budget` (tokens), `estimateTokens`, `fitOutline`, `fitLines`            | The token ceiling a view is fitted to                                          |
| Elision line    | `elisionLine`, `Elision`                                                 | The one closing line naming what was left out and how to see it                |
| Subtree         | query `only`, `ViewOptions.only`                                         | One element and what nests under it                                            |
| Content origin  | `contentOrigin`                                                          | Rounded top-left of the visible boxed content                                  |
| Revision        | `rev` (from [Agent changesets](../agent-changesets.md#the-tab-revision)) | The tab revision a view was rendered from                                      |

Banned: "handle", "alias", "short id", "short code" (for a ref); "mode", "format", "snapshot", "render" (for a view;
"render" stays the image preview's verb, and `format` names only `read_document`'s choice between a view and the
elements); "parent" for a frame or lane (it is the container; only `mindParentId` is a parent); "group",
"cluster" (a frame is a container; a cluster is graph input's word); "query" or "filter" (those are selectors and
Explorer lenses); "token" for a kind word (a token is an API token); "truncate" in copy ("hidden", "left out").

## Behaviour and state

Every view is a pure, synchronous function of its inputs: the same tab, context and options give the same bytes.
No view reads a clock, a random source or a locale; `overview` takes `now` as an input.

### The view model

`buildViewModel(tab, context)` runs once per render and holds, for the views to read:

1. **Partition.** `partitionVisible(tab)`: an element is **hidden** when `visibleLayerElements` drops it, or when it
   is an arrow with a pinned end on a hidden element (`VW10`). Everything else is **printed**, unknown kinds
   included.
2. **Refs.** `computeRefs(allElementIds)` over every element of the tab, hidden ones and arrows included (`VW2`),
   so a ref never changes with layer visibility.
3. **Kinds.** `kindWordOf` and `isKnownElement` per printed element.
4. **Tree.** `buildViewTree(printed)`: `deriveContainers` gives each printed non-arrow element one container or the
   root; siblings take reading order; `freehandRuns` folds bare strokes.
5. **Edges.** `edgesOf(printed)`: each printed arrow is either a `ViewEdge` on its source's line or an own-line arrow.
6. **Header.** `countElements` and the thread counts over printed elements; `rev` and the tab ref from the context.

`context` is `{ rev?: number; tabIds?: readonly string[] }`; `tabIds` (the document's tab ids in order) makes the
tab ref unique within the document (`VW4`).

### Refs (`@livediagram/document`, `element-refs.ts`)

- **Slug.** `isSlugId(id)` is `SLUG_ID_PATTERN.test(id)`. A slug id's ref is the id.
- **Prefix.** Otherwise sort every element id of the tab by UTF-16 code units; for each id, `lcp` is the longest
  common prefix length with its sorted neighbours; the ref is the first
  `min(id.length, max(REF_MIN_LENGTH, lcp + 1))` characters. O(n log n).
- **Unsafe characters.** A prefix holding any character outside `[A-Za-z0-9_-]` prints as `id:` plus the full id as
  a JSON string (`id:"Node A"`). The edit-operations selector grammar takes the same `id:"…"` token (`VW3`).
- **Resolution** (`resolveRef(input, table)`), case-sensitive (`VW1`):
  1. an element whose full id equals the input (an `id:"…"` input is unquoted first);
  2. else every element whose id starts with the input: one is the match, none is `not-found`, several is
     `ambiguous` with every candidate.
- A ref computed by `computeRefs` always resolves to its own element: a slug or a full id wins rule 1, and a prefix
  is unique by construction.
- A prefix of at least `REF_MIN_LENGTH` characters that now matches several elements is refused as `ambiguous`
  with `stale: true` (the refusal says "matches N elements now; one was added since your read?"). A ref matching
  nothing is `not-found` with up to `REF_NEAREST_MAX` nearest refs: ids sharing at least the first character with
  the input, by shared prefix length, then ref in code-unit order (resolution reads ids only).
- Labels never resolve: `resolveRef` reads ids only. Label matching is the selector engine's
  ([Edit operations](../edit-operations.md#selectors)).

### Slug ids for elements agents add (`element-refs.ts`)

`slugIdFor(label, kindWord, takenIds) → string` (`VW6`):

1. `label` NFKD-normalised, combining marks (`\p{M}`) removed, lower-cased.
2. Every run of characters outside `[a-z0-9]` becomes one `-`; leading and trailing `-` removed.
3. Empty: the base is `kindWord` slugged by steps 1 and 2 (so `es:actor` gives `es-actor`), or `element` when that
   does not start with a letter. Starting with a digit: the base is that kind base, `-`, then the slug.
4. The base is cut to `SLUG_ID_MAX_LENGTH` characters and trailing `-` trimmed.
5. Free in `takenIds`: done. Else the first free of `base-2`, `base-3`, …, the base cut to fit
   `SLUG_ID_MAX_LENGTH` with its suffix and trailing `-` trimmed before the suffix.

The result always satisfies `isSlugId`. The edit-operations engine calls it for every element an operation creates
without `id=`, arrows included (an unlabelled arrow's base is `arrow`) (`VW7`), with `takenIds` holding every id
of the tab plus every id minted earlier in the same changeset. Element ids are opaque strings everywhere: no code
reads them as UUIDs (`packages/api-schema/src/page-views.ts` checks page-view ids, not element ids), the room, the
ledger, `collab_threads (tab_id, element_id)` and element links key on the string, and `isValidTab` requires only
non-empty unique ids. The round-trip tests in [Testing](#testing) hold this.

### Kind words (`element-refs.ts`)

| Element                                   | Kind word                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| An event-storming note                    | its notation, `eventStormingKindOf(el)` (`domain-event`, `command`, …)        |
| The notation `actor`                      | `es:actor`, so it never reads as the `actor` shape                            |
| `type: 'shape'`, `shape` in `SHAPE_KINDS` | the shape (`square`, `frame`, `lane`, `entity`, `mind-node`, `actor`, …)      |
| `type` in `ELEMENT_TYPES`, not a shape    | the type (`text`, `sticky`, `table`, `image`, `freehand`, `path`, `arrow`, …) |
| `type: 'shape'`, unknown `shape`          | `? <shape>` (`VW12`); `? shape` when it has none                              |
| unknown `type`                            | `? <type>`                                                                    |

An unknown name prints bare when it matches `^[A-Za-z0-9_.:-]+$`, else as a JSON string (I4).

`SHAPE_KINDS` and `ELEMENT_TYPES` are `packages/document/src/validate.ts`'s sets, so the kind words know exactly what
the document model knows. An event-storming note still in photo draft carries the flag `draft` (`VW13`).

### Containment (`@livediagram/document`, `containment.ts`)

`deriveContainers(elements) → Map<ElementId, ElementId | null>` assigns each non-arrow element at most one
container; views, the edit-operations membership reports and the lint all read it. The editor's frame drag keeps its
own full-box rule (`withFrameContents`) and does not change.

1. **Mind parent first.** A `mind-node` whose `mindParentId` names a `mind-node` in the input nests under it.
   Following parent links from any node, a link that returns to a node already on the chain is ignored at the node
   with the lowest array index, which becomes a root of its tree (`VW24`).
2. **Geometry otherwise.** Candidates are `frame` and `lane` shapes other than the element itself whose stored box
   holds the element's centre (`boxHoldsPoint`, edges inclusive) and whose area is strictly greater than the
   element's (`VW23`). The smallest candidate by area wins; equal areas go to the earlier in array order.
   `smallestHolder(point, holders)` is that point query alone, the rule `mermaidFromTab` applies (smallest frame
   holding the centre, inclusive, the earlier on a tie); `deriveContainers` passes it only the strictly larger
   candidates, and that guard makes nesting acyclic. Rotation is ignored: centres and boxes are the stored
   axis-aligned ones.
3. Elements without numeric `x`, `y`, `width`, `height` (only unknown kinds can lack them) sit at the root.

Views pass printed elements only, so a hidden frame contains nothing. Containers nest to any depth. `mermaidFromTab`
keeps its one-level, frames-only output by calling `smallestHolder` with frames only.

`contentOrigin(elements)`: the rounded minimum `x` and `y` over boxed elements, `(0, 0)` when there are none. Views
pass printed elements; the edit-operations engine reads and writes coordinates against the same origin.

### Reading order

`readingOrder(siblings)` (`VW25`): sort by `y`, then `x`, then array index. Walk the sorted list: the first element
opens a row; each next element joins the current row when its top is above the bottom of the row's first element
(`el.y < first.y + first.height`), else opens a new row. Each row sorts by `x`, then `y`, then array index. Rows
print top to bottom. Elements without geometry follow, in array order. Siblings are ordered per container, and the
root, independently.

### Freehand runs

`freehandRuns(siblings)`: a **bare stroke** is a `freehand` element with no label, note, comment thread, link or
action and no printed arrow ending on it. Two or more bare strokes adjacent in one container's reading order fold
into one `FreehandRun` line, `freehand ×<n>`, then ` (<c> closed)` when any are `closed` (`VW56`). A run has no ref;
its strokes' refs are in `layout`. A lone bare stroke prints as itself.

### Edges

- An arrow whose `from` is `pinned` to a printed element is a `ViewEdge` on that element's line; its target prints as
  the target's ref, `arrow:<ref>` for an `on-arrow` end, or `free` for a free end.
- Every other printed arrow (a `free` or `on-arrow` source) is an own-line arrow: `arrow <ref> <from> → <to>`, ends
  as above, printed at the root after every boxed root line, in array order (`VW27`).
- A source line's edges keep the arrows' array order (`VW26`).
- After the target: the arrow's label as a JSON string cut at `LABEL_CUT_CHARS`, then style marks in this order:
  `~<strokeStyle>` when it is not `solid`, then `~none`, `~both` or `~from` when `arrowEnds` is not `to`.
- A self-loop prints `→ <own ref>`.

### Budgets

A view is fitted only when the request carries a budget. The api and the CLI give none by default; `read_document`
gives `READ_DOCUMENT_DEFAULT_BUDGET` to every view it reads unless the caller passes one (`VW45`).

`fitOutline(model, budget)` steps down a fixed ladder; each state is entered only while the estimate exceeds the
budget:

| State                  | Entered when                     | Drops                                                                                    |
| ---------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `full`                 | always first                     | nothing                                                                                  |
| `notes-dropped`        | `full` over budget               | every `note=` attribute                                                                  |
| `attributes-dropped`   | still over                       | every attribute, summary and state attribute except `comments=N open` (`VW38`)           |
| `containers-collapsed` | still over; repeats              | the children of the container with the most descendants (ties: earlier in reading order) |
| `root-collapsed`       | still over after every container | every root line                                                                          |

- Estimates come from a per-line cost model built once: each node's line length at each detail level, and each
  subtree's total, so a step subtracts and adds lengths instead of re-rendering. O(n + c log c) for c containers.
- The header line and the elision line always print, even when they alone exceed the budget.
- `fitLines(lines, budget)` fits every other view: whole lines in order until the next would exceed the budget,
  then the elision line (`VW40`).

Invariants:

- **I1** Same inputs, same bytes (no clock, randomness, locale or map-order dependence; every sort has a total
  tie-break).
- **I2** Every printed element appears exactly once in the outline: as its own line, inside a freehand run's count,
  or counted in the elision line.
- **I3** Every ref a view prints resolves, through `resolveRef` against the same tab, to the element it names.
- **I4** Every user-authored string a view prints passes through `jsonString`, `attrValue` or `cellText`, so no
  content can start a line, fake a header or break a line's grammar.
- **I5** Every tab view's first line is its header line; `overview`'s is its document line.
- **I6** A view that leaves anything out ends with exactly one elision line; a view that leaves nothing out has none.
- **I7** Elements on hidden layers are never printed and always counted in the header.

## Interfaces and contracts

### The outline grammar

```text
header      := "tab" SP tabRef SP jsonString(name) " · " total " element" ["s"] [": " buckets]
               [" · kind=" tabKind] [" · " hidden " hidden"] [" · " unknown " unknown"]
               [" · threads " open " open/" threadTotal] [" · rev " rev]
buckets     := bucket {", " bucket}                       (non-zero only, in the order boxes, frames, lanes, arrows)
bucket      := count SP ("box" | "boxes" | "frame" | "frames" | "lane" | "lanes" | "arrow" | "arrows")
line        := indent kindWord SP ref [SP label] [SP summary] {SP attribute} [SP "→" SP edge {", " edge}]
runLine     := indent "freehand ×" count [" (" closed " closed)"]
ownLine     := "arrow" SP ref SP end SP "→" SP end [SP label] {SP style}
indent      := "  " × depth
kindWord    := word | "? " unknownName
label       := jsonString(cut(label, 60)) ["…"]
edge        := end [SP label] {SP style}
end         := ref | "arrow:" ref | "free"
style       := "~" (strokeStyle | "none" | "both" | "from")
attribute   := key "=" attrValue | flag
```

`kind=` prints only for a tab whose `tabKindOf` is not `diagram`; `threads` only when the tab has a thread; `rev`
only when the context gives one (`VW8`). A blank label (after trim) prints nothing (`VW17`).

**Buckets** (`VW9`): `frames` and `lanes` are those shapes; `arrows` are arrows; `boxes` is every other printed
element, unknown kinds included. `total` is the printed count; `hidden` and `unknown` are counted apart from it
(`unknown` is also inside `total`).

**Threads** (`VW11`): a printed element whose `commentThread.comments` is non-empty is a thread; open when
`resolved` is false.

**Cutting** (`cutAtWord(text, max)`, `VW16`): counted in code points before escaping. Text within `max` prints whole.
Otherwise take the first `max` code points; when the code point after them is not whitespace and the slice holds
whitespace, cut at the slice's last whitespace; trim trailing whitespace; print the JSON string followed by `…`
outside the closing quote. A slice without whitespace is cut hard at `max`. Notes cut at `NOTE_CUT_CHARS`.

**`attrValue(text)`** (`VW15`): bare when it matches `ATTR_BARE_PATTERN` (`^[A-Za-z0-9._:/#?&=%+@~-]+$`), else a JSON
string.

**`cellText(text)`**: `JSON.stringify(text).slice(1, -1)` with `|` escaped as `\|`; inside entity braces `;` and `}`
are escaped as `\;` and `\}` too.

**Content summaries** (`contentSummaryOf`), printed after the label:

| Element                  | Summary                                                                                     | Ledger |
| ------------------------ | ------------------------------------------------------------------------------------------- | ------ |
| `entity`                 | `{` first `ENTITY_FIELDS_SHOWN` fields as `name[ type]`, joined `; ` (`; +N` when more) `}` | `VW19` |
| `table`                  | `<rows>x<cols>` then the first row's cells joined `\|`; `0x0` when empty                    | `VW18` |
| `code-block`             | `lang=<codeLanguage, else plain> lines=<line count, 0 when empty>`                          | `VW20` |
| `pie-chart`, `bar-chart` | `slices=<pieSlices.length>`                                                                 | `VW21` |
| `line-chart`             | `series=<lineSeries.length> x=<lineCategories.length>`                                      | `VW21` |
| `checklist`              | `done=<done>/<total>`                                                                       |        |

The table line prints its label first when it has one.

**State attributes** (`stateAttributeOf`), one per element of these kinds, printed after the summary (`VW22`):

| Kind                    | State attribute                                                           |
| ----------------------- | ------------------------------------------------------------------------- |
| `estimate`              | `votes=<responses.length>`, then `revealed` when `responsesRevealed`      |
| `temperature`           | `votes=<responses.length>`                                                |
| `done-check`            | `done=<responses.length>`                                                 |
| `idea-box`              | `ideas=<ideaCards.length>`, then `revealed` when `ideasRevealed`          |
| `qa-board`              | `questions=<qaNotes.length>`                                              |
| `agenda`                | `item=<agendaCurrent + 1>/<n>` once started, else `items=<n>`             |
| `decision`              | `status=<decisionStatus>` when set                                        |
| `roll-call`             | `present=<rollCall.length>`                                               |
| `quiz`                  | `state=revealed`, `state=locked`, `state=open` (started) or `state=ready` |
| `picker`                | `picked=<attrValue(pickerResult)>` when set                               |
| `reveal`                | `revealed` when `revealed`                                                |
| `stat-row`              | `stats=<stats.length>`                                                    |
| `process`               | `steps=<processSteps.length>`                                             |
| `site-header`           | `links=<navLinks.length>`                                                 |
| `legend`                | `items=<legendItems.length>`                                              |
| `rating`                | `rating=<rating>/5`                                                       |
| `progress-bar`, `-ring` | `progress=<progress, else 50>`                                            |
| `timeline-rail`         | `points=<railCount>`                                                      |
| `page`                  | `title=` the `pageTitle` cut at `NOTE_CUT_CHARS`, when set                |

Every other kind has no state attribute; `show` has its content.

**Attributes** (`attributesOf`), in this order after the summary and the state attribute (`VW14`):

| Attribute        | When                                                 | Form                                                                                        |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `draft`          | an event-storming note with `esDraft`                | flag                                                                                        |
| `icon=`          | a non-`icon`-shape with `iconId`, or an `icon` shape | `icon=<iconId>`                                                                             |
| `link=`          | `link` set (`VW28`)                                  | `link=<url>`, `link=tab:<tabRef>`, `link=tab:<tabRef>#<elementId>`, `link=doc:<documentId>` |
| `alt=`           | an `image` with `alt`                                | `alt=` cut at `ALT_CUT_CHARS`                                                               |
| `locked`         | `locked: true`                                       | flag                                                                                        |
| `action=`        | one `action` (`VW29`)                                | `action="<name cut at ACTION_CUT_CHARS>" @<assignee name>`, then `done` when done           |
| `actions=`       | an `actions` list                                    | `actions=<open> open/<total>`                                                               |
| `note=`          | `note` non-blank                                     | `note=` JSON string cut at `NOTE_CUT_CHARS`                                                 |
| `comments=`      | a thread                                             | `comments=<count> open` or `comments=<count> resolved`                                      |
| style attributes | only with `style` (`VW50`)                           | see below                                                                                   |

**Style attributes** (`styleAttributesOf`): `fill=` (`fillColor`), `stroke=` (`strokeColor`), `text-color=`
(`textColor`), `border=` (`strokeStyle` on a box), `line=` (`arrowStyle` on an arrow), `text=` (`textSize`),
`font=` (`font`), each printed only when present and different from what the kind's factory writes
(`createShape(kind, 0, 0)`, `createText`, `createSticky`, `createTable`, `createPinnedArrow` built once per render
with a fixed id). The keys are the edit-operations field keys, so a printed style attribute can be written back with
`set` unchanged; the two blueprints keep one key table (`STYLE_KEYS` in `@livediagram/document`).

### Every view

All take a tab (`overview` a document) and `ViewOptions { budget?, json?, only?, coarse?, style?, ref?, q?, all?,
door?, now? }`. `renderView(request, tab, context) → { text, json, elision }` dispatches by `request.view`.

| View       | Function                                | Served by                | Lines after the header                                                                  |
| ---------- | --------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| `outline`  | `outlineView(tab, context, options)`    | api, CLI offline         | The grammar above, depth-first in reading order, own-line arrows at the end of the root |
| `graph`    | `graphView`                             | api, CLI offline         | Nodes, a blank line, arrows (below)                                                     |
| `layout`   | `layoutView`                            | api, CLI offline         | Exact geometry, or coarse rows with `coarse`                                            |
| `comments` | `commentsView`                          | api, CLI offline         | Open threads, every comment in full; `all` adds resolved ones                           |
| `show`     | `showView` (`ref` required)             | api, CLI offline         | One element in full                                                                     |
| `find`     | `findView` (`q` required)               | api, CLI offline         | Matches with their container chains                                                     |
| `lint`     | `@livediagram/diagram-lint`             | api, CLI offline         | The lint's own output ([Diagram lint](../diagram-lint.md)) under the same header        |
| `diff`     | `diffView(before, after, context)`      | CLI only, from its cache | Added, removed, changed and moved elements                                              |
| `overview` | `overviewView(document, tabs, options)` | api, CLI offline         | One line per tab                                                                        |

`renderView` dispatches `lint` to the diagram-lint package's renderer; this package owns only its header and the
query plumbing (`VW58`). `diff` has no api door: the CLI keeps the last tab it read per document, tab and `rev` and runs
`diffView` on that copy and the current tab.

**`graph`** (`VW30`):

```text
<kindWord> <ref> <label>                      one per printed element with an arrow in or out, reading order, depth-first
                                              (blank line)
<from> -> <to> [<label>] [<arrow ref>]        one per printed arrow, array order; ends as in the outline
```

Arrows print in their stored direction, matching the `a->b` selector. When unconnected elements exist the elision
line names them with the outline as the command.

**`layout`**, exact (default) (`VW31`): one line per printed element (freehand runs unfolded), depth-first in reading
order, `<ref> <x>,<y> <w>x<h>` with `r=<deg>` when rotated, then one line per printed arrow,
`<ref> <from>.<anchor> → <to>.<anchor> [<arrowStyle>]` (`arrowStyle` only when not `straight`; a free end prints
`<x>,<y>`, an on-arrow end `arrow:<ref>@<t>` with `t` to two decimals). Numbers are integers, rounded, relative to
`contentOrigin(printed)`.

**`layout`, coarse** (`VW32`): `canvas: ` then the root's rows, refs separated by spaces, rows by `/`; then one
`<container ref>: <rows>` line per container with children, depth-first in reading order. Arrows are left out.

**`comments`** (`VW33`): per open thread, in the outline's depth-first order:

```text
<kindWord> <ref> <label> · open · <count>
  <authorName> <YYYY-MM-DD>: <jsonString(text)>
```

Dates are the comment's `createdAt` in UTC. Resolved threads are counted in the elision line, its command showing
them with `all`; with `all` they print with `· resolved ·`. `authorId` never prints.

**`show`** (`VW34`):

```text
<kindWord> <ref> <label> [in <container kind word> <container ref> <container label>]
  at <x>,<y> <w>x<h> [r=<deg>]                (content-origin coordinates; arrows print their ends instead)
  <field>: <compact JSON value>                every remaining stored field, keys sorted by code unit
  cells:                                       a table: one "  | a | b |" line per row, cellText escaped
  fields:                                      an entity: one "  - name type" line per field
  comments: <open|resolved> · <count>          then each comment as in the comments view
  ← <source ref> <source label> [label=<arrow label>] [<arrow ref>]
  → <target ref> <target label> [label=<arrow label>] [<arrow ref>]
  omitted: <field>, <field>                    the fields left out, when any
```

Left out, and named on `omitted:`: `id`, `type`, `shape` and `label` (in the first line); `x`, `y`, `width`,
`height`, `rotation` (on `at`); the plain-text mirrors' runs `richText`, `noteRich`; `packedPoints`; and every
person id, listed in `PERSON_ID_FIELDS` (`commentThread.comments[].authorId`, `action.assignerId`,
`action.assignee.userId`, `action.assignee.memberId`, `action.teamId`, the same on `actions[]`,
`responses[].participantId`, `qaNotes[].voters`). A test walks every element type's fields so a new person-id
field fails until it is listed. The edges list both directions with arrow refs, in array order. `code` prints as a
JSON string.

**`find`** (`VW35`): `q` is NFKC-normalised and lower-cased; it matches a printed element's label, note, table
cells, entity field names and types, checklist item text, code and comment text, and a printed arrow's label, each
NFKC-normalised and lower-cased, as a substring. Each match prints its container chain (each ancestor as
`<kindWord> <ref> <label>`, indented by depth, printed once for siblings) and then its own outline line; a matching
arrow prints as an own-line arrow under its source's chain. The last line is
`<n> matches: <count> <field>[s], …` with fields `label`, `note`, `edge`, `cell`, `field`, `item`, `code`,
`comment`. No match prints `0 matches`.

**`diff`** (`VW36`): `diffView(before, after)` compares by element id.

```text
tab <ref> <name> · since rev <a> · rev <b> · <n> changes
- <kindWord> <ref> <label>                                      removed (ref from the before tab)
+ <kindWord> <ref> <label> [in <container ref> <label>]          added
+ arrow <from> → <to> [<label>] [<arrow ref>]
~ <kindWord> <ref> <change> {" · " <change>}                     changed
```

`<change>` is one of `kind <a> → <b>`, `label <a> → <b>`, `note added|removed|changed`, `in <a> → <b>` (`canvas` for
the root), a summary `<a> → <b>`, an attribute `<key> <a> → <b>`, `comments <a> → <b>`, `from <a> → <b>`,
`to <a> → <b>`, `moved +dx,+dy`, `resized +dw,+dh`, `rotated`, `restyled` (any style attribute), `+<n> other fields`.
Removed lines come first in the before tab's order; added and changed follow in the after tab's order.

**`overview`** (`VW37`):

```text
doc <document id> <jsonString(name)> · <n> tabs · edited <age>
  tab <tabRef> <jsonString(name)> · <tab header segments after the name>
  tab <tabRef> (out of scope)
```

The document prints its full id: one document cannot know what prefix is unique in a library (`VW5`). `<age>` from
the document's `savedAt` and `now`: `just now` under a minute, `<n>m ago`, `<n>h ago`, `<n>d ago` under
30 days, else `YYYY-MM-DD` UTC. A tab outside a tab-scoped visitor's scope (`outOfScope`) prints its ref only.

### Elision line

`elisionLine(elision, door)` (`VW39`):

```text
"… " part {"; " part} ": " command
part    := "notes hidden" | "attributes hidden" | count " elements in " kindWord " " ref " hidden" | count " " noun " hidden"
```

The command names only what differs from the current request: `only` the largest collapsed container, else
`budget` the estimate of the full view, `all` for resolved threads, `view outline` for unconnected graph nodes. It is
written in the reading door's syntax (`VW54`):

| Door (`door`)   | Command form                                     | Example                         |
| --------------- | ------------------------------------------------ | ------------------------------- |
| `cli` (default) | `view` then ` --<flag> <value>` per argument     | `view --only c991`              |
| `mcp`           | `read_document` then the arguments as one object | `read_document {"only":"c991"}` |

### JSON forms

The `json` option returns the same model as the text, as the wire types in `packages/api-schema/src/document-views.ts` (planned)
(`VW49`). Strings are uncut (`VW46`); the budget applies, and `elision` says what was dropped.

```ts
type ViewHeader = {
  view: ViewName;
  tab: { id: string; ref: string; name: string; kind: TabKind };
  elements: number;
  counts: { boxes: number; frames: number; lanes: number; arrows: number };
  hidden: number;
  unknown: number;
  threads: { open: number; total: number };
  rev: number | null;
};
type ViewEnd = { ref: string } | { arrow: string } | { free: { x: number; y: number } };
type ViewEdgeJson = {
  ref: string;
  id: string;
  from: ViewEnd;
  to: ViewEnd;
  label: string | null;
  style: string[];
};
type OutlineNode = {
  ref: string;
  id: string;
  kind: string;
  unknown: boolean;
  label: string | null;
  summary: string | null;
  attributes: { key: string; value: string | null }[];
  edges: ViewEdgeJson[];
  children: (OutlineNode | FreehandRunJson)[];
  collapsed: number;
};
type FreehandRunJson = { run: 'freehand'; refs: string[]; closed: number };
type Elision = {
  dropped: ('notes' | 'attributes')[];
  collapsed: { ref: string; kind: string; elements: number }[];
  omitted: { noun: string; count: number }[];
  arguments: Record<string, string | number | boolean>;
  command: string;
} | null;
type OutlineView = {
  header: ViewHeader;
  nodes: (OutlineNode | FreehandRunJson)[];
  ownLineArrows: ViewEdgeJson[];
  elision: Elision;
};
type GraphView = {
  header: ViewHeader;
  nodes: { ref: string; id: string; kind: string; label: string | null }[];
  arrows: ViewEdgeJson[];
  elision: Elision;
};
type LayoutView = {
  header: ViewHeader;
  origin: { x: number; y: number };
  boxes: { ref: string; x: number; y: number; w: number; h: number; r: number }[];
  arrows: { ref: string; from: string; to: string; style: string }[];
  rows: { container: string | null; rows: string[][] }[] | null;
  elision: Elision;
};
type CommentsView = {
  header: ViewHeader;
  threads: {
    ref: string;
    kind: string;
    label: string | null;
    resolved: boolean;
    comments: { authorName: string; createdAt: number; text: string }[];
  }[];
  elision: Elision;
};
type ShowView = {
  header: ViewHeader;
  ref: string;
  kind: string;
  container: { ref: string; kind: string; label: string | null } | null;
  fields: Record<string, unknown>;
  incoming: ViewEdgeJson[];
  outgoing: ViewEdgeJson[];
  omitted: string[];
};
type FindView = {
  header: ViewHeader;
  q: string;
  matches: { ref: string; kind: string; label: string | null; field: FindField; path: string[] }[];
  elision: Elision;
};
type DiffView = {
  header: ViewHeader;
  since: number;
  changes: {
    op: '+' | '-' | '~';
    ref: string;
    kind: string;
    label: string | null;
    changes: { field: string; before: unknown; after: unknown }[];
  }[];
  elision: Elision;
};
type OverviewView = {
  document: { id: string; name: string; savedAt: number; tabs: number };
  tabs: ({ outOfScope: true; ref: string } | (ViewHeader & { outOfScope: false }))[];
  elision: Elision;
};
```

`DiffView` is a wire type although no api door serves it: the CLI's `--json` prints it.

### Refs on the wire

`packages/api-schema/src/ref-errors.ts` (planned): `TARGET_NOT_FOUND_ERROR = 'target_not_found'`,
`TARGET_AMBIGUOUS_ERROR = 'target_ambiguous'` (the codes [Edit operations](../edit-operations.md#rejections) names),
`RefCandidate = { ref, kind, label }`, `RefErrorBody = { error, message, input, candidates: RefCandidate[],
stale: boolean }`.

### REST

Both doors are `guest-or-clerk`, token-usable, read-gated exactly like the plain GETs they extend (`gateRead` on the
tab, `gateGrant` on the document), and answer `200 text/plain; charset=utf-8` (or `application/json` with `json=1`)
through `textPlain`, with `Cache-Control: no-cache`, the CORS set and the `ETag` the tab read carries
([Agent changesets](../agent-changesets.md#the-tab-revision)); a view never answers 304 (`VW44`).

| Method | Path                                   | Query (`VIEW_QUERY`, `VW42`)                                                                             | Failures                                                                                                     |
| ------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/documents/:id/tabs/:tabId?view=` | `view`, `json=1`, `budget`, `only` (outline, layout), `coarse=1`, `style=1`, `ref`, `q`, `all=1`, `door` | 400 `unknown_view`, 400 `invalid_value`, 404 `target_not_found`, 400 `target_ambiguous`, the GET's 404 / 410 |
| GET    | `/api/documents/:id?view=overview`     | `view=overview`, `json=1`, `budget`, `door`                                                              | 400 `unknown_view`, 400 `invalid_value`, the GET's 404 / 410                                                 |

`parseViewQuery(url, scope)` validates (`VW43`), each failure a JSON `{ error, message }` naming the parameter and its
allowed values:

- `view` in the door's names: `overview` on the document; `outline`, `graph`, `layout`, `comments`, `show`, `find`,
  `lint` on the tab. `diff` is `unknown_view` with the message "diff is computed by the CLI: livediagram tab diff".
- `budget`: an integer in `[1, VIEW_BUDGET_MAX]`.
- `only`, `ref`: resolved by `resolveRef`; `only` (outline and layout only) naming an arrow is `invalid_value`
  (`VW41`). The header still counts the whole tab.
- `q`: 1 to `FIND_QUERY_MAX_LENGTH` code points.
- `door`: `cli` (default) or `mcp`; the MCP always sends `mcp` (`VW57`).
- A parameter its view does not take is `invalid_value`.
- `ref` on `show` and `q` on `find` are required.

The tab door renders after `gateRead`, `getTab` and `redactCommentAuthorIds`, with `context.tabIds` from
`getDocument`'s tab summaries and `context.rev` from the tab row. The document door renders after `gateGrant` and
`redactDocumentForScope`, reading in-scope tab bodies through `tabBodiesInOrder` in batches of `OVERVIEW_TAB_BATCH`,
summarising each batch and dropping it before the next (`VW47`).

Every answered view sends one anonymous event, `reportServerEvent(env, 'Agent', 'Viewed', <type>)`, off the
response path through `ctx.waitUntil`, with the type the view in title case (`Overview`, `Outline`, `Graph`,
`Layout`, `Comments`, `Show`, `Find`, `Lint`) (`VW51`). The `Agent` category is the one the changesets add; `Viewed`
joins `TELEMETRY_ACTIONS`.

OpenAPI: `RouteSpec` gains `textResponse?: { description: string }`; `document.ts` documents a 200 with both
`application/json` and `text/plain` when it is set. The two GETs list the query parameters above; the view wire
types join `ROOT_TYPES`.

### MCP `read_document`

- `readDocumentShape` gains, each described: `view` (`z.enum(['outline', 'graph', 'layout', 'comments', 'show',
'find', 'lint'])`, default `outline`), `budget` (an integer, default `READ_DOCUMENT_DEFAULT_BUDGET`), `only`, `ref`,
  `q`, `coarse`, `all`, `style`, `format` (`z.enum(['view', 'json'])`, default `view`; `json` returns the elements)
  and `image` (boolean, default false) (`VW59`).
- The handler fetches `GET /documents/:id`, then the tab's view through `apiText` with `door=mcp` and the arguments as
  query parameters. With `image: true` it also loads the plain tab through `loadTab`, in parallel, for the PNG
  `imageResult` draws (`VW48`). With `format: "json"` it loads the plain tab only.
- The result (`VW55`): the first text block is the view text verbatim, then a newline and one line of JSON,
  `{ id, name, tab: { id, name, rev }, url }`, built by `viewResult`. `structuredContent` and `readDocumentOutput`
  are `{ id, name, tab: { id, name, rev, view, text }, url }`; with `format: "json"`, `tab` is
  `{ id, name, rev, elements }` and the text block is the structured object, as `textResult` writes it. The PNG
  follows only with `image: true`.
- The description: "Read one tab as text: by default its outline, one line per element with its ref, label and
  arrows, about a tenth of the element JSON. view picks another (graph, layout, comments, show, find, lint), budget
  fits it to a token count, format "json" returns the elements, image adds a PNG preview."
- `apiText(env, token, path) → Promise<string>` mirrors `apiJson`: Bearer token, `ApiError` on non-2xx, a 5xx
  reported to `Error` telemetry. An `ApiError` carrying `target_not_found` or `target_ambiguous` becomes an
  `isError` result naming the candidates.

### The CLI

The CLI blueprint maps `tab view --view <name>`, `--budget`, `--only`, `--coarse`, `--style`, `--json`, `--raw`,
`show`, `find`, `--all` and `tab lint` to the query above online, and calls `renderView` on a pulled file's tab
offline. `tab diff --since` runs `diffView` on the CLI's cached tab and the current one. An unknown kind is never
dropped online or offline.

## Data and persistence

| Datum                  | Class          | Notes                                                                                         |
| ---------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| View text and JSON     | derived        | Never stored; recomputed per request                                                          |
| Element ids from slugs | identity       | Stored as any element id, in `tabs.data`; the slug rule only chooses them                     |
| `tabs.rev`             | state (theirs) | Owned by [Agent changesets](../agent-changesets.md); views read it                            |
| The diff's before tab  | cache (CLI)    | The last tab the CLI read per document, tab and `rev`, in its cache directory (CLI blueprint) |
| `Agent·Viewed` events  | telemetry      | Category, action and view type only; no id, label or content                                  |

No migration. Snapshot and restore are the tab's own. A document export or `pull` file holds what a local view needs:
the tab and its `rev`.

## Errors and edge cases

| #   | Case                                          | Handling                                                                                         |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| E1  | Empty tab                                     | Header `0 elements`, nothing else; never an error                                                |
| E2  | Unlabelled element                            | Kind word and ref only                                                                           |
| E3  | Label with newlines, quotes, `→`, `\|`        | Inside a JSON string; `cellText` in tables and entities                                          |
| E4  | Overlapping containers                        | Smallest area holding the centre; equal areas, the earlier                                       |
| E5  | Element larger than a frame it overlaps       | Not nested (strict area)                                                                         |
| E6  | Rotated element                               | Centre of the stored box; `layout` prints `r=`                                                   |
| E7  | Hidden layer                                  | Left out, counted `· n hidden`; arrows to hidden elements counted with them                      |
| E8  | Free, on-arrow ends                           | `free`, `arrow:<ref>`; a non-pinned source prints on its own line                                |
| E9  | Parallel arrows                               | Both on the source line                                                                          |
| E10 | Self-loop                                     | `→ <own ref>`                                                                                    |
| E11 | Mind map cycle or dangling parent             | Broken at the lowest index; a dangling parent reads as a root                                    |
| E12 | Unknown type or shape                         | `? <name>` line with ref and label, counted `· n unknown`, contained by geometry when it has one |
| E13 | Element without geometry                      | Root, after the rows, in array order                                                             |
| E14 | Id with unsafe characters                     | `id:"…"` ref                                                                                     |
| E15 | Id shorter than 4                             | The full id is the ref                                                                           |
| E16 | Slug id that is another id's prefix           | Exact match wins; the longer id's ref grows past the common prefix                               |
| E17 | Prefix ambiguous after a collaborator's add   | 400 `target_ambiguous`, `stale: true`, candidates; never a guess                                 |
| E18 | Ref of a deleted element                      | 404 `target_not_found` with nearest refs; the message suggests `tab diff`                        |
| E19 | `only` on a non-container                     | The element's line alone                                                                         |
| E20 | Budget below the header                       | Header and elision line still print                                                              |
| E21 | Comment thread with zero comments             | Not a thread                                                                                     |
| E22 | Tab-scoped visitor asks `overview`            | Out-of-scope tabs print `(out of scope)`; their bodies are never read                            |
| E23 | Tab-scoped visitor asks a view of another tab | The GET's 404, unchanged                                                                         |
| E24 | `view=diff` asked of the api                  | 400 `unknown_view`, naming the CLI's `tab diff`                                                  |
| E25 | Trashed document                              | The GET's 410, unchanged                                                                         |
| E26 | Table with ragged rows                        | Columns = the longest row's length; missing cells print empty                                    |
| E27 | One bare stroke, or strokes split by a shape  | A lone stroke prints as itself; a run breaks wherever reading order puts another element         |
| E28 | Event-storming note with the `actor` notation | Kind word `es:actor`                                                                             |
| E29 | CLI cache holds no tab at `--since`           | The CLI's own refusal (CLI blueprint); the api is never asked                                    |

## Security and trust

- The trust boundary is the existing read gate: a view sees exactly what the plain GET of the same caller sees, after
  the same redaction. Whatever roles exist, a caller that may read the tab may read every view of it; no view checks
  a role by name.
- No person id leaves through a view: `authorId`, assigner and assignee ids, participant and voter ids are never
  printed, in text or JSON (`show` lists them as omitted).
- Every user string is escaped (I4), so a label cannot forge a header, an elision line or another element's line for
  the model reading it. Views are data; the CLI and MCP descriptions say content is user-authored.
- Input is bounded: `budget`, `q` length, `ref` length (`REF_INPUT_MAX_LENGTH`), `door` closed. `find` is substring
  only, so no pattern reaches a regex engine.
- Token reads count against the token read limiter ([Public API and API tokens](../../015-api/public-api-and-tokens.md)
  §3.5); the per-IP limits stay the backstop.
- An out-of-scope tab's body is never read for `overview`.
- The `Agent·Viewed` event carries only the view's name, so it is anonymous like every telemetry row.

## Performance and limits

- Worst case: `MAX_ELEMENTS_PER_TAB` (10,000) elements in a tab of up to `MAX_TAB_BYTES`. The outline costs about
  12 tokens (36 characters) an element: about 360 KB of text for a full 10,000-element tab. Through the MCP the
  default budget holds it to `READ_DOCUMENT_DEFAULT_BUDGET` tokens (about 24 KB).
- Refs O(n log n); reading order O(n log n); containment O(n · c) for c containers, about 10⁶ checks at 100
  containers, measured by the bench below; budget O(n + c log c) on the precomputed cost model.
- The api reads one tab body per view; `overview` holds at most `OVERVIEW_TAB_BATCH` bodies at once (about 15 MB at
  the tab cap) and makes one D1 query per batch.
- `read_document` makes two service-binding calls (document, view), three with `image: true` (the tab, in parallel).
- `[views] slow` logs any render over `VIEW_SLOW_MS`.

## Observability

| Fingerprint                                                                | Where                               |
| -------------------------------------------------------------------------- | ----------------------------------- |
| `[views] rendered <view> doc=<id> tab=<id> elements=<n> chars=<n> ms=<n>`  | api, every view answered            |
| `[views] budget <view> budget=<n> estimate=<n> state=<ladder state>`       | api, a budget that dropped anything |
| `[views] unknown kinds tab=<id> <type or shape>=<n>`                       | api, a tab holding unknown kinds    |
| `[views] invalid request <param> <code>`                                   | api, a 400 from `parseViewQuery`    |
| `[views] ref refused <not-found or ambiguous> stale=<bool> candidates=<n>` | api, a ref that did not resolve     |
| `[views] slow <view> ms=<n> elements=<n>`                                  | api, warn                           |
| `[views] overview doc=<id> tabs=<n> batches=<n> ms=<n>`                    | api, overview                       |
| `[mcp] read_document <view or json> image=<bool> budget=<n>`               | mcp, per call                       |

No log line carries a label, note, comment, query text or ref input. Telemetry: `Agent·Viewed·<View>` per answered
view (above), beside the front doors' `Mcp·Used` and `Cli·Used`.

## Testing

Every rule maps to a deterministic test; the spec's rules are numbered here.

| Rule                                                                 | Test                                                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| R1 A slug id is its own ref                                          | `packages/document/src/element-refs.test.ts` (planned)                                                                          |
| R2 Otherwise the shortest unique prefix, at least 4; `id:"…"` unsafe | `element-refs.test.ts` (collisions at 4, 5, an id that prefixes another, short ids, unsafe ids)                                 |
| R3 A ref, any unique prefix or a full id resolves                    | `element-refs.test.ts`                                                                                                          |
| R4 An ambiguous prefix is refused with candidates, never guessed     | `element-refs.test.ts`, `apps/api/src/routes/document-views-route.test.ts` (planned)                                            |
| R5 A prefix made ambiguous by an add says so                         | `element-refs.test.ts` (`stale`), `document-views-route.test.ts`                                                                |
| R6 A label is never a ref                                            | `element-refs.test.ts` (an element labelled like another's id)                                                                  |
| R7 Agent-added elements take label slugs, `-2` on a clash            | `element-refs.test.ts`; `slug-id-roundtrip.test.ts` (isValidTab, `applyElementDelta`); `apps/api/src/collab-index/rows.test.ts` |
| R8 One line per element, indentation is containment                  | `packages/document-views/src/outline.test.ts` (planned), golden `checkout.outline.txt`                                          |
| R9 Kind words, notations, `es:actor`                                 | `element-refs.test.ts` (kind words)                                                                                             |
| R10 JSON strings, cut 60 / 48 on a word boundary                     | `text.test.ts`                                                                                                                  |
| R11 Smallest frame or lane holding the centre; mind parent wins      | `packages/document/src/containment.test.ts` (planned); `mermaid.test.ts` unchanged; `tree.test.ts`                              |
| R12 Arrows on the source line; free ends on their own                | `edges.test.ts`                                                                                                                 |
| R13 Reading order                                                    | `reading-order.test.ts`                                                                                                         |
| R14 Content summaries and state attributes                           | `content-summary.test.ts`, `state-attribute.test.ts` (every kind in the table)                                                  |
| R15 Bare strokes fold into one counted line                          | `freehand-runs.test.ts`, golden `edge-cases.outline.txt`                                                                        |
| R16 What the outline leaves out; hidden counted                      | `outline.test.ts`, `header.test.ts`                                                                                             |
| R17 Each view holds what the table says                              | `{graph,layout,comments,show,find,diff,overview}.test.ts` and their goldens                                                     |
| R18 Every view opens with the header and its `rev`                   | `render-view.test.ts` (every view, `lint` through a stub renderer)                                                              |
| R19 `json` carries the same data; the plain GET is the raw tab       | `render-view.test.ts` (text and JSON agree on refs and counts)                                                                  |
| R20 Budget ladder, chars ÷ 3; no default budget but the MCP's        | `budget.test.ts` (300-element fixture, each state); `apps/mcp/src/tools.test.ts` (8,000 sent by default)                        |
| R21 Never silent: one elision line, in the door's syntax             | `budget.test.ts`, `elision.test.ts` (both doors), `comments.test.ts`, `graph.test.ts`                                           |
| R22 One pure package                                                 | `render-view.test.ts` (twice, byte-equal; no clock)                                                                             |
| R23 `?view=` answers `text/plain`; overview on the document; no diff | `document-views-route.test.ts` (real SQLite: gates, scope, 400s, `diff` refused, headers)                                       |
| R24 `read_document` reads a view; JSON and the PNG only on request   | `apps/mcp/src/tools.test.ts`, `output-schema.test.ts` (text block layout, no image by default)                                  |
| R25 Unknown kinds print `?`, counted, never dropped                  | `unknown-kinds.test.ts`                                                                                                         |
| R26 One `Agent·Viewed` event per answered view                       | `document-views-route.test.ts`; `packages/api-schema/src/telemetry-schema.test.ts`; `apps/telemetry` catalogue suite            |
| OpenAPI parity                                                       | `apps/api/src/openapi/*.test.ts`                                                                                                |

Golden files, through `expect(text).toMatchFileSnapshot(path)` (`VW52`), in
`packages/document-views/src/__fixtures__/golden/`:

| Fixture                 | Built from                                                                                                                                                                                   | Goldens                                                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout-tab.ts`       | The research's 30-element "Checkout platform" tab (below), `rev: 41`                                                                                                                         | `checkout.outline.txt`, `.outline.json`, `.outline-mcp-budget-200.txt`, `.graph.txt`, `.layout.txt`, `.layout-coarse.txt`, `.comments.txt`, `.show-146b.txt`, `.find-pay.txt`, `.style.txt` |
| `checkout-tab-after.ts` | The checkout tab with six changes: rename e4a8 "Payments", add cylinder "Redis cache" in c991 and an arrow 202b→it, remove arrow 0cee, resolve 0c84's thread, move cb02 by +200,0; `rev: 47` | `checkout.diff.txt`                                                                                                                                                                         |
| `checkout-document.ts`  | Three tabs: the checkout tab, a 42-element lanes tab, a 24-sticky event-storming tab                                                                                                         | `checkout.overview.txt`, `checkout.overview-scoped.txt`                                                                                                                                     |
| `agent-built-tab.ts`    | The Services frame built through `graphToElements` with slug node ids                                                                                                                        | `agent-built.outline.txt`                                                                                                                                                                   |
| `large-tab.ts`          | Ten copies of the checkout tab offset in x (300 elements)                                                                                                                                    | `large.budget-2000.txt`, `large.budget-200.txt`                                                                                                                                             |
| `edge-cases-tab.ts`     | E1 to E28 in one tab where they compose, separate tabs where they do not; every state-attribute kind                                                                                         | `edge-cases.outline.txt`                                                                                                                                                                    |

The checkout tab uses the factories (`createText`, `createShape`, `createTable`, `createSticky`, `createPinnedArrow`,
`createComment`) and then pins every id to a fixed UUID whose first four characters are the research's prefixes
(`98eb`, `048c`, `c991`, `ca76`, `b811`, `a3cf`, `649c`, `202b`, `146b`, `e4a8`, `6406`, `12de`, `0556`, `d41e`,
`822f`, `e6d7`, `cb02`, `480a`, `0c84`; arrows `c74b`, `6e71`, `9c5e`, `111e`, `c41d`, `8e70`, `892e`, `3462`,
`1434`, `0cee`, `1fc0`), the tab id `0b3481f3-59fb-4bd0-a21a-152f1ba9bba5`, every `createdAt` to a fixed epoch and
the geometry of the research's appendix (title 40,20 520x48; Edge 40,100 300x440; Services 400,100 580x440; Data
1040,100 280x440; Customer 150,140 80x110; Auth 440,150 200x72; Orders 720,150 200x72; the rest placed so the
research's coarse rows hold). `isValidTab` accepts it. Its outline golden is the full rule output: the research's
§4.1 render with `· rev 41` on the header, which the spec's shorter example abbreviates. `token-cost.test.ts` holds
the outline at or under 400 estimated tokens (chars ÷ 3) and at most a tenth of the pretty JSON's estimate.

A vitest bench (`tree.bench.ts`, not part of the test run) renders a 10,000-element tab with 100 containers.

## Constants and configuration

| Constant                       | Value                         | Provenance                                    | Safe range      |
| ------------------------------ | ----------------------------- | --------------------------------------------- | --------------- |
| `SLUG_ID_PATTERN`              | `^[a-z][a-z0-9_-]{0,23}$`     | Spec, "Refs" (in `@livediagram/document`)     | fixed           |
| `SLUG_ID_MAX_LENGTH`           | 24                            | Spec (the pattern's bound)                    | fixed           |
| `REF_MIN_LENGTH`               | 4                             | Spec                                          | fixed           |
| `LABEL_CUT_CHARS`              | 60                            | Spec                                          | fixed           |
| `NOTE_CUT_CHARS`               | 48                            | Spec                                          | fixed           |
| `ENTITY_FIELDS_SHOWN`          | 8                             | Spec                                          | fixed           |
| `CHARS_PER_TOKEN`              | 3                             | Spec (measured 3.07 for the outline)          | fixed           |
| `READ_DOCUMENT_DEFAULT_BUDGET` | 8,000                         | Spec, "Budgets" (in `apps/mcp/src/schema.ts`) | 2,000 to 32,000 |
| `ALT_CUT_CHARS`                | 48                            | As notes (`VW53`)                             | 24 to 120       |
| `ACTION_CUT_CHARS`             | 48                            | As notes (`VW53`)                             | 24 to 120       |
| `ATTR_BARE_PATTERN`            | `^[A-Za-z0-9._:/#?&=%+@~-]+$` | URL-safe without quotes or spaces (`VW15`)    | narrower only   |
| `REF_NEAREST_MAX`              | 5                             | Enough to choose from (`VW53`)                | 1 to 20         |
| `REF_INPUT_MAX_LENGTH`         | 256                           | Above any stored id in practice (`VW53`)      | 64 to 1,024     |
| `FIND_QUERY_MAX_LENGTH`        | 200                           | A phrase, not a document (`VW53`)             | 50 to 1,000     |
| `VIEW_BUDGET_MAX`              | 1,000,000                     | Above a full 10,000-element outline (`VW53`)  | 200,000 and up  |
| `OVERVIEW_TAB_BATCH`           | 8                             | About 15 MB of bodies at the tab cap (`VW47`) | 1 to 16         |
| `VIEW_SLOW_MS`                 | 100                           | Well above a 1,000-element render (`VW53`)    | 50 to 1,000     |

No environment variable or binding; self-hosting needs nothing new.

## Assets and external resources

The fixtures and goldens are the only assets: TypeScript fixtures in `src/__fixtures__/` built from
`@livediagram/document` factories (MIT, this repo), and golden text regenerated by `pnpm --filter
@livediagram/document-views test -- -u`, which CI never runs (a missing or changed golden fails CI). No font, image
or external resource.

## Defaults ledger

VW1 to VW59 in [DEFAULTS.md](DEFAULTS.md).
