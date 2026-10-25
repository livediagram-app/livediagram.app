import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { OfflineBanner } from '@/components/chrome/OfflineBanner';
import { TopCenterStack } from '@/components/chrome/TopCenter';

// Everything that floats at the top of the canvas: the Offline banner. (The session timer and the vote's status and
// results walkthrough live in the Session strip's popovers, docs/specs/012-collaboration/session-tools.md; the
// multi-selection toolbar floats over the selection itself, via Canvas + FloatingToolbar.) Extracted from
// CanvasChrome so the chrome shell stays lean.
type TopCenterChromeProps = Pick<CanvasProps, 'readOnly' | 'participantPalette'>;

export function TopCenterChrome({ readOnly, participantPalette = false }: TopCenterChromeProps) {
  // The strip is on screen for an Editor and for a Participant's own palette (docs/specs/013-workspace/share-roles.md):
  // either way the stack starts beneath it.
  const stripShown = !readOnly || participantPalette;
  return (
    <TopCenterStack below={stripShown ? 'toolbar' : undefined}>
      {/* Offline (docs/specs/007-editor/load-recovery.md "Offline"): says whether anything on screen is being
          saved. */}
      <OfflineBanner readOnly={readOnly === true} />
    </TopCenterStack>
  );
}
