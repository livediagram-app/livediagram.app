'use client';

import { useSyncExternalStore } from 'react';
import {
  ClusterPopoverSegment,
  ClusterStrip,
} from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';
import { MagnifierIcon } from '@/components/palette/palette-icons';
import { formatMagnification } from '@/lib/magnifier-config';
import { magnifierStore, type MagnifierStore } from '@/lib/magnifier-store';

// The Magnifier's control (docs/specs/008-canvas/magnifier.md "The settings popover"): in the bottom-right cluster
// while the mode is on, the glyph and, on a wide desktop, the current magnification. It opens the settings as a
// popover above it, through the dock's one-open-at-a-time slot.
export function MagnifierClusterButton({
  open,
  onToggle,
  store = magnifierStore,
}: {
  open: boolean;
  onToggle: (button: HTMLElement) => void;
  store?: MagnifierStore;
}) {
  const { zoom } = useSyncExternalStore(store.subscribe, store.get, store.get);
  return (
    <ClusterStrip dataTourId="magnifier-settings">
      <ClusterPopoverSegment
        label={`Magnifier settings, ${formatMagnification(zoom)}`}
        name={formatMagnification(zoom)}
        hoverTitle="Magnifier"
        hoverDescription="Change the lens's magnification, size and shape."
        icon={<MagnifierIcon size={18} />}
        popoverOpen={open}
        onTogglePopover={onToggle}
      />
    </ClusterStrip>
  );
}
