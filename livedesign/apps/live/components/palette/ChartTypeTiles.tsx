'use client';

// The Chart Type section's tiles (docs/specs/009-elements/pie-chart.md "Chart types"): the seven types, each its
// glyph over its name, the chart's own pressed. A pick changes the chart; hovering previews nothing.
import { CHART_TYPE_LABELS, CHART_TYPES, type ChartType } from '@livepages/document';
import { SizeButton } from '@/components/palette/palette-controls';
import { TileLabel } from '@/components/palette/context-menu-tiles';
import { ChartTypeIcon } from '@/components/primitives/ChartTypeIcon';

export function ChartTypeTiles({
  current,
  onSet,
}: {
  current: ChartType | null;
  onSet: (type: ChartType) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
      {CHART_TYPES.map((type) => (
        <SizeButton key={type} active={current === type} onClick={() => onSet(type)}>
          <TileLabel
            glyph={<ChartTypeIcon type={type} size={18} />}
            label={CHART_TYPE_LABELS[type]}
          />
        </SizeButton>
      ))}
    </div>
  );
}
