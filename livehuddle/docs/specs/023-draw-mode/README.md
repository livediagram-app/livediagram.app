# The whiteboard tools

**Status in livehuddle: retired.** Nothing in livehuddle arms these tools. Work Tracker #329 removed the whiteboard
dock, its keys and settings, the Fill tool's paint bucket, Snap colours, the board's own style memory and the quick
style panel's board and pen rows. What is left in the editor (the whiteboard pen, Path and Fill intents and the canvas
gestures that serve them) is unreachable and goes in a later pass. The specs below describe livediagram's tools.

> The whiteboard eraser is retired with the Eraser (6 November 2026,
> [Eraser panel](../008-canvas/eraser-panel.md)): what these specs say of it, and of its Stroke and Partial modes,
> is history. Delete takes elements away.

Follow the references below only as needed; never upfront.

- ./draw-mode.md - when working on the whiteboard tools Draw mode left behind (the mode itself is gone, see ../007-editor/editor-modes.md): preset pens, pen vs touch, stroke and partial erasers, shape recognition, backgrounds, light and dark board appearance, snapping custom colours to stock colours
- ./path-tool.md - when working on the Path tool: the vector pen (P), the path element, drawing, edit mode, style
- ./fill-tool.md - when working on the Fill tool: the paint bucket (F), its colour, what a press fills, closing a marker loop whose ends meet
- ./blueprints/README.md - when implementing the whiteboard tools: file-level contracts, constants, defaults and tests
