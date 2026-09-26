# Import and export

Follow the references below only as needed; never upfront.

- ./markdown-import.md - when working on Markdown import: Import Markdown outlines (XMind etc.) into a themed tree diagram
- ./mermaid.md - when working on Mermaid import & export: Import/export Mermaid text (the connection graph, not just labels), file OR paste/view; parse+serialize in packages/diagram reusing graphToElements. Flowcharts import+export (edge styles, full shape brackets + @{shape}, & fans, click links, subgraphs-as-frames with cluster layout); state + ER diagrams import-only. Removes the .lvd text DSL (the removed text-DSL spec) and re-assesses markdown ([Markdown import](markdown-import.md))
- ./excalidraw-import-export.md - when working on Excalidraw import & export: An Excalidraw format card in both the Import and Export dialogs: near-lossless `.excalidraw` import (shapes, bound text, arrow bindings, freedraw, groups) with ids re-minted, and a documented-degradation export (labelled boxes for kinds Excalidraw lacks, bound-text labels, reverse-mapped arrowheads); image bytes not migrated in v1
- ./export-fidelity.md - when working on Export fidelity: An exported image is a picture of the diagram: whatever the canvas draws, every export draws. Three renderers for the same content (canvas, SVG emitters, PNG canvas-2D drawers) had each drifted, so labels exported two thirds of their size and twenty-two kinds exported as an empty labelled box. Held by one definition per decision in @livediagram/diagram, imported by both sides, plus the list of kinds the PNG path must rasterise
