'use client';

// Where Knowledgebase Settings is drawn (docs/specs/030-knowledgebase/verification.md "The Review Period"): once,
// beside the editor's other dialogs, and only while it is open. The dialog is one chunk fetched on the first open,
// inside an error area of its own, so none of it is in the editor's first bundle and a crash in it leaves the
// editor standing.
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import {
  closeKnowledgeSettings,
  openKnowledgeSettings,
  publishKnowledgeSettingsOffered,
  useKnowledgeSettingsOpen,
} from '@/lib/knowledge-settings/settings-open';
import { SETTINGS_TITLE } from '@/lib/knowledge-settings/review-period-words';
import { track } from '@/lib/telemetry';
import { useSettingsOffered } from './useSettingsOffered';

const KnowledgeSettingsDialog = dynamic(
  () => import('./KnowledgeSettingsDialog').then((m) => m.KnowledgeSettingsDialog),
  { ssr: false },
);

/** The dialog while it is open and this session is offered it; nothing otherwise. */
export function KnowledgeSettingsWhenOpen() {
  const open = useKnowledgeSettingsOpen();
  const offered = useSettingsOffered();
  // Opened, then no longer offered (the role changed under the session): it closes.
  useEffect(() => {
    if (open && !offered) closeKnowledgeSettings();
  }, [open, offered]);
  useEffect(() => closeKnowledgeSettings, []);
  // The command palette lists Knowledgebase Settings from this.
  useEffect(() => {
    publishKnowledgeSettingsOffered(offered);
    return () => publishKnowledgeSettingsOffered(false);
  }, [offered]);
  if (!open || !offered) return null;
  return (
    <AreaErrorBoundary area="Modals" fallback="none">
      <KnowledgeSettingsDialog onClose={closeKnowledgeSettings} />
    </AreaErrorBoundary>
  );
}

/** Open Knowledgebase Settings, counted. For Page Health's link and the command palette. */
export function openKnowledgebaseSettings(): void {
  track('UI', 'Opened', 'KnowledgebaseSettings');
  openKnowledgeSettings();
}

/** Knowledgebase Settings, for the knowledgebase menu: its label and what choosing it does, or null for a session
 *  that may not change the settings (anyone but an Editor of the whole knowledgebase). */
export function useKnowledgebaseSettings(): { label: string; onSelect: () => void } | null {
  const offered = useSettingsOffered();
  if (!offered) return null;
  return { label: SETTINGS_TITLE, onSelect: openKnowledgebaseSettings };
}
