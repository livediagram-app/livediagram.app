// Participants: the persisted row and what the realtime room broadcasts as presence, every product's.

import type { AccessLevel } from './access-levels';

// A persisted participant row, returned by `POST /api/participants`
// when the editor registers identity. The editor app wraps this in its
// own `Participant` type that adds presence status (`online` / `away`
// / `stale`) on top — that status is purely client-derived from idle
// time and never crosses the wire.
export type ParticipantRecord = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  // The person's published Google picture (liveworkspace/docs/accounts.md "Profile pictures"), for a signed-in
  // reader only; absent for none, for a guest, and when the reader is not signed in.
  picture?: string;
};

// Realtime presence identity, broadcast to every connected peer: the room and the participant route clamp to
// these, and the editor clamps what it reads to them too.
export const MAX_PARTICIPANT_NAME_LEN = 120;
export const MAX_COLOR_LEN = 64;

// What the realtime room broadcasts as presence. Identical shape to
// `ParticipantRecord` minus `createdAt` — presence is concerned with
// "who is connected right now", not when they first registered.
export type ParticipantPresence = {
  id: string;
  name: string;
  color: string;
  // Server-resolved role inside this document. Set by the api worker
  // at WebSocket upgrade time before the request reaches the Durable
  // Object — derived from owner-id match (always 'edit') or the
  // share-code the visitor used to join. Optional so existing
  // hello frames keep parsing while clients catch up; missing value
  // is treated as "unknown role" by the UI (no badge surfaced). An access level
  // (docs/specs/013-workspace/share-roles.md); readers parse it with parseStoredLevel.
  role?: AccessLevel;
  // Id of the tab this participant is currently focused on. The room
  // remembers it from their `tab-focus` ops and echoes it in the
  // presence list so a LATE joiner learns where everyone already is —
  // tab-focus ops only fire on a switch, so without this a joiner would
  // default existing peers to the first tab until they happened to move.
  // Undefined until the participant's first tab-focus op lands.
  tabId?: string;
  // The tab in their other pane while they work side by side (docs/specs/007-editor/split-view.md
  // "Presence"), remembered from the same tab-focus ops so a late joiner sees it too. Undefined with
  // no split.
  besideTabId?: string;
  // The id this participant WRITES INTO THE DOCUMENT for anything recorded
  // per person — today the `responses` on a done check / estimate card /
  // temperature check (docs/specs/012-collaboration/participant-responses.md).
  //
  // It exists because `id` above cannot do that job. `id` is minted fresh by
  // the room for every socket (docs/specs/015-api/public-api-and-tokens.md §6), so it is unforgeable but also
  // unrecognisable: it changes on reconnect and matches nothing that was ever
  // saved. Joining a saved answer back to the person in the roster needs an
  // id that is STABLE across connections, and the owner id can't be it —
  // publishing that is exactly what §6 forbids.
  //
  // So this is a separate, per-browser random the client mints and keeps
  // (`<product>:v2:collab-key`), relayed VERBATIM: unlike `id` and `role`
  // it is claimed, not verified. That is deliberate and costs nothing — it is
  // not a credential and grants nothing, and any edit-role peer could already
  // write any participant id straight into the document. Optional, so an
  // older client's hello still parses (the roster falls back to `id`, which
  // simply matches nothing — the behaviour before this field existed).
  key?: string;
  // The person's Google picture (liveworkspace/docs/accounts.md "Profile pictures"): kept by the room only from a
  // session a verified account holds and only when it is a Google picture URL (isProfilePictureUrl), and sent
  // only to account sessions; a guest's roster never carries one.
  picture?: string;
};
