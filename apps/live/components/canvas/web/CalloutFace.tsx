import { calloutLayout, PAGE_HEADING_MAX, ACCENT_BAR_TEXT } from '@livediagram/diagram';
import { IconGlyph } from '@/components/primitives/icon-glyph';
import { InlineTextLine } from '@/components/canvas/InlineTextLine';
import { LabelRegion } from '@/components/canvas/web/LabelRegion';
import { rectStyle, type WebFaceProps } from '@/components/canvas/web/web-face-props';

// Callout (spec/146): the card is the ordinary bordered box; inside it, an
// accent badge (an "i", or the element's inline icon when one is dropped on
// it), a heading line edited in place, and the body — the label.
export function CalloutFace({
  element,
  labelNode,
  accent,
  textColor,
  fontFamily,
  zoom,
  editable,
  onSetHeading,
}: WebFaceProps) {
  const l = calloutLayout(element.width, element.height);
  const d = l.badge.r * 2;
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute flex items-center justify-center rounded-full font-bold"
        style={{
          left: l.badge.cx - l.badge.r,
          top: l.badge.cy - l.badge.r,
          width: d,
          height: d,
          backgroundColor: accent,
          color: ACCENT_BAR_TEXT,
          fontSize: l.badge.r,
          fontFamily,
        }}
      >
        {element.iconId ? (
          <span className="relative" style={{ width: d * 0.6, height: d * 0.6 }}>
            <IconGlyph iconId={element.iconId} stroke={ACCENT_BAR_TEXT} />
          </span>
        ) : (
          'i'
        )}
      </div>
      <div className="absolute" style={{ ...rectStyle(l.heading), fontFamily }}>
        <InlineTextLine
          value={element.pageTitle ?? ''}
          placeholder="Heading"
          editable={editable}
          onCommit={(v) => onSetHeading('pageTitle', v)}
          zoom={zoom}
          maxLength={PAGE_HEADING_MAX}
          className="font-semibold leading-snug"
          style={{ color: textColor, fontSize: l.headingPx }}
          ariaLabel="Callout heading"
        />
      </div>
      <LabelRegion rect={l.body}>{labelNode}</LabelRegion>
    </>
  );
}
