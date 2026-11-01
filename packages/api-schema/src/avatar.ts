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

export type AvatarConfig = {
  gender: AvatarGender;
  clothing: AvatarClothing;
  hair: AvatarHair;
  size: AvatarSize;
};

// One participant's Avatar-mode character (docs/specs/008-canvas/avatar-mode.md), as it travels over the
// presence channel. Position is the character's FEET in canvas coords; the
// animation inputs and the costume ride along so a peer draws the same
// character, walk cycle, hop, and flag wave the sender sees. Deliberately
// small — this goes out at cursor rates.

// The statuses a character can show in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Status"), the one list both
// ends of the wire read: the editor's picker and labels are keyed to it, so a status can never be sent that a
// receiver's type does not name.
export const AVATAR_STATUS_IDS = ['available', 'focus', 'meeting', 'away'] as const;
export type AvatarStatus = (typeof AVATAR_STATUS_IDS)[number];

export type AvatarPresence = {
  x: number;
  y: number;
  facing: 'down' | 'up' | 'left' | 'right';
  // The sender's costume (docs/specs/008-canvas/avatar-mode.md): gender / clothing / hair / size, each a
  // preset token from a closed set. Optional so a packet from an older client
  // still parses — the receiver falls back to the default character. Purely
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
  // A drink in the hand (docs/specs/009-elements/office.md "Using it"), from a water cooler or a coffee machine,
  // or none. Presence like the seat: put down after a minute or on leaving the mode, never in the document.
  // Optional so an older client's packet parses as empty-handed; anything else draws nothing.
  holding?: 'water' | 'coffee' | null;
  // How the person is (docs/specs/008-canvas/avatar-mode.md "Status"), or none. Presence for the session only;
  // a receiver draws only a status it knows. Optional so an older client's packet parses as no status.
  status?: AvatarStatus | null;
};

// The sender's Avatar-mode character, so everyone in the room sees everyone else walking around. Ephemeral presence
// exactly like cursor / laser: throttled to ~30 Hz, never logged, never replayed to a reconnecting client, and
// `avatar: null` means "I left the mode, drop my character". The tab id scopes rendering to peers looking at the
// same tab.
export type AvatarOp = { kind: 'avatar'; tabId: string; avatar: AvatarPresence | null };

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
