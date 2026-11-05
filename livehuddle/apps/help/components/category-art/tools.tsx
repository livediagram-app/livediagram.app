import { Label, Shape } from '@liveworkspace/help-site/art/primitives';
import { Card, Sparkle } from '@liveworkspace/help-site/art/parts';
import { ToolsArt as Scene } from '@liveworkspace/help-site/art/scenes/tools';

// Tools: the shared scene (docs/specs/018-help/help-pages.md "Category art"), with livehuddle's helper: Auto-align
// snapping a meeting's notes into line, beside the shared appearance switch (livehuddle has no Zen mode).
export function ToolsArt() {
  return (
    <Scene zen={false}>
      {/* Auto-align. */}
      <Card x={22} y={22} w={200} h={78} r={12}>
        <Sparkle cx={38} cy={40} r={7} className="fill-violet-500" />
        <Sparkle cx={47} cy={33} r={3.5} className="fill-violet-300" />
        <Label x={54} y={41} size={10.5} weight={700} tone="strong">
          Auto-align
        </Label>
        <rect
          x={32}
          y={56}
          width={180}
          height={34}
          rx={8}
          className="fill-slate-50 stroke-violet-300"
          strokeWidth={1.4}
        />
        <Label x={42} y={73.5} size={10} tone="body">
          Snap to the grid
        </Label>
        <rect
          x={160}
          y={62}
          width={46}
          height={22}
          rx={6}
          className="fill-violet-500 dark:fill-violet-700"
        />
        <Label x={183} y={73.5} anchor="middle" size={9} weight={700} tone="onAccent">
          Tidy
        </Label>
      </Card>

      {/* The notes it lines up. */}
      <Shape
        x={262}
        y={18}
        w={104}
        h={36}
        label="Agenda"
        fill="fill-violet-50"
        stroke="stroke-violet-400"
      />
      <Shape x={262} y={88} w={104} h={36} label="Ideas" />
      <Shape x={262} y={158} w={104} h={36} accent label="Next steps" />
      <Sparkle cx={372} cy={20} r={6} className="fill-amber-400" />
      <Sparkle cx={254} cy={98} r={4.5} className="fill-violet-400" />
      <Sparkle cx={378} cy={150} r={4} className="fill-amber-300" />
      <path
        d="M226 62 C240 62 246 40 258 37"
        className="fill-none stroke-violet-300"
        strokeWidth={1.6}
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
    </Scene>
  );
}
