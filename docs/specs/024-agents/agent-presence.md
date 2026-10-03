# Agent presence

**Status: specified, not built.**

An agent at work on a document is visible to the people in it, its work is credited to it and to the person it acts
for, and comments are how people and agents talk on the canvas when nobody is chatting.

## Attribution

- An agent is shown as **"<agent name> for <person>"**: "Claude for Webber". The agent name is the name of the token
  it holds; a token minted through the MCP or the CLI is named after the client ("Claude", "livediagram CLI"), and a
  token made in Settings carries the name its owner gave it ([Public API and API tokens](../015-api/public-api-and-tokens.md)).
- Changesets, comments and presence all carry it. Nothing an agent does reads as the person's own work.
- A changeset or comment written with a signed-in session is the person's own, with no agent name.

## Presence

- An agent appears in the tab's presence stack while it works: an avatar in its owner's colour with an agent badge,
  its name "Claude for Webber", and an optional status line ("adding payment service").
- **Every changeset** refreshes the agent's presence on that tab for `AGENT_PRESENCE_TTL_MS`.
- An agent may set presence explicitly: `POST /api/documents/:id/tabs/:tabId/presence` with `status` (up to 80
  characters), `focus` (up to 20 element ids, shown with a ring in the agent's colour) and `ttl` (up to
  `AGENT_PRESENCE_MAX_TTL_MS`). `DELETE` on the same path clears it. The agent holds no socket.
- The room keeps agent presence entries beside people's, expires them on their ttl, and never treats an agent as
  holding an element.
- An agent's presence never counts in a session's head count, the Done check or a roll call.

## Comments

- An agent comments through the comment endpoints; the comment's author is the token's owner and it carries the
  agent name, shown as "Claude for Webber".
- The comment endpoints gain **reply**, **resolve** and **reopen** (today only add and delete exist), each relayed to
  the room as an `el-delta` like add. Agents and people use the same endpoints.
- `GET /api/documents/:id/comments?status=open|resolved|all` lists threads across tabs with their element's ref and
  label, so an agent can read the conversation without reading the tab.

## Mentions

- A comment can mention an agent by its handle, the agent name in lower kebab case (`@claude`), by the rules of
  [Comment mentions](../012-collaboration/comment-mentions.md).
- The agents that can be mentioned on a document are those that wrote a changeset or comment on it within
  `AGENT_MENTION_WINDOW_DAYS`.
- A mention of an agent sends no email. The agent learns of it by waiting
  ([CLI](../015-api/cli.md) `wait --for mention`), which watches the room for comments mentioning its handle.

## Read-only tokens

A read-only token may add, reply to, resolve and reopen comments, as a view-role share visitor may, and nothing
else. Its presence shows like any agent's.

## Limits

| Constant                    | Value  | Why                                                      |
| --------------------------- | ------ | -------------------------------------------------------- |
| `AGENT_PRESENCE_TTL_MS`     | 30000  | Outlasts the gap between an agent's commands in one task |
| `AGENT_PRESENCE_MAX_TTL_MS` | 120000 | An agent that stops refreshing leaves within two minutes |
| `AGENT_MENTION_WINDOW_DAYS` | 30     | Agents that worked on the document recently, not forever |

## Observability

Logs `[agent-presence] set`, `[agent-presence] cleared`, `[agent-presence] expired` with the document, tab and token
id. Telemetry: category `Agent`, action `Present`, type the front door.
