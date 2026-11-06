'use client';

// The Avatar Panel (docs/specs/008-canvas/avatar-mode.md): the character sheet for Avatar mode. Present
// only while the mode is active: it joins and leaves its corner stack rather than
// sitting there. Same width as the Palette it stacks under. Its body (the portrait, the choices, the action rows
// and Send a Message) is @liveworkspace/avatar's; this editor wraps it in its own mode-panel chrome. A Space has
// calls, so its Status row offers Do Not Disturb too (docs/specs/012-collaboration/meeting-rooms-and-stage.md).

import {
  AvatarPanelBody,
  type AvatarPanelBodyProps,
} from '@liveworkspace/avatar/components/AvatarPanelBody';
import { AVATAR_CALL_STATUSES } from '@liveworkspace/avatar/status';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';
import { MenuToggleRow } from '@/components/palette/context-menu-input-rows';
import { setJukeboxListening, useJukeboxListening } from '@/lib/jukebox-listening';

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
        statuses={AVATAR_CALL_STATUSES}
      />
      <JukeboxMusicRow />
    </ModePanel>
  );
}

// Jukebox Music (docs/specs/009-elements/social-pieces.md "Jukebox"): your own switch for every jukebox, the same one a
// jukebox's Play / Mute button flips. Off until you turn it on (or press Play), remembered on this device.
function JukeboxMusicRow() {
  const listening = useJukeboxListening();
  return (
    <div className="border-t border-slate-200 pt-1 dark:border-slate-700">
      <MenuToggleRow
        label="Jukebox Music"
        description="Hear a jukebox's music while you stand in its room"
        checked={listening === 'on'}
        onToggle={() => setJukeboxListening(listening === 'on' ? 'muted' : 'on')}
      />
    </div>
  );
}
