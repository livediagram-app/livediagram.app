import { bannerLayout, BORDER_RADIUS_PX, PAGE_HEADING_MAX } from '@livediagram/diagram';
import { InlineTextLine } from '@/components/canvas/InlineTextLine';
import { LabelRegion } from '@/components/canvas/web/LabelRegion';
import { rectStyle, type WebFaceProps } from '@/components/canvas/web/web-face-props';

// Banner (spec/147): an accent bar with the title (the label, edited like any
// label) over a subtitle line edited in place. The bar paints in the fill
// when one is picked, else the stroke — the theme accent.
export function BannerFace({
  element,
  labelNode,
  accent,
  textColor,
  fontFamily,
  zoom,
  editable,
  onSetHeading,
}: WebFaceProps) {
  const l = bannerLayout(element.width, element.height);
  const radius = BORDER_RADIUS_PX[element.borderRadius ?? 'lg'];
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: element.fillColor ?? accent, borderRadius: radius }}
      />
      <LabelRegion rect={l.title}>{labelNode}</LabelRegion>
      <div className="absolute" style={{ ...rectStyle(l.subtitle), fontFamily }}>
        <InlineTextLine
          value={element.pageSubtitle ?? ''}
          placeholder="Subtitle"
          editable={editable}
          onCommit={(v) => onSetHeading('pageSubtitle', v)}
          zoom={zoom}
          maxLength={PAGE_HEADING_MAX}
          className="text-center leading-normal"
          style={{ color: textColor, opacity: 0.85, fontSize: l.subtitlePx }}
          ariaLabel="Banner subtitle"
        />
      </div>
    </>
  );
}
