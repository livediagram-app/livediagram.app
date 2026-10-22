// One glyph per chart type (docs/specs/009-elements/pie-chart.md "Chart types"), drawn on the 24-unit grid with the
// house stroke in `currentColor`: the Sheet toolbar's Insert Chart menu, the cell menu, a chart's Chart Type tiles and
// a Dashboard's chart picker all show a type by the same picture.
import { Glyph, Prims } from '@liveplanner/ui';
import { lucideChartPie } from '@liveplanner/icons/lucide';
import type { ChartType } from '@liveplanner/project';

const AXES = 'M3 3v18h18';

const MARKS: Record<ChartType, React.ReactNode> = {
  column: (
    <>
      <path d={AXES} />
      <path d="M8 17v-5M13 17V8M18 17v-8" />
    </>
  ),
  bar: (
    <>
      <path d={AXES} />
      <path d="M7 7h6M7 12h11M7 17h8" />
    </>
  ),
  line: (
    <>
      <path d={AXES} />
      <path d="m7 15 4-5 3 3 5-6" />
    </>
  ),
  area: (
    <>
      <path d={AXES} />
      <path d="M7 17v-3l4-5 3 3 5-5v10Z" fill="currentColor" fillOpacity={0.25} />
    </>
  ),
  scatter: (
    <>
      <path d={AXES} />
      <circle cx="8" cy="15" r="1.2" fill="currentColor" />
      <circle cx="11" cy="10" r="1.2" fill="currentColor" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" />
      <circle cx="18" cy="7" r="1.2" fill="currentColor" />
    </>
  ),
  pie: <Prims prims={lucideChartPie} />,
  doughnut: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v5M21 12h-5" />
    </>
  ),
};

export function ChartTypeIcon({ type, size = 16 }: { type: ChartType; size?: number }) {
  return (
    <Glyph size={size} units={24}>
      {MARKS[type]}
    </Glyph>
  );
}
