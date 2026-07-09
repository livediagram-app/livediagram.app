import { useEffect, useRef, useState } from 'react';
import type { Participant } from '@/lib/identity';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { PortalMenu } from '@/components/primitives/PortalMenu';

// Compact stack of participant initials, sitting between the tab
// label and the ellipsis menu in TabBar. Rendered smaller than the
// EditorHeader avatars so it doesn't dominate the tab. The last
// avatar uses 0 negative margin so the stack sits fully inside the
// pill's right padding.
//
// Add / remove are animated: incoming avatars pop in with the brand
// overshoot easing, departing avatars scale out before being dropped
// from the DOM. Tracked in `rendered` state because React unmounts
// the node immediately when props change otherwise, so we hold onto
// leavers long enough to finish their exit transition.
//
// Lifted out of TabBar.tsx (was 991 lines) so the bar file reads as
// tab-row chrome plus its inline icons, and this lives where the
// presence-fade animation behaviour is testable in isolation.

const POP_OUT_MS = 240;

export function TabPresenceStack({
  participants,
  selfId,
  selfRole,
}: {
  participants: Participant[];
  selfId: string;
  selfRole: 'edit' | 'view';
}) {
  type Slot = { p: Participant; leaving: boolean };
  const [rendered, setRendered] = useState<Slot[]>(() =>
    participants.map((p) => ({ p, leaving: false })),
  );
  // The "+N" overflow badge opens a popover listing the participants it hides.
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowBadgeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const incomingIds = new Set(participants.map((p) => p.id));
    setRendered((prev) => {
      const stable = new Map(prev.map((s) => [s.p.id, s] as const));
      const next: Slot[] = [];
      // Preserve current entries: mark leaving the ones no longer
      // present, refresh the participant payload for the ones that
      // are. Skip already-leaving entries that have since been
      // re-added: the leaving timer below would otherwise yank them
      // back out.
      for (const slot of prev) {
        if (incomingIds.has(slot.p.id)) {
          const fresh = participants.find((p) => p.id === slot.p.id)!;
          next.push({ p: fresh, leaving: false });
        } else if (!slot.leaving) {
          next.push({ p: slot.p, leaving: true });
        } else {
          next.push(slot);
        }
      }
      // Append new arrivals.
      for (const p of participants) {
        if (!stable.has(p.id)) next.push({ p, leaving: false });
      }
      // No-op if nothing actually changed; cheap reference check
      // saves a re-render storm when the parent computes the same
      // identity on every animation frame.
      if (
        next.length === prev.length &&
        next.every((s, i) => s.p === prev[i]!.p && s.leaving === prev[i]!.leaving)
      ) {
        return prev;
      }
      return next;
    });
  }, [participants]);

  useEffect(() => {
    const leavers = rendered.filter((s) => s.leaving);
    if (leavers.length === 0) return;
    const id = window.setTimeout(() => {
      setRendered((prev) => prev.filter((s) => !s.leaving));
    }, POP_OUT_MS);
    return () => window.clearTimeout(id);
  }, [rendered]);

  if (rendered.length === 0) return null;
  // Visible slots: leavers count for layout (they're still animating
  // out) but the overflow badge only considers active arrivals so a
  // departing participant doesn't keep the +N up.
  const active = rendered.filter((s) => !s.leaving);
  const visibleCap = 3;
  const overflow = Math.max(0, active.length - visibleCap);
  // The participants hidden behind the "+N" badge — listed in its popover.
  const overflowParticipants = active.slice(visibleCap).map((s) => s.p);
  const shown = rendered
    .filter((s) => !s.leaving || rendered.indexOf(s) < visibleCap)
    .slice(0, visibleCap + leavingExtra(rendered, visibleCap));
  const slots = overflow > 0 ? shown.length + 1 : shown.length;

  return (
    // ml-2 keeps the avatar stack off the tab name it sits beside in
    // TabBar (the row only uses gap-1, which crowds the initials).
    <div className="ml-2 flex items-center">
      {shown.map((slot, i) => (
        <span
          key={slot.p.id}
          className={`inline-flex ${i === slots - 1 ? '' : '-mr-0.5'} ${
            slot.leaving ? 'animate-pop-out' : 'animate-pop-in'
          }`}
          style={{ zIndex: slots - i, transformOrigin: 'center' }}
        >
          <ParticipantAvatar
            participant={slot.p}
            size={16}
            withTooltip
            badges={(() => {
              if (slot.p.id === selfId) {
                return ['You', selfRole === 'view' ? 'Viewer' : 'Editor'];
              }
              if (slot.p.role) {
                return [slot.p.role === 'view' ? 'Viewer' : 'Editor'];
              }
              return undefined;
            })()}
          />
        </span>
      ))}
      {overflow > 0 ? (
        <>
          <button
            ref={overflowBadgeRef}
            type="button"
            onClick={() => setOverflowOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={overflowOpen}
            aria-label={`${overflow} more participant${overflow === 1 ? '' : 's'} on this tab`}
            className="inline-flex h-4 w-4 animate-pop-in cursor-pointer items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[8px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-300 dark:border-slate-800 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            +{overflow}
          </button>
          {overflowOpen ? (
            <PortalMenu
              anchor={overflowBadgeRef.current}
              placement="above"
              onClose={() => setOverflowOpen(false)}
            >
              <div className="scrollbar-slim max-h-64 overflow-y-auto px-1 py-1">
                {overflowParticipants.map((p) => {
                  const role = participantRole(p, selfId, selfRole);
                  return (
                    <div key={p.id} className="flex items-center gap-2 px-2 py-1.5">
                      <ParticipantAvatar participant={p} size={20} />
                      <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                        {p.name}
                      </span>
                      {role ? (
                        <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {role}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </PortalMenu>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// Role chip text for a participant row in the overflow popover: "You" for
// the local viewer, else Viewer / Editor when the role is known, else none.
function participantRole(p: Participant, selfId: string, selfRole: 'edit' | 'view'): string | null {
  if (p.id === selfId) return selfRole === 'view' ? 'You · Viewer' : 'You';
  if (p.role) return p.role === 'view' ? 'Viewer' : 'Editor';
  return null;
}

// Helper so the visible slice keeps any leavers that occupy a slot
// inside the cap (so they can finish their exit animation) without
// also showing leavers past the cap.
function leavingExtra(slots: { leaving: boolean }[], cap: number): number {
  let extra = 0;
  let active = 0;
  for (const s of slots) {
    if (active >= cap) break;
    if (s.leaving) extra++;
    else active++;
  }
  return extra;
}
