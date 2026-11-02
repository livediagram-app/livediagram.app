'use client';

// The Avatar Panel (docs/specs/008-canvas/avatar-mode.md): the character sheet for Avatar mode. Present
// only while the mode is active: like the Poll / Vote panels, it joins and leaves its corner stack rather than
// sitting there. Same width as the Palette it stacks under. Its body (the portrait, the choices, the action rows
// and Send a Message) is @liveworkspace/avatar's; this editor wraps it in its own mode-panel chrome.

import {
  AvatarPanelBody,
  type AvatarPanelBodyProps,
} from '@liveworkspace/avatar/components/AvatarPanelBody';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';

export function AvatarPanel({
  config,
  onChange,
  onRandomise,
  onReaction,
  onBurst,
  shirt,
  onSendMessage,
  speechCooling,
  status,
  onSetStatus,
  ...placement
}: AvatarPanelBodyProps & ModePanelProps) {
  return (
    <ModePanel helpArticle="avatarMode" title="Avatar" {...placement}>
      <AvatarPanelBody
        config={config}
        onChange={onChange}
        onRandomise={onRandomise}
        onReaction={onReaction}
        onBurst={onBurst}
        shirt={shirt}
        onSendMessage={onSendMessage}
        speechCooling={speechCooling}
        status={status}
        onSetStatus={onSetStatus}
      />
    </ModePanel>
  );
}
