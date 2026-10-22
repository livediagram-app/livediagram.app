'use client';

import { lucideUser } from '@livepages/icons/lucide';
import { lucideGlyph } from '@livepages/ui';
import { ClusterPopoverButton } from './ClusterPopoverButton';

const AvatarIcon = lucideGlyph(lucideUser, 16);

// Avatar in the bottom-right cluster, while Avatar mode is on (docs/specs/008-canvas/avatar-mode.md "The Avatar
// Panel"): the character sheet one press away, for every role and on a phone too. Named beside its icon on a
// desktop; its icon alone on a phone. Someone who may not speak is not told they can.
export function AvatarClusterButton(props: {
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
  canSpeak: boolean;
}) {
  const { canSpeak, ...rest } = props;
  return (
    <ClusterPopoverButton
      label="Avatar"
      name="Avatar"
      hoverTitle="Avatar"
      hoverDescription={
        canSpeak
          ? 'Dress your character, react, and say something.'
          : 'Dress your character and react.'
      }
      icon={<AvatarIcon />}
      dataTourId="avatar-button"
      {...rest}
    />
  );
}
