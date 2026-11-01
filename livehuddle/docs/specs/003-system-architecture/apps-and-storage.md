# Apps and storage

Status: **proposed**, awaiting the owner's approval (Work Tracker #99).

How livehuddle's apps fit together and where its data lives. It is livediagram's architecture, which every
liveworkspace product already shares, so the fork brings it over whole; this page records the choices so nobody adds
a database on the way.

## Where a space lives

**One Durable Object per space, and no D1** (Work Tracker #99: "store its own documents as durable objects, not
D1").

- A space is stored as livediagram stores a document
  ([Storage](../../../../livediagram/docs/specs/015-api/api.md#storage)): one SQLite-backed Durable Object
  (`DocumentRoom`) holds its tabs, image references and changesets, and is the realtime room everyone on it joins.
  The api Worker routes every content request to it by RPC.
- The api Worker has **no D1 binding**. Where a space is filed (owner, folder, team, trash) and who may open it
  belong to liveworkspace's index ([Index](../../../../liveworkspace/docs/specs/004-index/README.md)), which the
  space's outbox keeps up to date, as every product's does
  ([One Explorer contracts](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)).
- Images go to the platform's media service ([Media](../../../../liveworkspace/docs/specs/006-media/media.md)), never
  into the Durable Object.
- Telemetry goes to the platform's telemetry service, never to livehuddle's api.
- Nothing livehuddle-only is stored anywhere else. A new kind of data (a meeting's notes, a recording later) is a
  spec change first, and goes in the space's Durable Object unless the spec says why not.

## What is never stored

- **Presence**: cursors, selections, characters, statuses, speech bubbles, pushes and follow-me are ephemeral room
  ops (`PRESENCE_OP_KINDS`), relayed and forgotten, never logged and never replayed to a reconnecting client, as in
  livediagram ([Avatar mode](../../../../livediagram/docs/specs/008-canvas/avatar-mode.md#realtime)).
- **A person's character**: kept in their own browser only, under livehuddle's own storage key (livediagram's
  `livediagram:v2:avatar-config`, renamed for livehuddle at the fork), so a costume chosen in one product does not
  leak into the other.
- Future audio, video and screen-share streams: never through the Durable Object and never stored
  ([Future work](../005-project-roadmap/future-work.md)).

## The room's limits

- A room holds at most **100 connections** (`ROOM_MAX_CONNECTIONS` in `packages/api-schema/src/room-capacity.ts`,
  shared by every product). The All-Hands Hall seats 32, so v1 fits, but a company all-hands of more than 100 people
  does not. Raising the cap is a separate, measured change (below).
- **Fan-out is the cost to watch.** Every relayed op is sent to every socket, and a walking character publishes about
  30 packets a second. One walker in a full room costs about 3,000 sends a second; everyone walking at once in a full
  room is about 300,000, which one Durable Object cannot sustain. livediagram meets this rarely because walking is a
  side feature; livehuddle makes it the main one. Before v1 ships, the build measures it and bounds it
  ([Build plan](../005-project-roadmap/build-plan.md#risks), R3).

## The apps

| App         | Runtime                     | Talks to                                                       |
| ----------- | --------------------------- | -------------------------------------------------------------- |
| `router`    | Worker, livehuddle.app      | Every app below, by service binding                            |
| `editor`    | Next.js on its own Worker   | `api` (REST and the room's WebSocket), the platform's services |
| `api`       | Worker + `DocumentRoom` DOs | accounts (token check), index (filing, grants), media          |
| `marketing` | Next.js on its own Worker   | Nothing at runtime                                             |
| `help`      | Next.js on its own Worker   | Nothing at runtime                                             |

The `mcp` and `cli` apps join in v1.1, if the owner takes that recommendation
([Open decisions](../005-project-roadmap/open-decisions.md) D3).
