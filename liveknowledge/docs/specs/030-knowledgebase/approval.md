# Approval

Owner, 2026-11-21: "I want the ability for a page to be "Pending Approval" and then other signed in members can
choose to approve or reject it."

Status: **built, not yet verified in a browser** ([blueprint](blueprints/approval-and-comments.md)). The details
below were decided by the builder and stand until the owner overturns them; each is marked "(decided)".

Verification says a page is right. Approval is how a writer asks someone else to say so before the page is trusted:
a second pair of eyes on a page a person or an agent has just written.

## The field

On the page (`Tab.knowledge.approval`), beside the verification fields ([Verification](verification.md) "The
fields"), written only by the api's approval route:

| Field              | What it holds                                                                           |
| ------------------ | --------------------------------------------------------------------------------------- |
| `state`            | `pending`, `approved` or `rejected`                                                     |
| `requestedBy`      | the account that asked (an agent's is its token's person)                               |
| `requestedAt`      | when (epoch ms)                                                                         |
| `requestedByAgent` | the agent's name ("Claude"), when an agent asked                                        |
| `requestedByName`  | the asker's profile name then, so a reader whose editor cannot name them still sees who |
| `decidedByName`    | the same for the person who decided                                                     |
| `decidedBy`        | the account that approved or rejected; absent while pending                             |
| `decidedAt`        | when                                                                                    |
| `note`             | a rejection's note, up to 500 characters, as written; absent when none was written      |

A page with no `approval` has never been asked about, and shows nothing. The field travels with the page as its
other knowledge fields do (copies, exports, a snapshot) and is synced in the same `tab-meta` patch.

The knowledgebase also keeps one row a page in its own SQLite, `page_approvals` (schema step after the automations'
steps), the page's current approval as the field holds it, so Home and agents list the pages waiting without reading
every page. The route writes the field and the row in one transaction; a deleted page takes its row with it.

## States

| State                | Shows as                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| **Pending Approval** | a violet "Pending Approval" pill in the meta row, a violet dot on the tree row, Page Health's panel |
| **Approved**         | the page is Verified (below): the green tick; Page Health says "Approved by Priya, 3 Nov"           |
| **Rejected**         | a rose "Rejected" pill in the meta row, a rose dot on the tree row, the note in Page Health         |

- Violet is approval's own hue (decided): amber is Review Due and rose is a refusal, so a page waiting is never read
  as a warning. Each pill is a button that opens the Approval popover.

## Asking for approval

- **Request Approval** is in the meta row after Verify, a quiet button the row's size (person icon with a tick), for
  an Editor or a Participant with an account, on a page that is not Pending Approval. It asks first, in a popover:
  "Request Approval?", "Signed-in members of this knowledgebase can approve or reject it. Approving also verifies
  it.", then **Cancel** and **Request Approval**.
- Page Health's Approval panel offers the same, one press.
- A page Rejected or Approved may be asked about again: the request replaces the record (**Request Again**).
- **An agent** may ask too (decided): a token that may suggest or write, through the MCP's `request_approval`, the
  CLI's `liveknowledge approval <kb> <page>` (`--withdraw` takes it back) and `POST .../pages/<tab>/approval`. The pill and Page Health say "Requested
  by Claude for Priya Shah" (its token's person). An agent that has just created or rewritten a page asks for
  approval in a second call; nothing asks on its own.
- **Withdraw** takes a request back while it is pending: the person who asked (or, for an agent's request, its
  person), or an Editor. The page goes back to having no approval.

## Approving and rejecting

- While a page is Pending Approval, every signed-in Editor and Participant except the person who asked sees
  **Approve** and **Reject** in the Approval popover (from the pill) and in Page Health's panel. The person who asked
  sees "Waiting for someone else to approve it." and **Withdraw** instead: nobody approves their own request.
- **Viewers do not approve or reject** (decided): approving verifies the page, which is a writer's act
  ([Verification](verification.md) "Share roles"). Nor does a link visitor, a guest, or an agent: approval is a
  person's judgement.
- **Approve** is one press. It sets `state: approved`, `decidedBy`, `decidedAt`, and **verifies the page** in the
  same write (decided): `verifiedAt` now, `verifiedBy` the approver, and the approver becomes the owner of a page
  with none, exactly as Verify does.
- **Reject** opens a note field in the popover, "What needs to change? (optional)", up to 500 characters, then
  **Cancel** and **Reject** (destructive). It sets `state: rejected` with the note. The page's verification is not
  touched: a page verified before is still verified.
- The api refuses a decision on a page that is not pending (`not_pending`, 409), the requester's own decision
  (`own_request`, 403), a decision with no account or from a token (`approval_needs_a_person`, 403) and a note over
  500 characters (`note_too_long`, 400).

## Where it shows

- **The meta row:** the pill, before Request Approval. Its popover: who asked and when ("Requested by Priya Shah,
  3 hours ago"), and for a Rejected page who rejected it, when, and the note in a quote; then the actions the person
  may take.
- **The page tree row:** a 6 px dot after the title, violet for Pending Approval and rose for Rejected, named
  "Pending Approval" or "Rejected" for a screen reader; an Approved page shows the Verified tick as any verified
  page does.
- **Page Health:** an **Approval** section after Page Health in the Page Info rail, shown when the page has an
  approval or the person may ask for one: the state with its glyph in a ring, who asked and when, who decided and
  when, the note, and the actions (the meta row popover's own body, so the two never differ).
- **Knowledgebase Home:** **Waiting for Your Approval**, after Yours to Review: the pages Pending Approval that you
  did not ask for, in the knowledgebases you may write, oldest request first, ten a knowledgebase, each with its
  knowledgebase, who asked and when, and **Review** (opens the page). Nothing at all when there are none.
- **Agents** read `approval` on `read_page` and `list_pages` (`pending`, `approved`, `rejected`, with who asked and
  the note), so an agent sees that a page is waiting or was turned down and why.

## Live

The route writes the field and tells the room the page's `tab-meta` patch, as Verify does: everyone with the
knowledgebase open sees the pill, the dot and Page Health change at once. A change made here shows at once and is
put back, with a toast in words, if the api refuses it.

## Email

When a page is rejected, its owner is emailed (**Page Rejected**): the page, who rejected it, and the note, with a
link to the page. Not when the owner rejected it themselves. It goes through the platform's notifier as the Review
Due email does, under the owner's **Knowledgebase Reviews** setting, and counts against the same daily ceiling.

## Telemetry

`Tab·Changed`, typed `ApprovalRequested`, `ApprovalWithdrawn`, `Approved`, `Rejected` or `RejectedWithNote`
(decided: the closed category list has no `Approval`, and a page's approval is a change of the page), counted when
the person presses, as Verify's `UI·Used VerifyPage` is.

## Share roles

| Action                                  | Editor | Participant | Viewer | Link visitor | Agent (suggest or write) |
| --------------------------------------- | ------ | ----------- | ------ | ------------ | ------------------------ |
| See the state                           | yes    | yes         | yes    | yes          | yes (read)               |
| Request Approval, Request Again         | yes    | yes         | no     | no           | yes                      |
| Withdraw a request                      | yes    | own         | no     | no           | own                      |
| Approve, Reject (not one's own request) | yes    | yes         | no     | no           | no                       |

Every gate reads `can` on the client and is enforced again in the api, with a test per role.

## Offline

A knowledgebase kept Offline has no account and no room: approval is not offered, and a stored approval shows as it
was.
