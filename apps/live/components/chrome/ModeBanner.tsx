import type { ReactNode } from 'react';
import { TopCenterBanner } from '@/components/chrome/TopCenter';
import { PaletteTray, PaletteTrayAction, type StripBox } from '@/components/chrome/PaletteTray';

type ModeBannerProps = {
  icon: ReactNode;
  message: string;
  actionLabel?: string;
  onAction: () => void;
  // Optional extra controls (icon-only toggle buttons) rendered to
  // the LEFT of the Cancel action. Used by the pen banner today for
  // the "recognise shapes" toggle so the user can flip the mode
  // without leaving the gesture. Future modes can hang their own
  // small toggles off the same slot.
  extras?: ReactNode;
  // The Toolbar layout's strip on screen (usePaletteStripBox): the banner hangs from it as the palette tray
  // (docs/specs/007-editor/toolbar-layout.md "Layout details") instead of floating as a pill.
  tray?: StripBox | null;
};

// A status message for editor "modes" (format painter, group, a tile in hand) telling the user what the next
// click will do, with a way out (Cancel) or to wrap up (Done): a floating top-centre pill, or the palette tray
// under the Toolbar layout's strip.
export function ModeBanner({
  icon,
  message,
  actionLabel = 'Cancel',
  onAction,
  extras,
  tray,
}: ModeBannerProps) {
  if (tray) {
    return (
      <PaletteTray
        box={tray}
        lead={icon}
        end={
          <>
            {extras}
            <PaletteTrayAction label={actionLabel} onAction={onAction} />
          </>
        }
      >
        {message}
      </PaletteTray>
    );
  }
  return (
    <TopCenterBanner
      tone="brand"
      className="gap-3 py-1.5 pl-3 pr-1.5 text-sm"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="flex items-center gap-2">
        {icon}
        {message}
      </span>
      {extras}
      <button
        type="button"
        onClick={onAction}
        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      >
        {actionLabel}
      </button>
    </TopCenterBanner>
  );
}
