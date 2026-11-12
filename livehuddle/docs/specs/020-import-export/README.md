# Import and export

Follow the references below only as needed; never upfront.

- ./markdown-import.md - (Gone from livehuddle, Work Tracker #423 part 4) when working on Markdown import: Import Markdown outlines (XMind etc.) into a themed tree diagram
- ./mermaid.md - (Gone from livehuddle, imports from other tools) when working on Mermaid import & export: Import/export Mermaid text (the connection graph, not just labels), file OR paste/view; parse+serialize in packages/document reusing graphToElements. Flowcharts import+export (edge styles, full shape brackets + @{shape}, & fans, click links, subgraphs-as-boundaries with cluster layout); state + ER diagrams import-only. Mermaid is the text form for a graph (no `.lvd` text DSL); Markdown is the summary form ([Markdown import](markdown-import.md))
- ./excalidraw-import-export.md - (Gone from livehuddle, imports from other tools) when working on Excalidraw import, paste or export: one parser from Excalidraw (clipboard copies, `.excalidraw` files, embedded-scene `.png` / `.svg`) to a board scene, landed per profile (whiteboard-native for a new document, the diagram mapping on an open tab); Cmd/Ctrl+V and drop on the canvas; the mapping checked against real copies, named degradations; a documented-degradation export; a specified follow-up for excalidraw.com share links
- ./import-image-pipeline.md - when working on images inside an imported board: the shared browser-side resize (2048 px, WebP) + gallery upload every importer uses, Offline Mode embedding, named failures (gallery full, unsupported, too large, no image storage) and the import report
- ./export-fidelity.md - when working on Export fidelity: An exported image is a picture of the document: whatever the canvas draws, every export draws. Three renderers for the same content (canvas, SVG emitters, PNG canvas-2D drawers) had each drifted, so labels exported two thirds of their size and twenty-two kinds exported as an empty labelled box. Held by one definition per decision in @livehuddle/document, imported by both sides, plus the list of kinds the PNG path must rasterise
- ./board-import.md - (Gone from livehuddle, imports from other tools) when working on any board import from another tool: stages, WebP resize (WASM on Safari), gallery-cap placeholders, the import report, bulk readiness
- ./board-scene.md - (Gone from livehuddle, imports from other tools) when working on the board scene every board import and paste reduces to: its items, the whiteboard and diagram profiles, colour, width and text mapping, placement, the report and the paste notice
- ./whiteboard-import.md - (Gone from livehuddle, Work Tracker #423 part 4) when working on Microsoft Whiteboard import: board exports (the edit history) replayed into one dated document per board, the format (tree, changes, pen-stroke encoding), colour normalisation, the mapping to a board scene, where it lives (the Explorer) and the import flow
- ./drawio-import.md - (Gone from livehuddle, Work Tracker #423 part 4) when working on draw.io import: .drawio / .xml (compressed or not), Drive saves without an extension, .drawio.svg / .drawio.png and JSON exports into tabs (one per page), libraries into shape libraries, the Explorer import of files and folders as new documents (names, dates, the 2 MB tab limit), the mapping and degradation tables, the shared import report
- ./blueprints/README.md - when implementing from a blueprint: the import image pipeline, Excalidraw import and draw.io import

## The dialogs' header

The Export and Import dialogs wear the [dialog hero
header](../../../../liveworkspace/docs/specs/004-index/dialog-hero-header.md), their title (**Export Tab** or **Export
Selection**, **Import to Tab**) and its one line in the band, then **Help** and the close. Export draws the tab
leaving as files: a page in the bottom left, a dashed line along the foot to format tiles fanned in the bottom right,
the file going out in front in the accent; an arrow rising out of a tray is its mark. Import draws files coming in:
two files in the bottom left, a dashed line along the foot to a dashed frame in the bottom right, a file dropping
in over its edge; an arrow into a tray is its mark. Both arts are shared
(`@liveworkspace/ui/dialog-hero-art/export`, `/import`), so every product's pair reads alike.
