# Research

Follow the references below only as needed; never upfront.

Research holds dated measurements and experiment reports. They record what was measured and decided at the time; the specs state what the product does now.

## Vision

How the event-storming photo import finds sticky notes in a wall photo and reads their handwriting.

- ./vision/sticky-detection.md - when working on how a wall photo becomes sticky notes: pipeline, constants, limits
- ./vision/handwriting-readers.md - when choosing a reader for marker handwriting on a sticky crop
- ./vision/research.md - when looking for an untried way to find the stickies: the research inventory, judged
- ./vision/experiments/a-colour.md - when tuning colour classification and light handling (round 1)
- ./vision/experiments/a2-colour.md - when tuning colour classification (round 2)
- ./vision/experiments/b-separation.md - when telling touching notes apart (round 1)
- ./vision/experiments/b2-separation.md - when telling touching notes apart (round 2)
- ./vision/experiments/c-junk.md - when refusing boxes that are not paper: tape, cardboard, shadow, windows
- ./vision/experiments/d-resolution.md - when asking whether more pixels per note help the sticky detector
- ./vision/experiments/e-model.md - when weighing a tiny learned boundary model against the classical pipeline
- ./vision/experiments/f-nobox.md - when a note's paper is in the colour mask but no box survives
- ./vision/experiments/g-precision.md - when pushing detection precision to the bar on every wall
- ./vision/experiments/h-recall.md - when pushing recall without actors to the bar on every wall
- ./vision/experiments/i-separation.md - when telling touching notes apart (round 3)
- ./vision/experiments/j-hybrid.md - when combining the classical detector with the learned boundary model
- ./vision/experiments/k-geometry.md - when trying geometric ideas from the second research round
- ./vision/experiments/m-editor-model.md - when running the boundary model inside the editor's photo import
- ./vision/experiments/n-recall.md - when recall fails on the night wall, the whiteboard or a shaded wall
- ./vision/experiments/o-flat.md - when flat, textureless notes (screenshots, drawn walls) go missing
