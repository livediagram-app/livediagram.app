'use client';

// Where Describe to Set Up is drawn (docs/specs/030-knowledgebase/describe-to-set-up.md "The flow"): once, by the
// knowledgebase views' host, and only while it is open. The dialog, its steps and the write path behind them are
// one chunk fetched on the first open, inside an error area of its own, so none of it is in the editor's first
// bundle and a crash in it leaves the editor standing.
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import { useAiSettingsOpen } from '@/lib/knowledge-ask/ai-settings-open';
import { useKnowledgeView } from '@/lib/knowledge-ask/useKnowledgeView';
import {
  closeSetup,
  openSetup,
  publishSetupOffered,
  useSetupOpen,
} from '@/lib/knowledge-setup/setup-open';
import { ADD_PAGES_BUTTON } from '@/lib/knowledge-setup/setup-words';
import { track } from '@/lib/telemetry';
import { useSetupOffered } from './useSetupOffered';

const SetupDialog = dynamic(() => import('./SetupDialog').then((m) => m.SetupDialog), {
  ssr: false,
});
// AI Settings, opened from the dialog's no-key step. Over Ask or AI Knowledge the views' host draws it; the setup
// dialog opens over Pages, where nothing else does.
const AiSettingsDialogHost = dynamic(
  () => import('@/components/ask/AiSettingsDialog').then((m) => m.AiSettingsHost),
  { ssr: false },
);

/** The dialog while it is open and this session is offered it; nothing otherwise. */
export function SetupWhenOpen() {
  const mode = useSetupOpen();
  const offered = useSetupOffered();
  // Opened, then no longer offered (the role changed, another knowledgebase opened): it closes.
  useEffect(() => {
    if (mode && !offered) closeSetup();
  }, [mode, offered]);
  useEffect(() => closeSetup, []);
  // The command palette lists Describe to Add Pages from this.
  useEffect(() => {
    publishSetupOffered(offered);
    return () => publishSetupOffered(null);
  }, [offered]);
  const settingsOpen = useAiSettingsOpen();
  const overPages = useKnowledgeView() === 'pages';
  if (!mode || !offered) return null;
  return (
    <AreaErrorBoundary area="Modals" fallback="none">
      <SetupDialog mode={mode} onClose={closeSetup} />
      {settingsOpen && overPages ? <AiSettingsDialogHost /> : null}
    </AreaErrorBoundary>
  );
}

/** Describe to Add Pages, for the knowledgebase menu: its label and what choosing it does, or null for a session
 *  that is not offered it (and while the knowledgebase is still empty, when the sidebar's button is the way in). */
export function useDescribeToAddPages(): { label: string; onSelect: () => void } | null {
  const offered = useSetupOffered();
  if (offered !== 'add') return null;
  return {
    label: ADD_PAGES_BUTTON,
    onSelect: () => {
      track('UI', 'Opened', 'DescribeToAddPages');
      openSetup('add');
    },
  };
}
