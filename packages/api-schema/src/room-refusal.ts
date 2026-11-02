// The room's answer to an Editor's element op it refused (each product's docs/specs/012-collaboration/
// realtime-conflict-resolution.md "An invalid element"): sent to the sender's socket alone, never relayed. The op it
// answers was not relayed, sequenced or kept for catch-up.

/** Why the room refused an element op. */
export const ROOM_OP_REFUSAL_REASONS = [
  // An element fails the product's validator for a kind and a field the room knows.
  'invalid-element',
  // A tab op names one element id twice.
  'duplicate-element',
  // A tab op holds more elements than a tab may.
  'too-many-elements',
] as const;

export type RoomOpRefusalReason = (typeof ROOM_OP_REFUSAL_REASONS)[number];

// The longest tab or element id the frame repeats back: the room's other id bound; a UUID is 36.
export const OP_REFUSED_ID_MAX = 64;

// `op`: the refused op's kind. `ref`: the op frame's own `ref`, echoed so a save waiting on that op stops waiting.
export type OpRefusedMessage = {
  kind: 'op-refused';
  op: string;
  reason: RoomOpRefusalReason;
  tabId?: string;
  elementId?: string;
  field?: string;
  ref?: number;
};
