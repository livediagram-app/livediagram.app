# Diagram sources

**Status: specified.** Built by `plans/0047-repository-sync.md`.

Most repositories already hold diagrams as text: Mermaid in READMEs, PlantUML beside the code, Graphviz written by
generators such as code2flow. A **source** is one such diagram, a file or a fenced block in Markdown, **bound** to a
livediagram tab through a [repository link](repository-link.md). Binding is the onboarding: every source comes into
livediagram (forward compatible), and livediagram writes back what the format can say (backward compatible, as far
as the format goes).

## Formats

A **bridge** is one format's two halves: a parser to a graph and a serialiser from a tab, with a capability table
naming what the format can express. Bridges reuse the existing importers ([Mermaid](../020-import-export/mermaid.md),
[draw.io](../020-import-export/drawio-import.md), [Excalidraw](../020-import-export/excalidraw-import-export.md)).

| Format                                          | Files                                     | Directions                                                 |
| ----------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| Mermaid flowchart                               | `.mmd`, `.mermaid`, ` ```mermaid ` fences | two-way                                                    |
| Mermaid state, ER                               | as above                                  | in (export is flowchart text)                              |
| PlantUML (component, activity, use case, class) | `.puml`, `.plantuml`, ` ```plantuml `     | in, then two-way per diagram type as each serialiser lands |
| Graphviz DOT (code2flow, pydeps, ...)           | `.dot`, `.gv`                             | in                                                         |
| draw.io                                         | `.drawio`, `.drawio.svg`, `.drawio.png`   | in                                                         |
| Excalidraw                                      | `.excalidraw`                             | two-way                                                    |

- **Direction** is per binding: `two-way` (the default where the format allows), `in` (the file feeds livediagram
  and is never written: generated files, formats without a serialiser) or `out` (livediagram writes the file and
  never reads it: a published Mermaid copy of a richer diagram).
- An `in` binding to a generated file is re-read when the file changes; what people drew on top of it in
  livediagram (positions, colours, extra elements) stays, by element identity (below).

## Binding

- **Adopt.** `livediagram link adopt [<glob>...]` finds the sources under the link, lists them with their format and
  the direction it would use, and, confirmed (or `--yes` when piped), creates one document per source file in the
  link's folder (one tab per fenced block for a Markdown file holding several), and binds each.
- **The marker.** A binding is written into the source itself, as a comment in the format's own syntax on its first
  line: `%% livediagram: doc_3h9x2a/0b34 relaxed` (Mermaid), `' livediagram: ...` (PlantUML),
  `// livediagram: ...` (DOT). A source moved or copied keeps its binding; a copy of a bound source is refused as a
  second binding of one tab until its marker is removed. Formats without comments (draw.io, Excalidraw) are bound by
  the link file's `[[sources]]` table, path to tab.
- **The tab knows.** The tab records its binding's format and compatibility (`source: { format, compatibility }`),
  so the editor enforces it wherever the tab is opened; the path stays in the repository.

## Identity

A source's node ids are its elements' ids: node `play` is element `play`
([refs](../024-agents/document-views.md#refs) are slugs for this reason). An edge is identified by its ends and its
order between them. So a renamed label is a change, a renamed id is a remove and an add, and layout drawn in
livediagram survives every re-read: the text formats carry no positions, so a source's change never moves an
existing element, and new elements are placed by the layout engine beside their neighbours.

## Compatibility

Each bound tab is **relaxed** (the default) or **strict**.

### Relaxed

Anything livediagram offers can be added. The source receives the tab's **projection**: everything its format can
express. The rest is **residue**, kept only in livediagram:

- The serialiser writes one comment line saying so, after the marker: `%% livediagram: 3 elements and 2 styles not
expressible here; see https://livediagram.app/document/...`.
- In the editor, the tab's source badge reads "Mermaid · relaxed", and its popover lists the residue by element; a
  residue element shows no mark of its own on the canvas, so the drawing stays clean.
- Residue is never an error and never a lint finding.

### Strict

The tab holds only what its format expresses, so the source and the tab say the same thing:

- The palette offers only kinds the bridge expresses; the style controls only the styles it does.
- A paste, an import or a template that would add residue is refused with what could not be kept, and offers to add
  the rest as a relaxed copy.
- A changeset that would add residue is refused `422 not_expressible`, naming each element and field
  ([Agent changesets](../024-agents/agent-changesets.md)).
- Switching a relaxed tab to strict lists the residue it holds and refuses until it is removed or the person removes
  it from the same dialog. Switching to relaxed always succeeds.

## Syncing a source

A source syncs as a mirror file does ([Repository link](repository-link.md#merging)), with the source's graph in
place of the element list: the base is the source text at the last sync, parsed; local is the file parsed; remote is
the tab. The merged tab is sent as a changeset and the source rewritten from it.

- The serialiser rewrites a source only when its projection changed, so an unrelated edit in livediagram (a colour,
  in Mermaid) leaves the file untouched.
- What the serialiser does not own is kept: in a Markdown file every byte outside the bound fence, and in a source
  its leading comments, its `%%{init}%%` or `@startuml` directives and its marker.
- Output is deterministic: nodes in tab reading order, then edges in source order, so a diff shows only real change.
- A source that no longer parses keeps the tab as it is and is reported with the parser's line and message; nothing
  is sent until it parses.

## Observability and telemetry

- CLI fingerprints: `[source] adopted`, `[source] parsed`, `[source] rewritten`, `[source] parse-failed`,
  `[source] residue` (counts), with the path and tab id.
- Api: `[changeset] not-expressible` with the document, tab and counts.
- Telemetry: `Cli·Used·LinkAdopt`; `Document·Imported·<Format>` per adopted source, as the editor's imports count;
  `UI·Toggled·StrictSource` and `UI·Toggled·RelaxedSource`.
