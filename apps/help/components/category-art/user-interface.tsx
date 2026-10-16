import { Arrow, Label, Shape } from '@/components/illustrations/primitives';
import { Stage, Window } from './parts';

// A numbered callout: the anatomy diagram's way of pointing at one part of the editor.
function Callout({ cx, cy, n }: { cx: number; cy: number; n: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} className="fill-brand-500 stroke-white" strokeWidth={2} />
      <Label x={cx} y={cy + 0.5} anchor="middle" size={10} weight={800} tone="onAccent">
        {n}
      </Label>
    </g>
  );
}

// User Interface: the whole editor laid out, with numbered callouts on its parts: the menu and mode switch,
// the palette strip, the style panel, and the tab bar and zoom along the foot.
export function UserInterfaceArt() {
  return (
    <Stage>
      <Window x={14} y={10} w={372} h={200} title="Product launch · livediagram">
        {/* Menu button and mode switch. */}
        <rect
          x={24}
          y={42}
          width={58}
          height={22}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <path
          d="M31 49 h10 M31 53 h10 M31 57 h10"
          className="stroke-slate-500"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <rect x={46} y={46} width={32} height={14} rx={4} className="fill-brand-50" />
        <Label x={62} y={53.5} anchor="middle" size={7.5} weight={700} tone="accent">
          Diagram
        </Label>

        {/* Palette strip. */}
        <rect
          x={110}
          y={42}
          width={168}
          height={22}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        {['Shapes', 'Draw', 'Build', 'Icons'].map((t, i) => (
          <Label
            key={t}
            x={138 + i * 38}
            y={53.5}
            anchor="middle"
            size={8.5}
            weight={i === 0 ? 700 : 500}
            tone={i === 0 ? 'accent' : 'body'}
          >
            {t}
          </Label>
        ))}

        {/* Style panel. */}
        <rect
          x={296}
          y={42}
          width={80}
          height={116}
          rx={9}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={306} y={54} size={8} weight={700} tone="muted">
          STYLE
        </Label>
        {[
          'fill-brand-400',
          'fill-violet-400',
          'fill-emerald-400',
          'fill-amber-400',
          'fill-rose-400',
        ].map((c, i) => (
          <circle key={c} cx={311 + i * 13} cy={70} r={5} className={c} />
        ))}
        <circle cx={311} cy={70} r={7.5} className="fill-none stroke-brand-500" strokeWidth={1.4} />
        {[88, 108, 128].map((y, i) => (
          <g key={y}>
            <rect x={306} y={y} width={60} height={4} rx={2} className="fill-slate-200" />
            <rect
              x={306}
              y={y}
              width={[38, 22, 48][i]}
              height={4}
              rx={2}
              className="fill-brand-400"
            />
            <circle
              cx={306 + [38, 22, 48][i]!}
              cy={y + 2}
              r={4}
              className="fill-white stroke-brand-500"
              strokeWidth={1.4}
            />
          </g>
        ))}
        <rect x={306} y={140} width={60} height={10} rx={3} className="fill-slate-100" />

        {/* Canvas content. */}
        <Shape x={66} y={94} w={70} h={34} label="Plan" />
        <Shape x={168} y={94} w={78} h={34} accent label="Launch" />
        <Arrow from={[136, 111]} to={[165, 111]} />

        {/* Tab bar and zoom. */}
        <rect
          x={24}
          y={178}
          width={150}
          height={22}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <rect
          x={28}
          y={182}
          width={56}
          height={14}
          rx={4}
          className="fill-white stroke-brand-400"
          strokeWidth={1.2}
        />
        <Label x={56} y={189.5} anchor="middle" size={7.5} weight={700} tone="accent">
          Overview
        </Label>
        <rect x={88} y={182} width={46} height={14} rx={4} className="fill-slate-100" />
        <Label x={111} y={189.5} anchor="middle" size={7.5} weight={500} tone="body">
          Flows
        </Label>
        <rect
          x={296}
          y={178}
          width={80}
          height={22}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={336} y={189.5} anchor="middle" size={8.5} weight={700} tone="strong">
          − 100% +
        </Label>
      </Window>
      <Callout cx={24} cy={40} n={1} />
      <Callout cx={110} cy={40} n={2} />
      <Callout cx={376} cy={40} n={3} />
      <Callout cx={24} cy={176} n={4} />
    </Stage>
  );
}
