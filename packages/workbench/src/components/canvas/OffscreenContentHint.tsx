// Nothing in view (liveworkspace/docs/specs/016-notifications/callouts.md "Floating callouts"): a one-line floating
// callout above the zoom dock when every element on the tab has scrolled out of view (see useOffscreenContent), with
// Show All, which fits the tab to the screen as the Fit button below it does. Rendered by CanvasChrome inside the
// bottom-right dock container; positioned above it with `bottom-full`.

import { Callout } from '@liveworkspace/ui/callout';

type OffscreenContentHintProps = {
  // Bring everything back into view (wired to fit-to-screen).
  onBringBack: () => void;
};

export function OffscreenContentHint({ onBringBack }: OffscreenContentHintProps) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute bottom-full right-0 mb-2 animate-pop-in whitespace-nowrap"
    >
      <Callout
        tone="info"
        role="status"
        floating
        action={{ label: 'Show All', onSelect: onBringBack }}
      >
        Nothing in view
      </Callout>
    </div>
  );
}
