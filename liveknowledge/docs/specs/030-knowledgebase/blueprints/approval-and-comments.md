# Blueprint: Approval and Comments on a Page

How [Approval](../approval.md) and [Comments on a Page](../page-comments.md) are built. Both are a page's feedback
loop: one asks a person to vouch for a page, the other is the conversation about it. They share the api's route
shape, the agents' module and the editor's foot and meta row, so they are built side by side.

## The rule, once

- `@liveknowledge/knowledge` `approval-field.ts` (the field, parsed defensively, `APPROVAL_NOTE_MAX`) and
  `approval.ts` (`approvalRefusal`, `approvalActions`, `applyApproval`): pure, at 100% coverage. The api enforces with
  them and the editor draws only what they allow, so the two cannot disagree. Approving calls `verified()`, so an
  approval verifies exactly as Verify does (the approver owns a page with none).
- `PageApproval` and its state are `@liveknowledge/document` types, on `TabKnowledge.approval`.

## Storage

- **Approval:** the field in `Tab.knowledge` (so it syncs in the `tab-meta` patch, travels with copies and exports,
  and the tree reads it from the tab list), plus a `page_approvals` row a page in the document's SQLite
  (`apps/api/src/knowledge/page-approvals.ts`, schema step V31), written in the same batch by
  `writePageKnowledge`'s `also` statements and guarded by the tab's rev. Home's "Waiting for Your Approval" reads the
  row (`awaitingApproval`, ten a knowledgebase) through the summary route, never every page.
- **Threads:** `page_threads` (V32, `apps/api/src/knowledge/page-threads.ts`), one row a thread with its comments as
  JSON and a rev for a compare-and-set write (a lost race retries once, then `thread_busy`). Never in the page body:
  a comment moves no revision, no Updated stamp, no version. Delete triggers take both tables' rows with the tab.

## The api

- `POST /documents/<id>/pages/<tab>/approval` (`routes/knowledge-approval-route.ts`): `{ action, note? }`. The
  caller (`approvalCallerOf`) is `view` unless an Editor or Participant on the whole knowledgebase (a link confined
  to one page decides nothing); an agent is read from the request's agent header. It writes through `saveFields`
  (the knowledge routes' one write, `verified: true` on approve so Changed since verified clears) and relays the
  `tab-meta` patch as Verify does. A reject emails the owner (`knowledge/approval-email.ts`, `PageRejected`, the
  Review Due email's notifier and ceiling) after the answer, in `waitUntil`.
- `GET|POST /documents/<id>/pages/<tab>/threads` (`routes/knowledge-thread-routes.ts`, the change itself in
  `knowledge/page-thread-changes.ts`): start, reply (reopens), resolve, reopen, and edit or delete of one's own
  comment (matched by account id, or token id for an agent). Each change relays one `page-thread` op (the whole thread
  or its removal) through the room's `/mutation`, which sequences it as a system op; clients cannot send one
  (`SYSTEM_OP_KINDS`). Authors are named on the wire by collab key, never account id.
- Comments on pages join the person's data export (`document-comments.ts`).

## Agents

`@liveknowledge/agent-verbs`: the shapes in `mcp/page-feedback-schema.ts`, the one request each in
`knowledge/page-feedback.ts` (`requestApproval`, `listPageComments`, `applyPageCommentChanges`, which stops at the
first refusal and says what landed), the MCP tools `request_approval`, `list_page_comments`, `change_page_comments`
(`verbs/mcp-tools.ts`, registered in apps/mcp `page-feedback-tools.ts`) and the CLI commands `approval`,
`comments`, `discuss` (`verbs/page-feedback.ts`). The trust fields every page answer carries gained `approval`,
`approval_requested_at` and `approval_note`.

## The editor

- Client: `lib/api/page-feedback.ts`.
- Approval: `pageKnowledgeStore.approval` (optimistic, rolled back on a refusal), `lib/knowledge/approval-view.ts`
  (the caller, marks and words), `components/knowledge/approval/`: `usePageApproval`, `ApprovalPanel` (one body for
  the popover and the rail), `PageApprovalMeta` (pill or Request Approval in the meta row, one `approval` note in
  `PageMetaRow`), `PageHealthApproval` (after Page Health in `PageRail`). The tree's dot: `approvalMarks` in
  `usePageTreeModel`, `approval` on `PageTreeRow`. Home: `components/home/HomeAwaitingApproval.tsx`.
- Comments: `lib/page-threads/page-threads-store.ts` (one read a page a session, the room's op, optimistic changes),
  `own-comment-key.ts` (the person's collab key, derived as the api does, to tell their own comments),
  `components/page-comments/` (`usePageComments`, `PageComments`, `PageThreadCard`, `PageCommentComposer`), drawn in
  the foot slot after Linked From (`PageKnowledgeSlots`). `room-op-receive.ts` hands a system `page-thread` op to the
  store.

## Performance

- Approval adds no request: the field rides the tab list, the tree's marks are one pass over it inside the memo the
  trust marks already had, and Home reads the summary it already reads.
- Threads: one `GET` a page a session, scheduled after the page draws; the foot reads one store slice keyed by the
  store's version, so typing in the writing renders none of it. A change sends one op carrying one thread.
- Bounds: 500 threads a page, 200 comments a thread, 2,000 characters a comment, 500 a rejection's note.

## Tests

- `packages/knowledge/src/approval.test.ts`; api `knowledge-approval-route.test.ts`, `knowledge-thread-routes.test.ts`
  (every role: Editor, Participant, Viewer, link visitor, edit-link guest, agent tokens); agent-verbs
  `verbs/page-feedback.test.ts`; editor `approval-roles.test.tsx`, `page-comments-roles.test.tsx`,
  `page-threads-store.test.ts`; e2e `e2e/signed-in/page-approval.spec.ts` and `page-comments.spec.ts`.
