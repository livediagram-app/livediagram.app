# Canvas suggestions

Status: retired (owner, 2026-11-17)

livediagram no longer offers [Canvas suggestions](../../../../liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md):
suggest mode left every product. Gone with it: Suggest Changes in Tools, Suggesting on the role pill, the Share dialog's
Suggestions section (Suggest Only), the routes `/api/documents/:id/tabs/:tabId/suggestions` (and `…/accept`,
`…/reject`) and `/api/documents/:id/review`, and the room's `suggestions` and `review` ops. A Participant link is a
Participant's again, held to the Participant rules ([Share roles](../013-workspace/share-roles.md)).

The room's `canvas_suggestions` table and the `review` column stay as their migrations wrote them: a migration is
history, and neither is read.
