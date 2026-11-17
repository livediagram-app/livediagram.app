'use client';

// The gate before a footer tool that needs the plan saved to the server or the person signed in
// (liveworkspace/docs/specs/004-index/footer-tools-menu.md "Always there"): the tool always shows in Tools, with a
// Sign In or Sync Plan badge beside its name, and a press opens this gate in its place, in Automations' words and shape
// (SyncGateDialog). Synced, the host swaps the gate for the tool's own dialog; signed in, the page comes back with the
// tool asked open (`?<param>=1`).
import { useEffect, useMemo, useState } from 'react';
import { authHrefWithReturn } from '@/components/chrome/auth-shared';
import { SyncGateDialog } from '@/components/dialogs/SyncGateDialog';

export type ToolGateKind = 'sync' | 'sign_in';
// `badges`: everything it still needs, in order (Sign In, Sync Plan), the gate opening on the first.
export type ToolGate = { badges?: readonly string[] } & (
  { kind: 'sync'; ready: boolean; sync: () => Promise<void> } | { kind: 'sign_in' }
);

/** The badges a gated tool wears in Tools: Sign In while signed out, Sync Plan while the plan is in This Browser. */
export const toolBadges = (input: { signedIn: boolean; offline: boolean }): readonly string[] => [
  ...(input.signedIn ? [] : ['Sign In']),
  ...(input.offline ? ['Sync Plan'] : []),
];

/** The badges a gate wears: its own list, else its kind's one. */
export const toolGateBadges = (gate: ToolGate | null | undefined): readonly string[] | undefined =>
  gate ? (gate.badges ?? [gate.kind === 'sync' ? 'Sync Plan' : 'Sign In']) : undefined;

/** A gate from its kind, with the Sync Plan move Share's gate uses and whether the reader is known yet. */
export function useToolGate(
  kind: ToolGateKind | null,
  ready: boolean,
  sync: () => Promise<void>,
  needs: { signedIn: boolean; offline: boolean },
): ToolGate | null {
  const { signedIn, offline } = needs;
  return useMemo<ToolGate | null>(() => {
    const badges = toolBadges({ signedIn, offline });
    return kind === 'sync'
      ? { kind, ready, sync, badges }
      : kind === 'sign_in'
        ? { kind, badges }
        : null;
  }, [kind, ready, sync, signedIn, offline]);
}

/** Where a guest signs in: back to this very page (its share code and tab kept), the tool asked open. */
export function toolSignInHref(
  param: string,
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
): string {
  const search = new URLSearchParams(location.search);
  search.set(param, '1');
  return authHrefWithReturn(
    '/sign-in/',
    `${location.pathname}?${search.toString()}${location.hash}`,
  );
}

/** Whether this page was opened asking for the tool (`?<param>=1`, a sign-in coming back), the ask then dropped from
 *  the address so a refresh doesn't reopen it. */
export function useAskedOpen(param: string): boolean {
  // Read as AutomationsHost reads its own ask: the editor renders only in the browser.
  const [asked] = useState(() => new URL(window.location.href).searchParams.get(param) === '1');
  useEffect(() => {
    if (!asked) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, [asked, param]);
  return asked;
}

export function ToolGateDialog({
  gate,
  title,
  promptTitle,
  signInPromptTitle = promptTitle,
  syncCopy,
  signInCopy,
  param,
  onClose,
}: {
  gate: ToolGate;
  title: string;
  promptTitle: string;
  // The heading over the sign-in copy, where it says something else.
  signInPromptTitle?: string;
  // Why it needs the plan on the server, and why it needs an account.
  syncCopy: string;
  signInCopy: string;
  param: string;
  onClose: () => void;
}) {
  return (
    <SyncGateDialog
      title={title}
      subtitle={gate.kind === 'sync' ? 'Saved only in this browser.' : 'You are not signed in.'}
      promptTitle={gate.kind === 'sync' ? promptTitle : signInPromptTitle}
      message={gate.kind === 'sync' ? syncCopy : signInCopy}
      onSyncToCloud={gate.kind === 'sync' ? gate.sync : async () => {}}
      ready={gate.kind === 'sync' ? gate.ready : true}
      signInHref={gate.kind === 'sign_in' ? toolSignInHref(param, window.location) : undefined}
      onClose={onClose}
    />
  );
}
