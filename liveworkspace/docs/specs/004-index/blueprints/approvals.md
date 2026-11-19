# Approvals: blueprint

Derived from [approvals.md](../approvals.md). The spec decides; this file only adds engineering precision. Defaults
are cited as `IDXn`. Paths are relative to the repository root.

Scope, by file:

| File                                                                                      | Role                                                                                                                               |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/migrations/0019_approvals.sql`                                  | `approvals`, `approval_people`, their indexes, and `items.content_at`                                                              |
| `liveworkspace/apps/index/src/approvals.ts`                                               | the routes: `handleApproval` (`GET`, `POST`, `DELETE /items/:id/approval`, `POST …/decision`, `GET …/people`)                      |
| `liveworkspace/apps/index/src/approval-rows.ts`                                           | reading an item's approval and its people into the wire `Approval` (`readApproval`, `namedIn`, `approvalOf`)                       |
| `liveworkspace/apps/index/src/approval-people.ts`                                         | who may be named: `checkNameable` (owner, Shared with me, team through accounts) and `approvalCandidates`                          |
| `liveworkspace/apps/index/src/app-routes.ts`                                              | the summary push sets `content_at = MAX(COALESCE(content_at, 0), updatedAt)`                                                       |
| `liveworkspace/apps/index/src/account-purge.ts`                                           | a closed account's approvals and decisions anonymised (three statements beside `byPerson`)                                         |
| `liveworkspace/apps/index/src/index.ts`                                                   | routes `items/:id/approval…` and labels `approval`, `decision`                                                                     |
| `packages/index-client/src/approvals.ts`                                                  | the wire types, limits, `parseApprovalNotice`, `isApprovalDay`                                                                     |
| `packages/index-client/src/constants.ts`                                                  | the four event kinds in `ITEM_EVENT_TYPES` and `TEAM_AUDIT_ITEM_TYPES`, their audit labels                                         |
| `packages/index-client/src/client.ts`                                                     | `getApproval`, `requestApproval`, `decideApproval`, `cancelApproval`, `approvalPeople`                                             |
| `packages/index-app/src/internal.ts`, `internal-contract.ts`                              | the `approval_requested` notice to the `approvalRequested` handler (202 and nothing without one)                                   |
| `packages/index-app/src/notifier.ts`                                                      | `notifyApprovalRequested`: the approvers' addresses (`notifyActionAssigned`), one email each through the app's `approvalRequested` |
| `packages/explorer/src/approvals/*`                                                       | `door.tsx` (`useEditorApprovalDoor`, `ApprovalDoorProvider`), the badge, the banner, the Approval tab's form and panel, words      |
| `packages/explorer/src/dialogs/ShareDialog.tsx`, `share/ShareTabs.tsx`                    | the Approval tab beside Passes when a door is open                                                                                 |
| `packages/explorer/src/library/history-*.ts`, `event-icons.tsx`, `explorer/audit/rows.ts` | the four kinds' History labels, tone, filter, glyphs and audit sentences                                                           |
| each app's `apps/api/src/routes/internal-items.ts`, `email/*`                             | the notice handler and the email template                                                                                          |
| each app's editor (`EditorView`, `editor-view-bars`, `EditorTabDialogs`)                  | the door from its gate, the badge in the corner card (`EditorCornerActions`), the banner above the corner card's layer             |

## Domain and naming

| Term             | Identifier                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------- |
| approval request | a row of `approvals`; `Approval` on the wire                                                 |
| approver         | a row of `approval_people`; `Approver`                                                       |
| state            | `approvals.state`: `open`, `approved`, `cancelled` (`ApprovalState`)                         |
| decision         | `approval_people.decision`: `pending`, `approved`, `changes_requested` (`ApproverDecision`)  |
| status (badge)   | `ApprovalStatus`: `awaiting`, `changes_requested`, `approved`, `changed`, worked out on read |
| revision         | `items.content_at`                                                                           |
| due day          | `approvals.due_day`, `YYYY-MM-DD`; `due` on the wire                                         |

## Behaviour and state

- `statusOf(approval, contentAt)`: `cancelled` → null; `open` → `changes_requested` when any decision is
  `changes_requested`, else `awaiting`; `approved` → `changed` when `contentAt !== null && contentAt > closedAt`, else
  `approved`.
- Request: one batch, in order: `UPDATE approvals SET state = 'cancelled', closed_at = now WHERE item_id = ? AND state =
'open'` with its `approval_cancelled` event (only when the read before found one); `INSERT` the request; one
  `INSERT … SELECT FROM json_each(?)` for its approvers; the `approval_requested` event; `DELETE FROM approvals WHERE
item_id = ? AND id NOT IN (the newest APPROVALS_KEPT)`.
- Decide: one batch: the approver's row updated; the event; then `UPDATE approvals SET state = 'approved', closed_at =
now WHERE id = ? AND state = 'open' AND NOT EXISTS (a decision other than approved)`. The event's `complete` is
  worked out before the batch from the rows read (every other approver approved and this one approves).
- A decision equal to the one held (and the same note) answers the approval unchanged and writes nothing.
- The unique partial index `approvals_open (item_id) WHERE state = 'open'` makes a second open request impossible even
  when two requests race: the loser's batch fails and answers 409 `approval_conflict`.

## Interfaces and contracts

| Route                               | Need                                           | Body                                                | Answers                                                                                                                                                            |
| ----------------------------------- | ---------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /items/:id/approval`           | reaches the item, any level, not a public link | none                                                | 200 `{approval}`                                                                                                                                                   |
| `POST /items/:id/approval`          | Editor of the whole item                       | `{approverIds, note?, due?, snapshotId?}`           | 201 `{approval}`; 400 `invalid_body`, `invalid_approvers`, `invalid_due`; 403 `forbidden`; 409 `approval_conflict`; 422 `approver_cannot_open`; 429 `rate_limited` |
| `POST /items/:id/approval/decision` | a named approver who reaches the whole item    | `{decision: 'approve' \| 'request_changes', note?}` | 200 `{approval}`; 400 `invalid_body`; 403 `not_an_approver`; 404 `approval_not_found`                                                                              |
| `DELETE /items/:id/approval`        | Editor of the whole item                       | none                                                | 204; 404 `approval_not_found`                                                                                                                                      |
| `GET /items/:id/approval/people`    | Editor of the whole item                       | none                                                | 200 `{people: [{id, name, via: 'owner' \| 'link'}]}`                                                                                                               |

Every route: 401 without a person; 403 `approvals_need_a_person` for an app acting for a person, the Drive mirror or
the export; 404 for an item the caller doesn't reach (as `loadItem`). `approverIds`: 1 to `APPROVERS_MAX` distinct
ids, each `user_…` (`isAccountId`), none the caller (`invalid_approvers`). `note` text, trimmed, at most
`APPROVAL_NOTE_MAX` (`invalid_body` past it). `due` null or a real `YYYY-MM-DD` (`invalid_due`). `snapshotId` null or
an id (`isId`).

The notice (`ApprovalNotice`, `parseApprovalNotice`): `{type: 'approval_requested', approvalId, requesterId,
requesterName: string | null, approverIds: string[] (1..10), itemTitle, note: string | null, due: string | null}`.

## Data and persistence

```sql
CREATE TABLE approvals (
  id           TEXT    PRIMARY KEY,
  item_id      TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  requested_by TEXT    NOT NULL,
  note         TEXT    NULL,
  due_day      TEXT    NULL,
  snapshot_id  TEXT    NULL,
  state        TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  closed_at    INTEGER NULL
);
CREATE INDEX approvals_item ON approvals (item_id, created_at DESC);
CREATE UNIQUE INDEX approvals_open ON approvals (item_id) WHERE state = 'open';
CREATE INDEX approvals_requester ON approvals (requested_by);
CREATE TABLE approval_people (
  approval_id TEXT    NOT NULL REFERENCES approvals (id) ON DELETE CASCADE,
  person_id   TEXT    NOT NULL,
  position    INTEGER NOT NULL,
  decision    TEXT    NOT NULL DEFAULT 'pending',
  note        TEXT    NULL,
  decided_at  INTEGER NULL,
  PRIMARY KEY (approval_id, person_id)
);
CREATE INDEX approval_people_person ON approval_people (person_id);
ALTER TABLE items ADD COLUMN content_at INTEGER NULL;
```

- A purged item takes its requests and their people (cascade). Nothing else references them.
- `content_at` starts null for every item; the next summary push sets it. An approval closed while it is null reads
  `approved` until the first push after it.
- Closing an account: `UPDATE approvals SET requested_by = 'deleted'` and `UPDATE approval_people SET person_id =
'deleted', note = NULL` for that person, by the two person indexes (`IDX51`). An `approval_people` row whose rename
  would collide with another `deleted` row of the same request is deleted instead (`UPDATE OR IGNORE`, then `DELETE`).

## Errors and edge cases

- An approver gone from the item still counts; their place waits. Cancel and ask again without them (spec).
- The item in the Trash or archived: `loadItem` already limits it to its owner and team; requests and decisions on a
  request on a trashed or archived item answers 404 `not_found`. An open request's approvers may still answer while
  they reach it.
- Accounts unreachable while naming a team member: the request is refused 503 `approvals_unavailable` rather than
  sent to someone the index couldn't check. Names unreachable: names are null (`IDX33`'s rule).
- An unknown `decision` is 400 `invalid_body`.

## Security and trust

- Approvers are checked on the server, never trusted from the client: each must reach the whole item now
  (`nameable`). The client's candidate list is presentation.
- A Viewer's one write is the decision row and its event, nothing about the item's content.
- The request limit (10 a day per item) bounds the emails one Editor can cause; each email goes only to people who
  already reach the item and whose assignment emails are on.
- Notes are text: stored and sent as given, escaped by every renderer (React, the email templates' `escapeHtml`).

## Performance and limits

- `GET /items/:id/approval`: `loadItem` (one row, one link read), then one batch of three statements (the newest
  request by `approvals_item`, its people by primary key, the item's `content_at`), then one accounts call for at most
  11 names. Nothing per approver.
- `POST`: up to 10 accounts team reads (in parallel, 3 s each, only for a team item and only for people not found as
  owner or link), one D1 read of who is in Shared with me (`json_each`), one batch.
- `content_at` is written by the summary push's existing statement: no extra statement.
- The editor reads once on open, on visibility (at most every 30 s) and after its own writes.

## Observability

- `[approvals] notice not delivered` (the index's `tellApp` log) when the app does not take the notice.
- `[notify-email] skipped …` from the notifier when an approver has no address or turned emails off.
- Every refusal is a coded 4xx; the route label is `…Items.Approval` / `…Items.Approval.Decision`.

## Testing

- `liveworkspace/apps/index/src/approvals.test.ts`: request, decide, cancel, read, people; the role table (Editor,
  tab-confined Editor, Participant, Viewer, outsider, public link, token); nameable checks; Changed Since Approval from
  a summary push; the replace and the cap of five; the rate limit; the notice; History and the team audit log rows;
  closing an account.
- `packages/index-client/src/approvals.test.ts`: the notice parser and the day check.
- `packages/index-app/src/notifier.test.ts`, `internal.test.ts`: the approval email and the door.
- `packages/explorer/src/approvals/*.test.ts(x)`: the badge per status, the banner's decide flow, the Approval tab's
  form, list and states, the door's gate, and the four kinds in History and the Audit Log.
- Each app: `lib/approvals-roles.test.tsx` pins that only an Editor of the whole item asks, that a named Editor,
  Participant or Viewer approves, and that a guest has no door.

## Constants and configuration

| Constant                    | Value | Where                                    | Why                                                          |
| --------------------------- | ----- | ---------------------------------------- | ------------------------------------------------------------ |
| `APPROVERS_MAX`             | 10    | `packages/index-client/src/approvals.ts` | a sign-off is a few people; bounds accounts reads and emails |
| `APPROVAL_NOTE_MAX`         | 500   | same                                     | a note, not a document; the Inbox's own text cap             |
| `APPROVALS_KEPT`            | 5     | same                                     | only the newest is read; History keeps the story             |
| `APPROVAL_REQUESTS_PER_DAY` | 10    | same                                     | bounds the emails one item's requests send                   |
| `APPROVAL_PEOPLE_MAX`       | 100   | same                                     | the candidates read's cap, one accounts names call           |
| `APPROVAL_REFRESH_MS`       | 30 s  | `packages/explorer/src/approvals/`       | the editor's re-read on coming back, as the Inbox's          |

## Defaults ledger

`IDX51`: a closed account's approval rows are anonymised, not deleted, so the request's count of approvers stays true.
`IDX52`: an approval's emails follow the Actions Assigned to Me switch; there is no switch of its own.
