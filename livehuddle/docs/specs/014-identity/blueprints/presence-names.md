# Presence names: blueprint

Derived from [Auth + guest access, "Presence names"](../auth-and-guest-access.md#presence-names) (Work Tracker 797
and 801). Paths are relative to `livehuddle/`.

## Domain and naming

- **Presence name**: the `name` on a session's roster entry (`ParticipantPresence.name`). Always the room's pick.
- **Profile name**: a person's liveworkspace profile name (`ParticipantDTO.name`, `apps/api/src/liveworkspace/profiles.ts`).
- **Verified name**: the profile name the api stamped on the upgrade, pinned on the session as `verifiedName`
  (`apps/api/src/room-session.ts`).
- **Visitor name**: a link visitor's typed name, kept in `visitor_names` by collab key (`apps/api/src/db/visitor-names.ts`).
- **Guest name**: `guestNameForKey(key)` (`packages/api-schema/src/guest-names.ts`), two FNV-1a picks over the
  shared word lists `GUEST_NAME_ADJECTIVES` and `GUEST_NAME_ANIMALS`, which the editor's `randomName` also draws from.
- **Person** vs **session with no identity**: a session with a person tag (`session.personTag`, set by the upgrade
  for every person) vs one without (a link visitor).

## Behaviour and state

- `presenceNameFor(session)` (`apps/api/src/document-room-rules.ts`): `verifiedName || visitorName ||
guestNameForKey(collabKey ?? presenceId)`. `helloPresence(claimed, session, visitorName)` sets `name` from it and
  never reads `claimed.name`.
- The hello branch (`document-room/room-message.ts`) passes `storedVisitorName(room, keyed)` (`room-names.ts`): the
  stored name for the session's collab key, only for a session with no person tag, after `withVisitorKey` gave it
  its browser's key.
- `visitor-name` frame → `nameVisitor` (`room-names.ts`): refused when `typedPresenceName` gives null, the session has
  no presence yet, a person tag, or the same name already; else writes `visitor_names`, rewrites the attachment's
  presence name, renames the key's open visits and broadcasts the roster.
- `POST /presence-name` (`room-internal.ts`) → `renamePerson(room, personTag, name)`: every session with that tag gets
  `verifiedName` and, once hello'd, the presence name; open visits renamed per key; one broadcast if any entry changed.
- The editor (`apps/editor/app/document/[id]/room-name-sync.ts`): `createRoomNameSync()` holds one pending chosen name
  (trimmed) for `ROOM_NAME_PENDING_MS`. `fromRoster(roomName, localName)` clears it when the room shows it, holds the
  local name while it waits, and otherwise answers the room's name when it differs. `useRoomConnection` finds our entry
  by the key from the `collab-key` frame (`roomKeyRef`, set before the roster that follows) and calls `adoptRoomName`
  (`useEditorRoom`), which marks the name persisted so no profile write echoes it.
- `announceRoomName` (called by `useEditorPersistence` after a name change's profile write, and on a Settings ›
  Profile save): no room → nothing; no identity (no account, no guest token) → `visitor-name` frame; a person whose
  write failed → nothing; else `chose` then `apiAnnounceRoomName`.

- `presence-colour` frame → `recolourSession` (`document-room/room-colour.ts`): `presenceColour(raw)` (the hello's own
  check, `document-room-rules.ts`); refused when empty, before the hello, or the same colour; else the attachment's
  presence colour, the key's open visits (`recolourOpenVisits`) and one roster broadcast. Any level. The editor sends
  it (`announceRoomColour`, `room-name-sync.ts`) from `useEditorPersistence` when our colour changes, and on a
  Settings › Profile save.
- `acceptSession`'s 13th argument `account` (from `verifiedSessionOf`'s `X-Verified-Account`, passed by
  `room-grants.ts`) pins `SessionAttachment.account`: the Google picture rule and Attendance's `guest` read it.

## Interfaces and contracts

- Upgrade header `X-Verified-Name`: `presenceNameHeader(name)` = `encodeURIComponent(cutParticipantName(name))`, or
  `''`. Read by `verifiedSessionOf`: decoded, trimmed, cut; a bad encoding or blank is null. Overwritten on every
  upgrade, like every trust header.
- `POST /api/documents/:id/room-name` (`routes/document-room-routes.ts`): no body. Grant any level (`resolveDocumentGrant`),
  404 none, 410 trashed, 403 `community_link`. Answers `RoomNameResponse` `{ name: string | null }`.
- Room internal `POST /presence-name` `{ personTag: string, name: unknown }` → `{ renamed: number }`; 400
  `missing person`. Worker side `relayPresenceName` (`room-client.ts`), `ROOM_RELAY_TIMEOUT_MS`, null on failure.
- Client frames `VisitorNameMessage` `{ kind: 'visitor-name', name: string }` and `PresenceColourMessage`
  `{ kind: 'presence-colour', color: string }` (`packages/api-schema/src/room-messages.ts`).

## Data and persistence

- `visitor_names (person_key TEXT PRIMARY KEY, name TEXT NOT NULL, named_at INTEGER NOT NULL)`, schema step V8
  (`document-schema.ts`). Upsert per key; pruned to `VISITOR_NAMES_MAX` newest after each write. Never in a copy, an
  export or the outbox. Purged with the room (`deleteAll`). No account data: keys are visitor keys only.
- `SessionAttachment.verifiedName?: string` (at most 120 characters).

## Errors and edge cases

- A person with no profile, or a profile read that failed: no header, guest name.
- A store failure reading or writing a visitor name: logged, the session keeps its guest name or shows the typed name
  unkept.
- A document never started: nothing stored; the typed name still shows for the session.
- A rename before the socket's hello: the attachment holds `verifiedName`, the hello uses it.
- The room unreachable on a rename: the door still answers the name and logs; the next upgrade reads the profile.

## Security and trust

- No client-sent name is believed: the hello's is never read; the header is overwritten by the worker; the door reads
  the profile itself, fresh. A visitor name is accepted only from a session with no person tag.
- The visitor-name frame rides the per-socket frame cap (`admitFrame`), like every frame.

## Performance and limits

- Upgrade: one profile read per person, remembered `PROFILE_CACHE_MS` per isolate (no extra call on a warm isolate),
  started before the other header work.
- Hello: one indexed `SELECT` by primary key for a session with no identity; none for a person.
- Rename: one fresh accounts read and one room call per rename (a person action, never a hot path); `renamePerson` is
  O(sockets), at most `ROOM_MAX_CONNECTIONS`.
- `visitor_names`: at most 1,000 rows, a few dozen bytes each.

## Observability

- `[presence-name] no_profile` (door, `person` true/false), `[presence-name] room_unavailable`,
  `[presence-name] visitor name not read` / `not kept`, `[presence-name] visits not renamed`,
  `[presence-colour] visits not recoloured`.

## Testing

- `apps/api/src/document-room-rules.test.ts`: `presenceNameFor`, `typedPresenceName`, a forged hello name at each
  level, a visitor's stored and guest names.
- `apps/api/src/room-session.test.ts`: the header read, encoding, cut and blanks.
- `apps/api/src/document-room/room-names.test.ts`: two and more clients through a real room: a forged name never
  reaches a peer at any level; a visitor's typed name reaches peers and Attendance and survives a reload; a typed-
  nothing visitor keeps one name; refusals; a person's rename across devices; the store cap and failures; a colour
  change reaching peers and Attendance at every level, and its refusals; an account session through the real upgrade
  keeping its Google picture and an account's visit.
- `apps/api/src/routes/document-room-routes.test.ts`: the header on the upgrade; the door at each level, for a link
  visitor, with the room down, and its refusals.
- `apps/editor/app/document/[id]/room-name-sync.test.ts`, `useRoomConnection.room-name.test.tsx`,
  `lib/api/room-name.test.ts`: the editor's side.
- `apps/editor/e2e/presence-names.spec.ts`: two browsers: the owner sees the visitor's typed join name, and after a
  reload.

## Constants and configuration

- `ROOM_NAME_PENDING_MS` = 15,000 (editor): longer than a door's answer, short enough that a lost rename is undone
  quickly. Safe range 5 s to 60 s.
- `VISITOR_NAMES_MAX` = 1,000 (api): a document's link visitors with a typed name. Safe range 100 to 10,000.

## Defaults ledger

- [PN1, PN2](DEFAULTS.md).
