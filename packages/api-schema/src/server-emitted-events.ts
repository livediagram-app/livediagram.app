// The telemetry pairs only the api worker writes (spec/22). Each one is
// counted server-side because the server is the only party that can count it
// honestly: an email sent from a cron (Email·Sent), a first visit to a shared
// diagram (Diagram·Joined, once per visitor and diagram), a new Clerk session
// or account (Session·SignedIn / SignedUp, once per authentication whatever
// the method).
//
// POST /api/events drops these, so an old cached editor bundle that still
// emits them (or anyone posting by hand) can't double count what the worker
// already records. Pairs are `Category·Action`, the same spelling as the
// editor's telemetry manifest.
export const SERVER_EMITTED_EVENT_PAIRS: readonly string[] = [
  'Diagram·Joined',
  'Email·Sent',
  'Session·SignedIn',
  'Session·SignedUp',
];

export function isServerEmittedEvent(e: { category: string; action: string }): boolean {
  return SERVER_EMITTED_EVENT_PAIRS.includes(`${e.category}·${e.action}`);
}
