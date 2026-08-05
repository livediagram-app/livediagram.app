// Whether a timeline event counts as "New" for this reader (spec/138 §2).
//
// Two bounds, and the upper one is the interesting half. Expiry warnings are
// written FUTURE-dated on purpose — a token lapsing on the 12th is recorded at
// the 12th so it renders in the Upcoming band above Today — while the seen
// watermark is only ever written as `now`. So `occurredAt > lastSeenAt` is
// permanently true for anything scheduled, and every Upcoming bubble wore a
// New pill on every visit, forever. Something scheduled isn't news until it
// happens.
//
// Its own module so the rule is testable without mounting the feed, and so
// this pill and the server's unread badge (countUnseen, which clamps the same
// way) can be read side by side — they answer the same question and had drifted
// into disagreeing with each other by being written in two places.
export function isNewEvent(
  occurredAt: number,
  lastSeenAt: number | undefined,
  now: number = Date.now(),
): boolean {
  // No watermark means the reader has never opened the feed. Marking their
  // whole history New would be noise, so nothing is new until they've been
  // here once.
  if (lastSeenAt === undefined) return false;
  return occurredAt > lastSeenAt && occurredAt <= now;
}
