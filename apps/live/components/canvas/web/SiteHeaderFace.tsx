import { BORDER_RADIUS_PX, headerLayout, WEB_TEXT_MAX } from '@livediagram/diagram';
import { IconGlyph } from '@/components/primitives/icon-glyph';
import { InlineTextLine } from '@/components/canvas/InlineTextLine';
import { LabelRegion } from '@/components/canvas/web/LabelRegion';
import { rectStyle, type WebFaceProps } from '@/components/canvas/web/web-face-props';

// Header (docs/specs/009-elements/web-components-and-no-groups.md): a website header bar — a round logo, the brand (the
// label) and the nav links right-aligned, each edited in place. The logo is
// the element's inline icon when one is dropped on it, else the brand's
// initial. Links that no longer fit a narrowed bar drop from the end (see
// headerLayout) rather than running over the brand.
export function SiteHeaderFace({
  element,
  labelNode,
  accent,
  textColor,
  fontFamily,
  zoom,
  editable,
  onSetRows,
}: WebFaceProps) {
  const links = element.navLinks ?? [];
  const l = headerLayout(element.width, element.height, links);
  const bar = element.fillColor ?? accent;
  const d = l.logo.r * 2;
  const initial = (element.label ?? '').trim().charAt(0).toUpperCase();
  const edit = (i: number, v: string) =>
    onSetRows({ navLinks: links.map((k, j) => (j === i ? v : k)) });
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: bar,
          borderRadius: BORDER_RADIUS_PX[element.borderRadius ?? 'md'],
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute flex items-center justify-center rounded-full font-bold"
        style={{
          left: l.logo.cx - l.logo.r,
          top: l.logo.cy - l.logo.r,
          width: d,
          height: d,
          backgroundColor: textColor,
          color: bar,
          opacity: 0.92,
          fontSize: l.logo.r,
          fontFamily,
        }}
      >
        {element.iconId ? (
          <span className="relative" style={{ width: d * 0.62, height: d * 0.62 }}>
            <IconGlyph iconId={element.iconId} stroke={bar} />
          </span>
        ) : (
          initial
        )}
      </div>
      <LabelRegion rect={l.brand}>{labelNode}</LabelRegion>
      {l.links.map((k, i) => (
        <div
          key={i}
          className="absolute flex items-center justify-center"
          style={{ ...rectStyle(k.rect), fontFamily }}
        >
          <InlineTextLine
            value={k.text}
            placeholder="Link"
            editable={editable}
            onCommit={(v) => edit(i, v)}
            zoom={zoom}
            maxLength={WEB_TEXT_MAX}
            className="text-center"
            style={{ color: textColor, opacity: 0.9, fontSize: l.linkPx }}
            ariaLabel={`Link ${i + 1}`}
          />
        </div>
      ))}
    </>
  );
}
