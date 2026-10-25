// The telemetry pairs only the api worker writes (docs/specs/017-telemetry/telemetry.md). Each one is
// counted server-side because the server is the only party that can count it
// honestly: an email sent from a cron (Email·Sent), a first visit to a shared
// document (Document·Joined, once per visitor and document), a new signed-in session
// or account (Session·SignedIn / SignedUp, once per authentication whatever
// the method), a realtime room first holding two people (Document·Used, the
// Multiplayer count, once per session by the document room rather than once
// per participant).
//
// POST /api/events drops these, so an old cached editor bundle that still
// emits them (or anyone posting by hand) can't double count what the worker
// already records. Pairs are `Category·Action`, the same spelling as the
// editor's telemetry manifest.
export const SERVER_EMITTED_EVENT_PAIRS: readonly string[] = [
  'Agent·Present',
  'Document·Joined',
  'Document·Used',
  'Email·Sent',
  'Session·SignedIn',
  'Session·SignedUp',
  // Teams and API tokens are run on liveworkspace.app: accounts counts these as they happen, under the
  // app the person signed up through. Team·Created, ·Added and ·Removed stay the browser's too (a team
  // made in an app, an item moved into or out of a team); their accounts types (Member, Invite, Self,
  // Link) are ones no browser sends.
  'Team·Changed',
  'Team·Declined',
  'Team·Deleted',
  'Team·Joined',
  'Team·Shared',
  'Token·Removed',
];

export function isServerEmittedEvent(e: { category: string; action: string }): boolean {
  return SERVER_EMITTED_EVENT_PAIRS.includes(`${e.category}·${e.action}`);
}
