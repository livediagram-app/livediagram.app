import { RELAYED_SAMPLE_KINDS } from '@liveworkspace/api-kit/room-presence-relay';

// The sample streams this room relays and coalesces (docs/specs/015-api/api.md "A busy room bounds its presence
// fan-out"): the cursors (the walking characters join as their own track, ../room-avatar-track.ts), plus proximity
// audio's talking level (docs/specs/012-collaboration/proximity-audio.md "The wire"), so a full Space talking adds
// bytes to frames the walkers already cause, never frames; and a game's paddle (docs/specs/009-elements/social-pieces.md "The wire"),
// which only its tab can see.
export const ROOM_SAMPLE_KINDS: ReadonlySet<string> = new Set([
  ...RELAYED_SAMPLE_KINDS,
  'avatar-voice',
  'game-input',
]);
