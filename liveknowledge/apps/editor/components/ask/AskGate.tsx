'use client';

// The Ask gate (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): a press on the Ask tab when this session cannot
// ask (no AI key yet, or nobody signed in) keeps the knowledgebase where it is and says why in a dialog over it, a
// sheet on a phone, with what to do next (owner 2026-11-21: "couldn't that have been a modal / drawer on mobile rather
// than another screen entirely"). Ask's own address still shows the same words in the view, for a link followed.
import { useSyncExternalStore } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { aiSettingsStore } from '@/lib/knowledge-ask/ai-settings-store';
import type { AskSession } from './useAskSession';
import { AskNoKey, AskSignedOut } from './AskStates';

export type AskGate = 'no-key' | 'signed-out';

let open: AskGate | null = null;
const listeners = new Set<() => void>();
const set = (next: AskGate | null) => {
  if (next === open) return;
  open = next;
  listeners.forEach((l) => l());
};

export const askGate = {
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: (): AskGate | null => open,
  open: (gate: AskGate) => set(gate),
  close: () => set(null),
};

/**
 * What stands between this session and Ask, read when the tab is pressed: nobody signed in, or (once the settings
 * are read, on the first press) no key. Null when Ask can open, or when the settings could not be read: the view says
 * so itself, with Try Again. An Offline knowledgebase's tab is off already (KnowledgeViewTabs).
 */
export async function askGateFor(session: AskSession): Promise<AskGate | null> {
  const { askOff } = session.rights;
  if (askOff === 'signed-out') return 'signed-out';
  if (askOff === 'offline') return null;
  await aiSettingsStore.load(session.who, session.documentId);
  const state = aiSettingsStore.get(session.documentId);
  return state.status === 'ready' && !state.settings.hasKey ? 'no-key' : null;
}

/** The gate's dialog, drawn by the footer's view tabs while it is open. */
export function AskGateDialog({ manageAi }: { manageAi: boolean }) {
  const gate = useSyncExternalStore(askGate.subscribe, askGate.get, () => null);
  return (
    <Dialog
      open={gate !== null}
      onClose={askGate.close}
      ariaLabel={gate === 'signed-out' ? 'Sign In to Ask' : "Ask Needs Your Team's AI Key"}
      size="sm"
      phoneSheet
    >
      {gate === 'signed-out' ? (
        <AskSignedOut bare before={askGate.close} />
      ) : gate === 'no-key' ? (
        <AskNoKey bare manageAi={manageAi} before={askGate.close} />
      ) : null}
    </Dialog>
  );
}
