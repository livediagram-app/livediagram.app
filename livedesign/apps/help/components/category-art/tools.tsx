import { Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Shadow } from '@liveworkspace/help-site/art/parts';
import { ToolsArt as Scene } from '@liveworkspace/help-site/art/scenes/tools';

// A wireframe screen's blocks, each as drawn (a little off) and where Auto-align puts it: lined up on a shared left
// edge and rounded to the 10 px grid.
const BLOCKS = [
  { from: [7, 0], to: [0, 0], w: 60, h: 8, tone: 'fill-brand-500' },
  { from: [-5, 16], to: [0, 14], w: 92, h: 40, tone: 'fill-brand-100' },
  { from: [9, 63], to: [0, 60], w: 80, h: 6, tone: 'fill-slate-300' },
  { from: [-4, 76], to: [0, 72], w: 70, h: 6, tone: 'fill-slate-300' },
  { from: [6, 98], to: [0, 96], w: 92, h: 14, tone: 'fill-brand-500' },
] as const;

// Tools: the shared scene (docs/specs/018-help/help-pages.md "Category art"), with livedesign's helper: Auto-align
// (the command palette's Actions, Layout Cleanup) taking a wireframe's drifting blocks and lining them up on one
// edge, beside the shared appearance switch and Zen mode.
export function ToolsArt() {
  return (
    <Scene>
      {/* The command that runs it. */}
      <Card x={22} y={22} w={200} h={78} r={12}>
        <Label x={34} y={38} size={8} weight={700} tone="muted">
          ACTIONS
        </Label>
        <rect
          x={30}
          y={46}
          width={184}
          height={22}
          rx={6}
          className="fill-brand-50 stroke-brand-200"
          strokeWidth={1}
        />
        <path
          d="M40 51 v12 M44 54 h12 M44 60 h8"
          className="stroke-brand-600"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <Label x={64} y={57.5} size={10} weight={700} tone="accent">
          Auto-align
        </Label>
        <Label x={34} y={82} size={9} tone="muted">
          Snaps the drift to a 10 px grid
        </Label>
      </Card>

      {/* Before and after, on a phone screen. */}
      {(
        [
          { ox: 246, key: 'from', label: 'Before' },
          { ox: 318, key: 'to', label: 'After' },
        ] as const
      ).map((p) => (
        <g key={p.key}>
          <Label x={p.ox + 32} y={22} anchor="middle" size={8.5} weight={600} tone="muted">
            {p.label}
          </Label>
          <Shadow x={p.ox} y={30} w={64} h={130} r={10} />
          <rect
            x={p.ox}
            y={30}
            width={64}
            height={130}
            rx={10}
            className="fill-white stroke-slate-300"
            strokeWidth={1.5}
          />
          <rect x={p.ox + 24} y={34} width={16} height={3} rx={1.5} className="fill-slate-700" />
          {p.key === 'to' && (
            <line
              x1={p.ox + 8}
              y1={40}
              x2={p.ox + 8}
              y2={154}
              className="stroke-rose-400"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          )}
          {BLOCKS.map((b, i) => {
            const [dx, dy] = b[p.key];
            const s = 48 / 92;
            return (
              <rect
                key={i}
                x={p.ox + 8 + dx}
                y={44 + dy}
                width={b.w * s}
                height={b.h}
                rx={2}
                className={b.tone}
              />
            );
          })}
        </g>
      ))}
      <path
        d="M312 94 h3 m-3 -4 l4 4 -4 4"
        className="fill-none stroke-brand-500"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Scene>
  );
}
