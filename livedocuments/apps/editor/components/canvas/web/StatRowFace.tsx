import { useRef, type CSSProperties } from 'react';
import {
  BORDER_RADIUS_PX,
  cornerRadiusPx,
  STAT_CHANGE_MAX,
  statRowLayout,
  statsHaveChange,
  statTrend,
  statTrendColours,
  WEB_TEXT_MAX,
  type StatItem,
} from '@livedocuments/document';
import { InlineTextLine } from '@liveworkspace/workbench/components/canvas/InlineTextLine';
import { rectStyle, type WebFaceProps } from '@/components/canvas/web/web-face-props';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { useElementSurface } from '@/components/canvas/CanvasSurfaceContext';
import { usePresenting } from '@/components/canvas/PresentingContext';
import { useCountUp } from '@/components/canvas/useCountUp';

// A value counting up while its slide is presented (docs/specs/009-elements/stat-row.md "Count-up when presented"):
// a plain line whose digits useCountUp writes outside React, hidden from screen readers (the card carries the value).
function CountUpValue({
  value,
  className,
  style,
}: {
  value: string;
  className: string;
  style: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useCountUp(ref, value, true);
  return (
    <span
      ref={ref}
      aria-hidden
      data-count-up=""
      className={`block w-full truncate ${className}`}
      style={style}
    >
      {value}
    </span>
  );
}

// Stat row (docs/specs/009-elements/web-components-and-no-groups.md, stat-row.md): KPI cards sharing the width, each a
// big value in the accent over a muted caption and, when the row has one, a change pill coloured by its trend. The
// value's size follows the card height (see statRowLayout), so resizing the row taller grows the numbers. While the
// tab is presented the values count up.
export function StatRowFace({
  element,
  accent,
  fill,
  textColor,
  fontFamily,
  editable,
  onSetRows,
}: WebFaceProps) {
  const zoom = useCanvasZoom();
  const presenting = usePresenting();
  const surface = useElementSurface(element.id);
  const stats = element.stats ?? [];
  const l = statRowLayout(element.width, element.height, stats.length, statsHaveChange(stats));
  const counting = presenting && element.statCountUp !== false;
  const edit = (i: number, field: keyof StatItem, v: string) =>
    onSetRows({ stats: stats.map((st, j) => (j === i ? { ...st, [field]: v } : st)) });
  const valueClass = 'text-center font-bold leading-tight tabular-nums';
  const valueStyle = { color: accent, fontSize: l.valuePx };
  return (
    <>
      {stats.map((st, i) => {
        const card = l.cards[i]!;
        const trend = st.change
          ? statTrendColours(statTrend(st.change), surface, fill, textColor)
          : null;
        const change = l.change && (st.change || editable) ? l.change : null;
        return (
          <div
            key={i}
            className="pointer-events-none absolute overflow-hidden border"
            style={{
              ...rectStyle(card),
              backgroundColor: fill,
              borderColor: accent,
              // Each card is capped by its own size (docs/specs/008-canvas/corner-radius.md).
              borderRadius: cornerRadiusPx(
                element.borderRadius,
                card.width,
                card.height,
                BORDER_RADIUS_PX.md,
              ),
              fontFamily,
            }}
          >
            <div
              className="absolute flex items-center justify-center [&>*]:max-w-full"
              style={rectStyle(l.value)}
            >
              {counting ? (
                <CountUpValue value={st.value} className={valueClass} style={valueStyle} />
              ) : (
                <InlineTextLine
                  value={st.value}
                  placeholder="0"
                  editable={editable}
                  onCommit={(v) => edit(i, 'value', v)}
                  zoom={zoom}
                  maxLength={WEB_TEXT_MAX}
                  className={valueClass}
                  style={valueStyle}
                  ariaLabel={`Stat ${i + 1} value`}
                />
              )}
            </div>
            <div
              className="absolute flex items-center justify-center [&>*]:max-w-full"
              style={rectStyle(l.caption)}
            >
              <InlineTextLine
                value={st.caption}
                placeholder="Caption"
                editable={editable}
                onCommit={(v) => edit(i, 'caption', v)}
                zoom={zoom}
                maxLength={WEB_TEXT_MAX}
                className="text-center leading-snug"
                style={{ color: textColor, opacity: 0.7, fontSize: l.captionPx }}
                ariaLabel={`Stat ${i + 1} caption`}
              />
            </div>
            {change ? (
              // The change pill (docs/specs/009-elements/stat-row.md "How it looks"): its trend's colour over a soft
              // wash of it. Empty, while the row is editable, it is a faint placeholder to type into.
              <div className="absolute flex items-center justify-center" style={rectStyle(change)}>
                <div
                  data-stat-trend={trend ? statTrend(st.change) : undefined}
                  className="flex min-w-0 max-w-full items-center rounded-full"
                  style={{
                    backgroundColor: trend?.wash,
                    height: change.height,
                    paddingInline: l.changePx * 0.7,
                  }}
                >
                  <InlineTextLine
                    value={st.change ?? ''}
                    placeholder="Change"
                    editable={editable}
                    onCommit={(v) => edit(i, 'change', v)}
                    zoom={zoom}
                    maxLength={STAT_CHANGE_MAX}
                    className="whitespace-nowrap text-center font-semibold leading-none tabular-nums"
                    style={{ color: trend?.ink ?? textColor, fontSize: l.changePx }}
                    ariaLabel={`Stat ${i + 1} change`}
                  />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
