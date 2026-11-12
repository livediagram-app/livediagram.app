# Agent presence

> **No MCP server or CLI in livehuddle** ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-mcp-server-the-cli-and-workbenches)):
> the REST API is the only front door. Where this file names the MCP or the CLI, it records livediagram's front
> doors over the same engine, where this design came from; their wire values (`mcp`, `cli`) still parse.

**Status: built.** The comment listing, comment token ids, agent presence in the api, the room and the editor. The
comment writes are gone: livehuddle has no comments ([Comments, actions, links and notes](../002-project-scope/not-in-livehuddle.md#comments-actions-links-and-notes)), so every comment write answers
410 `comments_gone` and the reads stay.

An agent acts as the person whose token it holds. People see its work as that person's, and its presence as that
person's agent.

## Attribution

- An agent's changesets and comments carry the name and colour of the token's owner, and its presence the owner's
  colour and the name "{owner}'s Agent". "Webber changed 3 elements" reads the same whether Webber or his agent made
  the change.
- The token id is recorded on every changeset and comment for the audit trail (logs, `changeset ls`, revoking a
  token), and never shown as a name.

## Presence

- An agent at work appears in the tab's presence stack as an avatar of its own, named "{owner}'s Agent" ("Webber's
  Agent"), in its owner's colour and wearing the agent mark instead of initials, with an optional status line
  ("adding payment service"). Everyone on the document sees it, its owner included: when the owner also has the tab
  open, the stack shows the owner and their agent side by side.
- The status line shows in the avatar's hover card, its row in the Collaborators modal and its accessible name, never
  as text in the tab pill. Without one, the hover card and the row say "Working on this tab". The hover card and the
  row carry an "Agent" badge before the agent's level.
- An agent shows on one tab only: the last it read, changed or set presence on. Reading or changing another tab
  moves it there.
- It stays for a few minutes after it last read or changed the tab (`AGENT_PRESENCE_ACTIVITY_TTL_MS`), then leaves.
- Two tokens of one owner on one tab show as one avatar, with the status set last.
- A personal document's stack, otherwise hidden, shows while its owner's agent is present.
- The Collaborators modal lists an agent under its tab with its status line, offers no Follow, and leaves it out of
  the people count.
- The room recognises the owner's own sessions by a per-document tag derived from the owner id, held inside the room
  and never sent to a socket, so no owner id reaches the room.
- **Every changeset** applied or reverted with a token refreshes that token's presence on that tab for
  `AGENT_PRESENCE_ACTIVITY_TTL_MS`. A dry run or a refused changeset refreshes nothing.
- **Every read** of a tab with a token (`GET /api/documents/:id/tabs/:tabId`, any view, as the MCP and the CLI read a
  tab) refreshes it the same way, at most once per agent, document and tab every `AGENT_PRESENCE_STAMP_MS`: a read
  inside that window, on the tab the agent already shows on, writes nothing. A session's read refreshes nothing, nor
  does a read by a view token or one whose grant is a Viewer's ([Token levels](#token-levels)): before, such a read
  put "{owner}'s Agent" in front of the room and took one of its places.
- An agent may set presence explicitly: `PUT /api/documents/:id/tabs/:tabId/presence` with `status` (up to 80
  characters), `focus` (up to 20 element ids, shown with a ring in the owner's colour) and `ttl` (up to
  `AGENT_PRESENCE_MAX_TTL_MS`). `DELETE` on the same path clears it. The agent holds no socket.
- The room keeps agent presence entries beside people's and expires them on their ttl. An agent's presence never
  holds an element, and never counts in a session's head count, the Done check or a roll call.

## Comments

livehuddle has no comments ([Comments, actions, links and notes](../002-project-scope/not-in-livehuddle.md#comments-actions-links-and-notes)).

- **Writes answer 410 `comments_gone`.** Adding a comment, deleting one's own, replying, resolving and reopening
  (`POST /api/documents/:id/tabs/:tabId/comments`, `DELETE …/comments/:commentId`, `POST …/comments/:commentId/reply`,
  `/resolve`, `/reopen`) answer `410 { error: 'comments_gone' }` for every caller, a token's or a person's, write
  nothing, relay nothing and email nothing. A GET on a thread verb answers 405. The refusal is logged once with its
  code (`[comments] refused`).
- **Reads stay.** `GET /api/documents/:id/comments?status=open|resolved|all` lists the threads a canvas already
  holds, across tabs, with their element's ref and label, so an agent can still read a conversation stored before.
  It is not capped: it reads one tab at a time.
- The room drops a comment delta from any client at its op gate, so no stored thread changes from there either.

## Token levels

What an agent may do follows its token's [level](../013-workspace/share-roles.md), through the same gates
as a share link: reading needs read access; session answers and presence need the participation gate
(`gateParticipate`); changesets need the edit gate. A participate token takes part and sets presence and submits no
changesets; a view token reads and writes nothing, presence included.

`gateParticipate` is the Participant check of [share roles](../013-workspace/share-roles.md): a token whose grant is
a Viewer's sets and clears no presence (403), however its own level reads, since a status line and focus rings are
put in front of everyone in the room. A read-only token is refused every write at the choke point.

## Limits

| Constant                         | Value  | Why                                                                        |
| -------------------------------- | ------ | -------------------------------------------------------------------------- |
| `AGENT_PRESENCE_TTL_MS`          | 30000  | An explicit set's default: outlasts the gap between an agent's commands    |
| `AGENT_PRESENCE_MAX_TTL_MS`      | 120000 | An agent that sets presence and stops refreshing leaves within two minutes |
| `AGENT_PRESENCE_ACTIVITY_TTL_MS` | 180000 | An agent stays a few minutes after it last read or changed the tab         |
| `AGENT_PRESENCE_STAMP_MS`        | 30000  | A burst of reads costs one room write per agent and tab                    |

## Observability

Logs `[agent-presence] set`, `[agent-presence] cleared`, `[agent-presence] expired` with the document, tab and token
id. Telemetry: category `Agent`, action `Present`, type the front door, counted once when a `PUT` creates an entry.
