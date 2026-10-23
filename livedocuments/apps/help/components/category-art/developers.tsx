import { Arrow, Label, Shape } from '@/components/illustrations/primitives';
import { Chip, Stage, Window } from './parts';

const MONO = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  whiteSpace: 'pre',
} as const;

// One line of code, in segments of [text, colour class].
function Code({ x, y, parts }: { x: number; y: number; parts: [string, string][] }) {
  return (
    <text x={x} y={y} fontSize={9.5} dominantBaseline="middle" style={MONO}>
      {parts.map(([t, c], i) => (
        <tspan key={i} className={c}>
          {t}
        </tspan>
      ))}
    </text>
  );
}

// Developers: the API from the outside. A request with a bearer token, and the diagram it creates, with the
// three ways in (the REST API, the CLI and MCP for AI tools).
export function DevelopersArt() {
  return (
    <Stage>
      <g className="help-art-as-drawn">
        <rect
          x={18}
          y={24}
          width={214}
          height={150}
          rx={12}
          className="fill-slate-900/[0.08]"
          transform="translate(2 6)"
        />
        <rect x={18} y={24} width={214} height={150} rx={12} className="fill-slate-900" />
        <circle cx={32} cy={38} r={3} className="fill-rose-400" />
        <circle cx={42} cy={38} r={3} className="fill-amber-400" />
        <circle cx={52} cy={38} r={3} className="fill-emerald-400" />
        <Code
          x={32}
          y={62}
          parts={[
            ['POST', 'fill-violet-300'],
            [' /api/documents', 'fill-slate-100'],
          ]}
        />
        <Code
          x={32}
          y={80}
          parts={[
            ['Authorization: ', 'fill-slate-400'],
            ['Bearer lwt_…', 'fill-amber-300'],
          ]}
        />
        <Code x={32} y={102} parts={[['{', 'fill-slate-400']]} />
        <Code
          x={42}
          y={118}
          parts={[
            ['"name"', 'fill-sky-300'],
            [': ', 'fill-slate-400'],
            ['"Service map"', 'fill-emerald-300'],
          ]}
        />
        <Code
          x={42}
          y={134}
          parts={[
            ['"tabs"', 'fill-sky-300'],
            [': ', 'fill-slate-400'],
            ['[ … ]', 'fill-slate-300'],
          ]}
        />
        <Code x={32} y={150} parts={[['}', 'fill-slate-400']]} />
      </g>

      <Arrow from={[238, 100]} to={[262, 100]} width={2.5} />
      <Chip x={240} y={74} label="201" tone="emerald" w={30} h={16} size={8.5} />

      <Window x={268} y={44} w={116} h={116}>
        <Label x={280} y={80} size={9.5} weight={700} tone="strong">
          Service map
        </Label>
        <Shape x={280} y={92} w={44} h={24} label="" />
        <Shape
          x={330}
          y={122}
          w={44}
          h={28}
          kind="circle"
          fill="fill-violet-100"
          stroke="stroke-violet-400"
        />
        <Shape x={282} y={126} w={40} h={22} accent />
        <Arrow from={[324, 104]} to={[340, 119]} width={1.8} />
        <Arrow from={[302, 116]} to={[302, 123]} width={1.8} />
      </Window>

      <Chip x={60} y={188} label="REST API" tone="brand" h={22} size={9.5} />
      <Chip x={140} y={188} label="CLI" tone="slate" h={22} size={9.5} />
      <Chip x={186} y={188} label="MCP for AI tools" tone="violet" h={22} size={9.5} />
    </Stage>
  );
}
