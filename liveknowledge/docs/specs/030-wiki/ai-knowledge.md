# AI Knowledge

Status: **spec**, not built ([Build plan](../005-project-roadmap/build-plan.md) step 10).

The wiki's third tab, beside Pages and Ask: what agents know, where they learned it and what they could not find.
Most of it needs no model: it is bookkeeping the room already has.

## Connected agents

One card per agent that has read or written this wiki in the last 30 days: its name (the MCP client's, the CLI, or an
API token's label), how it connects, what it may do (**Reads**, **Suggests Edits**), pages read this week and the
three it read most. **Connect an Agent** opens the instructions for the MCP server, the CLI and tokens.

An agent acts for a person or a token and can open only what they can: share roles apply to agents exactly as to
people.

## Reads

The room counts page reads by day, by reader kind (`person` or `agent`) and by agent, in its Durable Object
(`page_reads`), kept 90 days. A read is one open of a page in the editor, or one `read_page` or search result served
to an agent. No reader's identity is kept beyond the agent's name.

## Questions nobody could answer

- A question is logged (`questions`) when Ask says the wiki does not cover it, when a search by an agent returns
  nothing, or when an agent calls `report_gap`. Like questions are grouped (same words after stemming); the row shows
  the question, how many times and by whom ("3 people and the Coding Agent").
- **Draft a Page** starts a page titled from the question. With a key it is drafted from the nearest passages, marked
  "Draft, Not Verified" in its first line; without one it opens empty with the question as its first heading.
  **Dismiss** removes the row.

## Pages that disagree

- When a page is verified or its writing is saved (at most once per page per 10 minutes), and the wiki has a key, the
  room looks up passages on other pages that match its passages and asks the model whether any pair states opposite
  facts. A found pair is a **conflict**: the question it answers, both passages, and each page's verified state.
- Resolving: **<Page> Is Right, Fix the Other** opens the other page with the passage selected and a margin note
  quoting the right one; **Ask Both Owners** emails them; **Not a Conflict** dismisses the pair for good.
- A conflict closes by itself when either passage changes. Bounds: 50 checks a wiki a day; at most 5 candidate
  passages a check. Without a key the section explains that it needs one.

## Edits suggested by agents

An agent with the Suggests Edits scope never changes a page directly: its edit arrives as a changeset
([Agent changesets](../024-agents/agent-changesets.md)) with its reason. The card shows the page, the agent, the
change as removed and added lines, and **Accept**, **Open the Page**, **Dismiss**. Accepting applies it as one undo
step in the acceptor's name and does not verify the page.

## Always in Context

Pages every agent is handed before it starts: `Tab.wiki.context: true`, set from the row menu ("Always in Context")
or here. The list shows each page's size in tokens (characters / 4, rounded up to 10) against a budget of 8,000
(`CONTEXT_BUDGET_TOKENS`); a page that would pass the budget cannot be added, and says so.

## Knowledge Health

Counts of Verified, Review Due and Never Verified pages as one stacked bar with a legend, and **Remind the Owners**
(one email each, at most once a week per wiki).

## Share roles

| Action                                                      | Editor | Participant | Viewer |
| ----------------------------------------------------------- | ------ | ----------- | ------ |
| See AI Knowledge                                            | yes    | yes         | yes    |
| Accept or dismiss a suggestion, resolve a conflict          | yes    | no          | no     |
| Draft a page, dismiss a question, set Always in Context     | yes    | no          | no     |
| Remind the owners                                           | yes    | no          | no     |
