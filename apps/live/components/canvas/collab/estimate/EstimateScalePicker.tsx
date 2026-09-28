// A new estimate card asking for its scale (docs/specs/012-collaboration/estimate-card.md "Choosing a
// scale"): the three scales as cards, each showing its values, because "1 2 3
// 5 8" is the thing being chosen between, not the name. One press sets it and
// the card becomes a normal estimate card. A viewer who can't edit sees that
// it is waiting.

import {
  ESTIMATE_SCALE_LABELS,
  ESTIMATE_SCALE_VALUES,
  ESTIMATE_SCALES,
  type EstimateScale,
} from '@livediagram/diagram';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { tint } from '../collab-chrome';
import { QA_ACCENT, QA_ACCENT_INK, stopPointer } from '../qa/qa-parts';

export function EstimateScalePicker({
  textColor,
  onChoose,
}: {
  textColor: string;
  onChoose?: (scale: EstimateScale) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
      <p className="text-center text-[12.5px] font-semibold" style={{ color: textColor }}>
        {onChoose ? 'Pick a scale to estimate on' : 'Waiting for a scale'}
      </p>
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
  return (
    <button
      type="button"
      {...press}
      {...stopPointer}
      disabled={!onPress}
      aria-label={`Estimate in ${ESTIMATE_SCALE_LABELS[scale]}`}
      className="est-scale pointer-events-auto flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left disabled:cursor-default"
      style={{ borderColor: tint(textColor, 0.14), backgroundColor: tint(textColor, 0.04) }}
    >
      <span className="text-[12px] font-semibold" style={{ color: textColor }}>
        {ESTIMATE_SCALE_LABELS[scale]}
      </span>
      <span className="flex min-w-0 gap-1 overflow-hidden">
        {ESTIMATE_SCALE_VALUES[scale].map((v) => (
          <span
            key={v}
            className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-md px-1 text-[10px] font-bold tabular-nums"
            style={{ color: QA_ACCENT_INK, backgroundColor: tint(QA_ACCENT, 0.12) }}
          >
            <span className="text-optical-centre">{v}</span>
          </span>
        ))}
      </span>
    </button>
  );
}
