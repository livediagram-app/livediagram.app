# Import and export

Follow the references below only as needed; never upfront.

- ./mermaid.md - when working on the Mermaid parser and serialiser left in packages/document, which no agent surface reaches since the MCP, CLI and API dropped Mermaid input and export: the connection graph parsed in packages/document and laid out with graphToElements. Flowcharts read and written (edge styles, full shape brackets + @{shape}, & fans, click links, subgraphs-as-frames with cluster layout); state, ER and sequence diagrams read only
- ./export-fidelity.md - when working on Export fidelity: An exported image is a picture of the document: whatever the canvas draws, every export draws. Three renderers for the same content (canvas, SVG emitters, PNG canvas-2D drawers) had each drifted, so labels exported two thirds of their size and twenty-two kinds exported as an empty labelled box. Held by one definition per decision in @liveplanner/document, imported by both sides, plus the list of kinds the PNG path must rasterise
