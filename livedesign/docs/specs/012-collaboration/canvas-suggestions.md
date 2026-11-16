# Canvas suggestions

Status: built (Work Tracker 931)

Suggesting changes on the canvas for an Editor to accept, as every product does it:
[Canvas suggestions](../../../../liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md) is the rule, the words and
the look. This page holds what is livedesign's own.

- **Where**: every page of a design and what is on it.
- **The routes** are `/api/designs/:id/tabs/:tabId/suggestions` (list, suggest), `…/accept` and `…/reject`, and
  the Share dialog's settings `GET`/`PUT /api/designs/:id/review`.
- **Accepting** writes one changeset to the tab by the Editor, in the design's changeset history
  ([Agent changesets](../024-agents/agent-changesets.md)), so Revert takes it back.
- **Suggest Only** is set in the Share dialog's Suggestions section; a link to every tab is named **Whole Design**.
- **Telemetry** goes under `Element` and `Design · Shared`, as the platform spec lists.
