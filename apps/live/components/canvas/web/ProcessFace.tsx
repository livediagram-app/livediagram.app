import { ACCENT_BAR_TEXT, processLayout, WEB_TEXT_MAX } from '@livediagram/diagram';
import { InlineTextLine } from '@/components/canvas/InlineTextLine';
import { rectStyle, type WebFaceProps } from '@/components/canvas/web/web-face-props';

// Process steps (spec/147): numbered accent circles spread across the width,
// joined by arrows, with a caption under each edited in place. The numbers
// are the step's position, so reordering or removing a step renumbers the
// rest rather than leaving a gap.
export function ProcessFace({
  element,
  accent,
  textColor,
  fontFamily,
  zoom,
  editable,
  onSetRows,
}: WebFaceProps) {
  const steps = element.processSteps ?? [];
  const l = processLayout(element.width, element.height, steps.length);
  const edit = (i: number, v: string) =>
    onSetRows({ processSteps: steps.map((s, j) => (j === i ? v : s)) });
  return (
    <>
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={element.width}
        height={element.height}
      >
        {l.connectors.map((c, i) => {
          if (c.x2 - c.x1 < 4) return null;
          const head = Math.min(7, (c.x2 - c.x1) / 2);
          return (
            <g key={i}>
              <path
                d={`M ${c.x1} ${c.y} L ${c.x2 - head} ${c.y}`}
                stroke={accent}
                strokeWidth={2}
              />
              <path
                d={`M ${c.x2 - head} ${c.y - head * 0.7} L ${c.x2} ${c.y} L ${c.x2 - head} ${c.y + head * 0.7} Z`}
                fill={accent}
              />
            </g>
          );
        })}
        {l.steps.map((s, i) => (
          <g key={i}>
            <circle cx={s.cx} cy={s.cy} r={s.r} fill={accent} />
            <text
              x={s.cx}
              y={s.cy}
              textAnchor="middle"
              dominantBaseline="central"
              fill={ACCENT_BAR_TEXT}
              fontWeight={700}
              fontSize={l.numberPx}
              fontFamily={fontFamily}
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      {l.steps.map((s, i) => (
        <div
          key={i}
          className="absolute flex items-center justify-center px-1"
          style={{ ...rectStyle(s.caption), fontFamily }}
        >
          <InlineTextLine
            value={steps[i] ?? ''}
            placeholder="Step"
            editable={editable}
            onCommit={(v) => edit(i, v)}
            zoom={zoom}
            maxLength={WEB_TEXT_MAX}
            className="text-center leading-snug"
            style={{ color: textColor, fontSize: l.captionPx }}
            ariaLabel={`Step ${i + 1}`}
          />
        </div>
      ))}
    </>
  );
}
