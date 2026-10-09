'use client';

import { AiPanelContent } from '@/components/panels/AiPanel';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import type { UserPreferences } from '@/lib/user-preferences';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import type { CanvasProps } from './Canvas.types';

// The floating AI Assistant panel (docs/specs/007-editor/ai-assistance.md + /63 docking), lifted out
// of useCanvasChromePanels: the MovablePanel shell with the settings
// popover in its header (which also carries the reset-position item —
// hence no header reset button) and the AiPanelContent body.
export function CanvasAiPanel({
  aiPanel,
  wiring,
  tabName,
  settings,
}: {
  aiPanel: NonNullable<CanvasProps['aiPanel']>;
  wiring: ReturnType<ReturnType<typeof useCornerDocking>['panelWiringFor']>;
  tabName: string;
  settings: UserPreferences;
}) {
  return (
    <MovablePanel
      title="AI Assistant"
      position={wiring.position}
      defaultCorner="top-right-stacked"
      width="w-auto sm:w-64"
      collapsible
      onMoveTo={aiPanel.onMove}
      {...wiring.dock}
      // Reset-position is the panel header's own button now: the settings
      // popover that used to carry it, and the two AI preferences inside it,
      // moved to the Settings dialog (docs/specs/007-editor/user-preferences.md).
      onReset={wiring.onReset}
    >
      <AiPanelContent
        contextElements={aiPanel.contextElements}
        tabId={aiPanel.tabId}
        tabName={tabName}
        ownerId={aiPanel.ownerId}
        onApplyElements={aiPanel.onApplyElements}
        showSuggestions={settings.aiSuggestedPrompts !== false}
      />
    </MovablePanel>
  );
}
