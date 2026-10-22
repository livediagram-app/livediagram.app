# Diagram lint

Removed from liveplanner (plans/0001-liveplanner-fork.md Phase 4). The diagram lint checked how a diagram tab was drawn
(boxes that overlap, arrows that cross or run behind boxes, labels too long for their box) and suggested a fix for each
finding as edit operations. liveplanner keeps no diagram elements, so the `@liveplanner/diagram-lint` package went, and
with it the tab view `view=lint`, the CLI's `tab lint`, the lint summary on every changeset's last line and on the MCP's
write results, and the `lint` field of a changeset's answer.

Its telemetry (`Agent·Viewed·Lint`, `Cli·Used·TabLint`) is retired; the dashboard drops those events
(`apps/telemetry/app/retired-events.ts`).
