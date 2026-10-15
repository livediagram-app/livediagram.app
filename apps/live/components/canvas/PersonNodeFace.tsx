import type { ReactNode } from 'react';
import {
  PAGE_HEADING_MAX,
  colorWash,
  personInitials,
  personNodeLayout,
  type ShapeElement,
} from '@livediagram/document';
import { InlineTextLine } from '@/components/canvas/InlineTextLine';
import { LabelRegion } from '@/components/canvas/web/LabelRegion';
import { rectStyle } from '@/components/canvas/web/web-face-props';
import { useCanvasZoom } from '@/components/canvas/CanvasZoomContext';

// A person node (docs/specs/009-elements/org-chart.md): the initials disc, the name (the node's ordinary label, edited
// like any mind node's) and the role, edited in place once the node is selected. Placed by the export's
// `personNodeLayout`.
export function PersonNodeFace({
  element,
  labelNode,
  accent,
  ink,
  fontFamily,
  editable,
  onSetRole,
}: {
  element: ShapeElement;
  labelNode: ReactNode;
  accent: string;
  ink: string;
  fontFamily: string | undefined;
  editable: boolean;
  onSetRole: (value: string) => void;
}) {
  const zoom = useCanvasZoom();
  const role = element.pageSubtitle ?? '';
  // While selected and editable the role line shows (its placeholder invites a role); otherwise only a set one does.
  const l = personNodeLayout(element.width, element.height, !!role.trim() || editable);
  const d = l.disc.width;
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute flex items-center justify-center rounded-full font-semibold"
        style={{
          ...rectStyle(l.disc),
          backgroundColor: colorWash(accent, 0.16),
          color: accent,
          fontSize: Math.round(d * 0.37),
          fontFamily,
        }}
      >
        {personInitials(element.label ?? '')}
      </div>
      <LabelRegion rect={l.name}>
        <div className="absolute inset-0 font-semibold" style={{ color: ink }}>
          {labelNode}
        </div>
      </LabelRegion>
      {l.role ? (
        <div className="absolute flex items-center" style={{ ...rectStyle(l.role), fontFamily }}>
          <InlineTextLine
            value={role}
            placeholder="Role"
            editable={editable}
            onCommit={onSetRole}
            zoom={zoom}
            maxLength={PAGE_HEADING_MAX}
            className="truncate leading-snug"
            style={{ color: ink, fontSize: 12, opacity: 0.7 }}
            ariaLabel="Role"
          />
        </div>
      ) : null}
    </>
  );
}
