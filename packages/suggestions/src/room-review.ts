// An item's review settings in its room (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md "Suggest
// Only"; livedocuments/docs/specs/007-editor/suggestions.md "Suggest Only"): read from the item's own storage (cached
// until an Editor changes them), the people who join as Participants noted for the Share dialog, and each Participant
// session told whether it suggests. The same in every product's room; each hands in its storage and its sockets.
import {
  parseStoredReview,
  suggestOnlyFor,
  withReviewPinned,
  withReviewSeen,
  type StoredReview,
} from './review';

/** What the review asks of one session: its server-verified level, keys and link, and the name it joined with. */
export type ReviewSession = {
  role: string | null;
  // The collab key the upgrade verified (X-Verified-Collab-Key), or null.
  collabKey: string | null;
  // The key on its presence (the verified one, or one the room minted for a socket with no identity).
  presenceKey: string | null;
  shareCode: string | null;
  name: string;
};

export type RoomReviewDeps<W> = {
  // The stored settings (JSON), or null for none; null too while the item has no storage yet.
  read: () => string | null;
  // Store the settings; skipped by the caller while the item has no storage.
  write: (text: string) => void;
  sockets: () => Iterable<W>;
  sessionOf: (ws: W) => ReviewSession | null;
  // The room's word to one socket, as a system op (never relayed, never sequenced).
  tell: (ws: W, suggestOnly: boolean) => void;
};

export type RoomReview<W> = {
  review: () => StoredReview;
  // Whose suggestions a Participant session's writing must be when it is on Suggest Only: its collab key (a session
  // with none may write nothing, which no author matches). Null for anyone else.
  suggestByOf: (session: ReviewSession) => string | null;
  joined: (ws: W, session: ReviewSession) => void;
  changed: () => void;
};

const NO_AUTHOR = '\u0000';

export function createRoomReview<W>(deps: RoomReviewDeps<W>): RoomReview<W> {
  let cached: StoredReview | null = null;
  const review = (): StoredReview => {
    cached ??= parseStoredReview(deps.read());
    return cached;
  };
  const keyOf = (s: ReviewSession) => s.collabKey ?? s.presenceKey ?? null;
  const suggestByOf = (s: ReviewSession): string | null => {
    if (s.role !== 'participate') return null;
    const key = keyOf(s);
    const on = suggestOnlyFor(review(), {
      shareCode: s.shareCode,
      collabKey: key,
      verifiedKey: s.collabKey,
    });
    return on ? (key ?? NO_AUTHOR) : null;
  };
  return {
    review,
    suggestByOf,
    joined(ws, s) {
      if (s.role !== 'participate') return;
      const key = keyOf(s);
      const was = review();
      if (key) {
        const now = Date.now();
        const seen = withReviewSeen(was, { key, name: s.name }, now);
        // Pinned by the server-verified key alone: a key the client named could be changed to slip the pin.
        const next =
          s.collabKey && s.shareCode ? withReviewPinned(seen, s.collabKey, s.shareCode, now) : seen;
        if (next !== was) {
          deps.write(JSON.stringify(next));
          cached = next;
        }
      }
      deps.tell(ws, suggestByOf(s) !== null);
    },
    changed() {
      cached = null;
      for (const ws of deps.sockets()) {
        const s = deps.sessionOf(ws);
        if (s?.role !== 'participate') continue;
        deps.tell(ws, suggestByOf(s) !== null);
      }
    },
  };
}
