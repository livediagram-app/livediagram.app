# Verification

Status: **the states, Verify, the meta row, the tree's tick, Page Health and the Review Period are built, not yet
verified in a browser** ([Build plan](../005-project-roadmap/build-plan.md) step 7;
[blueprint](blueprints/knowledge-ui.md)). Not built: "Edited <when> by <name>" (no route says when a page's writing
was last edited, or by whom). The Review Due email is built and tested over
a fake sender, not yet sent from a deployed Worker. Verify needs an account, and a knowledgebase kept Offline has
none.

A knowledgebase is only useful, to a person or to an agent, while it is right. Each page says who vouches for it and when they
last did.

## The fields

On the page (`Tab.knowledge`): `owner` (a person with access to the knowledgebase), `verifiedAt` and `verifiedBy`.

On the knowledgebase (`knowledgeSettings.reviewEvery` in the document's metadata): the **Review Period**, one for
every page (owner, 2026-11-20: "Review Period should be a knowledgebase setting, not per page"): 30, 90, 180 or 365
days, 90 by default, or **Never** for a knowledgebase whose pages do not age. A page has no review period of its
own.

## States

| State              | When                                              | Shows as                                |
| ------------------ | ------------------------------------------------- | --------------------------------------- |
| **Verified**       | `verifiedAt` is set and the review is not yet due | a green tick, "Verified by <name>"      |
| **Review Due**     | `verifiedAt` plus the Review Period has passed    | an amber "Review Due" pill              |
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
- **Page Health** (right rail): owner (changeable), last verified, when the review is due, reads by people and
  by agents this week, and Verify Again.

## The Review Period

- **Knowledgebase Settings > Reviews** (the knowledgebase's menu), Editor only: **Review Period**, a row of five
  choices (Every 30 Days, Every 90 Days, Every 180 Days, Every Year, Never) with one line under it saying what it
  does: "A verified page comes due for review this long after it was last verified."
- Changing it changes when every page comes due, at once: states are worked out when read, so nothing is rewritten.
  The dialog says how many pages the new period makes due before it is applied when that number grows ("12 pages
  will be due for review"), and applying is one undoable edit.
- **Never** means no page is ever Review Due: pages are Verified or Never Verified, and no review email is sent.
- Page Health shows the page's due date and, for an Editor, a link to the setting ("Every 90 Days, Change"); it has
  no control of its own.

### The Review Period, as built

- **Ways in.** Page Health's **Change** link, the command palette's **Knowledgebase Settings**, and the
  knowledgebase menu's **Knowledgebase Settings** row (the menu takes it from `useKnowledgebaseSettings()`).
- **The dialog** is titled **Knowledgebase Settings**, centred, of one height, with one section, **Reviews**. The
  five choices are bordered single-choice rows, the chosen one ticked. A shorter period is counted first; when it
  would make more pages due than are due now, a strip under the rows says "12 pages will be due for review with
  Every 30 Days." with **Apply** and Cancel. A shorter period that makes no more pages due, a longer one and Never
  apply at once.
- **Undo** is the **Undo** in the toast that says the period was applied ("Pages are now reviewed every 30
  days."): it applies the period that was replaced. The editor's own undo (Cmd or Ctrl Z) holds a page's writing,
  not the knowledgebase's settings, and does not reach it.
- **A refusal** puts the period back and says why in a toast, in words.
- **Page Health** has two rows for it: **Review Due** (the date; "Once Verified" for a page never verified; "No
  Review Period" under Never) and **Review Period** ("Every 90 Days", with **Change** on a line under it for an
  Editor: at the card's width "Every 180 Days, Change" does not fit one line beside its label, and a clipped value
  would cut the link off).
- **The api:** `PUT knowledge-settings` (Editor, in person or a token granted `write`), `GET knowledge-settings`,
  and `GET knowledge-settings/preview?reviewEvery=` for the count. `PUT pages/<tab>/knowledge` refuses a
  `reviewEvery` and says where the setting lives.
- **Agents** are told the period once (`review_period` on `get_context` and `list_pages`); no tool sets it.
- **Emails.** The Review Due and reminder emails say "This knowledgebase reviews pages every 90 days." A page is
  told of once for each verification's review: changing the period never tells an owner twice of the same one.
- **Kept Offline,** a knowledgebase keeps its period in this browser and takes it along when it is synced.
- **It travels** with a copy of the whole knowledgebase, its export and Drive file, and a snapshot.

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
  comes due, and after a page is verified or the Review Period changes.
- No email is sent for a knowledgebase kept Offline: it lives in one browser and has no room to send from.

## Share roles

Verify, change owner and change the Review Period: Editor only. Everyone sees the states.
