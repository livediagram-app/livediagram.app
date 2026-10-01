// A new estimate card asking for its scale (docs/specs/012-collaboration/estimate-card.md "Choosing a
// scale"). Each scale is a row: a small fan of three of its cards, its name,
// every value as a quiet line (the values are what is being chosen between,
// not the name), and a chevron. Hovering washes the row in the accent, fans
// the cards out and nudges the chevron; nothing jumps. One press sets it and
// the card becomes a normal estimate card. A viewer who can't edit sees that
// it is waiting.

import {
  ESTIMATE_SCALE_LABELS,
  ESTIMATE_SCALE_VALUES,
  ESTIMATE_SCALES,
  type EstimateScale,
} from '@livediagram/document';
import { Glyph, GlyphDisc } from '@livediagram/ui';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { tint } from '../collab-chrome';
import { QA_ACCENT, QA_ACCENT_INK, stopPointer } from '../qa/qa-parts';

// Two cards overlapping: "a hand to pick from".
function CardsGlyph() {
  return (
    <Glyph size={15} units={16}>
      <rect x="2.2" y="3.4" width="7" height="10" rx="1.5" transform="rotate(-10 5.7 8.4)" />
      <rect x="6.8" y="2.6" width="7" height="10" rx="1.5" transform="rotate(8 10.3 7.6)" />
    </Glyph>
  );
}

function ChevronRight() {
  return (
    <Glyph size={14} units={16}>
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </Glyph>
  );
}

export function EstimateScalePicker({
  textColor,
  onChoose,
}: {
  textColor: string;
  onChoose?: (scale: EstimateScale) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
      <div className="flex items-center gap-2.5">
        <GlyphDisc
          size={30}
          style={{ color: QA_ACCENT_INK, backgroundColor: tint(QA_ACCENT, 0.14) }}
        >
          <CardsGlyph />
        </GlyphDisc>
        <div className="flex min-w-0 flex-col">
          <span className="text-[12.5px] font-semibold leading-tight" style={{ color: textColor }}>
            {onChoose ? 'Choose a scale' : 'Waiting for a scale'}
          </span>
          <span className="text-[10.5px] leading-snug" style={{ color: textColor, opacity: 0.55 }}>
            {onChoose
              ? 'Everyone picks privately from these cards.'
              : 'Someone who can edit picks one first.'}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {ESTIMATE_SCALES.map((scale) => (
          <ScaleOption
            key={scale}
            scale={scale}
            textColor={textColor}
            onPress={onChoose ? () => onChoose(scale) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function ScaleOption({
  scale,
  textColor,
  onPress,
}: {
  scale: EstimateScale;
  textColor: string;
  onPress?: () => void;
}) {
  const press = usePressWithoutDrag(() => onPress?.());
  const values = ESTIMATE_SCALE_VALUES[scale];
  // First, middle and last: enough to say how the scale steps.
  const fan = [values[0], values[Math.floor((values.length - 1) / 2)], values[values.length - 2]];
  return (
    <button
      type="button"
      {...press}
      {...stopPointer}
      disabled={!onPress}
      aria-label={`Estimate in ${ESTIMATE_SCALE_LABELS[scale]}`}
      className="est-scale group pointer-events-auto flex w-full cursor-pointer items-center gap-3 rounded-xl border px-2.5 py-2 text-left outline-none disabled:cursor-default"
      style={
        {
          '--est-row': tint(textColor, 0.035),
          '--est-row-hover': tint(QA_ACCENT, 0.09),
          '--est-border': tint(textColor, 0.12),
          '--est-border-hover': tint(QA_ACCENT, 0.45),
        } as React.CSSProperties
      }
    >
      <span className="est-fan relative h-7 w-[50px] shrink-0" aria-hidden>
        {fan.map((v, i) => (
          <span
            key={`${i}-${v}`}
            className="est-fan-card absolute top-0 flex h-7 w-[20px] items-center justify-center rounded-[5px] border text-[8.5px] font-bold tabular-nums"
            style={
              {
                left: i * 15,
                '--est-fan-i': i - 1,
                color: QA_ACCENT_INK,
                backgroundColor: 'var(--qa-card)',
                borderColor: tint(QA_ACCENT, 0.4),
                zIndex: i,
              } as React.CSSProperties
            }
          >
            <span className="text-optical-centre">{v}</span>
          </span>
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[12px] font-semibold leading-tight" style={{ color: textColor }}>
          {ESTIMATE_SCALE_LABELS[scale]}
        </span>
        <span
          className="truncate text-[10.5px] tabular-nums leading-snug"
          style={{ color: textColor, opacity: 0.55 }}
        >
          {values.join(' · ')}
        </span>
      </span>
      {onPress ? (
        <span className="est-chevron shrink-0" style={{ color: QA_ACCENT_INK }} aria-hidden>
          <ChevronRight />
        </span>
      ) : null}
    </button>
  );
}
