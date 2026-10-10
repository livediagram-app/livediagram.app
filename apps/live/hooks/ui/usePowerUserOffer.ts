import { useEffect, useRef } from 'react';
import { track } from '@/lib/telemetry';
import { setPowerUserMode } from '@/lib/power-user-mode';
import {
  localDayKey,
  offerDue,
  offerEligible,
  readOfferCounters,
  recordEditingSession,
  recordShortcut,
  writeOfferCounters,
  type OfferCounters,
} from '@/lib/power-user-offer';
import type { UserPreferences } from '@/lib/user-preferences';
import type { ToastOffer } from './useToast';
import { debugLog } from '@/lib/debug-log';

export type PowerUserOfferDeps = {
  prefs: UserPreferences;
  // The server copy has been merged (or failed to arrive), so the synced
  // `powerUserOfferShown` latch can be trusted.
  settled: boolean;
  editable: boolean;
  embed: boolean;
  zen: boolean;
  // Persist the next preferences (state + cache + server).
  apply: (next: UserPreferences) => void;
  offer: (offer: ToastOffer) => void;
};

const OFFER_COPY = {
  message: 'Power user mode: fewer labels and a few faster defaults.',
  confirmLabel: 'Try power user mode',
  declineLabel: 'No thanks',
};

// The once-ever power user mode offer (docs/specs/007-editor/power-user-mode.md): records editing
// sessions and shortcuts on this device, and shows the offer the first time
// either threshold is met while the session is eligible.
export function usePowerUserOffer(deps: PowerUserOfferDeps): { onShortcutUsed: () => void } {
  // Synced after each commit, first among the effects, so the session effect
  // below and every later event read this render's deps.
  const live = useRef(deps);
  useEffect(() => {
    live.current = deps;
  });
  const shown = useRef(false);

  const evaluate = (counters: OfferCounters) => {
    const d = live.current;
    if (shown.current || !d.settled || !offerDue(counters)) return;
    if (!offerEligible(d.prefs, { editable: d.editable, embed: d.embed, zen: d.zen })) return;
    shown.current = true;
    // Marked the moment it shows: never again, answered or not.
    d.apply({ ...d.prefs, powerUserOfferShown: true });
    track('UI', 'Opened', 'PowerUserOffer');
    debugLog('[power-user-offer] shown', {
      days: counters.days,
      shortcuts: counters.shortcuts,
    });
    d.offer({
      ...OFFER_COPY,
      onConfirm: () => {
        track('UI', 'Used', 'PowerUserOffer');
        track('UI', 'Toggled', 'PowerUserModeOn');
        debugLog('[power-user-offer] accepted');
        const latest = live.current;
        latest.apply(setPowerUserMode({ ...latest.prefs, powerUserOfferShown: true }, true).prefs);
      },
      onDecline: () => {
        track('UI', 'Declined', 'PowerUserOffer');
        debugLog('[power-user-offer] declined');
      },
    });
  };

  // One editing session per page load, counted once the preferences settle
  // and only while the document is editable.
  const sessionRecorded = useRef(false);
  const { settled, editable } = deps;
  useEffect(() => {
    if (sessionRecorded.current || !settled || !editable) return;
    sessionRecorded.current = true;
    const next = recordEditingSession(readOfferCounters(), localDayKey(new Date()));
    writeOfferCounters(next);
    evaluate(next);
  }, [settled, editable]);

  const onShortcutUsed = () => {
    const next = recordShortcut(readOfferCounters());
    writeOfferCounters(next);
    evaluate(next);
  };

  return { onShortcutUsed };
}
