import { Arrow, Label, Shape } from '@/components/illustrations/primitives';
import { Card, Sparkle, Stage } from './parts';

// Tools: the editor's helpers. An AI prompt drawing a sign-up flow, the appearance switch set to Dark, and Zen
// mode tucking the chrome away.
export function ToolsArt() {
  return (
    <Stage>
      {/* The AI prompt. */}
      <Card x={22} y={22} w={200} h={78} r={12}>
        <Sparkle cx={38} cy={40} r={7} className="fill-violet-500" />
        <Sparkle cx={47} cy={33} r={3.5} className="fill-violet-300" />
        <Label x={54} y={41} size={10.5} weight={700} tone="strong">
          Ask AI
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
          Draw a sign-up flow
        </Label>
        <rect x={149} y={65} width={1.5} height={17} className="fill-violet-500" />
        <rect
          x={160}
          y={62}
          width={46}
          height={22}
          rx={6}
          className="fill-violet-500 dark:fill-violet-700"
        />
        <Label x={183} y={73.5} anchor="middle" size={9} weight={700} tone="onAccent">
          Draw
        </Label>
      </Card>

      {/* The flow it draws. */}
      <Shape
        x={262}
        y={18}
        w={104}
        h={36}
        label="Sign up"
        fill="fill-violet-50"
        stroke="stroke-violet-400"
      />
      <Shape x={262} y={88} w={104} h={36} label="Verify email" />
      <Shape x={262} y={158} w={104} h={36} accent label="Welcome" />
      <Arrow
        from={[314, 54]}
        to={[314, 85]}
        colour={{ stroke: 'stroke-violet-400', fill: 'fill-violet-400' }}
      />
      <Arrow
        from={[314, 124]}
        to={[314, 155]}
        colour={{ stroke: 'stroke-violet-400', fill: 'fill-violet-400' }}
      />
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

      {/* Appearance. */}
      <Card x={22} y={116} w={200} h={36} r={10}>
        <rect x={30} y={123} width={60} height={22} rx={6} className="fill-transparent" />
        <circle cx={42} cy={134} r={4} className="fill-amber-400" />
        <path
          d="M42 126 v2 M42 140 v2 M34 134 h2 M48 134 h2 M36.5 128.5 l1.4 1.4 M46.1 138.1 l1.4 1.4 M36.5 139.5 l1.4 -1.4 M46.1 129.9 l1.4 -1.4"
          className="stroke-amber-400"
          strokeWidth={1.3}
          strokeLinecap="round"
        />
        <Label x={54} y={134.5} size={9.5} weight={500} tone="body">
          Light
        </Label>
        <rect
          x={92}
          y={122}
          width={64}
          height={24}
          rx={7}
          className="fill-slate-800 help-art-as-drawn"
        />
        <path
          d="M108 128 a6 6 0 1 0 6 8.5 a5 5 0 0 1 -6 -8.5 Z"
          className="fill-brand-200 help-art-as-drawn"
        />
        <Label x={120} y={134.5} size={9.5} weight={700} className="fill-white help-art-as-drawn">
          Dark
        </Label>
        <Label x={170} y={134.5} size={9.5} weight={500} tone="body">
          System
        </Label>
      </Card>

      {/* Zen mode. */}
      <Card x={22} y={166} w={130} h={36} r={10}>
        <path
          d="M34 184 c4 -6 14 -6 18 0 c-4 6 -14 6 -18 0 Z"
          className="fill-none stroke-slate-500"
          strokeWidth={1.4}
        />
        <path
          d="M33 192 l20 -16"
          className="stroke-slate-500"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <Label x={62} y={184.5} size={9.5} weight={600} tone="body">
          Zen mode
        </Label>
        <rect x={112} y={177} width={30} height={16} rx={8} className="fill-brand-500" />
        <circle cx={134} cy={185} r={6} className="fill-white help-art-as-drawn" />
      </Card>
    </Stage>
  );
}
