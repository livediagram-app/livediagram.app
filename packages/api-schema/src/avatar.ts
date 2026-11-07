// Avatar mode's wire shapes (livediagram's docs/specs/008-canvas/avatar-mode.md), shared by every product with
// Avatar mode: the costume vocabulary, the statuses, a character's presence packet, and the `avatar` and
// `avatar-push` room ops (the `avatar-say` op is ./avatar-say). Each product's api-schema re-exports them and puts
// the ops in its own `RoomOp` union and `PRESENCE_OP_KINDS`.
//
// The costume vocabulary: the four choices the Avatar Panel offers, as closed sets of preset tokens.
//
// It lives in the wire package rather than the editor because both ends need
// it and neither owns it. The editor picks a costume and publishes it on the
// presence channel (AvatarPresence below); a peer receives the packet and
// draws the same character. Written out twice (once as named types in
// the editor, once inline in the presence message), the two sets could drift,
// and adding a sixteenth jumper to one of them would quietly mean peers never
// see it.
//
// Tokens only, no labels: what a costume is CALLED in the panel is the
// editor's business, and its catalogues (AVATAR_CLOTHING and friends) type
// their ids against these unions so the two cannot separate.
//
// Colour is deliberately absent. The shirt takes the participant's presence
// colour so a character matches its owner's cursor and name chip.
export type AvatarGender = 'male' | 'female';

export type AvatarClothing =
  | 'tee'
  | 'stripes'
  | 'jumper'
  | 'hoodie'
  | 'vest'
  | 'suit'
  | 'dress'
  | 'skirt'
  | 'polo'
  | 'flannel'
  | 'overalls'
  | 'labcoat'
  | 'hawaiian'
  | 'varsity'
  | 'turtleneck'
  | 'apron';

export type AvatarHair =
  | 'short'
  | 'buzz'
  | 'curly'
  | 'long'
  | 'ponytail'
  | 'bun'
  | 'mohawk'
  | 'bald'
  | 'pigtails'
  | 'afro'
  | 'spiky'
  | 'bob'
  | 'braid'
  | 'topknot';

export type AvatarSize = 'small' | 'regular' | 'tall';

// Hair colour (livehuddle's docs/specs/008-canvas/avatar-mode.md "Hair Colour"): natural colours first, then bold
// ones. A look like the rest, never an identity: the shirt keeps the presence colour.
export type AvatarHairColour =
  | 'black'
  | 'dark-brown'
  | 'brown'
  | 'auburn'
  | 'ginger'
  | 'blonde'
  | 'platinum'
  | 'grey'
  | 'white'
  | 'blue'
  | 'pink'
  | 'purple'
  | 'green';

export type AvatarConfig = {
  gender: AvatarGender;
  clothing: AvatarClothing;
  hair: AvatarHair;
  size: AvatarSize;
  // Optional, so a config stored or sent by a build that predates it still type-checks and parses: absent draws
  // Brown, the hair every character had before. An older receiver's parser rebuilds the config field by field and
  // simply drops it.
  hairColour?: AvatarHairColour;
};

// One participant's Avatar-mode character (docs/specs/008-canvas/avatar-mode.md), as it travels over the
// presence channel. Position is the character's FEET in canvas coords; the
// animation inputs and the costume ride along so a peer draws the same
// character, walk cycle, hop, and flag wave the sender sees. Deliberately
// small — this goes out at cursor rates.

// The statuses a character can show in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Status"), the one list both
// ends of the wire read: the editor's picker and labels are keyed to it, so a status can never be sent that a
// receiver's type does not name. `dnd` (Do Not Disturb) is livehuddle's call status (its
// docs/specs/012-collaboration/meeting-rooms-and-stage.md): every product parses and draws it, only livehuddle offers it.
// So do the rest after it (livehuddle's Need Help, Out to Lunch and its moods), appended so the list only grows: a
// client that predates a token reads it as no status, never as an error. `break` (On a Break) and `busy` (Busy) are
// the two livehuddle's seat pieces set (its docs/specs/009-elements/workday-pieces.md "Statuses a piece sets").
export const AVATAR_STATUS_IDS = [
  'available',
  'focus',
  'meeting',
  'away',
  'dnd',
  'help',
  'lunch',
  'angry',
  'celebrating',
  'thinking',
  'sick',
  'break',
  'busy',
] as const;
export type AvatarStatus = (typeof AVATAR_STATUS_IDS)[number];

export type AvatarPresence = {
  x: number;
  y: number;
  facing: 'down' | 'up' | 'left' | 'right';
  // The sender's costume (docs/specs/008-canvas/avatar-mode.md): gender / clothing / hair / size / hair colour, each a
  // preset token from a closed set. Optional: a lean packet leaves it out (AvatarPacket below) and the receiver keeps
  // the last one it saw from that peer, falling back to the default character for one it never saw. Purely
  // cosmetic, and never an identity claim.
  config?: AvatarConfig;
  // A reaction in progress (docs/specs/008-canvas/avatar-mode.md): which one, and how far into it the
  // sender is. The pose is derived from these two by a pure function on both
  // ends, so the wire carries a kind and a clock rather than a pose.
  reaction?: {
    kind: 'jumping-jacks' | 'wave' | 'spin' | 'cheer' | 'dance';
    elapsedMs: number;
  };
  walking: boolean;
  // Two-frame leg swing (0 | 1).
  stepFrame: number;
  // Height above the ground mid-hop, in canvas px (0 = standing).
  lift: number;
  // Flag-wave frame, or null when the flag is down.
  wave: number | null;
  // Chair (docs/specs/009-elements/chair.md): the element id of the chair this character is sitting
  // on, or null / absent when standing.
  //
  // Occupancy rides HERE, on ephemeral presence, and is deliberately never
  // written to the document: a chair therefore cannot be left permanently
  // occupied by somebody who closed their laptop, cannot conflict between two
  // clients, and reaches D1 and undo not at all. Optional so a
  // packet from an older client still parses as "standing".
  seatedOn?: string | null;
  // Which of the piece's seats (its `seatPoints` index), when the sitter sat (the sender's epoch ms) and a random
  // tiebreak drawn then (docs/specs/009-elements/chair.md "Occupancy is presence"): a seat takes one sitter, and two
  // who sat at once settle it the same way on every machine, the earlier `at` then the lower `tie` keeping it.
  // Optional so an older client's packet parses: it holds the seat nearest its feet. Sent only while seated.
  seat?: { index: number; at: number; tie: number } | null;
  // A drink in the hand (docs/specs/009-elements/office.md "Using it"), from a water cooler or a coffee machine,
  // or none. Presence like the seat: put down after a minute or on leaving the mode, never in the document.
  // Optional so an older client's packet parses as empty-handed; anything else draws nothing.
  holding?: 'water' | 'coffee' | 'juice' | 'soda' | null;
  // How the person is (docs/specs/008-canvas/avatar-mode.md "Status"), or none. Presence for the session only;
  // a receiver draws only a status it knows. Optional so an older client's packet parses as no status.
  status?: AvatarStatus | null;
};

// A character as it travels (docs/specs/008-canvas/avatar-mode.md "A busy room", "The costume rides only when it is
// needed"): a full `AvatarPresence`, or a lean one that leaves out the costume and each field at its resting value.
// A receiver turns either back into an `AvatarPresence` with `expandAvatarPacket`, filling in the costume it last saw.
export type AvatarPacket = Omit<AvatarPresence, 'stepFrame' | 'lift' | 'wave'> & {
  stepFrame?: number;
  lift?: number;
  wave?: number | null;
};

// How often (ms) a walking character's packet carries its costume even when nothing asked for it: the net for a
// receiver that missed the one that did (a reconnect, a room that hibernated and forgot it).
export const AVATAR_COSTUME_REFRESH_MS = 2000;

// A position rounded to a hundredth of a canvas px: invisible at any zoom, and a walk's float noise
// (512.3456789012345) costs 17 characters a coordinate on the wire.
const roundPx = (v: number): number => Math.round(v * 100) / 100;

/**
 * The lean form of `full`: the position rounded, the costume only `withCostume`, and every field at its resting
 * value (step frame 0, no hop, no wave, no seat, no drink, no status, no reaction) left out.
 */
export function leanAvatarPacket(full: AvatarPacket, withCostume: boolean): AvatarPacket {
  const out: AvatarPacket = {
    x: roundPx(full.x),
    y: roundPx(full.y),
    facing: full.facing,
    walking: full.walking,
  };
  if (full.stepFrame) out.stepFrame = full.stepFrame;
  if (full.lift) out.lift = full.lift;
  if (full.wave !== undefined && full.wave !== null) out.wave = full.wave;
  if (withCostume && full.config) out.config = full.config;
  if (full.reaction) out.reaction = full.reaction;
  if (full.seatedOn) out.seatedOn = full.seatedOn;
  if (full.seat) out.seat = full.seat;
  if (full.holding) out.holding = full.holding;
  if (full.status) out.status = full.status;
  return out;
}

/** Whether `packet` leaves anything out that an older receiver reads as required (the costume or a resting value). */
export function isLeanAvatarPacket(packet: AvatarPacket): boolean {
  return (
    packet.config === undefined ||
    packet.stepFrame === undefined ||
    packet.lift === undefined ||
    packet.wave === undefined
  );
}

/**
 * `packet` filled back out: the resting values it left out, and `costume` (the last one seen from this peer) when it
 * carries none. A packet that carries its own costume keeps it. Unvalidated, like the packet: a receiver still parses
 * the costume field by field (`parseAvatarConfig`).
 */
export function expandAvatarPacket(
  packet: AvatarPacket,
  costume: AvatarConfig | undefined,
): AvatarPresence {
  const config = packet.config ?? costume;
  return {
    ...packet,
    stepFrame: packet.stepFrame ?? 0,
    lift: packet.lift ?? 0,
    wave: packet.wave ?? null,
    ...(config ? { config } : null),
  };
}

// The sender's Avatar-mode character, so everyone in the room sees everyone else walking around. Ephemeral presence
// exactly like cursor / laser: throttled to ~30 Hz, never logged, never replayed to a reconnecting client, and
// `avatar: null` means "I left the mode, drop my character". The tab id scopes rendering to peers looking at the
// same tab. Full or lean (AvatarPacket): an editor sends lean packets only to a room that said it takes them.
export type AvatarOp = { kind: 'avatar'; tabId: string; avatar: AvatarPacket | null };

// One character SHOVES another. Sent by the pusher when their character reaches the person they clicked; only the
// participant named in `targetId` acts on it, by sliding their own character a short way along (`dx`, `dy`), a unit
// vector. Everyone's character stays authoritative on its owner's machine, so a push is a request, never a remote
// write, and a peer who has left the mode simply ignores it.
export type AvatarPushOp = {
  kind: 'avatar-push';
  tabId: string;
  targetId: string;
  dx: number;
  dy: number;
};
