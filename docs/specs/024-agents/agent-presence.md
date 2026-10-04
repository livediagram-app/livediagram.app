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
- The status line shows in the avatar's hover card, its row in the Collaborators modal and its accessible name, never
  as text in the tab pill. An agent's avatar carries the owner's name and colour, never a profile picture.
- The owner sees their own agent's status on their own avatar when both are on the tab, and as an avatar in their
  name on any other tab.
- Two tokens of one owner on one tab show as one avatar, with the status set last.
- A personal document's stack, otherwise hidden, shows while its owner's agent is present.
- The Collaborators modal lists an agent under its tab with its status line, offers no Follow, and leaves it out of
  the people count.
- The room recognises the owner's own sessions by a per-document tag derived from the owner id, held inside the room
  and never sent to a socket, so no owner id reaches the room.
- **Every changeset** applied or reverted with a token refreshes that token's presence on that tab for
  `AGENT_PRESENCE_TTL_MS`. A dry run or a refused changeset refreshes nothing.
- An agent may set presence explicitly: `PUT /api/documents/:id/tabs/:tabId/presence` with `status` (up to 80
  characters), `focus` (up to 20 element ids, shown with a ring in the owner's colour) and `ttl` (up to
  `AGENT_PRESENCE_MAX_TTL_MS`). `DELETE` on the same path clears it. The agent holds no socket.
- The room keeps agent presence entries beside people's and expires them on their ttl. An agent's presence never
  holds an element, and never counts in a session's head count, the Done check or a roll call.

## Comments

- An agent comments through the comment endpoints; the comment's author is the token's owner.
- The comment endpoints gain **reply**, **resolve** and **reopen** (today only add and delete exist), each relayed to
  the room as an `el-delta` like add. Agents and people use the same endpoints.
- An editor that may comment but not edit resolves and reopens through these endpoints, as it adds; an editor that
  may edit keeps the room and its save.
- `GET /api/documents/:id/comments?status=open|resolved|all` lists threads across tabs with their element's ref and
  label, so an agent can read the conversation without reading the tab. It is not capped: it reads one tab at a
  time.
- Agents cannot be mentioned. An agent that answers comments reads new ones as they arrive ([CLI](../015-api/cli.md)
  `wait --for comment`) or on its next read.

## Token levels

What an agent may do follows its token's [level](../013-workspace/share-roles.md#api-tokens), through the same gates
as a share link: reading needs read access; comments, session answers and presence need the participation gate
(`gateParticipate`); changesets need the edit gate. A participate token comments, takes part and sets presence and
submits no changesets; a view token reads and writes nothing, comments and presence included.

## Limits

| Constant                    | Value  | Why                                                      |
| --------------------------- | ------ | -------------------------------------------------------- |
| `AGENT_PRESENCE_TTL_MS`     | 30000  | Outlasts the gap between an agent's commands in one task |
| `AGENT_PRESENCE_MAX_TTL_MS` | 120000 | An agent that stops refreshing leaves within two minutes |

## Observability

Logs `[agent-presence] set`, `[agent-presence] cleared`, `[agent-presence] expired` with the document, tab and token
id. Telemetry: category `Agent`, action `Present`, type the front door, counted once when a `PUT` creates an entry.
