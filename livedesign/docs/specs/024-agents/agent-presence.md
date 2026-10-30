# Agent presence

**Status: built.** The comment endpoints and their listing, comment token ids, agent presence in the api, the room
and the editor, and the CLI's `comment`, `presence`, `wait` and `watch`.

An agent acts as the person whose token it holds. People see its work and its comments as that person's, and its
presence as that person's agent, and comments are how people and agents talk on the canvas when nobody is chatting.

## Attribution

- An agent's changesets and comments carry the name and colour of the token's owner, and its presence the owner's
  colour and the name "{owner}'s Agent". "Webber changed 3 elements" reads the same whether Webber or his agent made
  the change.
- The token id is recorded on every changeset and comment for the audit trail (logs, `changeset ls`, revoking a
  token), and never shown as a name.

## Presence

- An agent at work appears in the tab's presence stack as an avatar of its own, named "{owner}'s Agent" ("Webber's
  Agent"), in its owner's colour and wearing the agent mark instead of initials, with an optional status line
  ("adding payment service"). Everyone on the design sees it, its owner included: when the owner also has the tab
  open, the stack shows the owner and their agent side by side.
- The status line shows in the avatar's hover card, its row in the Collaborators modal and its accessible name, never
  as text in the tab pill. Without one, the hover card and the row say "Working on this tab". The hover card and the
  row carry an "Agent" badge before the agent's level.
- An agent shows on one tab only: the last it read, changed or set presence on. Reading or changing another tab
  moves it there.
- It stays for a few minutes after it last read or changed the tab (`AGENT_PRESENCE_ACTIVITY_TTL_MS`), then leaves.
- Two tokens of one owner on one tab show as one avatar, with the status set last.
- A personal design's stack, otherwise hidden, shows while its owner's agent is present.
- The Collaborators modal lists an agent under its tab with its status line, offers no Follow, and leaves it out of
  the people count.
- The room recognises the owner's own sessions by a per-design tag derived from the owner id, held inside the room
  and never sent to a socket, so no owner id reaches the room.
- **Every changeset** applied or reverted with a token refreshes that token's presence on that tab for
  `AGENT_PRESENCE_ACTIVITY_TTL_MS`. A dry run or a refused changeset refreshes nothing.
- **Every read** of a tab with a token (`GET /api/designs/:id/tabs/:tabId`, any view, as the MCP and the CLI read a
  tab) refreshes it the same way, at most once per agent, design and tab every `AGENT_PRESENCE_STAMP_MS`: a read
  inside that window, on the tab the agent already shows on, writes nothing. A session's read refreshes nothing.
- An agent may set presence explicitly: `PUT /api/designs/:id/tabs/:tabId/presence` with `status` (up to 80
  characters), `focus` (up to 20 element ids, shown with a ring in the owner's colour) and `ttl` (up to
  `AGENT_PRESENCE_MAX_TTL_MS`). `DELETE` on the same path clears it. The agent holds no socket.
- The room keeps agent presence entries beside people's and expires them on their ttl. An agent's presence never
  holds an element, and never counts in a session's head count.

## Comments

- An agent comments through the comment endpoints; the comment's author is the token's owner.
- The comment endpoints gain **reply**, **resolve** and **reopen** (today only add and delete exist), each relayed to
  the room as an `el-delta` like add. Agents and people use the same endpoints.
- An editor that may comment but not edit resolves and reopens through these endpoints, as it adds; an editor that
  may edit keeps the room and its save.
- `GET /api/designs/:id/comments?status=open|resolved|all` lists threads across tabs with their element's ref and
  label, so an agent can read the conversation without reading the tab. It is not capped: it reads one tab at a
  time.
- Agents cannot be mentioned. An agent that answers comments reads new ones as they arrive ([CLI](../015-api/cli.md)
  `wait --for comment`) or on its next read.

## What a token may do

What an agent may do follows its token ([Public API and API tokens](../015-api/public-api-and-tokens.md)), through
the same gates as its owner, on the index's grant: reading needs read access; comments and taking part need the
participation gate (`gateParticipate`); presence and changesets need the edit gate (`gateEdit`). A **read-only**
token reads and writes nothing (`403 read_only_token` on every write, `apps/api/src/index.ts`), comments and presence
included. Tokens carry no share level ([Share roles](../013-workspace/share-roles.md#outside-the-levels)).

Until [share roles](../013-workspace/share-roles.md) are built, `gateParticipate` names today's rule: read access to
the design or tab, as a view link may already comment, with a read-only token refused every write at the choke
point. It becomes the Participant check when share roles land, and no route changes then.

## Limits

| Constant                         | Value  | Why                                                                        |
| -------------------------------- | ------ | -------------------------------------------------------------------------- |
| `AGENT_PRESENCE_TTL_MS`          | 30000  | An explicit set's default: outlasts the gap between an agent's commands    |
| `AGENT_PRESENCE_MAX_TTL_MS`      | 120000 | An agent that sets presence and stops refreshing leaves within two minutes |
| `AGENT_PRESENCE_ACTIVITY_TTL_MS` | 180000 | An agent stays a few minutes after it last read or changed the tab         |
| `AGENT_PRESENCE_STAMP_MS`        | 30000  | A burst of reads costs one room write per agent and tab                    |

## Observability

Logs `[agent-presence] set`, `[agent-presence] cleared`, `[agent-presence] expired` with the design, tab and token
id. Telemetry: category `Agent`, action `Present`, type the front door, counted once when a `PUT` creates an entry.
