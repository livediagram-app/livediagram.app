# AI Knowledge

Status: **the view is built as a dashboard and was seen in a browser on 2026-11-21** (every tile and card action
pressed, light and dark, 1440 to 390 wide; a conflict only through a stubbed read, since none can be found without a
key) ([Build plan](../005-project-roadmap/build-plan.md)
step 10). What is not built is under "Not built"; the [AI Knowledge UI blueprint](blueprints/ai-knowledge-ui.md) has
the detail.

The knowledgebase's third tab, beside Pages and Ask: what agents know, where they learned it and what they could not find.
Most of it needs no model: it is bookkeeping the room already has.

## Connected agents

One card per agent that has read or written this knowledgebase in the last 30 days: its name (the MCP client's, the CLI, or an
API token's label), how it connects, what it may do (**Reads**, **Suggests Edits**, **Writes**), pages read this week and the
three it read most. **Connect an Agent** opens the instructions for the MCP server, the CLI and tokens.

A new connection reads and suggests. An Editor allows one connection to write from its card's menu (**Allow
Writing**), and stops it there (**Stop Writing**); each asks first, saying what writing allows (replace a page's
writing and move pages, never on a page that is Verified or Review Due) and that it applies to this knowledgebase
only ([Knowledgebase for agents](../024-agents/knowledgebase-for-agents.md)).

An agent acts for a person or a token and can open only what they can: share roles apply to agents exactly as to
people.

## Reads

The room counts page reads by day, by reader kind (`person` or `agent`) and by agent, in its Durable Object
(`page_reads`), kept 90 days. A read is one open of a page in the editor, or one `read_page` or search result served
to an agent. No reader's identity is kept beyond the agent's name.
Opening a page in the editor, by its tree, a link or search, is counted as it opens (`GET pages/<tab>/health?opened=1`,
once a person a page a day), and Page Health's Read This Week is read again on every open, so it moves without a
reload (owner 2026-11-21).

The view's read answers the last 14 days' reads by day, people and agents apart (the sparkline and Reads This Week),
and the 5 pages read most in the last 7 days with each one's reads by people and by agents (Most Read).

## Questions nobody could answer

- A question is logged (`questions`) when Ask says the knowledgebase does not cover it, when a search by an agent returns
  nothing, or when an agent calls `report_gap`. Like questions are grouped (same words after stemming); the row shows
  the question and how many times it was asked, by people and by each named agent ("Asked 4 times by people and
  Coding Agent"). The count is of asks, not of distinct people: no asker's identity is kept.
- **Draft a Page** starts a page titled from the question, drafted from the nearest passages (on the team's key, or
  built-in AI without one: [Built-in AI](search-and-ask.md#built-in-ai)), marked "Draft, Not Verified" in its first
  line; when no AI can answer (no key and no built-in AI on the server, or the draft's call fails) it opens with the
  question as its first heading alone.
  **Dismiss** removes the row.

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
- A conflict closes by itself when either passage changes. Bounds: 50 checks a knowledgebase a day on a key, 20 on built-in AI;
  at most 5 candidate passages a check. Only a deployment with no built-in AI and a knowledgebase with no key has no
  check, and the section says so.

## Edits suggested by agents

An agent with the Suggests Edits scope never changes a page directly: its edit arrives as a changeset
([Agent changesets](../024-agents/agent-changesets.md)) with its reason. The card shows the page, the agent, the
change as removed and added lines, and **Accept**, **Open the Page**, **Dismiss**. Accepting applies it as one undo
step in the acceptor's name and does not verify the page.

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
- **Answered From This Page**: the questions whose Ask answer cited this page, up to 3, most asked first, over the
  last 30 days, each quoted with "Asked 6 times" ("Asked once" for one). With none it is not shown (owner,
  2026-11-21: "if no questions or read by agents, don't show it").
- **Read by Agents**: the agents that read this page in the last 7 days, the 3 that read it most, each with its
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

Counts of Verified, Review Due and Never Verified pages as one stacked bar with a legend, and **Remind the Owners**
(one email each, at most once a week per knowledgebase). The counts are worked out under the knowledgebase's one
Review Period ([Verification](verification.md) "The Review Period") when the view is read: under Never no page is
Review Due.

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
- **Header:** "AI Knowledge", one line, **Connect an Agent** and **AI Settings**.
- **The figures band:** six tiles, each a button named by its words and its figure. Six across on a wide screen,
  three across from a tablet's width, two across on a phone.

  | Tile                | Figure                                                                     | Pressed                                  |
  | ------------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
  | Reads This Week     | page reads in the last 7 days; people and agents apart; a 14-day sparkline | brings Most Read into view               |
  | Connected Agents    | agents seen in 30 days; how many may write                                 | brings Connected Agents into view        |
  | Open Questions      | questions nobody could answer; how many asks in all                        | shows Needs Attention at Questions       |
  | Pages That Disagree | open conflicts                                                             | shows Needs Attention at Disagreements   |
  | Suggested Edits     | agents' edits waiting                                                      | shows Needs Attention at Suggested Edits |
  | Verified            | the verified share of the pages, as a percentage; how many are Review Due  | brings Knowledge Health into view        |

  A tile whose figure asks for someone (an open question, a conflict, an edit waiting, a page Review Due) carries a
  small amber mark; a tile that filters Needs Attention shows pressed while its filter is on, and pressing it again
  shows All. The sparkline is the last 14 days' reads, a bar a day, people and agents stacked in two tones, with
  its words said as the tile's description ("Reads by day over the last 14 days: 60 by people, 24 by agents.").

- **Needs Attention** (the widest card, first): the work waiting for someone, in one list, most urgent first: pages
  that disagree (a wrong answer is being given now), then edits agents suggested (an agent is waiting), then
  questions nobody could answer, the most asked first. A switch above it shows **All**, **Questions**,
  **Disagreements** or **Edits** (an agent's suggested edits). Each row says what kind it is with an icon and a word, and keeps its
  actions as below. At most 4 rows show; **Show All 9** opens the rest in place and **Show Fewer** folds them.
- **Knowledge Health:** the verified share as a large figure, the stacked bar and its legend, and **Remind the
  Owners**.
- **Connected Agents:** compact cards, two across, at most 4 before **Show All**; **Connect an
  Agent** at the card's top right.
- **Always in Context:** the budget meter, each page with its size and a remove button, at most 5 before **Show All**,
  and **Add a Page**.
- **Most Read:** the 5 pages read most in the last 7 days, each with a bar of its reads, people and agents in the
  same two tones as the sparkline, and its figures. A row opens its page. A deleted page is left out.
- **What an Agent Sees:** the dark sample card, last.
- On a wide screen the cards flow through two equal columns as tiles do, in the order Needs Attention, Knowledge
  Health, Connected Agents, Always in Context, Most Read, What an Agent Sees: each takes the next free slot, so no
  column runs long beside an empty one (owner 2026-11-21). Below a laptop's width (1024px) they are one column in that
  order. Nothing scrolls sideways at any width.
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
- **Connect an Agent** is a dialog: a new connection can read, search and suggest; how an Editor allows writing
  (anyone else reads that an Editor can); then the MCP server's address and its first tools (`get_context`,
  `search_pages`, `read_page`, `suggest_edit`), the command line (`liveknowledge auth login`, `context`, `search`)
  and **Open API Tokens** (Settings' Tokens page).
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
  real passage of this knowledgebase when the read holds one.
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
| See AI Knowledge                                        | yes    | yes         | yes    |
| Accept or dismiss a suggestion, resolve a conflict      | yes    | yes         | no     |
| Draft a page, dismiss a question, set Always in Context | yes    | yes         | no     |
| Allow an agent to write, or stop it                     | yes    | no          | no     |
| Ask both owners of a conflict; remind the owners        | yes    | yes         | no     |
