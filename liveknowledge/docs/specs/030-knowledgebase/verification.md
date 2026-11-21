# Verification

Status: **the states, Verify, the meta row, the tree's tick, Page Health and the Review Period are built, not yet
verified in a browser** ([Build plan](../005-project-roadmap/build-plan.md) step 7;
[blueprint](blueprints/knowledge-ui.md)). Not built: "Edited <when> by <name>" (no route says when a page's writing
was last edited, or by whom). The Review Due email is built and tested over
a fake sender, not yet sent from a deployed Worker. A guest may verify too, shown as "Verified by Guest" and never made the page's owner (owner, 2026-11-21), and a knowledgebase kept Offline has
none.

A knowledgebase is only useful, to a person or to an agent, while it is right. Each page says who vouches for it and when they
last did.

## The fields

On the page (`Tab.knowledge`): `owner` (a person with access to the knowledgebase), `verifiedAt` and `verifiedBy`.

**The owner** of a new page is the person who created it (owner, 2026-11-21): the save that makes a page sets
`owner` to its writer, and an Editor changes it in Page Health. A page made before this, or by an agent or an import,
has no owner until someone picks one or verifies it.

**Created and Updated** (owner, 2026-11-21, "like we do on cards in liveplanner"): the knowledgebase keeps who
created each page and who last saved it, with when (`page_authors` in its Durable Object, schema step V17). The first
person whose save makes the page is its creator for good; each later save by a person that changes the page moves "updated" (an editor saving back what it already holds changes nothing, so an agent's edit stays the agent's). A page not
saved since the table began has no row and shows neither: nothing is guessed. Page Health's read answers them as
`created` and `updated`.

**Made by a person or an agent** (owner, 2026-11-21: badges under the title, "AI Generated" or "Human Generated" and
"AI Edited" or "Human Edited"). Each of the two stamps also says what kind of writer made it (schema step V18):

- **An agent** is any write made with an API token: the MCP server's tools, the CLI and the api called with a token
  (`create_page`, `write_page`, a changeset, a version restore or copy, and an import run by a token). The stamp
  keeps the token's name ("Claude", "Release bot") where the platform told the api it, and the door it came through
  (MCP, CLI or the API). The person who made the token is the stamp's `by`.
- **An agent's suggestion, accepted** by an Editor, is an agent's edit too: its words are the agent's. The stamp
  names the suggesting agent and is `by` the Editor who accepted it.
- **A person** is every other save: the editor's saves, an Import run in the editor, Describe to Set Up's pages.
- A stamp from before V18 was always a person's (V17 noted people's saves only), and reads as one.
- The meta row shows two small quiet pills for a page that has a row, after the reading time: **AI Generated** or
  **Human Generated** (who made the page), then **AI Edited** or **Human Edited** (who changed it last). A page whose
  last change is its making shows the second too, from the same stamp. A sparkle icon marks an agent's, a person
  icon a person's. Each opens a hover card: "Created by an agent through MCP", "Created by Claude through MCP on
  12 Nov", "Last edited by Priya Shah, 3 hours ago", "Last edited by Claude, from a suggestion Priya Shah
  accepted". A page with no row shows neither pill. The pills are neutral grey, never the accent or a state colour,
  so they never read as a warning.
- Every role sees them, as Page Health's foot.

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
- **Verify** (the Page Health card in the right rail, or behind Page Info on a narrower window, the tree row menu,
  and a quiet **Verify** in the meta row after Add Cover, owner 2026-11-21) sets `verifiedAt` to now and `verifiedBy`
  to the person. The meta row's asks first, in a popover under it: "Verify This Page?" (or "Verify This Page Again?"),
  what verifying means ("You are vouching that this page is right as it stands today. Readers and agents see it as
  Verified, and it comes due for review again in 90 days."), "It has no owner yet, so you become its owner." where that
  is so, then **Cancel** and **Verify**. The rail's and the menu's stay one press.
  A page with no owner takes the verifier as its owner.
- An agent never rewrites a page that is Verified or Review Due, whatever it was granted: it suggests the edit, and
  a person accepts it ([Knowledgebase for agents](../024-agents/knowledgebase-for-agents.md)). A due page is the
  one most likely to need a person's eye.
- Writing on a verified page does not clear the tick. A large change (more than a fifth of the writing's characters
  since `verifiedAt`) adds "Changed since verified" beside it, until someone verifies again.
- **Page Health** (right rail): owner (changeable), last verified, when the review is due, reads by people and
  by agents this week, and Verify Again; at its foot, who created the page and who last updated it, each the
  person's initials disc, their whole name, and under it "Created 3 days ago" or "Updated 7 mins ago", as a liveplanner
  card's footer.
- **How the rail looks** (owner, 2026-11-21: "really amazing, but also not distracting; at the moment it's boxy and
  boring"): no card and no borders, the page's own ground under it, sections headed by small capitals as On This
  Page is. Page Health leads with the page's state beside a thin **freshness ring**, the share of the Review Period
  left, in the state's colour (green verified, amber due, an empty dashed ring for a page never verified), with one
  line under it: "Fresh for 80 more days", "Was due 14 Jan", "Verify once it's right." The week's reads are two
  quiet figures (people, agents) under "Read This Week". The ring fills over 200 ms when it changes (the chrome motion budget), and not
  at all with reduced motion. (Redesigned 2026-11-21, "it's rubbish": the state, its line and Verify sit in a soft
  panel washed in the state's colour; the facts below each have a glyph; **Read This Week** (a panel on the theme's tint, a quiet open book drawn behind its two counts) and Created / Updated
  are the rail's foot, held at its bottom while the rest scrolls, the Page Info card showing them last; Created /
  Updated sit above Read This Week (owner 2026-11-21).) **Order** (owner 2026-11-21): Page Health first, On This Page
  under it. **AI
  Context** follows Page Health, before the foot, in the same quiet style ([AI Knowledge](ai-knowledge.md) "AI
  Context on a page").
- **The meta row** under the title is drawn only when it has something to say (a tick or pill, a due date, an edit,
  how long it takes to read, who made and edited it, Add Cover): an empty page never verified has no row, so the writing starts right under the title.
- **Reading time** sits in the meta row (owner, 2026-11-21: "1 min read should go under the page title, not the
  sidebar"), a small clock then "4 min read", counted at 230 words a minute from the committed writing; none for an
  empty page. The right rail no longer shows it. **Add Cover** follows it, for whoever may change the page's cover
  ([The page surface](page-surface.md) "The cover").

## The Review Period

- **Knowledgebase Settings > Reviews** (the knowledgebase's menu), Editor only (never a Participant): **Review
  Period**, a row of five choices (Every 30 Days, Every 90 Days, Every 180 Days, Every Year, Never) with one line
  under it saying what it does: "A verified page comes due for review this long after it was last verified."
- Changing it changes when every page comes due, at once: states are worked out when read, so nothing is rewritten.
  The dialog says how many pages the new period makes due before it is applied when that number grows ("12 pages
  will be due for review"), and applying is one undoable edit.
- **Never** means no page is ever Review Due: pages are Verified or Never Verified, and no review email is sent.
- Page Health shows the page's due date and the knowledgebase's period ("Every 90 Days"), read-only for everyone
  (owner 2026-11-21: the period is changed in Knowledgebase Settings, not the sidebar).

### The Review Period, as built

- **Ways in.** The command palette's **Knowledgebase Settings** and the
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
- **Page Health** has two rows for it: **Review Due** (the date; "Not Verified" for a page never verified; "No
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

Verify and change a page's owner: an Editor or a Participant. Change the Review Period: an Editor only, as all of
Knowledgebase Settings ([Knowledgebases and pages](knowledgebases-and-pages.md#share-roles)); everyone sees the
period in Page Health, with no Change link. Everyone sees the states.

A writer may also ask someone else to vouch for a page before it is trusted: [Approval](approval.md). Approving a
page verifies it.
