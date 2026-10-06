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

// Below this canvas zoom the on-element adornments (badge pill, lock
// badge, remote-selector avatars) disappear entirely.
export const ADORNMENT_MIN_ZOOM = 0.4;

export function RemoteSelectorsStrip({
  selectors,
}: {
  selectors: { id: string; name: string; color: string }[];
}) {
  const zoom = useCanvasZoom();
  if (zoom < ADORNMENT_MIN_ZOOM) return null;
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none absolute -left-1 -top-1 flex"
    >
      {selectors.map((p, i) => (
        // Margin / z-index live on the outer wrapper so the HoverCard's
        // inline-flex span doesn't disturb the overlap stack.
        <div
          key={p.id}
          style={{
            marginLeft: i === 0 ? 0 : -6,
            zIndex: selectors.length - i,
          }}
        >
          <HoverCard
            title={`Locked to ${p.name}`}
            description="Selected by them; you can't edit it right now."
          >
            <GlyphDisc
              size={20}
              as="div"
              aria-label={`Locked to ${p.name}`}
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
