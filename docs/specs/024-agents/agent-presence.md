# Agent presence

**Status: specified, not built.**

An agent acts as the person whose token it holds. People see its work, its presence and its comments as that
person's, and comments are how people and agents talk on the canvas when nobody is chatting.

## Attribution

- An agent's changesets, comments and presence carry the name and colour of the token's owner. "Webber changed 3
  elements" reads the same whether Webber or his agent made the change.
- The token id is recorded on every changeset and comment for the audit trail (logs, `changeset ls`, revoking a
  token), and never shown as a name.

## Presence

- An agent at work appears in the tab's presence stack as its owner, with an optional status line ("adding payment
  service"). When the owner also has the tab open, the stack shows them once and the status line beside them.
- **Every changeset** refreshes the agent's presence on that tab for `AGENT_PRESENCE_TTL_MS`.
- An agent may set presence explicitly: `PUT /api/documents/:id/tabs/:tabId/presence` with `status` (up to 80
  characters), `focus` (up to 20 element ids, shown with a ring in the owner's colour) and `ttl` (up to
  `AGENT_PRESENCE_MAX_TTL_MS`). `DELETE` on the same path clears it. The agent holds no socket.
- The room keeps agent presence entries beside people's and expires them on their ttl. An agent's presence never
  holds an element, and never counts in a session's head count, the Done check or a roll call.

## Comments

- An agent comments through the comment endpoints; the comment's author is the token's owner.
- The comment endpoints gain **reply**, **resolve** and **reopen** (today only add and delete exist), each relayed to
  the room as an `el-delta` like add. Agents and people use the same endpoints.
- `GET /api/documents/:id/comments?status=open|resolved|all` lists threads across tabs with their element's ref and
  label, so an agent can read the conversation without reading the tab.
- Agents cannot be mentioned. An agent that answers comments reads new ones as they arrive ([CLI](../015-api/cli.md)
  `wait --for comment`) or on its next read.

## Read-only tokens

A read-only token writes nothing, comments included: the dispatch gate refuses every write it presents
([Public API and API tokens](../015-api/public-api-and-tokens.md) §3.4). It may not set presence either.

## Limits

| Constant                    | Value  | Why                                                      |
| --------------------------- | ------ | -------------------------------------------------------- |
| `AGENT_PRESENCE_TTL_MS`     | 30000  | Outlasts the gap between an agent's commands in one task |
| `AGENT_PRESENCE_MAX_TTL_MS` | 120000 | An agent that stops refreshing leaves within two minutes |

## Observability

Logs `[agent-presence] set`, `[agent-presence] cleared`, `[agent-presence] expired` with the document, tab and token
id. Telemetry: category `Agent`, action `Present`, type the front door.
