'use client';

// The name tray (liveworkspace/docs/specs/011-workbench/first-edit.md "A visitor's name"): a guest who arrives by a
// share link joins under the name they have, and this standing palette tray says so, with Change Name (the name card)
// and Keep It. Nothing blocks the canvas while it shows. Without a strip on screen (a Viewer's, Draw's dock) it is
// the same card at the top centre, as the template example tray falls back to. On a phone the sentence is for screen
// readers: the tray's width holds only the two actions. It goes first: another standing message (the template example
// tray) steps aside while it shows, as they share the slot.
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideUser } from '@liveworkspace/icons/lucide';
import {
  PaletteTray,
  PaletteTrayAction,
  PaletteTrayCard,
  pillPlace,
  usePaletteStripBox,
  useToolbarBox,
} from './PaletteTray';
import { useViewportHeight } from '../../hooks/ui/useViewportHeight';

const UserGlyph = lucideGlyph(lucideUser, 15);

/** The narrowest the tray's slot gets, in px: its glyph, "You're <a long placeholder name> here" and both actions. */
export const NAME_TRAY_MIN_WIDTH_PX = 440;

export function NameTray({
  name,
  onChange,
  onKeep,
  dockSelector,
}: {
  // The name the visitor shows under now.
  name: string;
  // Opens the name card.
  onChange: () => void;
  // Confirms the name as it is.
  onKeep: () => void;
  // The dock the card stands clear of without a strip (livediagram's `[data-whiteboard-dock]`).
  dockSelector?: string;
}) {
  const strip = usePaletteStripBox();
  const dock = useToolbarBox(dockSelector ?? '[data-name-tray-no-dock]', !strip && !!dockSelector);
  const viewportHeight = useViewportHeight();
  const lead = <UserGlyph />;
  const end = (
    <>
      <PaletteTrayAction tone="brand" label="Change Name" onAction={onChange} />
      <PaletteTrayAction label="Keep It" onAction={onKeep} />
    </>
  );
  const message = (
    <>
      You&rsquo;re <strong className="font-semibold">{name}</strong> here
    </>
  );
  if (strip)
    return (
      <PaletteTray
        box={strip}
        standing
        first
        quietOnPhone
        minWidth={NAME_TRAY_MIN_WIDTH_PX}
        lead={lead}
        end={end}
      >
        {message}
      </PaletteTray>
    );
  return (
    <div
      data-name-tray=""
      className="pointer-events-none fixed inset-x-0 z-[var(--z-chrome)] flex justify-center px-4 [body[data-explorer-open]_&]:hidden"
      style={pillPlace(dockSelector ? dock : null, viewportHeight)}
    >
      <PaletteTrayCard lead={lead} end={end} standing first quietOnPhone>
        {message}
      </PaletteTrayCard>
    </div>
  );
}
