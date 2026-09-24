import { BORDER_RADIUS_PX, statRowLayout, WEB_TEXT_MAX } from '@livediagram/diagram';
import { InlineTextLine } from '@/components/canvas/InlineTextLine';
import { rectStyle, type WebFaceProps } from '@/components/canvas/web/web-face-props';

// Stat row (spec/147): KPI cards sharing the width, each a big value in the
// accent over a muted caption. The value's size follows the card height (see
// statRowLayout), so resizing the row taller grows the numbers.
export function StatRowFace({
  element,
  accent,
  fill,
  textColor,
  fontFamily,
  zoom,
  editable,
  onSetRows,
}: WebFaceProps) {
  const stats = element.stats ?? [];
  const l = statRowLayout(element.width, element.height, stats.length);
  const radius = BORDER_RADIUS_PX[element.borderRadius ?? 'md'];
  const edit = (i: number, field: 'value' | 'caption', v: string) =>
    onSetRows({ stats: stats.map((st, j) => (j === i ? { ...st, [field]: v } : st)) });
  return (
    <>
      {stats.map((st, i) => (
        <div
          key={i}
          className="pointer-events-none absolute flex flex-col items-center justify-center gap-0.5 overflow-hidden border px-2 text-center"
          style={{
            ...rectStyle(l.cards[i]!),
            backgroundColor: fill,
            borderColor: accent,
            borderRadius: radius,
            fontFamily,
          }}
        >
          <InlineTextLine
            value={st.value}
            placeholder="0"
            editable={editable}
            onCommit={(v) => edit(i, 'value', v)}
            zoom={zoom}
            maxLength={WEB_TEXT_MAX}
            className="text-center font-bold leading-tight"
            style={{ color: accent, fontSize: l.valuePx }}
            ariaLabel={`Stat ${i + 1} value`}
          />
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
      ))}
    </>
  );
}
