# How agents edit existing structured documents: an editing model for the livediagram CLI

Research for the `livediagram <resource> <verb>` CLI, angle: **editing existing documents**. It asks how
an AI agent (a coding agent in a repo, or a chat agent changing a diagram while a person talks to it)
reliably changes a spatial, structured document it did not author, and ends with a recommended
editing model, an op format, layout and concurrency rules, and three mock sessions.

Sources were read on the date of writing; external claims carry a link in [Sources](#sources). Claims
about livediagram cite the file they come from. Where a claim is an estimate or a judgement, it says so.

## 1. Summary

- **The unit of an agent edit is an id-addressed op, not a text diff.** Code agents need
  `str_replace` / search-replace / context patches because text has no stable identity; their whole
  reliability story is about _locating_ the edit (no line numbers, unique match, fuzzy apply).
  Diagram elements already have ids, so locating is solved; the hard parts move to **geometry**,
  **arrow wiring**, **implicit (spatial) membership** and **concurrency with live humans**.
- **One small, closed op vocabulary with intent-level verbs** (`set`, `add`, `rm`, `move`,
  `connect`, `insert … between`, `wrap … in frame`), applied as an **atomic, ordered batch**
  (Google Slides `batchUpdate`, Miro bulk create, VS Code `WorkspaceEdit`), with **client-chosen
  ids** so later ops reference earlier ones.
- **Layout is preserved by default and repaired locally**: edits never trigger a whole-tab
  relayout; ops that need room make room (shift the downstream neighbourhood), ops that move things
  rebind arrow anchors, and full relayout is an explicit verb.
- **Concurrency is element-scoped optimistic concurrency, not tab-level `If-Match`.** A tab under
  live human editing autosaves every ~600 ms, so a tab revision check would fail constantly; the
  batch instead carries fingerprints of the elements it touches and rebases over unrelated changes
  (git rebase, Google Docs `targetRevisionId`). A strict tab-level mode exists for scripts.
- **The biggest finding is in our own API**: a REST tab `PUT` is not relayed to the realtime room,
  so today an agent edit to a document a person has open is invisible to them and is **overwritten
  by their next autosave** ([API app](../../specs/015-api/api.md) "The persistence boundary"). A CLI
  built on the existing tab `PUT` would ship this data loss to every chat-agent session. The
  recommendation needs one server change: an ops endpoint whose result is relayed to the room as
  ordinary `el` ops.
- **Errors are model-correctable by construction**: every rejection names the op index, a closed
  error code, the offending value and the nearest candidates, and nothing is applied.
- **Dry-run, changeset, undo**: the same pure function produces the plan for `--dry-run`, the
  changeset the server returns, and the inverse batch the CLI journals for `undo`.

## 2. What livediagram has today

### 2.1 The MCP `update_document` ops mode

`apps/mcp/src/tools.ts` (`update_document`, mode `ops`): an ordered list of
`{ op: 'add' | 'update' | 'remove', element?, elementId? }`. The tool reads the tab, applies the ops
to an id map, normalises touched elements, runs `isValidTab`, and `PUT`s the whole tab. No
auto-layout runs, so positions are kept ([MCP server §4.4](../../specs/015-api/mcp-server.md)).

What works well and should carry over:

- Id-addressed, ordered, atomic (one `PUT`, so all or nothing).
- Positions preserved; only touched elements are normalised (`normaliseElement`).
- `update` is a shallow merge (`mergeElementUpdate` in `packages/document/src/element-normalise.ts`), close
  to JSON Merge Patch at the top level.
- Off-vocabulary shape kinds are coerced; lanes are kept painting behind (`lanesToFront`);
  event-storming arrivals land on lanes (`landMcpArrivals`).

Gaps an agent will hit, each verified in the code:

| Gap                                    | Where                                                                                                                            | Effect on an agent                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `update` on an unknown id              | `byId.set(op.elementId, mergeElementUpdate(byId.get(op.elementId), el))` with `prev` undefined                                   | Silently creates a partial element, then fails validation with a generic message |
| `remove` on an unknown id              | `byId.delete` of a missing key                                                                                                   | Silent no-op: a hallucinated id "succeeds"                                       |
| Removing a node leaves dangling arrows | `isValidTab` checks a pinned endpoint is a non-empty string with a valid anchor (`validate.ts:223`), not that the element exists | Broken arrows persist                                                            |
| One generic error                      | `'The resulting elements are invalid. See the livediagram://schema/elements resource.'`                                          | No op index, field or reason; the model guesses                                  |
| Absolute geometry only on `add`        | `add` takes a full element                                                                                                       | The model must compute `x/y/width/height` and anchors for every insertion        |
| Shallow merge only                     | Nested fields (`from`, `to`, `entityFields`) replace wholesale; no way to unset a field                                          | Easy to drop an arrow's anchor or styling by sending a partial endpoint          |
| No preconditions                       | Read-modify-write against D1, no revision check                                                                                  | A stale read silently overwrites newer work                                      |
| Not relayed to the room                | Tab `PUT` route (`apps/api/src/routes/document-subresource-routes.ts`) merges the room ledger in but never broadcasts            | Live editors don't see the change, and their next autosave erases it             |
| No changeset, no inverse               | Returns `{ id, tabId, url }` plus a PNG                                                                                          | The model cannot confirm what changed in text, and there is no undo              |

### 2.2 The realtime op model

- `packages/document/src/element-ops.ts`: `ElementOp` is `add` (with z-index `at`), `update` (whole
  element by id), `remove`, `reorder` (full id order). `diffToElementOps(before, after)` derives
  them; `applyElementOp` applies by id, and an op for a removed id is a safe no-op.
- Element-level last-writer-wins in room order; different elements merge
  ([Realtime conflict resolution](../../specs/012-collaboration/realtime-conflict-resolution.md)).
- Multi-writer fields (answers, ideas, ticks, comments, dots) travel as commuting `el-delta`
  deltas (`element-deltas.ts`) and are kept in the room's ledger (`collab-ledger.ts`), which the
  tab `PUT` merges in so a stale save cannot erase them.
- The room stamps `seq` + `epoch`; clients fold remote ops into their save baseline
  (`lastSavedTabsRef`), so an op a peer receives is carried by that peer's next save.
- A field-level CRDT was built and dropped; the selection lock is advisory and REST writers never
  see it.
- The room's `POST /mutation` accepts only `el-delta` today (used by the comment endpoints via
  `relayElementDelta`), so the plumbing for "the worker sequences a change as if a peer sent it"
  exists and is one op kind short.
- Precedent for compare-and-swap: Q&A board writes use `UPDATE tabs SET data = ? … WHERE id = ? AND
data = ?` (`apps/api/src/db/tabs.ts:422`). `tabs.updated_at` exists for a cheap revision.

### 2.3 Facts about the document that shape the editing model

- **Ids are arbitrary strings.** The editor mints UUIDs (`crypto.randomUUID()`), but graph input
  keeps the model's own node ids (`graphToElements` in `graph-authoring.ts`). So a CLI may let the
  agent name new elements (`id=verify`), and must abbreviate UUIDs for display.
- **Arrows pin to anchors on sixteen compass points** and **auto-rebind** to the facing side when
  their ends move ([Arrow anchors](../../specs/008-canvas/arrow-anchors.md);
  `rebindArrowAnchorsAfterMove` in `arrow-rebind.ts`, `bestAnchorTowards` in `anchor-choice.ts`).
  An agent should never have to choose an anchor.
- **Frame and lane membership is spatial, not a parent pointer.** A node belongs to the smallest
  frame containing its centre (`mermaid-serialise.ts`); a lane owns what lies fully inside its box
  (`apps/mcp/src/schema.ts`). Groups were removed ([web components and no groups](../../specs/009-elements/web-components-and-no-groups.md)).
  Consequence: **any move or resize can silently change membership**, and wrapping a section in a
  frame can silently capture a bystander. draw.io and Miro have an explicit parent (`set-cell-parent`,
  item `parent`); we do not, so the CLI must compute and report membership changes.
- **The theme owns colour** for every element but a sticky ([MCP server §4.6](../../specs/015-api/mcp-server.md)).
  A restyle should name theme slots, not hex values.
- **A layout engine exists** (`autoLayoutElements`, clustered layout, crossing reduction;
  [Layout cleanup](../../specs/008-canvas/layout-cleanup.md)) and a pure SVG renderer
  (`svg-render.ts`), both usable headless in a CLI.

## 3. What the prior art teaches

### 3.1 Coding-agent edit formats

| Format                                   | How it locates the edit               | Measured or reported reliability                                                                                                                                                                                                                          | Lesson for diagrams                                                                                   |
| ---------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Whole file (aider `whole`)               | None needed                           | Most robust for weak models, most expensive: every token re-emitted, and models get "lazy" and elide content ([aider edit formats](https://aider.chat/docs/more/edit-formats.html))                                                                       | Our `replace` mode. Fine for building from scratch, wrong for a one-node edit on a 200-element tab    |
| Search/replace blocks (aider `diff`)     | Exact original text, must match       | Aider's default for strong models; failure is mostly a non-matching search block                                                                                                                                                                          | Exact-match targeting is a precondition in disguise: the edit fails if the target changed             |
| Unified diff (aider `udiff`)             | Context lines, **no line numbers**    | Raised GPT-4 Turbo from 20 % to 61 % on aider's laziness benchmark, lazy comments on 4 tasks instead of 12 ([aider](https://aider.chat/docs/unified-diffs.html)); aider applies hunks flexibly                                                            | Familiar, simple, high-level, flexible: aider's four design rules apply to any agent format           |
| `str_replace` (Anthropic text editor)    | `old_str` must occur **exactly once** | Zero or several matches is an error the model corrects; designed with "poka-yoke" in mind ([Anthropic, building effective agents](https://www.anthropic.com/research/building-effective-agents))                                                          | **Ambiguity is an error by default.** A selector matching three elements must not silently edit three |
| `apply_patch` (Codex, V4A)               | Context lines and `@@` scope markers  | OpenAI trained GPT-4.1 on it; the formats that work "do not use line numbers" and "provide both the exact code to be replaced and the exact code with which to replace it" ([GPT-4.1 guide](https://cookbook.openai.com/examples/gpt4-1_prompting_guide)) | Show the before and after in the changeset; never make the agent count positions                      |
| Sketch + apply model (Cursor fast apply) | A second model merges a lazy sketch   | Fast and forgiving, but non-deterministic                                                                                                                                                                                                                 | Not for us: a deterministic op engine does what the apply model does, exactly                         |

The shared lesson: **reliability comes from cheap, unambiguous targeting plus a loud, specific
failure**, not from the expressiveness of the format. For diagrams, ids give the targeting; the
format must add the loud failure.

### 3.2 Patch and op vocabularies

- **JSON Patch (RFC 6902)**: `add`, `remove`, `replace`, `move`, `copy`, `test`, addressed by JSON
  Pointer (RFC 6901). Atomic per document. Its `test` op is a precondition inside the batch, which
  we keep. Its pointers address arrays **by index** (`/elements/17/label`), which breaks under any
  concurrent insert or reorder and forces the model to count. Rejected as the agent-facing format.
- **JSON Merge Patch (RFC 7386)**: send the fields you change, `null` deletes, arrays replace
  wholesale. Exactly the right semantics for `set` on one element, and close to `mergeElementUpdate`
  already. Kept for property updates, with an explicit unset.
- **OT / CRDT vocabularies** (Yjs, Automerge, tldraw's store diffs `{ added, updated, removed }`,
  Figma multiplayer): Figma's server is authoritative, merges **per property** last-writer-wins,
  orders children with fractional indices and guards reparenting cycles
  ([Figma, multiplayer](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)).
  livediagram consciously stopped at **per element** LWW. A short-lived CLI should not run a CRDT;
  it should submit ops that the server turns into the room's existing `el` ops.

### 3.3 Diagram and document APIs

| System                                                                                                            | Edit model                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Take                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [tldraw agent starter kit](https://tldraw.dev/starter-kits/agent)                                                 | Actions: create, update, delete; align, distribute, stack, resize, rotate, reorder; count by expression; schedule reviews. Each action has a `sanitizeAction` step (`ensureShapeIdExists`, `ensureShapeIdIsUnique`, `ensureValueIsVec`). Shapes go to the model in three detail levels (Blurry, Focused, Peripheral clusters), positions **offset to the chat's origin and rounded**, with the exact values restored on the way back. The prompt includes the **user's selection**, their recent actions and **lints** | The best single reference. Sanitise-and-repair, offset-and-round, the selection as context, lints after an edit |
| Figma Plugin API                                                                                                  | Imperative node tree; auto-layout frames own spacing, so inserting a child reflows siblings                                                                                                                                                                                                                                                                                                                                                                                                                            | "Make room" belongs to the container; we emulate it because our frames don't auto-layout                        |
| [Framelink Figma MCP](https://github.com/GLips/Figma-Context-MCP)                                                 | Read side only: simplifies Figma JSON before it reaches the model                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Compaction is where most of the context saving is                                                               |
| [Miro REST v2](https://developers.miro.com/reference/create-items)                                                | One item per call, plus **bulk create of up to 20 items, transactional** (one failure, none created); connectors are items with start/end item; items carry a `parent` frame                                                                                                                                                                                                                                                                                                                                           | Atomic batch, explicit parent                                                                                   |
| [Google Slides batchUpdate](https://developers.google.com/slides/api/reference/rest/v1/presentations/batchUpdate) | Ordered requests, **each validated, any invalid fails all**; replies in request order; client-chosen `objectId`s so later requests reference earlier ones; `writeControl.requiredRevisionId` rejects a stale write; Google Docs adds `targetRevisionId`, which **transforms the batch over collaborators' changes** instead                                                                                                                                                                                            | The batch shape, client ids, and the two concurrency modes we adopt                                             |
| [Notion block API](https://developers.notion.com/reference/patch-block-children)                                  | Append children with an `after` block id; patch a block; archive                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Relative insertion by reference, not by index                                                                   |
| [Lucid Standard Import](https://developer.lucid.co/docs/standard-import)                                          | Whole-document JSON import                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Whole-document replace only; no surgical edit                                                                   |
| [Excalidraw MCP (yctimlin)](https://github.com/yctimlin/mcp_excalidraw)                                           | Element CRUD, `query` with typed filters, `describe` (plain-text scene), screenshot, align/distribute, named **snapshots** for rollback; also a CLI with JSON on stdout and exit codes 0/1/2/3/4. Its changelog records a fix where unknown element fields were dropped on update                                                                                                                                                                                                                                      | Plain-text describe, snapshots, exit codes; **never drop fields the agent didn't mention**                      |
| [draw.io MCP (lgazo)](https://github.com/lgazo/drawio-mcp-server)                                                 | Drives a live editor: `get-selected-cell`, `list-paged-model` (paged reads), `add-edge`, `edit-cell`, `set-cell-parent`, layers, pages                                                                                                                                                                                                                                                                                                                                                                                 | Paging for big diagrams, the live selection as a target                                                         |
| [Penpot MCP](https://github.com/penpot/penpot-mcp)                                                                | Lets the model run code against the plugin API                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | "Code mode": a CLI that reads ops from stdin is already scriptable                                              |
| [VS Code WorkspaceEdit](https://code.visualstudio.com/api/references/vscode-api#WorkspaceEdit)                    | A set of edits applied atomically, with change annotations that can require confirmation in a refactor preview                                                                                                                                                                                                                                                                                                                                                                                                         | Preview the batch, then apply the same batch                                                                    |
| [kubectl apply](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/declarative-config/) / Terraform plan  | Declarative desired state, three-way merge against the last-applied state; `plan` before `apply`                                                                                                                                                                                                                                                                                                                                                                                                                       | The model for round-tripping an edited text outline                                                             |

### 3.4 Selectors, relative references, outlines, declarative edits

- **Selectors** (CSS, jq, JSONPath RFC 9535, Figma `findAll`, Excalidraw `query --filter`) let one
  op hit many elements. The str_replace lesson says the default must be "exactly one, or fail".
  Plural requires saying so (`all`).
- **Relative references** (`after`, `inside`, `right-of`, `between`) are how people and models
  describe edits, and they carry intent that coordinates lose: "between n3 and n4" also means "rewire
  the arrow", which no `x,y` can say. tldraw's stack/align/distribute and Notion's `after` are the
  precedent.
- **Outline round-tripping** (edit a text form, diff it back) is attractive because models edit text
  well. Its costs: the agent re-emits the whole outline (whole-file economics), a dropped line reads
  as a delete, a renamed node can read as delete + add unless ids are kept, and intent (insert
  between) degrades to a pile of field changes. kubectl solves the merge with a three-way base; it
  does not solve intent.
- **Declarative vs imperative**: declarative (a desired graph, a Mermaid text, an outline) suits
  building and syncing; imperative intent ops suit targeted edits on a human-arranged board.
  Both should compile to one op engine so there is one validator and one changeset.

## 4. Requirements an agent edit model must meet

Derived from the above, in the order they bite:

1. **Locate cheaply and unambiguously**: ids or a unique selector; ambiguity and absence are errors.
2. **Never require geometry for an intent edit**: placement is relative; anchors are automatic.
3. **Never lose what was not mentioned**: untouched fields, untouched elements and their exact
   coordinates survive (merge semantics; rounding only on the read side).
4. **Keep the human's arrangement**: no global relayout as a side effect; local repair only.
5. **Make implicit structure explicit**: report frame and lane membership changes and arrow rewiring.
6. **Atomic batches with client ids**: all or nothing; later ops reference earlier new ids.
7. **Survive live human editing**: no lost updates in either direction; conflicts scoped to what the
   batch touched; the person sees the change live.
8. **Correctable failure**: op index, code, value, candidates, and a hint; nothing applied.
9. **Preview and confirm**: a dry-run that prints the same changeset the real run returns, plus an
   optional render.
10. **Reversible**: every applied batch yields its inverse; undo never clobbers a human's later edit.
11. **Compact**: a one-node edit costs tens of tokens in and out, not the tab.

## 5. Recommended editing model

### 5.1 Shape of the solution

```text
 agent ──► livediagram edit (CLI)
             │  parse line ops / JSON ops
             │  resolve selectors against its last read (cache)
             │  dry-run: apply locally with @livediagram/edit-ops, print plan, optional PNG
             ▼
           POST /api/documents/:id/tabs/:tabId/edits   { base, ops, options }
             │  api: load tab from D1, check base fingerprints, apply the same pure engine,
             │  validate, write (compare-and-swap), relay resulting ElementOps to the room
             ▼
           room: sequence as `el` ops ──► live editors apply + fold into their save baseline
```

- **One pure engine**, `applyEditBatch(tab, ops, options) → { tab, changes, inverse, warnings } |
{ errors }`, in a new package (working name `@livediagram/edit-ops`, depending on
  `@livediagram/document` for layout, anchors, validation and normalisation). Consumers: the CLI
  (dry-run, local preview), the api (authoritative apply), and the MCP's `update_document` ops mode,
  which becomes a thin wrapper so the two agent surfaces cannot drift (reuse principle).
- **One server change**: an edits endpoint that applies the batch server-side and relays it to the
  room. The room's `/mutation` widens from `el-delta` to also accept `el` ops. This fixes the REST
  writer gap for the MCP as well, not only the CLI.
- **Remote-first**: the server is authoritative; the local engine is for preview and for computing
  the plan the agent reads before committing.

### 5.2 Verbs

Resource-verb, consistent with the rest of the CLI. Editing verbs only; read views belong to the
reading angle and are referenced where editing depends on them.

| Command                                                       | Purpose                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `livediagram edit <doc> [--tab T] [-f FILE \| -]`             | Apply a batch of ops (line form or JSON lines). The core verb                              |
| `livediagram edit … --dry-run [--png FILE]`                   | Print the plan (and render it) without writing                                             |
| `livediagram el set <doc> <sel> k=v…`                         | One-op sugar for `set`; every op has such a verb so `--help` teaches the vocabulary        |
| `livediagram el add <doc> <kind> k=v… [placement]`            | Sugar for `add`                                                                            |
| `livediagram el rm <doc> <sel>`                               | Sugar for `rm` (cascades arrows; says so)                                                  |
| `livediagram el move <doc> <sel> <placement>`                 | Sugar for `move`                                                                           |
| `livediagram el connect <doc> <a> <b> [label=…]`              | Sugar for `connect`                                                                        |
| `livediagram el insert <doc> <kind> k=v… between <a> <b>`     | Sugar for `insert`                                                                         |
| `livediagram el wrap <doc> <sel> in frame\|lane k=v…`         | Sugar for `wrap`                                                                           |
| `livediagram tab layout <doc> [<sel>] [--style flow\|tree…]`  | Explicit relayout of a selection, a frame, or the tab                                      |
| `livediagram tab replace <doc> --graph F \| --mermaid F`      | Declarative rebuild (the MCP's graph-first path), as a batch so it previews and undoes too |
| `livediagram tab pull <doc> > f` / `tab push <doc> f`         | Outline round trip with a three-way base (section 5.9); secondary path                     |
| `livediagram comment add\|reply\|resolve\|list <doc> <sel> …` | Comments via the existing comment endpoints (author stamping, relay), not via element ops  |
| `livediagram undo <doc> [<batch>]`                            | Apply the journalled inverse of the agent's own batch                                      |

### 5.3 Addressing: handles and selectors

**Handles.** Every read view prints an element's handle: its id when the id is short and readable
(`verify`, `n3`), or the shortest unique prefix of a UUID, minimum 4 characters (`3f9a`), git-style.
Handles are stable because ids are; they never shift between reads the way positional numbering
does. The CLI and the server both resolve a handle: exact id first, then unique prefix; several
matches is `E_TARGET_AMBIGUOUS` with candidates.

**Selectors.** A selector is either a handle or a set of `key:value` tokens ANDed together, in the
token style the Explorer filters already use (`packages/explorer-lens`), so people learn one syntax:

| Token                            | Matches                                                                |
| -------------------------------- | ---------------------------------------------------------------------- |
| `n3`, `3f9a`                     | That element                                                           |
| `"Sign in"` or `label:"Sign in"` | Exact label (case-insensitive); `label~auth` is a substring match      |
| `type:sticky`, `shape:diamond`   | By element type or shape kind                                          |
| `in:f1`                          | Members of a frame or lane (centre rule, the same one the engine uses) |
| `from:n3`, `to:n4`, `n3->n4`     | Arrows by their ends; `n3->n4` is the arrow between them               |
| `downstream:n3`, `upstream:n4`   | Nodes reachable along arrows                                           |
| `selected`                       | The token owner's live selection in an open editor, from room presence |
| `region:x,y,w,h`                 | Elements whose centre lies in the box                                  |

- A selector must match **exactly one** element unless the op says `all` (`set all type:sticky
fill=mint`). Zero matches is `E_TARGET_NOT_FOUND` with the nearest labels by edit distance.
- `selected` is what makes the chat case work: "make this blue" while the person has it selected.
  It is resolved at submit time; an empty selection is an error, not a no-op.

### 5.4 The op vocabulary

Closed and small. Each op is one line; values with spaces are quoted; JSON form is one object per op.

| Op        | Line form                                                                | Does                                                                                                                                             |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `set`     | `set <sel> k=v … [all]`                                                  | Merge-patch the element's fields; `k=` (empty) unsets. Unknown keys are `E_UNKNOWN_FIELD` with the valid keys for that kind                      |
| `add`     | `add <kind> [id=] k=v … [<placement>]`                                   | Create an element; size from the kind's factory default or its label; placement relative (5.5)                                                   |
| `rm`      | `rm <sel> [all] [keep-arrows]`                                           | Remove; arrows pinned to it are removed too and listed (or kept as free ends with `keep-arrows`)                                                 |
| `move`    | `move <sel> <placement> \| by=dx,dy [all]`                               | Move; arrows rebind; membership changes reported                                                                                                 |
| `connect` | `connect <a> -> <b> [id=] [label=] [style…]`                             | Pinned arrow, anchors chosen by `bestAnchorTowards`; a duplicate a→b is `E_DUPLICATE_ARROW` unless `again`                                       |
| `rewire`  | `rewire <arrow> from=<x> \| to=<y>`                                      | Move an arrow end to another element                                                                                                             |
| `insert`  | `insert <kind> [id=] k=v … between <a> <b>`                              | Put a node on the a→b arrow: the existing arrow becomes a→new (keeps its id, style, label), a new arrow new→b copies its style; makes room (5.5) |
| `wrap`    | `wrap <sel…> in frame\|lane [id=] [label=] [tidy] [make-room \| absorb]` | Create a frame or lane around the members (5.5)                                                                                                  |
| `unwrap`  | `unwrap <frame>`                                                         | Remove the frame, keep its members where they are                                                                                                |
| `order`   | `order <sel> front \| back \| above=<x> \| below=<x>`                    | Z-order; lanes and frames stay behind their contents                                                                                             |
| `layout`  | `layout <sel> [style=flow\|tree\|mindmap] [direction=down\|right]`       | Relayout only the selection, keeping its bounding box's top-left; the batch's one way to move many things at once                                |
| `test`    | `test <sel> k=v …`                                                       | Precondition (JSON Patch `test`): fails the batch if the element's field differs                                                                 |

Field values speak the document's vocabulary, never raw internals: `shape=stadium` (coerced like the
MCP), `fill=accent` (a theme slot; a hex value is accepted with `W_COLOUR_OVERRIDES_THEME`, stickies
excepted), `text=sm`, `note="…"`, `line=angled`. A `label` longer than 40 characters is split into a
heading and a `note`, as the MCP's graph input does (`GRAPH_LABEL_MAX`), and reported as a warning.

JSON form of the same ops, for scripts and `jq` pipelines:

```json
{"op":"set","target":"n3","fields":{"label":"Sign in","shape":"stadium","fill":"accent"}}
{"op":"insert","kind":"shape","id":"verify","fields":{"label":"Verify email"},"between":["n3","n4"]}
{"op":"wrap","targets":["n5","n6","n7"],"in":"frame","id":"payment","fields":{"label":"Payment"},"tidy":true}
```

### 5.5 Layout on edit: preserve, then repair locally

Default policy `--layout local`. The engine never moves an element the batch did not name, except to
make room, and it reports every such move.

- **`set`**: geometry unchanged. If a new label no longer fits the box at its text size, the box
  grows around its centre to the size the factory would give that label (the MCP's label sizing), and
  the changeset says `widened 140→168`. `no-fit` keeps the box.
- **`add` with placement**: `right-of:n3`, `left-of:`, `above:`, `below:` (with `gap:`, default the
  layout engine's rank gap), `after:n3` (the flow direction inferred from n3's outgoing arrows, else
  down), `inside:f1` (next free slot in the frame's flow), `align:n3` (share an axis), `at:x,y`
  (absolute, tab coordinates). An occupied target slot nudges along the placement axis until free.
  No placement: next to the most recently added element, else the first free slot right of the
  content.
- **`insert … between a b`**: the new node goes to the midpoint of a and b. If it would overlap,
  **make room**: take the flow axis from a's centre to b's centre (snapped to the dominant axis), and
  shift every node whose centre lies beyond the midline on that axis by the new node's extent plus
  the gap, limited to the frame or lane that contains b (or the connected component outside frames).
  Frames that contain shifted members grow. Arrows rebind. This mirrors what Figma's auto-layout does
  for a container, without making our frames auto-layout.
- **`move`**: arrows attached to moved elements rebind (`rebindArrowAnchorsAfterMove`); a membership
  change is a line in the changeset (`f2 −n5`, `f1 +n5`).
- **`wrap`**: frame box = members' bounding box plus padding plus the frame header. Because
  membership is spatial, any non-member whose centre would fall inside the new frame is
  `E_FRAME_CAPTURES`, naming it, unless the op says `absorb` (it joins) or `make-room` (it is pushed
  outside along the nearest edge). `tidy` first lays the members out compactly with the layout
  engine, keeping their top-left, which is what "reorganise a section" usually means. The frame goes
  behind its members in z-order (`layers.ts` frame rank).
- **Lanes and event-storming tabs**: lanes stay first in z-order (`lanesToFront`); workshop notes
  land on lanes (`landMcpArrivals`), as the MCP does today.
- **Coordinates the agent sees are rounded and offset** to the tab's content origin (tldraw's
  offset-and-round), so numbers are short; the engine converts back, and untouched elements keep their
  exact stored values because `set` touches only named fields.
- `--layout none` disables make-room and fit (overlaps become warnings); `--layout all` re-runs the
  tab layout after the batch and is never implied.

After every batch the engine runs **lints** (tldraw's idea), reported as warnings, never as
silent fixes: overlapping boxes, an arrow crossing a box, a label clipped at its text size, a node
outside every frame next to a frame it probably belongs to, an orphaned node.

### 5.6 Concurrency: element-scoped optimistic concurrency, relayed live

**Read gives a base.** Every read the CLI performs is cached per document and tab
(`$XDG_CACHE_HOME/livediagram/<doc>/<tab>.json`): the tab revision and the elements. The tab
revision is an ETag from `tabs.updated_at` (or a content hash), returned on `GET`.

**A batch carries the base it was planned on**: the revision, and a short fingerprint (hash) of every
element the batch **targets** (set, rm, move, rewire, wrap members, insert's a, b and the a→b arrow).
Elements shifted only to make room are not fingerprinted: a relative shift commutes with a person's
move.

**The server decides with three outcomes:**

| Situation                                                                          | Result                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Revision unchanged                                                                 | Apply                                                                                                                                                              |
| Revision changed, every targeted fingerprint unchanged, selectors resolve the same | **Rebase**: apply on the current tab, report `rebased over N changes` (Google Docs `targetRevisionId`, git rebase)                                                 |
| A targeted element changed or vanished, or a selector now resolves differently     | `409 E_CONFLICT`: nothing applied; the response lists each conflicting element as it was in the base and as it is now, compactly, so the agent re-plans from facts |

- `--strict` sends `If-Match: <rev>` and fails on any change (`412`), for scripts and file sync that
  want Google Slides' `requiredRevisionId` semantics. Strict is wrong for a live board: a human
  typing elsewhere would fail every batch.
- **No base** (the agent never read the tab): the batch applies to the current state with only
  existence preconditions, and the result carries `W_NO_BASE`. This is the `str_replace` contract:
  the target must exist, nothing more.
- **Write**: the api applies, validates and writes with compare-and-swap on the row it read (the Q&A
  precedent); a lost race re-runs the check once, then returns `409`.
- **Relay**: the resulting `ElementOp`s (`diffToElementOps(before, after)`) go to the room through
  `/mutation` as `el` ops, sequenced like a peer's. Live editors draw the change at once and fold it
  into their save baseline, so their next autosave carries it instead of erasing it. This closes the
  data-loss path in section 2.1.
- **Residual, stated**: D1 lags a live editor by up to one autosave debounce (~600 ms), and same
  element edits are whole-element last-writer-wins in room order. An agent `set` on an element a
  person changed within that window can overwrite their change on peers. The fingerprint check
  catches it when the change has reached D1; the selection check below catches the common case.
- **Selection awareness**: the server asks the room which targeted elements are selected by someone
  else and returns `W_SELECTED_BY "Webber" n3`. It warns rather than refuses: in a chat session the
  person usually selected the element because they are talking about it. `--respect-selection`
  turns it into a refusal for unattended agents.
- **Comments stay deltas**: they go through the comment endpoints, which stamp the author and relay
  `comment-add` deltas that commute; they never ride in an element `set`.

### 5.7 Changesets, dry-run and errors

The success output and the dry-run output are the same text, from the same function, so what the
agent previewed is what it gets. Compact by default, `--json` for the structured form.

```text
~ n3  label "Login"→"Sign in" · shape square→stadium · fill →accent · widened 140→152
+ verify  shape "Verify email" @200,400 140×60
~ a3  to n4→verify
+ a3b  verify→n4 (style of a3)
» n4 n5 n6  +0,+100 (make room, flow ↓)
f2  +verify
rev 41→42 · batch b7 · undo: livediagram undo d_8f2k b7
```

Line prefixes: `+` added, `~` changed (field: before→after), `-` removed, `»` moved without being
named, and a frame or lane handle followed by membership changes. Warnings follow with `!`.

**Errors** use a closed code set, the op index and the op's own text, then candidates and a hint,
and always end with `nothing was applied`:

```text
error E_TARGET_AMBIGUOUS · op 2 · set "Pay" fill=accent
  "Pay" matches 3 elements:
    n7  shape "Pay" in f2
    n9  sticky "Pay"
    a4  arrow n3→n7 "Pay"
  hint: use a handle, narrow with type:shape, or add `all`
nothing was applied
```

| Code                 | When                                    | Carries                                     |
| -------------------- | --------------------------------------- | ------------------------------------------- |
| `E_PARSE`            | A line does not parse                   | Column, the expected token                  |
| `E_UNKNOWN_OP`       | Op name not in the vocabulary           | The vocabulary                              |
| `E_TARGET_NOT_FOUND` | Selector matches nothing                | Nearest labels and handles                  |
| `E_TARGET_AMBIGUOUS` | More than one match without `all`       | The matches                                 |
| `E_UNKNOWN_FIELD`    | Field not valid for the element kind    | Valid fields for that kind                  |
| `E_INVALID_VALUE`    | Value out of vocabulary or range        | Allowed values or range                     |
| `E_ID_TAKEN`         | `add id=` collides                      | A free suggestion                           |
| `E_NOT_CONNECTED`    | `insert between a b` with no a→b arrow  | Arrows touching a and b                     |
| `E_FRAME_CAPTURES`   | `wrap` would capture non-members        | The bystanders; `absorb` / `make-room` hint |
| `E_TEST_FAILED`      | A `test` precondition differs           | Expected and actual                         |
| `E_CONFLICT`         | Targeted element changed since the base | Base and current, compact                   |
| `E_INVALID_RESULT`   | The result fails `isValidTab`           | Element, field path, rule                   |
| `E_TOO_LARGE`        | Tab byte cap or op count cap            | The cap                                     |

Exit codes: `0` applied, `1` rejected batch (any `E_` above but conflict), `2` usage, `3` conflict,
`4` auth or permission (including `read_only_token`), `5` network or server. An agent can branch on
the code without parsing text.

### 5.8 Undo and rollback

- Every applied batch returns its inverse: the before-image of each touched element and the removal
  of each added one, as ops. The CLI appends it to a local journal
  (`$XDG_STATE_HOME/livediagram/journal/<doc>.jsonl`), keyed by batch id.
- `livediagram undo <doc> [<batch>]` submits the inverse with fingerprints of the **after-images**
  as its base. If a person has since changed one of those elements, that element conflicts and is
  reported; `--partial` undoes the rest. Undo never reverts a human's edit, matching the locked
  decision that undo is local and affects only one's own changes
  ([Realtime conflict resolution](../../specs/012-collaboration/realtime-conflict-resolution.md)).
- The journal is the agent's rollback; it needs no server state. A server-side history, if one is
  added, would complement it, not replace it.

### 5.9 Declarative paths, compiled to the same engine

- `tab replace --graph/--mermaid` keeps the MCP's graph-first rebuild for big reworks; it is a batch
  too, so it previews, carries a base and journals an inverse (the whole previous tab).
- `tab pull` writes a text outline (one line per element, keyed by handle, the reading angle's
  format). `tab push` diffs the edited outline three-way against the pulled base (kubectl's
  last-applied model) into ops and shows the plan. Rules that keep it safe: only fields the outline
  shows are diffed, everything else is untouched; a missing line deletes only with `--prune`
  (otherwise `W_LINE_MISSING`); an unknown handle with a known label is a rename, not delete + add.
  Recommended for humans syncing files and for agents doing bulk relabelling, not as the agent's
  default edit path: it costs a full outline per edit and loses intent such as `insert … between`.

### 5.10 Cost, as an estimate

A UUID-keyed element in tab JSON is roughly 200 to 300 characters (60 to 90 tokens), an arrow more,
as it names two ids. A 40-element tab is therefore a few thousand tokens to read and the same again
to re-emit in `replace`. One line op is 10 to 25 tokens and its changeset line about the same. For
the three edits below, the op path costs on the order of a hundred tokens of output; the replace path
costs the tab. These are estimates from the element shapes, not measurements.

## 6. Mock sessions

The document is `d_8f2k`, a checkout flow on one tab. The outline view is abbreviated here; its
exact format belongs to the reading angle.

```bash
$ livediagram tab read d_8f2k
# Checkout flow · tab main · rev 41 · 16 elements · flow ↓
n1  stadium "Start"         @0,0
n2  square  "Cart"          @0,100
n3  square  "Login"         @0,200
n4  square  "Address"       @0,300
n5  square  "Card details"  @0,400
n6  diamond "3-D Secure?"   @0,500
n7  square  "Charge card"   @0,620
n8  stadium "Receipt email" @0,720
t1  text    "Retry up to 3 times" @150,620
a1 n1→n2 · a2 n2→n3 · a3 n3→n4 · a4 n4→n5 · a5 n5→n6 · a6 n6→n7 "yes" · a7 n7→n8
```

### 6.1 Rename and restyle a node

```bash
$ livediagram el set d_8f2k "Login" label="Sign in" shape=stadium fill=accent
~ n3  label "Login"→"Sign in" · shape square→stadium · fill →accent
rev 41→42 · batch b1 · undo: livediagram undo d_8f2k b1
```

- Targeted by label; unique, so it resolves to `n3`. Arrows `a2` and `a3` are pinned and need no
  change; geometry is untouched because the label fits.
- If Webber had moved `n3` between the read and the edit, the fingerprint differs:

```bash
$ livediagram el set d_8f2k n3 label="Sign in" shape=stadium fill=accent
error E_CONFLICT · op 1 · set n3
  n3 changed since rev 41 (by Webber):
    base     square "Login" @0,200
    current  square "Log in / Sign up" @0,200
  hint: re-read n3, then retry, or add `test n3 label="Log in / Sign up"` to assert what you saw
nothing was applied
$ livediagram tab read d_8f2k --only n3
n3  square "Log in / Sign up" @0,200 · selected by Webber
$ livediagram el set d_8f2k n3 shape=stadium fill=accent
~ n3  shape square→stadium · fill →accent
! W_SELECTED_BY n3 is selected by Webber
rev 43→44 · batch b2
```

### 6.2 Insert a new step between two connected nodes

```bash
$ livediagram edit d_8f2k --dry-run <<'EOF'
insert shape id=verify label="Verify email" between n3 n4
EOF
plan (dry run, nothing written):
+ verify  square "Verify email" @0,300 140×60
~ a3  to n4→verify
+ a3b  verify→n4 (style of a3)
» n4 n5 n6 n7 n8  +0,+100 (make room, flow ↓)
$ livediagram edit d_8f2k <<'EOF'
insert shape id=verify label="Verify email" between n3 n4
EOF
+ verify  square "Verify email" @0,300 140×60
~ a3  to n4→verify
+ a3b  verify→n4 (style of a3)
» n4 n5 n6 n7 n8  +0,+100 (make room, flow ↓)
rev 44→45 · rebased over 2 changes · batch b3
```

- The agent named the new node `verify`, so a follow-up op in the same batch could reference it
  (`connect verify -> n2 label="resend"`).
- The flow axis comes from n3→n4 (straight down). Downstream nodes shift; the human's horizontal
  arrangement is untouched. `--layout none` would place `verify` at the midpoint and warn about the
  overlap instead.
- Without an n3→n4 arrow the op fails with `E_NOT_CONNECTED` and lists the arrows touching each.

### 6.3 Reorganise a section into a frame

```bash
$ livediagram edit d_8f2k --dry-run <<'EOF'
wrap n5 n6 n7 in frame id=payment label="Payment"
EOF
error E_FRAME_CAPTURES · op 1 · wrap n5 n6 n7 in frame
  the frame box @-20,460 180×340 would contain a non-member:
    t1  text "Retry up to 3 times" @150,620
  hint: add it to the members, `absorb` it, or `make-room` to push it outside
nothing was applied
$ livediagram edit d_8f2k --dry-run <<'EOF'
wrap n5 n6 n7 t1 in frame id=payment label="Payment" tidy
set n6 note="3-D Secure applies to EU cards only"
EOF
plan (dry run, nothing written):
+ payment  frame "Payment" @-20,460 340×360 (behind members)
» n5 n6 n7 t1  tidied in place (flow ↓, top-left kept)
~ n6  note →"3-D Secure applies to EU cards only"
» n8  +0,+40 (make room, flow ↓)
payment  +n5 +n6 +n7 +t1
$ livediagram edit d_8f2k --png /tmp/plan.png --dry-run -f - <<'EOF'
wrap n5 n6 n7 t1 in frame id=payment label="Payment" tidy
set n6 note="3-D Secure applies to EU cards only"
EOF
(plan as above) · preview: /tmp/plan.png
$ livediagram edit d_8f2k -f - <<'EOF'
wrap n5 n6 n7 t1 in frame id=payment label="Payment" tidy
set n6 note="3-D Secure applies to EU cards only"
EOF
(changeset as above) · rev 45→46 · batch b4
$ livediagram comment add d_8f2k payment "Grouped the payment steps. Should the receipt email sit in here too?"
+ comment c_19 on payment
```

- The batch is atomic: the frame and the note land together or not at all.
- Membership is reported explicitly because it is spatial; a later `move n8 inside:payment` would
  print `payment +n8`.
- The comment goes through the comment endpoint, so it is stamped with the token owner's name and
  reaches the open editor as a delta.

## 7. Design forks to settle

These are genuine choices for the spec, not defaults the research could pick:

1. **Server ops endpoint vs client apply + tab `PUT`.** Recommended: the endpoint (it is the only
   option that does not lose an agent's edit under a live editor). A cheaper interim, client apply
   with `If-Match`, still loses the edit to the next autosave and should not ship.
2. **The CLI as a room participant.** A CLI that joins the room over WebSocket would get live state
   and show the agent as a collaborator with a cursor, at the cost of reimplementing editor op
   semantics in a short-lived process. Recommended: not now; selection awareness and relay through the
   api give most of the benefit.
3. **Line form and JSON form.** Two input syntaxes for one op model. Recommended: both, with the line
   form parsed into the JSON form by one parser, because heredoc line ops are what agents emit most
   cheaply and JSON is what scripts produce.
4. **Where the engine lives.** A new `@livediagram/edit-ops` package vs files in `@livediagram/document`.
   Recommended: a new package, because it is one cohesive concern with three consumers.
5. **Make-room scope.** Shift within the containing frame or component (recommended) vs the whole tab
   beyond the midline.
6. **Selection conflicts.** Warn (recommended for chat) vs refuse by default.

## 8. Implications for the specs

When this becomes a spec, the deltas are:

- [API app](../../specs/015-api/api.md): the edits endpoint, the tab ETag, and the room's `/mutation`
  accepting `el` ops; "The persistence boundary" changes because REST element edits reach the room.
- [MCP server §4.4](../../specs/015-api/mcp-server.md): `update_document` ops mode delegates to the
  shared engine and gains the error codes, changeset and the vocabulary above.
- [Realtime conflict resolution](../../specs/012-collaboration/realtime-conflict-resolution.md):
  REST writers become sequenced peers; the residual same-element window is restated.
- A CLI spec under `docs/specs/015-api/` owning verbs, op grammar, exit codes and the journal.

## Sources

- Aider, edit formats: <https://aider.chat/docs/more/edit-formats.html>
- Aider, "Unified diffs make GPT-4 Turbo 3X less lazy": <https://aider.chat/docs/unified-diffs.html>
- Aider leaderboards (edit-format correctness per model): <https://aider.chat/docs/leaderboards/>
- OpenAI, GPT-4.1 prompting guide (apply_patch, V4A): <https://cookbook.openai.com/examples/gpt4-1_prompting_guide>
- OpenAI Codex CLI (apply_patch tool): <https://github.com/openai/codex>
- Anthropic, text editor tool: <https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/text-editor-tool>
- Anthropic, building effective agents (tool design, poka-yoke): <https://www.anthropic.com/research/building-effective-agents>
- RFC 6902 JSON Patch: <https://www.rfc-editor.org/rfc/rfc6902>
- RFC 7386 JSON Merge Patch: <https://www.rfc-editor.org/rfc/rfc7386>
- RFC 6901 JSON Pointer: <https://www.rfc-editor.org/rfc/rfc6901>
- RFC 9535 JSONPath: <https://www.rfc-editor.org/rfc/rfc9535>
- RFC 9110 HTTP semantics, conditional requests (`If-Match`, `412`): <https://www.rfc-editor.org/rfc/rfc9110#section-13>
- tldraw agent starter kit: <https://tldraw.dev/starter-kits/agent>, README at <https://github.com/tldraw/tldraw/tree/main/templates/agent>
- Figma, how multiplayer works: <https://www.figma.com/blog/how-figmas-multiplayer-technology-works/>
- Figma plugin API: <https://www.figma.com/plugin-docs/>
- Framelink Figma MCP: <https://github.com/GLips/Figma-Context-MCP>
- Miro REST, create items in bulk: <https://developers.miro.com/reference/create-items>
- Google Slides `batchUpdate`: <https://developers.google.com/slides/api/reference/rest/v1/presentations/batchUpdate>
- Google Docs `WriteControl` (`targetRevisionId`): <https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate>
- Notion, append block children (`after`): <https://developers.notion.com/reference/patch-block-children>
- Lucid Standard Import: <https://developer.lucid.co/docs/standard-import>
- Excalidraw MCP and CLI (yctimlin): <https://github.com/yctimlin/mcp_excalidraw>
- draw.io MCP (lgazo), tools reference: <https://github.com/lgazo/drawio-mcp-server/blob/main/TOOLS.md>
- Penpot MCP: <https://github.com/penpot/penpot-mcp>
- VS Code `WorkspaceEdit`: <https://code.visualstudio.com/api/references/vscode-api#WorkspaceEdit>
- Kubernetes declarative management, three-way merge: <https://kubernetes.io/docs/tasks/manage-kubernetes-objects/declarative-config/>
- livediagram: `apps/mcp/src/tools.ts`, `packages/document/src/element-normalise.ts`, `apps/mcp/src/schema.ts`,
  `packages/document/src/element-ops.ts`, `element-deltas.ts`, `collab-ledger.ts`, `validate.ts`,
  `mermaid-serialise.ts`, `arrow-rebind.ts`, `anchor-choice.ts`, `graph-authoring.ts`,
  `apps/api/src/routes/document-subresource-routes.ts`, `apps/api/src/db/tabs.ts`,
  [API app](../../specs/015-api/api.md), [MCP server](../../specs/015-api/mcp-server.md),
  [Realtime conflict resolution](../../specs/012-collaboration/realtime-conflict-resolution.md),
  [Arrow anchors](../../specs/008-canvas/arrow-anchors.md), [Layout cleanup](../../specs/008-canvas/layout-cleanup.md)
