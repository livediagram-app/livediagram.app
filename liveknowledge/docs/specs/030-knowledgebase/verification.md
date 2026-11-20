# Verification

Status: **the states, Verify, the meta row, the tree's tick and Page Health are built, not yet verified in a browser**
([Build plan](../005-project-roadmap/build-plan.md) step 7; [blueprint](blueprints/knowledge-ui.md)). Not built: "Edited <when> by <name>"
(no route says when a page's writing was last edited, or by whom). The Review Due email is built and tested over
a fake sender, not yet sent from a deployed Worker. Verify needs an account, and a knowledgebase kept Offline has
none.

A knowledgebase is only useful, to a person or to an agent, while it is right. Each page says who vouches for it and when they
last did.

## The fields

On the page (`Tab.knowledge`): `owner` (a person with access to the knowledgebase), `verifiedAt`, `verifiedBy`, `reviewEvery`
(30, 90, 180 or 365 days; 90 by default; "Never" for pages that do not age).

## States

| State              | When                                              | Shows as                                |
| ------------------ | ------------------------------------------------- | --------------------------------------- |
| **Verified**       | `verifiedAt` is set and the review is not yet due | a green tick, "Verified by <name>"      |
| **Review Due**     | `verifiedAt + reviewEvery` has passed             | an amber "Review Due" pill              |
| **Never Verified** | no `verifiedAt`                                   | nothing on the page; grey in the counts |

- States are worked out when read, from the fields and the clock; nothing is written when a review comes due.
- The tick or pill sits in the page's meta row under the title, in the page tree row and on every page link's hover
  card. The meta row also says "Review due <date>" and "Edited <when> by <name>".
- **Verify** (meta row, tree row menu, the Page Health card) sets `verifiedAt` to now and `verifiedBy` to the person.
  A page with no owner takes the verifier as its owner. Verify is one press; it never asks for confirmation.
- An agent never rewrites a page that is Verified or Review Due, whatever it was granted: it suggests the edit, and
  a person accepts it ([Knowledgebase for agents](../024-agents/knowledgebase-for-agents.md)). A due page is the
  one most likely to need a person's eye.
- Writing on a verified page does not clear the tick. A large change (more than a fifth of the writing's characters
  since `verifiedAt`) adds "Changed since verified" beside it, until someone verifies again.
- **Page Health** (right rail): owner (changeable), last verified, review interval (changeable), reads by people and
  by agents this week, and Verify Again.

## Reminders

- The [Knowledgebase Home](knowledgebase-home.md) lists **Yours to Review**: pages you own that are due, oldest first, each with
  **Still Right** (verifies it) and a link to the page.
- An owner gets one email when pages of theirs come due: **Pages Due for Review**. It lists every page of theirs
  that is due (the first 100 by name, the rest counted, so the email is never clipped), each a link to its page,
  and goes at most once a day an owner a knowledgebase. A page is told of once for each review that comes due:
  verified again, it is told of again when that review comes due.
- It goes through the platform's notifier ([accounts.md "An app's own notices"](../../../liveworkspace/docs/specs/003-accounts/accounts.md#notification-emails)),
  to the owner's verified address, and only while their **Knowledgebase Reviews** setting is on (Settings, Account,
  Notifications; on by default; one switch for this email, a conflict's Ask Both Owners and Knowledge Health's
  Remind the Owners, which [AI Knowledge](ai-knowledge.md) specifies). The knowledgebase keeps no address.
- Only someone who can still open the knowledgebase is emailed: its own owner, a joined member of its team, or
  someone the index still grants it to. An owner who is a guest has no address and gets none.
- The three emails together are at most 50 a knowledgebase a day; an owner the ceiling leaves out is emailed the
  next day. A deployment that sends no email sends none of them.
- Nothing is sent when a page is written: the knowledgebase's room wakes by its own alarm when the next review
  comes due, and after a page is verified or its interval changes.
- No email is sent for a knowledgebase kept Offline: it lives in one browser and has no room to send from.

## Share roles

Verify, change owner and change the review interval: Editor only. Everyone sees the states.
