# Insights

Status: **the view is built as a dashboard and was seen in a browser on 2026-11-21** (every tile and card action
pressed, light and dark, 1440 to 390 wide; a conflict only through a stubbed read, since none can be found without a
key) ([Build plan](../005-project-roadmap/build-plan.md)
step 10). What is not built is under "Not built"; the [Insights UI blueprint](blueprints/insights-ui.md) has
the detail.

The knowledgebase's third tab, beside Pages and Ask: what agents know, where they learned it and what they could not find.
Most of it needs no model: it is bookkeeping the room already has.

## Connected agents

One card per agent that has read or written this knowledgebase in the last 30 days: its name (the MCP client's, else its
API token's label, the same name a page's Created and Updated give its writes, so a CLI connection is "Claude Code" on
both and never "Agent"; "MCP", "CLI" or "API Token" only for a connection with neither), how it connects, what it may do (**Reads**, **Suggests Edits**, **Writes**), pages read this week and the
three it read most. **Connect an Agent** opens the [Connect](mcp-connect.md) view: the steps for an AI app over the
MCP server, the CLI and tokens.

A new connection reads and suggests. An Editor allows one connection to write from its card's menu (**Allow
Writing**), and stops it there (**Stop Writing**); each asks first, saying what writing allows (replace a page's
writing and move pages, never on a page that is Verified or Review Due) and that it applies to this knowledgebase
only ([Knowledgebase for agents](../024-agents/knowledgebase-for-agents.md)).

An agent acts for a person or a token and can open only what they can: share roles apply to agents exactly as to
people.

## Reads

The room counts page reads by day, by reader kind (`person` or `agent`) and by agent, in its Durable Object
(`page_reads`), kept 90 days (with Pro on, the owner's AI Knowledge History, [Tiers](tiers.md)). A read is one open of a page in the editor, or one `read_page` or search result served
to an agent. No reader's identity is kept beyond the agent's name.
Opening a page in the editor, by its tree, a link or search, is counted as it opens (`GET pages/<tab>/health?opened=1`,
once a person a page a day), and Page Health's Read This Week is read again on every open, so it moves without a
reload (owner 2026-11-21).

The view's read answers the last 14 days' reads by day, people and agents apart (the sparkline and Reads This Week),
the 5 pages read most in the last 7 days with each one's reads by people and by agents (Most Read), and the pages
nobody read in the last 90 days (Not Read in 90 Days).

### Not Read in 90 Days

Owner, 2026-11-21: "isn't that already in Insights tab? if not add something useful". The pages to update, merge
or delete: every page with no read, by a person or an agent, in the last 90 days (all `page_reads` keeps), or in
the days the owner's tier keeps reads where fewer (30 on Free, "Not Read in 30 Days"; tiers.md). A page
made in the last 90 days is left out: it has not had 90 days to be read. Up to 10 are listed, the one touched
longest ago first (its last edit, else when it was made; a page with neither kept is older than both and leads,
ties in tree order), each with "Last edited 5 months ago" ("Last edit not kept" with none) and opening its page;
the card's count is all of them, and "4 more not listed" follows the tenth. With none: "Every Page Was Read",
saying every page older than 90 days was opened or read by an agent in that time. It comes from the overview's one
read: the facts statement Knowledge Health already runs answers each page's last read day (`MAX(day)` on the
`page_reads_tab` index), so it costs no request and no statement more. Every role that can see Insights sees
it; it changes nothing.

### Page Insights

A page's use over time, in its right rail (and its Page Info card and sheet), for everyone who can read the page.
Owner 2026-11-22: it is one with **Read This Week**. The 30 days of bars sit under the week's two counts, with
"30 days ago" and "Today" beneath (a page in its first week says its reads so far instead). The total, the key, and
the **Cited by Ask** and **Read by Agents** figures are gone from the rail. **Answered From This Page** stays, after
On This Page. What follows is what the read carries:

- **Reads, 30 days**: a bar a day for the last 30 days, people under agents in the dashboard's two tones, scaled to
  the page's busiest day, with the total ("128 reads in 30 days") and a key ("94 people, 34 agents"). One spoken
  label says it all: "Reads by day over the last 30 days: 94 by people, 34 by agents."
- **Cited by Ask**: how many times Ask's answer to a first question cited the page in the last 30 days
  (`page_answers`, the same count AI Context's questions are). Not shown through a link confined to one page,
  which has no Ask.
- **Read by Agents**: the agents' reads in the last 30 days (each `read_page`, and each search result an agent was
  served), from the same bars.
- **Answered From This Page** moves here from AI Context: the 3 questions it answered most, as before. With none it
  is not drawn.
- **A new page** (made in the last 7 days) shows **New This Week** and one line in place of the bars (the figures
  follow only once one is above zero): "Reads show here as people and agents open it." with no reads, else its reads so far ("3 reads so far: 2
  by people, 1 by an agent"). Never 30 days of bars mostly from before it was made: opening a page counts a read, so
  its maker would otherwise see one bar and 29 empty days. An older page with no reads in 30 days shows the empty
  bars (hairlines) and "No reads in 30 days".
- **The read.** Page Health's one read answers it (`insights`): the 30 days' reads by day and reader kind (a range
  of `page_reads_tab`, at most 60 rows), which also gives Read This Week, and the citations as a window total on
  the questions statement AI Context already runs. No request and no statement more than before.
- Kept Offline, there is no room: the section is not drawn.

| Action             | Editor | Participant | Viewer |
| ------------------ | ------ | ----------- | ------ |
| See Page Insights  | yes    | yes         | yes    |
| See Not Read in 90 | yes    | yes         | yes    |

## Questions nobody could answer

- A question is logged (`questions`) when Ask says the knowledgebase does not cover it, when a search by an agent returns
  nothing, or when an agent calls `report_gap`. Like questions are grouped (same words after stemming); the row shows
  the question and how many times it was asked, by people and by each named agent ("Asked 4 times by people and
  Coding Agent"). The count is of asks, not of distinct people: no asker's identity is kept.
- **Draft a Page** starts a page titled from the question, drafted from the nearest passages (on the team's key, or
  built-in AI without one: [Built-in AI](search-and-ask.md#built-in-ai)), marked "Draft, Not Verified" in its first
  line; when no AI can answer (no key and no built-in AI on the server, or the draft's call fails) it opens with the
  question as its first heading alone. While it drafts, the button shows a spinner and reads **Drafting…** (the call
  takes seconds). Once the page is made the question has a page, so its row leaves the list.
  **Dismiss** removes the row. A question also leaves the list once it is answered (owner 2026-11-21): when Ask later
  answers it in full from pages (a first question, citing pages, with no gap), and when a writer presses **Accept
  Answer** on a chat, which settles the chat's question and every gap its answers named.

## Pages that disagree

- When a page is verified or its writing is saved (at most once per page per 10 minutes), the
  room looks up passages on other pages that match its passages and asks the model whether any pair states opposite
  facts, on the team's key or, without one, on built-in AI. A found pair is a **conflict**: the question it answers, both passages, and each page's verified state.
- Resolving: **<Page> Is Right, Fix the Other** opens the other page with the passage selected and a margin note
  quoting the right one; **Ask Both Owners** emails them; **Not a Conflict** dismisses the pair for good.
- **Ask Both Owners** sends each owner of the two pages one email, **Two Pages Disagree**: the question, both
  pages by name with a link each, each passage as a plain text excerpt of at most 280 characters, and a link to
  this view. At most once a conflict (one person who owns both pages gets one email). It is a
  [Knowledgebase Reviews](verification.md#reminders) email: the same setting, the same check that the owner can
  still open the knowledgebase, the same 50 a day. The answer says what happened: sent to how many owners, already
  asked and when, nobody owns either page, the owners cannot be reached, the day's emails are spent, or this
  server sends no email.
- **The likely right one** (owner 2026-11-21): each side carries its page's Health Score, and when one side's score
  is higher by 10 or more, its row says "<Page> is more likely right (health 86 against 41)" and leads with that
  side's **Is Right, Fix the Other**. Closer than 10, it suggests neither. It is a suggestion: both buttons stay.
- A conflict closes by itself when either passage changes. Bounds: 50 checks a knowledgebase a day on a key, 20 on built-in AI;
  at most 5 candidate passages a check. Only a deployment with no built-in AI and a knowledgebase with no key has no
  check, and the section says so.

## Edits suggested by agents

An agent with the Suggests Edits scope never changes a page directly: its edit arrives as a changeset
([Agent changesets](../024-agents/agent-changesets.md)) with its reason. The card shows the page, the agent, the
change as removed and added lines, and **Accept**, **Open the Page**, **Dismiss**. Accepting applies it as one undo
step in the acceptor's name and does not verify the page; a page that was Verified stays Verified (its writing
changed, so it reads Changed since verified). An appended suggestion that is only table rows (no header) joins the
page's last table under its last row, never a paragraph of pipes (owner 2026-11-22).

### On the page

Built by Work Tracker 1362 to the approved mockup (owner, 2026-11-22): a suggestion is seen where it applies, not only
on Insights. Everything a suggestion draws on a page is in the Insights violet (violet-700 on violet-50, and
violet-300 on violet-500/15 in the dark theme), the colour Insights' own count wears, so it never reads as a
page's trust (green and amber) or a comment.

- **The page tree:** a page with suggestions waiting has an 8 px violet dot at the end of its row, before its trust
  mark, with a tooltip and a spoken label ("1 Suggested Edit", "3 Suggested Edits"). None at 0.
- **The meta row:** a **1 Suggested Edit** / **3 Suggested Edits** pill right after the verified badge, a pencil before
  its words and a pointer cursor, with no tooltip (the meta row's labelled buttons have none, owner 2026-11-23). Pressing it opens the
  first suggestion's popover (below) on its marked passage, or the rail's section when no passage is marked. None at 0.
- **The passage it replaces** is washed violet (the blocks it covers, a pale violet ground with a dashed violet
  underline), with a **margin marker**: a 28 px violet disc with a pencil, in the left margin at the passage's first
  line, labelled "Open the Suggested Edit". An appended suggestion (no passage, Markdown added at the end) marks the
  page's end instead: its marker sits by the writing's last block, which is not washed. The marker opens the
  **popover**, anchored to it: who suggested it ("Suggested by Claude") and when ("4 minutes ago"), the reason
  ("Why: ..."), the lines taken out (rose, struck, a minus) and put in (blue, a plus), **Accept**, **Show in Page**,
  **Dismiss**, and, on a page that is Verified now, **Stays Verified** at its right. A Close button and Escape close it.
  Several suggestions on one page each have their own wash and marker; two on the same passage share the first one's
  marker, which opens the newest.
- **Show in Page:** the change drawn in the writing itself: the passage's text struck through on a rose ground, and
  the text that arrives underlined on a blue ground right after it, under a violet bar across the top of the page:
  "**Reviewing Claude's suggestion.** Struck text goes, underlined text arrives. Nothing changes until you accept."
  with **Accept**, **Dismiss** and **Done**. Done (and Escape) return to reading with the page as it was; nothing is
  stored. Accept or Dismiss end the review too. Only one suggestion is shown in the page at a time.
- **The right rail:** a **Suggested Edits** section between Page Health and AI Context, its heading in violet with a
  count chip: a row per suggestion (the reason's first line, then "Claude, 4 min ago · 1 removed, 2 added"), pressing
  which opens its popover on the passage (or, with no passage marked, a popover of its own anchored to the row), and a
  **Review All in Insights** link that opens Insights filtered to Suggested Edits. Not drawn at 0.
- **A passage no longer found** (the page changed after the suggestion was made, so `before` is not in the page once,
  as it now reads) is never marked: no wash, no marker, nothing struck. The suggestion shows in the rail and its
  popover alone, which say "The page has changed since" in place of Show in Page; Accept is still offered and the api
  answers whether it still fits (409 `suggestion_stale`, said in words). The page is never marked in the wrong place:
  a passage is marked only where it reads, once, as the suggestion has it, its words matched with Markdown marks
  (`**`, `_`, backticks, a heading's `#`, a list's marker, a link's address) set aside.
- **A phone or narrow window:** the popover is a bottom sheet with the same content, its buttons 44 px tall; the
  review bar wraps under its words.
- **Reading once.** A page's suggestions ride its Page Health read, which a page already makes each time it opens
  ([Verification](verification.md) "Page Health"): no read of their own, and never polled. The same read carries the
  pending count of every page the reader may see, for the tree's dots. When a suggestion is made, accepted or
  dismissed the room tells its open editors (`suggestions-changed`, the pages' ids only), and each reads its open
  page's health again once: a new suggestion shows and a decided one goes without a reload. Accepting changes the
  writing as any save does, which every open editor sees at once.
- **The address:** `#t=<page>&suggestion=<id>` opens the page with that suggestion's popover open (the Inbox's Open,
  below); a suggestion no longer waiting opens the page alone.

### In the owner's Inbox

The owner is told (owner's decision for 1362, 2026-11-22, may be overturned): each pending suggestion is a row in the
Inbox of the person it waits on, the page's **owner**, or for a page with no owner the knowledgebase's owner
([one-explorer-contracts.md "Inbox"](../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md#inbox)). The
row reads the agent ("Claude"), **Suggested an edit** and the page, and is counted in the Inbox's badge. Its pane
quotes the reason, shows the change, and offers **Accept** and **Dismiss** through this app's suggestion routes and
**Open in liveknowledge** at the page with the popover open. The knowledgebase's room pushes it with the page's comment
threads and actions (its outbox's tab key, written by triggers on `suggestions` in the write's own transaction), so
the row leaves the Inbox on the push after the suggestion is accepted or dismissed, or its page is deleted. Each
suggestion's texts are cut to 2,000 characters for the Inbox; the whole suggestion stays here.

## Always in Context

Pages every agent is handed before it starts: `Tab.knowledge.context: true`, set from the row menu ("Always in Context")
or here. The list shows each page's size in tokens (characters / 4, rounded up to 10) against a budget of 8,000
(`CONTEXT_BUDGET_TOKENS`); a page that would pass the budget cannot be added, and says so.

- **A person's to set** (security review, 2026-11-21): an agent's token, even one allowed to write, cannot put a page
  in or out of Always in Context, nor change its owner (`403 needs_a_person`): what is in context is handed to every
  agent.

## AI Context on a page

Owner, 2026-11-21: "The designs had a section for AI Context, why do we not have that so far?" The approved page
mockup's right rail had, under Page Health, the questions answered from the page and a way to ask about it. A page's
right rail (and its Page Info card) holds an **AI Context** section, after Page Health and before the rail's foot:
what agents and Ask make of this one page. It looks as the rest of the rail does ([Verification](verification.md)
"How the rail looks"): a small-capitals heading, no card, no borders, quiet.

- **Always in Context**: whether every agent is handed this page first, with its size ("About 1,200 tokens", the
  budget's count). An Editor has a switch, the same change as the tree row menu's **Always in Context**: a page that
  would pass the budget is not added and the refusal says so in the route's words. Anyone else reads "Handed to
  Every Agent First" or "Not Handed to Agents First".
- **Answered From This Page** (now in [Page Insights](#page-insights), beside how often Ask cited the page): the
  questions whose Ask answer cited this page, up to 3, most asked first, over the last 30 days, each quoted with
  "Asked 6 times" ("Asked once" for one). With none it is not shown (owner, 2026-11-21: "if no questions or read by
  agents, don't show it").
- **Read by Agents** (a pointer popover from Read This Week's "N by Agents", owner 2026-11-22; no longer in AI
  Context): the agents that read this page in the last 7 days, the 3 that read it most, each with its
  reads. With none it is not shown.
- No Ask About This Page (owner, 2026-11-21: "we already have Ask in the footer").
- **What is kept.** When Ask answers a first question (not a follow-up) and cites pages, the room counts it once
  for each page cited, under the question's key (the words that carry meaning, stemmed: the same grouping as
  questions nobody could answer), by day: `page_answers`, a row a page, key and day, holding the asker's words (at
  most 280 characters) and the count. No asker's identity is kept. It is one statement an answer, in the
  transaction that logs its gaps. The daily upkeep drops days older than 30 and keeps at most 5,000 rows, the
  newest; a deleted page takes its rows with it.
- **The read.** Page Health's read answers the questions and the agents with the rest, so opening a page costs no
  more requests. Every role that can read the page reads them.
- **A knowledgebase kept Offline** has no room, no Ask and no agents: the section is not drawn and nothing is kept.

| Action                        | Editor | Participant | Viewer |
| ----------------------------- | ------ | ----------- | ------ |
| See AI Context                | yes    | yes         | yes    |
| Set Always in Context from it | yes    | yes         | no     |

## Knowledge Health

Counts of Verified, Review Due and Never Verified pages as one stacked bar with a legend, the knowledgebase's
**average Health Score** ([Verification](verification.md#health-score)) beside the verified share, the pages with
low health, and **Remind the Owners**
(one email each, at most once a week per knowledgebase). The counts are worked out under the knowledgebase's one
Review Period ([Verification](verification.md) "The Review Period") when the view is read. Under Never
verification is off ([Verification](verification.md#under-a-review-period-of-never)): the card leads with the average
Health Score ("71 average health across 24 pages"), keeps Pages With Low Health, and draws no verified share, no bar
or legend and no Remind the Owners.

**Pages With Low Health** (owner 2026-11-21: "Knowledge health should show up to 5 pages with low health"): the 5
lowest-scoring pages whose score is under the Healthy line (75), lowest first, a tie the most read this week first,
then tree order. Each row is the page's title, its score and word ("38 Needs Work", the word's colour and never
colour alone) and its main reason ("Never verified", "Review due 40 days ago", "2 broken links"); pressing it opens
the page. With none: "Every Page Is Healthy", saying every page scores 75 or more. The average is of every page, a
whole number, "No pages yet" with none. Both come from the overview's one read (`GET knowledge`, still one
request): the api scores every page with the same function from one statement over the room's tables, no read a
page.

**Remind the Owners** sends each owner one email, **Pages to Review**, listing their pages that are Review Due or
Never Verified (each named with its state and linked; the first 100, the rest counted). It is a
[Knowledgebase Reviews](verification.md#reminders) email. A week runs from the last reminder that reached someone:
a press that sent nothing does not spend it. The answer says what happened, as Ask Both Owners does, and also that
every page is verified when there is nothing to remind anyone of.

## The view, as built

Owner, 2026-11-21: "Can you improve the UX of that page, its just a long page with stacked items, could be more of a
dashboard". The view is a dashboard: a band of headline figures, then cards in a grid, each card holding its own
rows and actions, long lists capped so the page never grows with the data.

- One read of `GET .../knowledge` each time the view opens and one after each action taken in it. Nothing is polled.
  Every figure below comes from that one read.
- **Header:** "Insights", one line, **Connect an Agent** and **AI Settings**.
- **The figures band:** six tiles, each a button named by its words and its figure. Six across on a wide screen,
  three across from a tablet's width, two across on a phone.

  | Tile                | Figure                                                                                               | Pressed                                  |
  | ------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------- |
  | Reads This Week     | page reads in the last 7 days; "9 by people, 2 by agents" (reads, not readers); a 14-day sparkline   | brings Most Read into view               |
  | Connected Agents    | agents seen in 30 days; how many may write; a bar of who reads most                                  | brings Connected Agents into view        |
  | Open Questions      | questions nobody could answer; how many asks in all; a bar per question                              | shows Needs Attention at Questions       |
  | Pages That Disagree | open conflicts; the oldest conflict's two pages                                                      | shows Needs Attention at Disagreements   |
  | Suggested Edits     | agents' edits waiting; a 14-day track of how long each has waited                                    | shows Needs Attention at Suggested Edits |
  | Verified            | the verified share; a bar of verified, Review Due and never verified; the average Health Score       | brings Knowledge Health into view        |
  | Average Health      | under a Review Period of Never, in Verified's place: the average Health Score; across how many pages | brings Knowledge Health into view        |

  A tile whose figure asks for someone (an open question, a conflict, an edit waiting, a page Review Due) carries a
  small amber mark; a tile that filters Needs Attention shows pressed while its filter is on, and pressing it again
  shows All. The sparkline is the last 14 days' reads, a bar a day, people and agents stacked in two tones, with
  its words said as the tile's description ("Reads by day over the last 14 days: 60 by people, 24 by agents.").
  Every read count names reads, never readers: no reader's identity is kept, so one person opening nine pages is
  9 reads by people, never "9 people" (owner 2026-11-22).

  **Every tile draws a picture** (owner 2026-11-22: "the other 5 need to be more amazing, visualisations that are
  useful to look at and help me understand"), in the same 28px strip at the tile's foot as the sparkline, so the six
  line up. Each picture is from the same overview read, and its words are said as part of the tile's description.

  - **Connected Agents:** which agents lean on the knowledgebase. A bar split by each agent's share of this week's
    agent reads (the 4 who read most, the rest as one "others" piece), in four tones of the brand, with its caption
    naming the agent who reads most and its share ("Claude Code, 72% of reads"). With no agent reads this week, a
    hairline and "No reads this week"; with no agents, "Connect one to start".
  - **Open Questions:** where the gaps bite. A bar for each open question, most asked first (12 at most), its height
    its asks, asks by people under asks by agents in the Reads tones. The line says the asks and how many were
    agents' ("Asked 12 times, 9 by agents"). One tall bar means one gap everyone hits; many short ones, a scatter.
  - **Pages That Disagree:** what disagrees, at a glance. The oldest open conflict's two page titles on two lines,
    the second led by a not-equal mark, and "+2" when more are open. The line says how long the oldest has
    been open ("Oldest found 3 days ago"). None open: a hairline.
  - **Suggested Edits:** how long agents have waited. A track of the last 14 days, today at its right, with a dot
    for each waiting edit on the day it was suggested (stacked on a busy day); a dot 7 days or older is amber, and
    one older than the track sits at its left end. The line says the oldest wait ("Oldest waits 4 days"). None
    waiting: the bare track.
  - **Verified:** how far the pages can be trusted. A bar of every page in three parts, verified (brand), Review Due
    (amber) and never verified (grey), with each part's count beside its colour as its caption (the words are in
    the tile's hover card and its spoken description). The line is the
    average Health Score ("Average health 71"). No pages: a hairline.

- **Needs Attention** (the widest card, first): the work waiting for someone, in one list, most urgent first: pages
  that disagree (a wrong answer is being given now), then edits agents suggested (an agent is waiting), then
  questions nobody could answer, the most asked first. A switch above it shows **All**, **Questions**,
  **Disagreements** or **Edits** (an agent's suggested edits). Each row says what kind it is with an icon and a word, and keeps its
  actions as below. At most 4 rows show; **Show All 9** opens the rest in place and **Show Fewer** folds them.
- **Knowledge Health:** the verified share as a large figure with the average Health Score beside it ("Average
  health 71"), the stacked bar and its legend, **Pages With Low Health** (at most 5 rows, under the legend), and
  **Remind the Owners**.
- **Connected Agents:** compact cards, two across, at most 4 before **Show All**; **Connect an
  Agent** at the card's top right.
- **Always in Context:** the budget meter, each page with its size and a remove button, at most 5 before **Show All**,
  and **Add a Page**.
- **Most Read:** the 5 pages read most in the last 7 days, each with a bar of its reads, people and agents in the
  same two tones as the sparkline, and its figures. A row opens its page. A deleted page is left out.
- **Not Read in 90 Days:** under Most Read, as [Not Read in 90 Days](#not-read-in-90-days) says: a row a page,
  its title and when it was last edited, a chevron, opening the page.
- **What an Agent Sees:** the dark sample card, last.
- On a wide screen the cards fill two equal columns (owner 2026-11-21): Needs Attention, Connected Agents, Most
  Read and Not Read in 90 Days on the left; Knowledge Health, Required Reading ([Required Reading](required-reading.md): each page asked to be read, least read first, with how many have), Always in Context and What an Agent Sees on the right, so neither column runs
  long beside an empty one. Each column is its own stack, so a card's height in one never moves a card in the other,
  and Knowledge Health heads its column on a whole pixel (CSS columns put it half a pixel off, and its glyph with it).
  Below a laptop's width (1024px) they are one column, the left column's cards then the right's, the order focus
  moves in. Nothing scrolls sideways at any width.
- **Empty states** teach how each card fills:
  - Needs Attention with nothing waiting: "Nothing Needs Attention", saying what lands here and how (an
    unanswered Ask, an agent's empty search or `report_gap`, a page that disagrees with another, an agent's
    suggested edit). Each filter with nothing has its own: "No Unanswered Questions Yet" (Ask, an agent's search
    or its `report_gap` logs one), "No Disagreements Yet" (checked when a page is verified or saved), "No
    Suggested Edits Yet" (an agent with Suggests Edits sends one).
  - Connected Agents: "No Agents Yet" with **Connect an Agent**.
  - Most Read: "No Reads Yet": opening a page counts a read, as does an agent's `read_page` or search result.
  - Knowledge Health: "No Pages Yet". Always in Context: "No Pages in Context Yet" (an Editor's line says how to add
    one; anyone else's who can).
- **The AI key** is never a blocker on the dashboard: built-in AI checks for conflicts when there is no key
  (owner, 2026-11-21). Only where no AI can check (no key, and no built-in AI on this server) does the Disagreements
  filter carry one small note, with **Open AI Settings** for an Editor; the All list, the tiles and the empty states
  say nothing of a key.
- **Connect an Agent** opens the [Connect](mcp-connect.md) view (owner 2026-11-21), which replaced the dialog it
  opened: the steps for each AI app, what a connection may do and how an Editor allows writing, the command line
  and **Open API Tokens**.
- **An agent's card:** an icon, the name, how it connects and when it was last seen (what the room noted of its
  token), a "Connected" dot, what it may do as chips from its scopes (**Reads**, **Suggests Edits**, **Writes**),
  pages read this week and the three it read most, each opening its page. An agent known only by its reads, counted
  before the room kept tokens, shows **Reads** and how its name says it connects. For an Editor a card has a More
  menu with **Allow Writing** or **Stop Writing**, behind a confirm dialog; the chips change at once and go back,
  with a toast saying why, when the change is refused. A connection that cannot write whatever is granted (a
  read-only token, or one acting for someone who is not an Editor) has no menu and says why.
- **A conflict's row:** the question, the two passages side by side (stacked on a phone) each with its page's
  trust, **<Page> Is Right, Fix the Other** for each side (it opens the other page), **Ask Both Owners** and **Not
  a Conflict**. Once the owners were asked, "Owners asked 14 Nov" stands in the button's place.
- **A question's row:** the question, "Asked 4 times by people and Coding Agent", **Draft a Page** and a dismiss
  button.
- **A suggestion's row:** the page, the agent, the reason's first line, the lines taken out and put in (a sign and a
  strike as well as a colour), **Accept**, **Open the Page**, **Dismiss**. A suggestion that no longer fits its page
  says so in words.
- **Knowledge Health's bar:** Verified, Review Due and Never Verified, dark, mid and light so they differ in lightness
  as well as hue, with one spoken label and a legend of the three counts. **Remind the Owners** sits at the card's
  right while a page is Review Due or Never Verified; for a week after a reminder "Owners reminded 14 Nov" stands in
  its place.
- **The two email buttons** are a signed-in Editor's and are drawn only where the deployment sends email (the read
  says so). Each shows what happened in a toast, in words ("Sent to 2 owners.", "The owners were already reminded
  this week. They can be reminded again on 25 Nov."); a request that fails outright is said above the cards.
- **Always in Context's meter** reads "4,410 of 8,000 tokens"; **Add a Page** opens a page picker. A page that would
  pass the budget is refused in the route's own words.
- **What an Agent Sees:** a dark card with a short sample of how one search result reads to an agent, built from a
  real passage of this knowledgebase when the read holds one. It shows the trust line and the page's Health Score
  ("health: 87 (healthy)"), as every result an agent gets carries both (owner 2026-11-22).
- A knowledgebase kept Offline shows one empty state for the whole view and reads nothing.
- Passages, questions, reasons and suggested lines are other people's text: drawn as text, never as HTML.

## Not built

- **Ask <Owner> to Write It** on a Knowledge Gap card ([Search and Ask](search-and-ask.md)): it has no email and
  is not drawn.
- The emails have been sent only through a fake sender in tests, never from a deployed Worker.
- **Fix the Other** opens the other page, not the passage with a margin note quoting the right one.
- **Edits Suggested by Agents** is built against the wire type and its two routes and tested over a fake; it has not
  been exercised against a running api.
- A dismissed question or conflict, and an accepted suggestion, leave the list on the read after the action, not
  before it.

## Share roles

| Action                                                  | Editor | Participant | Viewer |
| ------------------------------------------------------- | ------ | ----------- | ------ |
| See Insights                                            | yes    | yes         | yes    |
| See a page's suggestions (tree dot, pill, wash, rail)   | yes    | yes         | yes    |
| Accept or dismiss a suggestion                          | yes    | no          | no     |
| Suggest an edit (an agent of theirs, the api)           | yes    | yes         | no     |
| Resolve a conflict                                      | yes    | yes         | no     |
| Draft a page, dismiss a question, set Always in Context | yes    | yes         | no     |
| Allow an agent to write, or stop it                     | yes    | no          | no     |
| Ask both owners of a conflict; remind the owners        | yes    | yes         | no     |

Accepting or dismissing a suggestion is an Editor's alone (Work Tracker 1362, 2026-11-22), on the page, in AI
Knowledge, in the Inbox and over the api (`403` for anyone less; an API token is refused `needs_a_person` whatever its
person's role): a Participant's agent suggests, and someone who may change the knowledgebase's every page decides. A
Viewer and a Participant see the marks, the pill, the rail and the popover's reason and change, with no Accept,
Dismiss or Show in Page's verbs (Show in Page itself, which changes nothing, is everyone's).
