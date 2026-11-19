# Import and export blueprints

Follow the references below only as needed; never upfront.

- ./drawio-import.md - when implementing or changing draw.io import: decoding, the cell tree, the mapping, edges, the report, the summary
- ./import-image-pipeline.md - when implementing or changing how an importer's images are resized, encoded, stored, embedded offline, or reported
- ./excalidraw-import.md - when implementing or changing the Excalidraw parser to a board scene, Excalidraw paste or drop, image migration, embedded-scene PNG / SVG import, or the import dialog's progress and report
- ./board-scene.md - when implementing or changing the board scene landing, its editor wiring (paste insert, import commit paths, the paste notice) or the element fields it needs
- ./visio-import.md - when implementing or changing the Visio (.vsdx) import: the package, the shape sheet and masters, the master table, masterless geometry, connectors, images and the Visio card
- ./ms-whiteboard-import.md - when implementing or changing the Microsoft Whiteboard import: the format ids, replay, pen-stroke decoding and thinning, colour normalisation, scene mapping, board titles and dates, the panel and the Explorer page's Import from toolbar
- ./infrastructure-import.md - when implementing or changing the infrastructure import: detection, the Wrangler, Compose, Terraform and Kubernetes mappings, the HCL tokenizer, grouping and the cap, the summary, the sources record and the update merge, `link from-code` and the editor's Infrastructure panels
- ./bpmn-import.md - when implementing or changing the .bpmn import (reading, the mapping, flows, caps, the report) or draw.io's BPMN stencil mapping
- ./DEFAULTS.md - when an import/export blueprint applies a default the spec leaves open
- ./COMPLETENESS.md - when checking which completeness categories an import/export blueprint covers
