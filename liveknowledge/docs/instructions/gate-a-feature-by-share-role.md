# Gate a feature by share role

Every feature that a shared document can reach decides what an **Editor**, a **Participant** and a **Viewer** may do
with it ([Share roles](../specs/013-workspace/share-roles.md)). Do this while specifying, not after: a feature built
for Editors alone either leaks to a Participant (who is `isReadOnly` but still commits) or tells a Viewer to do
something it cannot.

1. **Write the role line into the spec first.** In the feature's spec, one short section or table: what each of
   Editor, Participant and Viewer sees and may do. The defaults: a Viewer only looks; a Participant edits text and comments
   (the words of what is already there, and the writing in an article) but never adds, moves, restyles or removes
   anything, reshapes the pages or changes settings; everything else is an Editor's. A fork from those defaults is the user's call: ask.
2. **Name it in the Share roles spec.** If the feature is something a Participant may do, add it to the May column
   of "What a Participant changes"; if it is explicitly not, to the Never column.
3. **Pick the server gate.** A REST write uses `gateEdit`, or `gateParticipate` for a Participant's write; a room op
   is presence (anyone, checked for level; a reaction needs a Participant), a Participant's text (`gateClientOp` in
   `apps/api/src/room-op-gate.ts` answers `participant-content` for an `el` op and `participant-article` for an
   `article` frame), or an Editor's. A Participant's element change goes through `applyParticipantOp` in
   `packages/document/src/participant-content.ts`, an allow-list of text fields per element kind
   (`PARTICIPANT_TEXT_FIELDS`); its writing in an article through `applyParticipantArticleOps` in
   `participant-article.ts`. A new field is refused to a Participant until it is added to that list; add it only
   when it is text, and keep the leak test (`participant-content.leak.test.ts`) passing in the same change.
4. **Pick the editor gate.** Never gate on `isReadOnly` alone: it is true for a Participant too. Use the session's
   `can` (`apps/editor/lib/editor-capabilities.ts`): `can.takePart` for comments and reactions, `can.writeText(el)`
   for an element's words, `can.writeArticle` for writing in an article; add a flag there (with the Viewer branch
   `false`) when none fits. Structural hooks take `structureBlocked` (`editsBlocked || isReadOnly`) or `createBlocked` (`structureBlocked || activeLayerBlocked`), from `useEditorState.ts`.
5. **Hide, do not dead-end.** A control the session cannot use is not rendered, or renders inert. A tool that
   changes the document carries `mutates: true` in `CANVAS_TOOLS` (`apps/editor/lib/editor-commands.ts`), which keeps it
   out of read-only command lists.
6. **Check the copy.** Every empty state, hint, hover card and toast the feature shows: would a Participant or Viewer
   be told to do something it cannot? Give them a description instead (see the comment empty
   states for the pattern).
7. **Lock it with tests.** At least: the server refuses the forbidden write for a Participant and a Viewer; the
   editor capability (or gate) is false for a Viewer and right for a Participant. The role tests that must keep
   passing: `participant-content.leak.test.ts`, `participant-article.test.ts`, `editor-capabilities.test.ts`,
   `room-op-gate.test.ts`, `document-room-participant.test.ts`.
8. **Look at it as each role.** Open the document through a Participant link and a Viewer link (`/document/shared?s=`)
   and try the feature; a guest browser profile per role keeps the identities apart.
