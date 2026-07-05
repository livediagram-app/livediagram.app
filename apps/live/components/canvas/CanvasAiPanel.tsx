'use client';

import { track } from '@/lib/telemetry';
import { AiPanelContent } from '@/components/panels/AiPanel';
import { AiSettingsPopover } from '@/components/panels/AiSettingsPopover';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import type { UserPreferences } from '@/lib/user-preferences';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import type { CanvasProps } from './Canvas.types';

// The floating AI Assistant panel (spec/25 + /63 docking), lifted out
// of useCanvasChromePanels: the MovablePanel shell with the settings
// popover in its header (which also carries the reset-position item —
// hence no header reset button) and the AiPanelContent body.
export function CanvasAiPanel({
  aiPanel,
  wiring,
  stackBelowY,
  tabName,
  settings,
  onChangeSettings,
  minimalPanels,
  activeMobilePanel,
  activeDockAnchor,
  onMobileClose,
}: {
  aiPanel: NonNullable<CanvasProps['aiPanel']>;
  wiring: ReturnType<ReturnType<typeof useCornerDocking>['panelWiringFor']>;
  stackBelowY: number | undefined;
  tabName: string;
  settings: UserPreferences;
  onChangeSettings: (next: UserPreferences) => void;
  minimalPanels: boolean;
  activeMobilePanel: string | null;
  activeDockAnchor: { left: number; top: number; arrowOffset: number } | undefined;
  onMobileClose: () => void;
}) {
  return (
    <MovablePanel
      title="AI Assistant"
      position={wiring.position}
      defaultCorner="top-right-stacked"
      stackBelowY={stackBelowY}
      width="w-auto sm:w-64"
      collapsible
      // No header reset button here (unlike the other panels): the AI
      // panel's Settings popover already carries a "Reset position" item,
      // so a second one in the title row was redundant. Drag-to-move still
      // works via onMoveTo; the popover handles the reset.
      onMoveTo={aiPanel.onMove}
      {...wiring.dock}
      headerActions={
        <AiSettingsPopover
          enabled={settings.aiAssistanceEnabled === true}
          onSetEnabled={(v) => {
            track('AI', 'Toggled', v ? 'AiOn' : 'AiOff');
            onChangeSettings({ ...settings, aiAssistanceEnabled: v });
          }}
          showSuggestions={settings.aiSuggestedPrompts !== false}
          onSetShowSuggestions={(v) => onChangeSettings({ ...settings, aiSuggestedPrompts: v })}
          onResetPosition={wiring.onReset}
          resettable={wiring.resettable}
        />
      }
      mobileOpenOverride={activeMobilePanel === 'ai'}
      mobileDockAnchor={activeDockAnchor}
      forceDockMode={minimalPanels}
      onMobileClose={onMobileClose}
    >
      <AiPanelContent
        contextElements={aiPanel.contextElements}
        focusIds={aiPanel.focusIds}
        tabId={aiPanel.tabId}
        tabName={tabName}
        ownerId={aiPanel.ownerId}
        onApplyElements={aiPanel.onApplyElements}
        showSuggestions={settings.aiSuggestedPrompts !== false}
      />
    </MovablePanel>
  );
}
