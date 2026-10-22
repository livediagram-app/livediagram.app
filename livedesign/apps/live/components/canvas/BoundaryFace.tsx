import type { ReactNode } from 'react';
import {
  PAGE_HEADING_MAX,
  boundaryLayout,
  boundaryStyleOf,
  BOUNDARY_TINT,
  colorWash,
  labelOn,
  type ShapeElement,
} from '@livepages/document';
import { IconGlyph } from '@/components/primitives/icon-glyph';
import { TechIconArt } from '@/components/primitives/tech-icon-glyph';
import { InlineTextLine } from '@/components/canvas/InlineTextLine';
import { LabelRegion } from '@/components/canvas/web/LabelRegion';
import { rectStyle } from '@/components/canvas/web/web-face-props';
import { useCanvasZoom } from '@/components/canvas/CanvasZoomContext';
import { isTechIconId } from '@/lib/tech-icons';

// The boundary (docs/specs/009-elements/boundary.md): a tint under everything it holds (nested ones stack, so they
// read deeper), and its title in a tab on the top edge, inside its corner, or at its bottom-left for C4, placed by boundaryLayout (the
// export's numbers). The title is the element's ordinary label; the meta line edits in place once it is selected.
export function BoundaryFace({
  element,
  labelNode,
  accent,
  ink,
  fontFamily,
  editable,
  onSetMeta,
}: {
  element: ShapeElement;
  labelNode: ReactNode;
  accent: string;
  ink: string;
  fontFamily: string | undefined;
  editable: boolean;
  onSetMeta: (value: string) => void;
}) {
  const zoom = useCanvasZoom();
  const style = boundaryStyleOf(element);
  const icon = style !== 'c4' && element.iconId ? element.iconId : undefined;
  const l = boundaryLayout(element.width, element.height, {
    style,
    icon: !!icon,
    titleChars: (element.label ?? '').length,
    meta: !!element.pageSubtitle,
  });
  const onTab = labelOn(accent);
  const titleColour = l.tab ? onTab : style === 'inset' ? accent : ink;
  const meta = element.pageSubtitle ?? '';
  return (
    <>
      {element.fillColor ? null : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ borderRadius: 'inherit', backgroundColor: colorWash(accent, BOUNDARY_TINT) }}
        />
      )}
      {l.tab ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-md"
          style={{ ...rectStyle(l.tab), backgroundColor: accent }}
        />
      ) : null}
      {icon && l.icon ? (
        isTechIconId(icon) ? (
          <svg
            aria-hidden
            className="pointer-events-none absolute"
            style={rectStyle(l.icon)}
            viewBox="0 0 24 24"
          >
            <TechIconArt iconId={icon} sizePx={l.icon.width} />
          </svg>
        ) : (
          <span className="pointer-events-none absolute" style={rectStyle(l.icon)}>
            <IconGlyph iconId={icon} stroke={l.tab ? onTab : accent} />
          </span>
        )
      ) : null}
      <LabelRegion rect={l.title}>
        <div className="absolute inset-0" style={{ color: titleColour }}>
          {labelNode}
        </div>
      </LabelRegion>
      {l.meta && meta ? (
        <div className="absolute flex items-center" style={{ ...rectStyle(l.meta), fontFamily }}>
          <InlineTextLine
            value={style === 'c4' && !editable ? `[${meta}]` : meta}
            placeholder="Meta line"
            editable={editable}
            onCommit={onSetMeta}
            zoom={zoom}
            maxLength={PAGE_HEADING_MAX}
            className="truncate leading-snug"
            style={{ color: ink, fontSize: l.metaPx, opacity: 0.7 }}
            ariaLabel="Boundary meta line"
          />
        </div>
      ) : null}
    </>
  );
}
