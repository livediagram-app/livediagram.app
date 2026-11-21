'use client';

// The gate before the Automations screen (liveworkspace/docs/specs/018-automations/automations.md "Who may do what"):
// rules and schedules run on our servers for an Editor, even while nobody has the item open. An item kept Offline
// syncs first, through the same gate the app's Share opens (its own dialog, handed in) and its Sync move; a guest on
// a server item signs in first, back to this item with the screen open (`?automations=1`). Once synced, or signed
// in, the host swaps the gate for the screen. The app loads it with its own chunk the first time.

import type { ComponentType, ReactNode } from 'react';
import { toolGateCopy } from '@liveworkspace/workbench/lib/tool-gate-copy';
import { AUTOMATIONS_PARAM } from './automations-gate';
import type { AutomationsGate } from './AutomationsHost';

/** Where a guest signs in: back to this very page (its share code and tab kept), the screen asked open. `signIn`:
 *  the app's sign-in address for a path to come back to. */
export function automationsSignInHref(
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
  signIn: (returnTo: string) => string,
): string {
  const search = new URLSearchParams(location.search);
  search.set(AUTOMATIONS_PARAM, '1');
  return signIn(`${location.pathname}?${search.toString()}${location.hash}`);
}

// The app's Sync gate dialog, as its Share gate draws it.
export type SyncGateDialogProps = {
  title: string;
  help: ReactNode;
  promptTitle: string;
  message: string;
  onSyncToCloud: () => Promise<void>;
  ready: boolean;
  signInHref: string | undefined;
  onClose: () => void;
};

export function AutomationsSyncGate({
  gate,
  onClose,
  item,
  help,
  signIn,
  Dialog,
}: {
  gate: AutomationsGate;
  onClose: () => void;
  // The item's word, as a title says it: "Plan".
  item: Parameters<typeof toolGateCopy>[2];
  help: ReactNode;
  signIn: (returnTo: string) => string;
  Dialog: ComponentType<SyncGateDialogProps>;
}) {
  const said = toolGateCopy(gate.kind, 'Automations', item);
  return (
    <Dialog
      title="Automations"
      help={help}
      promptTitle={said.title}
      message={said.body}
      onSyncToCloud={gate.kind === 'sync' ? gate.sync : async () => {}}
      ready={gate.kind === 'sync' ? gate.ready : true}
      signInHref={
        gate.kind === 'sign_in' ? automationsSignInHref(window.location, signIn) : undefined
      }
      onClose={onClose}
    />
  );
}
