# Canvas suggestions

Status: retired (owner, 2026-11-16)

liveplanner no longer offers [Canvas suggestions](../../../../liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md).
A plan's work is its cards and cells, which a suggestion never covered, so suggesting only the elements around them
was of little use. Gone with it: the Suggest row in Tools, Suggesting on the role pill, the Share dialog's Suggestions
section (Suggest Only), the routes `/api/projects/:id/tabs/:tabId/suggestions` (and `…/accept`, `…/reject`) and
`/api/projects/:id/review`, and the room's `suggestions` and `review` ops. A Participant link is a Participant's again,
held to the Participant rules ([Share roles](../013-workspace/share-roles.md)).

The room's `canvas_suggestions` table (migration V33) stays as written: a migration is history, and the table is never
read.
