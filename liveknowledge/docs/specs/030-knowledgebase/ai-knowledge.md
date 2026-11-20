# AI Knowledge

Status: **the view is built, not yet verified in a browser** ([Build plan](../005-project-roadmap/build-plan.md)
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

## Questions nobody could answer

- A question is logged (`questions`) when Ask says the knowledgebase does not cover it, when a search by an agent returns
  nothing, or when an agent calls `report_gap`. Like questions are grouped (same words after stemming); the row shows
  the question and how many times it was asked, by people and by each named agent ("Asked 4 times by people and
  the Coding Agent"). The count is of asks, not of distinct people: no asker's identity is kept.
- **Draft a Page** starts a page titled from the question. With a key it is drafted from the nearest passages, marked
  "Draft, Not Verified" in its first line; without one it opens empty with the question as its first heading.
  **Dismiss** removes the row.

## Pages that disagree

- When a page is verified or its writing is saved (at most once per page per 10 minutes), and the knowledgebase has a key, the
  room looks up passages on other pages that match its passages and asks the model whether any pair states opposite
  facts. A found pair is a **conflict**: the question it answers, both passages, and each page's verified state.
- Resolving: **<Page> Is Right, Fix the Other** opens the other page with the passage selected and a margin note
  quoting the right one; **Ask Both Owners** emails them; **Not a Conflict** dismisses the pair for good.
- **Ask Both Owners** sends each owner of the two pages one email, **Two Pages Disagree**: the question, both
  pages by name with a link each, each passage as a plain text excerpt of at most 280 characters, and a link to
  this view. At most once a conflict (one person who owns both pages gets one email). It is a
  [Knowledgebase Reviews](verification.md#reminders) email: the same setting, the same check that the owner can
  still open the knowledgebase, the same 50 a day. The answer says what happened: sent to how many owners, already
  asked and when, nobody owns either page, the owners cannot be reached, the day's emails are spent, or this
  server sends no email.
- A conflict closes by itself when either passage changes. Bounds: 50 checks a knowledgebase a day; at most 5 candidate
  passages a check. Without a key the section explains that it needs one.

## Edits suggested by agents

An agent with the Suggests Edits scope never changes a page directly: its edit arrives as a changeset
([Agent changesets](../024-agents/agent-changesets.md)) with its reason. The card shows the page, the agent, the
change as removed and added lines, and **Accept**, **Open the Page**, **Dismiss**. Accepting applies it as one undo
step in the acceptor's name and does not verify the page.

## Always in Context

Pages every agent is handed before it starts: `Tab.knowledge.context: true`, set from the row menu ("Always in Context")
or here. The list shows each page's size in tokens (characters / 4, rounded up to 10) against a budget of 8,000
(`CONTEXT_BUDGET_TOKENS`); a page that would pass the budget cannot be added, and says so.

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

- One read of `GET .../knowledge` each time the view opens and one after each action taken in it. Nothing is polled.
- **Header:** "AI Knowledge", one line, **Connect an Agent** and **AI Settings**.
- **Connect an Agent** is a dialog: a new connection can read, search and suggest; how an Editor allows writing
  (anyone else reads that an Editor can); then the MCP server's address and its first tools (`get_context`,
  `search_pages`, `read_page`, `suggest_edit`), the command line (`liveknowledge auth login`, `context`, `search`)
  and **Open API Tokens** (Settings' Tokens page).
- **Connected Agents:** a card each: an icon, the name, how it connects and when it was last seen (what the room
  noted of its token), a "Connected" dot, what it may do as chips from its scopes (**Reads**, **Suggests Edits**,
  **Writes**), pages read this week and the three it read most, each opening its page. An agent known only by its
  reads, counted before the room kept tokens, shows **Reads** and how its name says it connects. For an Editor a
  card has a More menu with **Allow Writing** or **Stop Writing**, behind a confirm dialog; the chips change at
  once and go back, with a toast saying why, when the change is refused. A connection that cannot write whatever
  is granted (a read-only token, or one acting for someone who is not an Editor) has no menu and says why.
- **Pages That Disagree:** the question, the two passages side by side (stacked on a phone) each with its page's
  trust, **<Page> Is Right, Fix the Other** for each side (it opens the other page), **Ask Both Owners** and **Not
  a Conflict**. Once the owners were asked, "Owners asked 14 Nov" stands in the button's place. Without a key the
  section says it needs one.
- **Questions Nobody Could Answer:** rows of the question, "Asked 4 times by people and the Coding Agent", **Draft a
  Page** and a dismiss button.
- **Edits Suggested by Agents:** a card each: the page, the agent, the reason's first line, the lines taken out and
  put in (a sign and a strike as well as a colour), **Accept**, **Open the Page**, **Dismiss**. A suggestion that no
  longer fits its page says so in words.
- **Knowledge Health:** one stacked bar, Verified, Review Due and Never Verified, dark, mid and light so they differ
  in lightness as well as hue, with one spoken label and a legend of the three counts. **Remind the Owners** sits
  at the section's right while a page is Review Due or Never Verified; for a week after a reminder "Owners reminded
  14 Nov" stands in its place.
- **The two email buttons** are a signed-in Editor's and are drawn only where the deployment sends email (the read
  says so). Each shows what happened in a toast, in words ("Sent to 2 owners.", "The owners were already reminded
  this week. They can be reminded again on 25 Nov."); a request that fails outright is said above the sections.
- **Always in Context:** the budget bar ("4,410 of 8,000 tokens"), each page with its size and a remove button, and
  **Add a Page**, which opens a page picker. A page that would pass the budget is refused in the route's own words.
- **What an Agent Sees:** a dark card with a short sample of how one search result reads to an agent, built from a
  real passage of this knowledgebase when the read holds one.
- Every section with nothing to show has an empty state. A knowledgebase kept Offline shows one empty state for the
  whole view and reads nothing.
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
| Accept or dismiss a suggestion, resolve a conflict      | yes    | no          | no     |
| Draft a page, dismiss a question, set Always in Context | yes    | no          | no     |
| Allow an agent to write, or stop it                     | yes    | no          | no     |
| Ask both owners of a conflict; remind the owners        | yes    | no          | no     |
