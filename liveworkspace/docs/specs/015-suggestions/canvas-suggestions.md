# Canvas suggestions

Status: retired (owner, 2026-11-17)

No product suggests changes any more: the owner judged suggest mode a poor fit and removed it from every app.
liveplanner went first (2026-11-16, [its page](../../../../liveplanner/docs/specs/012-collaboration/canvas-suggestions.md));
livediagram, livedesign and livedocuments followed, and livedocuments' article suggestions went with them
([Suggestions](../../../../livedocuments/docs/specs/007-editor/suggestions.md)).

Gone everywhere:

- The shared package `@liveworkspace/suggestions` (`packages/suggestions`): the rule, the store, the routes' logic,
  the capture, the ghosts, the Suggestions panel and its `ToolExplainer` art.
- **Suggest Changes** in the footer's Tools menu, and **Suggesting** on the role pill.
- The Share dialog's **Suggestions** section (**Suggest Only**, and livedocuments' **Assistants Suggest**).
- The routes `/api/<items>/:id/tabs/:tabId/suggestions` (and `…/accept`, `…/reject`) and `/api/<items>/:id/review`,
  and the rooms' `suggestions` and `review` ops.

A Participant link is a Participant's again in every product, held to the Participant rules of each product's Share
roles. Each room's `canvas_suggestions` table and its item row's `review` column stay as their migrations wrote them:
a migration is history, and neither is read.
