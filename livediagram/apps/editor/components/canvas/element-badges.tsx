// On-element adornments for BoxedElementView: the remote-selector avatar
// strip (who else has this element selected). The link / note / action /
// comment indicators are ElementIndicators (docs/specs/008-canvas/element-indicators.md).
//
// Adornments scale WITH the canvas zoom (they render in canvas units, no
// counter-scaling): they used to hold their on-screen size, which at low
// zoom left a full-size pill squatting over a thumbnail-sized element.
// Below ADORNMENT_MIN_ZOOM they hide entirely — too small to read or hit,
// and an overview zoom is for shape, not affordances. Resize handles are
// deliberately NOT treated this way (element-parts.tsx): interaction
// grips need a constant hit size.
import { initialsOf } from '@/lib/identity';
import { HoverCard, GlyphDisc, IDENTITY_FILL, identityVars } from '@livediagram/ui';
import { useCanvasZoom } from '@/components/canvas/CanvasZoomContext';
import type { RemoteSelector } from '@/lib/presence-rows';

// Below this canvas zoom the on-element adornments (badge pill, lock
// badge, remote-selector avatars) disappear entirely.
export const ADORNMENT_MIN_ZOOM = 0.4;

// What a remote selector's disc says (docs/specs/007-editor/editor-app.md "Concurrent-selection lock"): an Editor or
// Participant holds the element, a Viewer only looks at it, so their disc never claims a lock.
export function remoteSelectorCopy(s: Pick<RemoteSelector, 'name' | 'holds'>): {
  title: string;
  description: string;
} {
  return s.holds
    ? {
        title: `Locked to ${s.name}`,
        description: "Selected by them; you can't edit it right now.",
      }
    : {
        title: `Selected by ${s.name}`,
        description: "They're only viewing, so you can still edit it.",
      };
}

export function RemoteSelectorsStrip({ selectors }: { selectors: RemoteSelector[] }) {
  const zoom = useCanvasZoom();
  if (zoom < ADORNMENT_MIN_ZOOM) return null;
  // The strip lets presses through to the element, but each disc takes the pointer so its hover card can
  // open (pointer-events is inherited, so a none on the strip alone left the card unreachable). A press on a
  // disc still bubbles to the element, as a press on its corner always did.
  return (
    <div className="pointer-events-none absolute -left-1 -top-1 flex">
      {selectors.map((p, i) => (
        // Margin / z-index live on the outer wrapper so the HoverCard's
        // inline-flex span doesn't disturb the overlap stack.
        <div
          key={p.id}
          className="pointer-events-auto"
          style={{
            marginLeft: i === 0 ? 0 : -6,
            zIndex: selectors.length - i,
          }}
        >
          <HoverCard {...remoteSelectorCopy(p)}>
            <GlyphDisc
              size={20}
              as="div"
              aria-label={remoteSelectorCopy(p).title}
              style={identityVars(p.color)}
              className={`border border-white text-[9px] font-semibold text-white shadow-sm ${IDENTITY_FILL}`}
            >
              {initialsOf(p.name)}
            </GlyphDisc>
          </HoverCard>
        </div>
      ))}
    </div>
  );
}
