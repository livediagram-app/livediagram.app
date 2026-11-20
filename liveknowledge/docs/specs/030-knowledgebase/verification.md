# Verification

Status: **the states, Verify, the meta row, the tree's tick and Page Health are built, not yet verified in a browser**
([Build plan](../005-project-roadmap/build-plan.md) step 7; [blueprint](blueprints/knowledge-ui.md)). Not built: "Edited <when> by <name>"
(no route says when a page's writing was last edited, or by whom) and Reminders. Verify needs an account, and a
knowledgebase kept Offline has none.

A wiki is only useful, to a person or to an agent, while it is right. Each page says who vouches for it and when they
last did.

## The fields

On the page (`Tab.wiki`): `owner` (a person with access to the wiki), `verifiedAt`, `verifiedBy`, `reviewEvery`
(30, 90, 180 or 365 days; 90 by default; "Never" for pages that do not age).

## States

| State              | When                                                              | Shows as                                  |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------- |
| **Verified**       | `verifiedAt` is set and the review is not yet due                 | a green tick, "Verified by <name>"        |
| **Review Due**     | `verifiedAt + reviewEvery` has passed                             | an amber "Review Due" pill                |
| **Never Verified** | no `verifiedAt`                                                   | nothing on the page; grey in the counts   |

- States are worked out when read, from the fields and the clock; nothing is written when a review comes due.
- The tick or pill sits in the page's meta row under the title, in the page tree row and on every page link's hover
  card. The meta row also says "Review due <date>" and "Edited <when> by <name>".
- **Verify** (meta row, tree row menu, the Page Health card) sets `verifiedAt` to now and `verifiedBy` to the person.
  A page with no owner takes the verifier as its owner. Verify is one press; it never asks for confirmation.
- Writing on a verified page does not clear the tick. A large change (more than a fifth of the writing's characters
  since `verifiedAt`) adds "Changed since verified" beside it, until someone verifies again.
- **Page Health** (right rail): owner (changeable), last verified, review interval (changeable), reads by people and
  by agents this week, and Verify Again.

## Reminders

- The [Wiki Home](wiki-home.md) lists **Yours to Review**: pages you own that are due, oldest first, each with
  **Still Right** (verifies it) and a link to the page.
- An owner gets one email when a page of theirs comes due, batched to at most one email a day, through the platform's
  email package. It honours the account's email settings. No email is sent for wikis kept Offline.

## Share roles

Verify, change owner and change the review interval: Editor only. Everyone sees the states.
