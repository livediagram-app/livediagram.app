'use client';

// The way into AI Settings from a view's header (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): for every
// role, since everyone may see whether a key is set; the dialog itself keeps the controls for an Editor.
import { Button, HoverCard } from '@liveknowledge/ui';
import { openAiSettings } from '@/lib/knowledge-ask/ai-settings-open';
import { track } from '@/lib/telemetry';
import { SettingsIcon } from './ask-icons';

export function openAiSettingsFrom(): void {
  track('UI', 'Opened', 'AiSettings');
  openAiSettings();
}

export function AiSettingsButton() {
  return (
    <HoverCard
      title="AI Settings"
      description="The Claude API key and model this knowledgebase answers with."
    >
      <Button variant="secondary" size="xs" onClick={openAiSettingsFrom} className="cursor-pointer">
        <SettingsIcon />
        <span className="phone:sr-only">AI Settings</span>
      </Button>
    </HoverCard>
  );
}
