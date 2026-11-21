'use client';

// Gives the editor its Automations (AutomationsContext) and draws the screen while it is open (blueprint ui.md "The
// door"). The screen's code is the app's to load (`Screen`, a lazy component over its kit and AutomationsDialog), so
// an item whose Editor never opens it pays nothing for it; this file, the row and the gate import none of it. The
// list itself is read a moment after the item opens, for the footer's amber dot. On an item kept Offline, or for a
// guest, it gives the footer its row alone, which opens the gate (`Gate`, the app's lazy wrapper of
// AutomationsSyncGate): Sync, or Sign In; once synced or signed in the same opening goes on to the screen.
// `?automations=1` (where a guest's sign-in comes back) opens it on arrival.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  AutomationsContext,
  AutomationsDoorContext,
  type AutomationsAccess,
  type AutomationsDoor,
  type AutomationsTarget,
} from './AutomationsContext';
import { AUTOMATIONS_PARAM } from './automations-gate';
import type { AutomationsPlumbing, AutomationsScope } from './kit';
import { readAutomations } from './use-automations';

// What stands before the screen (automationsGateFor): an item kept Offline syncs (the app's Sync move, once the
// reader is known); a guest on a server item signs in.
export type AutomationsGate = { badges?: readonly string[] } & (
  { kind: 'sync'; ready: boolean; sync: () => Promise<void> } | { kind: 'sign_in' }
);

// What the app's lazy screen is handed: it provides its kit and draws AutomationsDialog with these.
export type AutomationsScreenProps = {
  scope: AutomationsScope;
  target: AutomationsTarget;
  onTarget: (next: AutomationsTarget) => void;
  onClose: () => void;
  signedIn: boolean;
};

/** Whether this page was opened asking for the screen (`?automations=1`), as `?share=1` opens Share. */
const askedOpen = () => new URL(window.location.href).searchParams.get(AUTOMATIONS_PARAM) === '1';

// How long after the item opens the list is read for the dot: past the item's own first load.
export const AUTOMATIONS_FIRST_READ_MS = 3000;

export function AutomationsHost({
  plumbing,
  scope,
  gate = null,
  signedIn = false,
  Screen,
  Gate,
  children,
}: {
  // The same object from render to render (a module constant).
  plumbing: AutomationsPlumbing;
  // Null for anyone but an Editor of the whole item saved to an account (automationsScopeFor).
  scope: AutomationsScope | null;
  // Set for someone who could edit the item but must sync it or sign in first (automationsGateFor).
  gate?: AutomationsGate | null;
  // Whether the person is signed in (connections are an account's).
  signedIn?: boolean;
  // The app's screen and gate, each loaded with its own chunk the first time it draws.
  Screen: ComponentType<AutomationsScreenProps>;
  Gate: ComponentType<{ gate: AutomationsGate; onClose: () => void }>;
  children: ReactNode;
}) {
  // Back from a guest's sign-in: the Automations screen opens on the rules (its own modal, as from Tools), then the
  // ask is dropped so a refresh doesn't reopen it.
  const [target, setTarget] = useState<AutomationsTarget | null>(null);
  useEffect(() => {
    if (!askedOpen()) return;
    // oxlint-disable-next-line react/set-state-in-effect -- a one-shot arrival, read from the address once
    setTarget({ view: 'rules' });
    const url = new URL(window.location.href);
    url.searchParams.delete(AUTOMATIONS_PARAM);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, []);
  const { ownerId, itemId, shareCode, as } = scope ?? {};
  const stable = useMemo<AutomationsScope | null>(
    () =>
      ownerId && itemId
        ? { ownerId, itemId, shareCode: shareCode ?? null, ...(as !== undefined ? { as } : {}) }
        : null,
    [ownerId, itemId, shareCode, as],
  );
  const { client, track } = plumbing;
  // The list for the dot, once the item has settled.
  useEffect(() => {
    if (!stable) return;
    const timer = setTimeout(() => void readAutomations(client, stable), AUTOMATIONS_FIRST_READ_MS);
    return () => clearTimeout(timer);
  }, [client, stable]);
  const open = useCallback(
    (at: AutomationsTarget = { view: 'rules' }) => {
      setTarget(at);
      track('opened');
    },
    [track],
  );
  const value = useMemo<AutomationsAccess | null>(
    () => (stable ? { scope: stable, plumbing, open } : null),
    [stable, plumbing, open],
  );
  const gateKind = gate?.kind ?? null;
  const badges = gate?.badges;
  const door = useMemo<AutomationsDoor | null>(() => {
    if (stable) return { open: () => open(), offline: false, plumbing };
    if (!gateKind) return null;
    return {
      // The screen's own target: once the item is synced, the scope arrives and the screen opens on it.
      open: () => {
        setTarget({ view: 'rules' });
        track(gateKind === 'sync' ? 'opened_offline' : 'opened_sign_in');
      },
      offline: true,
      plumbing,
      badges,
    };
  }, [stable, open, gateKind, badges, plumbing, track]);
  return (
    <AutomationsDoorContext.Provider value={door}>
      <AutomationsContext.Provider value={value}>
        {children}
        {value && target ? (
          <Screen
            scope={value.scope}
            target={target}
            onTarget={setTarget}
            onClose={() => setTarget(null)}
            signedIn={signedIn}
          />
        ) : null}
        {gate && !stable && target ? <Gate gate={gate} onClose={() => setTarget(null)} /> : null}
      </AutomationsContext.Provider>
    </AutomationsDoorContext.Provider>
  );
}
