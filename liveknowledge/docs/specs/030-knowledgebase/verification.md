# Verification

Status: **the states, Verify, the meta row, the tree's tick, Page Health and the Review Period are built, not yet
verified in a browser** ([Build plan](../005-project-roadmap/build-plan.md) step 7;
[blueprint](blueprints/knowledge-ui.md)). Not built: "Edited <when> by <name>" (no route says when a page's writing
was last edited, or by whom). The Review Due email is built and tested over
a fake sender, not yet sent from a deployed Worker. A guest may verify too, shown by their name with "(Guest)" after it ("Verified by Bright Marlin (Guest)", or "Guest" with no name) and never made the page's owner (owner, 2026-11-21); the same name marks a guest's Created and Updated stamps, the api swapping a guest's owner id (a credential, never sent to readers) for "guest:<name> (Guest)" from their profile as the page's health is read (a save stamps a guest by the name they edit under from the start, as Verify does, since a guest seldom has a profile; owner 2026-11-22), and the rail and the header's discs read the page again after a save, a peer's included, and a knowledgebase kept Offline has
none.

A knowledgebase is only useful, to a person or to an agent, while it is right. Each page says who vouches for it and when they
last did.

## The fields

On the page (`Tab.knowledge`): `owner` (a person with access to the knowledgebase), `verifiedAt` and `verifiedBy`.

**The owner** of a new page is the person who created it (owner, 2026-11-21): the save that makes a page sets
`owner` to its writer, and an Editor changes it in Page Health. A page made before this, or by an agent or an import,
has no owner until someone picks one or verifies it. The api sets it on every path that makes a page, from the
request's credentials and never from what the page says: the create that makes a knowledgebase with its first pages
(/new, a structure's Start Here, the workbench's create in place, an Offline knowledgebase's sync), and the first save
of a page added later (a structure's pages, New Page, Add Subpage). The writer is a signed-in person, or the person
behind a workbench session; an agent's token, a guest and a link visitor make pages with no owner. An import's pages
are marked by the editor as taking none (`unowned`, never stored). A page already stored keeps its fields, and a page's
fields sent in a create are never taken. The editor that made the page sent no owner, so the api tells every open
editor, its maker's included, as the same `tab-meta` patch a Page Health change sends: Page Health names the owner at
once, with no reload.

**Created and Updated** (owner, 2026-11-21, "like we do on cards in liveplanner"): the knowledgebase keeps who
created each page and who last saved it, with when (`page_authors` in its Durable Object, schema step V17). The first
person whose save makes the page is its creator for good; each later save by a person that changes the page moves "updated" (an editor saving back what it already holds changes nothing, so an agent's edit stays the agent's). A page not
saved since the table began has no row and shows neither: nothing is guessed. Page Health's read answers them as
`created` and `updated`. Every reader sees the people by name (owner 2026-11-21: a Viewer through a link saw "Guest" and "Someone"):
the read also answers `names`, the profile name of each account the page names (its creator, its last writer, its
editors, its owner and who verified it), from one profiles read, so a reader outside the team names them as a member
does.

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
  last change is its making shows the second too, from the same stamp. When the same kind of writer made the page
  and changed it last, one pill says both: **Human Authored** or **AI Authored** (owner 2026-11-21, was "Written"), its hover card giving both lines
  (owner 2026-11-21: "if both human created and human edited, just use one badge"). A sparkle icon marks an agent's, a person
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
- The tick or pill sits in the page's meta row under the title, on every page link's hover
  card. The meta row also says "Edited <when> by <name>"; "Review due <date>" rides the badge's hover (and a screen
  reader's reading of it), so the row stays one line (owner 2026-11-21).
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
- **Page Health** (right rail): owner (changeable), last verified (one line: the date, then the verifier's disc,
  named on hover; owner 2026-11-21; Page Health is read again 1.5 s after each Save, this person's or a
  peer's, so Updated moves without a reload), when the review is due, reads by people and
  by agents this week, and Verify Again; at its foot, who created the page and who last updated it, each the
  person's initials disc, their whole name, and under it "Created 3 days ago" or "Updated 7 mins ago", as a liveplanner
  card's footer.
- **How the rail looks** (owner, 2026-11-21: "really amazing, but also not distracting; at the moment it's boxy and
  boring"): no card and no borders, the page's own ground under it, sections headed by small capitals as On This
  Page is. Page Health leads with the page's state beside a thin **freshness ring**, the share of the Review Period
  left, in the state's colour (green verified, amber due, an empty dashed ring for a page never verified), with one
  line under it: "Fresh for 80 more days", "Was due 14 Jan", "Verify once it's right." The week's reads are two
  quiet figures under "Read This Week", reads not readers ("9 by People", "2 by Agents": no reader's identity is kept). The ring fills over 200 ms when it changes (the chrome motion budget), and not
  at all with reduced motion. (Redesigned 2026-11-21, "it's rubbish": the state, its line and Verify sit in a soft
  panel washed in the state's colour; a hairline under Score Breakdown (owner 2026-11-22); the facts below (Owner down to Approval) each have a glyph and fold under the state's panel as **Page Details**, closed by default like Score Breakdown (owner 2026-11-22); **Read This Week** (a panel on the theme's tint, a quiet open book drawn behind its two counts) and Created / Updated
  are the rail's foot, held at its bottom while the rest scrolls, the Page Info card showing them last; Created /
  Updated sit above Read This Week (owner 2026-11-21).) **Order** (owner 2026-11-21): Page Health first, On This Page
  under it. **AI
  Context** follows Page Health, before the foot, in the same quiet style ([Insights](ai-knowledge.md) "AI
  Context on a page"). **Page Insights**, the page's reads over 30 days, how often Ask cited it and the questions it
  answered, sits just before AI Context, in the same style ([Insights](ai-knowledge.md#page-insights)).
- **The meta row** under the title is drawn only when it has something to say (a tick or pill, a due date, an edit,
  how long it takes to read, who made and edited it, Add Cover): an empty page never verified has no row, so the writing starts right under the title.
- **Reading time** sits in the meta row (owner, 2026-11-21: "1 min read should go under the page title, not the
  sidebar"), a small clock then "4 min read", counted at 230 words a minute from the committed writing; none for an
  empty page. The right rail no longer shows it. **Add Cover** follows it, for whoever may change the page's cover
  ([The page surface](page-surface.md) "The cover").

## Health Score

Owner, 2026-11-21: "Page Health should provide a score per page in the sidebar, taking into account verification,
age, length and more", and "MCP and AI should use it to judge the accuracy of the information provided, it isn't
just a score for humans reading the page". Every page has a **Health Score**, 0 to 100: how far a reader, a person
or an agent, can lean on it. One pure function (`pageHealth`, @liveknowledge/knowledge) works it out from the page's
facts and the clock, in the editor and in the api alike, so a person and an agent always see the same number.
Nothing is stored: it is worked out when read, as the states are.

**The formula.** Eight factors, each a whole number of points, summed (never below 0 or above 100):

| Factor       | Points | Full when                                                           | Less when                                                                                                                                                                                                                                                                                                    |
| ------------ | ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verification | 30     | Verified, the review not yet due                                    | Review Due 10; Never Verified 0                                                                                                                                                                                                                                                                              |
| Freshness    | 20     | 10: the share of the Review Period left; 10: touched lately         | Review left: 10 times the share left (all 10 under Never; none when due or never verified). Touched: the later of the last edit and the last Verify; 10 within 90 days, then down evenly to 0 at 455 days. A page with no edit kept and never verified counts from nothing: the full 10 (nothing is guessed) |
| Owner        | 10     | Someone owns it                                                     | No owner 0                                                                                                                                                                                                                                                                                                   |
| Length       | 10     | 50 words or more                                                    | Empty 0; under 20 words 3; under 50 words 6                                                                                                                                                                                                                                                                  |
| Structure    | 10     | Under 300 words, or any heading                                     | 300 to 2,500 words with no heading 5; over 2,500 words with no heading 0                                                                                                                                                                                                                                     |
| Links        | 5      | No broken page link, and another page links here                    | 4 with no backlink; each broken link (to a page no longer in the knowledgebase) takes 2 of the 4                                                                                                                                                                                                             |
| Open Issues  | 10     | Nothing open on the page                                            | Each open conflict ([Pages That Disagree](ai-knowledge.md#pages-that-disagree)) 5; Pending Approval 2; each unresolved comment thread 1 (3 at most); each agent's suggested edit waiting 1 (2 at most)                                                                                                       |
| Use          | 5      | Read this week, by a person or an agent; or made in the last 7 days | Not read this week 0 (a page in its first week is never marked down for it)                                                                                                                                                                                                                                  |

- **Under a Review Period of Never** (owner 2026-11-21: "if I set no review period, / never, then don't show the
  verification stuff, and don't include it in the health scorings"): the score leaves verification out. There is
  no Verification factor, Freshness counts only the last edit (10 within 90 days, down evenly to 0 at 455; no edit
  kept, the full share), and the seven factors left are re-weighted to 100: **Freshness 15, Owner 15, Length 15,
  Structure 15, Links 10, Open Issues 20, Use 10**. Each factor is worked out as above, scaled to its new weight and
  rounded (its gain too), so the factors still add up to the score. A page is never marked down, given a reason
  or offered a fix for not being verified: the breakdown has no Verification row and no Verify button, Freshness
  says "Bring it up to date" and "Not edited in 14 months". Knowledge Health's average and low pages, the agents'
  `health` and Ask's passages follow the same rule, so no agent is told a page is unverified. The rest of what
  Never hides is [Under a Review Period of Never](#under-a-review-period-of-never).
- **The word:** 75 and over is **Healthy** (green, the verified palette), 45 to 74 **Fair** (amber, Review Due's),
  under 45 **Needs Work** (rose). The word always shows beside the number: colour is never alone.
- **Bands, not every word:** length and structure count in bands (empty, under 20, under 50, under 300, up to
  2,500, more), so typing a word changes the score only when it crosses a band, and a typing commit inside one works
  nothing out again. Words are counted as reading time counts them (230 a minute; [Reading time](#page-health)).
- **The main reason** is the factor that lost the most points (the first in the table's order on a tie), in a few
  words: "Never verified", "Review due 40 days ago", "2 broken links", "No owner", "Under 50 words", "No headings
  in a long page", "1 open conflict", "Pending approval", "3 open comments", "Not read this week", "Not touched in
  14 months". A page with every point says "Every check passes".
- **Each factor says what would raise it** with the points it gains: "Verify this page: +30", "Verify again: +20",
  "Set an owner: +10", "Add a heading: +5", "Write at least 50 words: +4", "Fix 2 broken links: +4", "Resolve the
  conflict: +5". A factor at full says nothing.
- **Not counted:** unanswered questions a page is cited for. A question nobody could answer is logged with no page
  (it found none), so no page can be held to it.

### In Page Health

- **At the top of Page Health**, above the state panel: the score as a large figure in a small ring that fills to
  it (the ring's colour is the word's; the 200 ms fill follows the freshness ring's, none with reduced motion),
  then the word, then the main reason on one line.
- **The breakdown** opens under it, closed by default (owner's convention: closed accordions). The score itself is
  the disclosure: pressing anywhere on it opens and closes the breakdown, a chevron at its end turning (owner
  2026-11-22: no Score Breakdown row, and no "Health Score" word after the score's word). Likewise pressing the
  Verified panel anywhere but its own controls opens and closes Page Details, its chevron the keyboard's way in. Open, it lists the eight factors in the table's order, each with its points of its maximum
  ("8 / 10") and, where it is short, what would raise it. Where a fix is a press away it is a small button on the
  row: **Verify** (Verification, and Freshness when the review is due), **Set an Owner** (opens the Owner picker
  beside it), **Add a Heading** (opens the page for editing if it is not, then puts an empty level-two heading after the block
  the caret is in, under the title when the writing was not yet clicked into, the caret in it). Open issues each
  have a way to them for anyone who can read the page (owner 2026-11-22: a conflict could not be found from here):
  **Show Conflicts** (Insights' Needs Attention at Disagreements), **Show Comments** (scrolls to the page's
  comments), **Show Suggested Edits** (brings the rail's Suggested Edits into view). The rest read as text (a broken
  link is fixed in the writing). Score Breakdown and Page Details slide open and closed (200 ms; reduced motion
  snaps).
- **Roles:** everyone who can read the page sees the score, its word, its reason and the breakdown. The buttons are
  only for those who may do them: Verify and Set an Owner for an Editor or a Participant (as Verify and the owner
  are), Add a Heading for anyone who may change the page's writing. A Viewer reads the same rows with no buttons.
- **What it is worked out from, in the editor:** the page's fields and the Review Period as the state is, the
  committed writing (words, headings and page links, against the pages the editor holds), and Page Health's read:
  the week's reads and Created / Updated, which it already holds, and `signals` (open conflicts, unresolved
  threads, suggested edits waiting, backlinks), four counts the same read now answers. No request more: the score
  is there once Page Health is read, and before it the page's own facts give it, the read's counts as none.
  The same read carries the page's suggested edits themselves and the pending count of every page the reader may see
  ([Insights](ai-knowledge.md) "On the page"), so the meta row's pill, the rail's Suggested Edits and the tree's
  dots need no request of their own.
- **Kept Offline:** no room, so no signals and no reads: the score counts what the page itself holds (verification,
  freshness, owner, length, structure, broken links), Links' backlink point and Use as full, Open Issues as none,
  and the breakdown says "Kept in this browser: reads and open issues are not counted."
- **Phone:** the same, in the Page Info sheet.
- **Not in the page tree.** A score dot beside each tree row is not built: the tree holds each page's fields and
  title but not its words, headings or Page Health's counts, so a dot would need every page's writing walked in the
  editor, or one more read of the knowledgebase's scores (the overview's, below) on every open.

### For agents and Ask

- `read_page`, `search_pages` (each result) and `get_context` (each page) carry `health: { score, label, reason,
factors }` beside `verified` and `stale`: `label` is `healthy`, `fair` or `needs-work`, each factor `{ factor,
points, max }` and, when short, `raise`. The CLI's `read`, `search` and `context` say "health 42 (needs work: never
  verified)" on the trust line.
- The tools' descriptions, the MCP server's instructions and the CLI's knowledgebase guide tell an agent: weigh a
  passage from a low-scoring page as less reliable; when pages disagree, prefer the higher-scoring one; and say so
  to the person ("this comes from a page with a low health score: never verified and 14 months old").
- **Ask** hands the model each passage with its page's score and word; the system prompt says to prefer
  higher-scoring sources and to flag a low-scoring one in the answer. Each source card shows its page's score
  beside its trust ([Search and Ask](search-and-ask.md) "Sources").
- **Cost:** the api works the score out from one read for the pages it answers, never a read a page: one statement
  over the room's own tables (the index's words, headings and owner, `page_trust`, the link table, threads,
  approvals, conflicts, suggestions, the week's reads, the authors), for a set of pages (a search's, chunked at 50)
  or every page (the overview's). Measured in the [blueprint](blueprints/knowledge-package.md#page-health).

## The Review Period

- **Changed from Page Health**, in the Review Period row, by an Editor of the whole knowledgebase only (never a
  Participant, a Viewer or a link to one page): the value itself ("Every 90 Days") is a link (owner 2026-11-22, was a
  pencil before it), named "Change Review Period: Every 90 Days", its hover card saying it changes the period for
  the whole knowledgebase. It opens a small panel, **Review Period**, that says
  it applies to every page in this knowledgebase, then five choices (Every 30 Days, Every 90 Days, Every 180 Days,
  Every Year, Never) with one line saying what they do: "A verified page comes due for review this long after it
  was last verified." (owner 2026-11-21: the Review Period was the only setting, so Knowledgebase Settings is gone;
  its dialog, its row in the knowledgebase's menu and its command palette entry with it).
- Changing it changes when every page comes due, at once: states are worked out when read, so nothing is rewritten.
  The panel says how many pages the new period makes due before it is applied when that number grows ("12 pages
  will be due for review"), and applying is one undoable edit.
- **Never** means no page is ever Review Due and verification is off: no page is marked or offered Verify, and no
  review email is sent ([Under a Review Period of Never](#under-a-review-period-of-never)).
- Page Health shows the page's due date and the knowledgebase's period ("Every 90 Days") to everyone; only the
  Editor sees it as a link.

### The Review Period, as built

- **The way in** is Page Health's Review Period link alone. No menu row and no command: the period is read where it is
  shown, and a command would have to open a panel anchored on a rail that may be folded away.
- **The panel** opens under the link (a sheet on a phone), 360 px wide and of one height whatever it shows. It is
  headed **Review Period** with the line that says what the period does, then a tinted line, "Applies to every
  page in this knowledgebase.", before the choices. The five
  choices are bordered single-choice rows, the chosen one ticked. A shorter period is counted first; when it
  would make more pages due than are due now, a strip under the rows says "12 pages will be due for review with
  Every 30 Days." with **Apply** and Cancel. A shorter period that makes no more pages due, a longer one and Never
  apply at once. Closing the panel ends a count still running.
- **Undo** is the **Undo** in the toast that says the period was applied ("Pages are now reviewed every 30
  days."): it applies the period that was replaced. The editor's own undo (Cmd or Ctrl Z) holds a page's writing,
  not the knowledgebase's Review Period, and does not reach it.
- **A refusal** puts the period back and says why in a toast, in words.
- **Page Health** has two rows for it: **Review Due** (the date; "Not Verified" for a page never verified; not
  drawn under Never) and **Review Period** ("Every 90 Days", "Never", with the pencil before it for an Editor).
- **The api:** `PUT knowledge-settings` (Editor, in person or a token granted `write`), `GET knowledge-settings`,
  and `GET knowledge-settings/preview?reviewEvery=` for the count. `PUT pages/<tab>/knowledge` refuses a
  `reviewEvery` and says where the setting lives.
- **Agents** are told the period once (`review_period` on `get_context` and `list_pages`); no tool sets it.
- **Emails.** The Review Due and reminder emails say "This knowledgebase reviews pages every 90 days." A page is
  told of once for each verification's review: changing the period never tells an owner twice of the same one.
- **Kept Offline,** a knowledgebase keeps its period in this browser and takes it along when it is synced.
- **It travels** with a copy of the whole knowledgebase, its export and Drive file, and a snapshot.

## Under a Review Period of Never

Owner, 2026-11-21: "if I set no review period, / never, then don't show the verification stuff, and don't include
it in the health scorings". A knowledgebase whose Review Period is **Never** has **verification off**: no page is
shown as Verified, Review Due or unverified anywhere, to a person or to an agent, and nobody is offered Verify.
Nothing stored changes: each page keeps its `verifiedAt` and `verifiedBy`, so setting a period again brings every
mark back, the pages' dates as they were. The Health Score already leaves verification out
([Health Score](#health-score)); the rest follows the same rule, so the score and every surface agree.

- **The state is `off`.** Worked out when read, as the states are: under Never a page's state is `off` (never
  `verified` or `never-verified`), in the editor and in the api alike. Every reader of a page's trust takes `off` as
  "say nothing of verification".
- **Page Health** keeps the score, **Owner**, **Review Period** ("Never", with the Editor's pencil, so the period can
  be set again from where it is turned off) and Approval. It draws no state panel (no freshness ring, no "Not
  Verified" or "Verified"), no **Last Verified**, no **Review Due** and no **Verify** or **Verify Again**.
- **The meta row** shows no Verified tick, no Review Due pill, no "Review due" on hover and no "Changed since
  verified", and no **Verify**. The row is drawn only when the rest of it has something to say.
- **The page tree** shows no tick or pill on a row, and its row menu has no **Verify**. A page link's hover card
  and a search result show no badge.
- **Ask:** a source card shows no trust badge, the passage's words and its Health Score only; the answer's trust line
  ("Answered From 3 Verified Pages") is not drawn. The model is handed each passage with its health and no trust,
  and is told nothing of verification for it. Passages are chosen by rank alone (no verified page goes first).
- **Search** ranks by match alone (no verified page goes first), and its results carry `off`.
- **Insights:** the figures band's sixth tile is **Average Health** (the average Health Score, "Across 24
  pages"), not Verified; Knowledge Health leads with the average score, keeps **Pages With Low Health**, and draws no
  verified share, no Verified / Review Due / Never Verified bar or legend and no **Remind the Owners**; a conflict's
  sides show no trust, only their Health Scores.
- **Agents:** the trust fields keep their shape. `verified` is `off`, `stale` is false, and there is no
  `verified_at`, `verified_by` or `review_due`; `review_period` is `never` as before. The CLI's trust line says
  "verification off". The tools' descriptions and the MCP server's instructions say what `off` means: this
  knowledgebase does not verify pages, so weigh a page by its health alone.
- **An agent's rewrite** of a page a person verified before the period was set to Never is still refused
  (`page_verified`): a person vouched for it, and turning verification off is no grant to rewrite it. The refusal
  says so in words: "A person verified this page before verification was turned off, so an agent does not rewrite
  it. Suggest the change instead with suggest_edit, for a person to accept."
- **Verify** (`POST .../verify`) still answers under Never, for an api caller that sends it; the editor offers it
  nowhere. Approving a page still verifies it, as [Approval](approval.md) says; the mark shows once a period is set.
- **Emails:** no Review Due email is sent (as before), and Remind the Owners has nothing to send: the route answers
  that verification is off (`verification_off`) and sends nothing.
- **Home:** Yours to Review is empty under Never (no page is due), as before.

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
  Remind the Owners, which [Insights](ai-knowledge.md) specifies, and [Required Reading](required-reading.md#remind)'s Remind). The knowledgebase keeps no address.
- Only someone who can still open the knowledgebase is emailed: its own owner, a joined member of its team, or
  someone the index still grants it to. An owner who is a guest has no address and gets none.
- The three emails together are at most 50 a knowledgebase a day; an owner the ceiling leaves out is emailed the
  next day. A deployment that sends no email sends none of them.
- Nothing is sent when a page is written: the knowledgebase's room wakes by its own alarm when the next review
  comes due, and after a page is verified or the Review Period changes.
- No email is sent for a knowledgebase kept Offline: it lives in one browser and has no room to send from.
- Someone who [watches](watching.md) a page hears when its review comes due (**Verification Lapsed**), in the Inbox
  and their digest, whoever owns it; the same check notes it, with email off too.

## Share roles

Verify and change a page's owner: an Editor or a Participant, in person or through a workbench, never an agent
(`needs_a_person`). A version restore keeps the page's own fields, and a version's copy is a new page with none: no
Verify, owner or approval rides a version. Nor does any ride the room from a person's or a token's socket: an open
editor hears a page's fields only from the api, after it stored them, so no writer can make a page look Verified,
owned or unverified on anyone's screen. Change the Review Period: an Editor only
([Knowledgebases and pages](knowledgebases-and-pages.md#share-roles)); everyone sees the period in Page Health, and
only an Editor sees its pencil. Everyone sees the states.

A writer may also ask someone else to vouch for a page before it is trusted: [Approval](approval.md). Approving a
page verifies it.
