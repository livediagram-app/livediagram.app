# Canvas suggestions

Status: built (Work Tracker 931)

Suggesting changes on the canvas for an Editor to accept, as every product does it:
[Canvas suggestions](../../../../liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md) is the rule, the words and
the look. This page holds what is liveplanner's own.

- **Where**: the elements on a tab (a board, a sheet, a chart, a note, a shape, as placed); a board’s cards and a sheet’s cells are not elements and take no suggestion.
- **The routes** are `/api/projects/:id/tabs/:tabId/suggestions` (list, suggest), `…/accept` and `…/reject`, and
  the Share dialog's settings `GET`/`PUT /api/projects/:id/review`.
- **Accepting** writes one changeset to the tab by the Editor, in the plan's changeset history
  ([Agent changesets](../024-agents/agent-changesets.md)), so Revert takes it back.
- **Suggest Only** is set in the Share dialog's Suggestions section; a link to every tab is named **Whole Plan**.
- **Telemetry** goes under `Element` and `Project · Shared`, as the platform spec lists.
