# Canvas suggestions

Status: built (Work Tracker 931)

Suggesting changes on the canvas for an Editor to accept, as every product does it:
[Canvas suggestions](../../../../liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md) is the rule, the words and
the look. This page holds what is livedocuments's own.

- **Where**: slides and infographics: every element on a tab that is not an article’s writing.
- **The routes** are `/api/documents/:id/tabs/:tabId/suggestions` (list, suggest), `…/accept` and `…/reject`, and
  the Share dialog's settings `GET`/`PUT /api/documents/:id/review`.
- **Accepting** writes one changeset to the tab by the Editor, in the document's changeset history
  ([Agent changesets](../024-agents/agent-changesets.md)), so Revert takes it back.
- **Suggest Only** is set in the Share dialog's Suggestions section; a link to every tab is named **Whole Document**.
- **Telemetry** goes under `Element` and `Document · Shared`, as the platform spec lists.

- **Articles keep their own suggestions** ([Suggestions](../007-editor/suggestions.md)): text suggestions live in the
  article's writing, canvas suggestions beside the tab. One Suggest Only setting covers both: a Participant on it
  suggests in an article's text and on the canvas around it.
