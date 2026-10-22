# Import and export

Follow the references below only as needed; never upfront.

**In liveplanner** the importers (draw.io, Excalidraw, Microsoft Whiteboard, Mermaid, Markdown) are gone
([Scope](../002-project-scope/product-scope.md)). Export stays: a tab as PNG, SVG, PDF, Markdown, CSV or JSON, and a
JSON export imported back. The Mermaid code left in `packages/project` is reached by nothing an agent or person uses
and goes with the diagram element code.

- ./mermaid.md - when working on the Mermaid parser and serialiser left in packages/project, which no agent surface reaches since the MCP, CLI and API dropped Mermaid input and export: the connection graph parsed in packages/project and laid out with graphToElements. Flowcharts read and written (edge styles, full shape brackets + @{shape}, & fans, click links, subgraphs-as-frames with cluster layout); state, ER and sequence diagrams read only
- ./export-fidelity.md - when working on Export fidelity: An exported image is a picture of the project: whatever the canvas draws, every export draws. Three renderers for the same content (canvas, SVG emitters, PNG canvas-2D drawers) had each drifted, so labels exported two thirds of their size and twenty-two kinds exported as an empty labelled box. Held by one definition per decision in @liveplanner/project, imported by both sides, plus the list of kinds the PNG path must rasterise
