// "Did anyone actually work together on this?" (spec/22).
//
// Every other collaboration number counts INTENT rather than the thing
// itself: links created, comments left, teams formed. The one event that
// looked like presence, `Diagram·Joined`, fires only for a share-link
// visitor (useIdentityBootstrap gates it on `!isOwnerVisit`), so two
// teammates editing the same team diagram at the same moment produced two
// `Diagram·Loaded` and were indistinguishable from one person opening it
// twice. The multiplayer product had no multiplayer metric.
//
// This is that metric: one `Diagram·Used·Multiplayer` the first time a room
// holds somebody besides us.
import { track } from '@/lib/telemetry';

// Diagram ids already reported in this page load. Module-level, not a ref,
// so a reconnect (a new effect run, a fresh WebSocket) doesn't re-report the
// same session — the question is "was this open shared with a live peer",
// answered once, not once per dropped connection. Bounded in practice: a
// page load opens one diagram, and a navigation reloads the module.
const reported = new Set<string>();

// `participantCount` is the room's own presence list, which INCLUDES us, so
// a peer is present at 2. Called on every presence frame; all but the first
// qualifying one are dropped here rather than at the call site.
export function reportMultiplayerPresence(
  diagramId: string | null,
  participantCount: number,
): void {
  if (!diagramId || participantCount < 2) return;
  if (reported.has(diagramId)) return;
  reported.add(diagramId);
  track('Diagram', 'Used', 'Multiplayer');
}

// Test seam: the module-level guard would otherwise leak between cases.
export function resetMultiplayerPresenceReports(): void {
  reported.clear();
}
