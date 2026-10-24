# Import and export

Follow the references below only as needed; never upfront.

**In liveplanner** the importers (draw.io, Excalidraw, Microsoft Whiteboard, Mermaid, Markdown) are gone
([Scope](../002-project-scope/product-scope.md)). Export stays: a tab as PNG, SVG, PDF, Markdown, CSV or JSON, and a
JSON export imported back. The Mermaid code that was left in `packages/project` is gone too (2026-10-24).

- ./mermaid.md - when working on the sequence text reader (parseSequenceDiagram) and what remains of the removed Mermaid input and export: what was deleted from packages/project and the sequence syntax the sequence layout tests read
- ./export-fidelity.md - when working on Export fidelity: An exported image is a picture of the project: whatever the canvas draws, every export draws. Three renderers for the same content (canvas, SVG emitters, PNG canvas-2D drawers) had each drifted, so labels exported two thirds of their size and twenty-two kinds exported as an empty labelled box. Held by one definition per decision in @liveplanner/project, imported by both sides, plus the list of kinds the PNG path must rasterise
