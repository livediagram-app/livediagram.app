import type { ReactNode } from 'react';
import { Arrow, Label } from '../primitives';
import { Chip, Stage, Window } from '../parts';

const MONO = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  whiteSpace: 'pre',
} as const;

/** One line of code, in segments of [text, colour class]. */
export type CodeLine = [string, string][];

/** The colour classes a request body's tokens take on the dark terminal. */
export const CODE_TONES = {
  key: 'fill-sky-300',
  punctuation: 'fill-slate-400',
  string: 'fill-emerald-300',
  rest: 'fill-slate-300',
} as const;

function Code({ x, y, parts }: { x: number; y: number; parts: CodeLine }) {
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

// Developers: the API from the outside. A request with a bearer token, what it creates, and the three ways in (the
// REST API, the CLI and MCP for AI tools). The terminal and the ways in are the same in every product; the product
// hands in its own route (`path`), the body's lines (up to four, drawn between its braces), the name of what it
// makes, and that work in miniature (`result`, drawn in the window's box x 276 to 376, y 88 to 154).
export function DevelopersArt({
  path,
  body,
  name,
  result,
}: {
  path: string;
  body: CodeLine[];
  name: string;
  result: ReactNode;
}) {
  // The body's lines share the space between the token line and the terminal's foot.
  const step = body.length > 2 ? 14 : 16;
  const open = body.length > 2 ? 96 : 102;
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
            [` ${path}`, 'fill-slate-100'],
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
        <Code x={32} y={open} parts={[['{', CODE_TONES.punctuation]]} />
        {body.map((line, i) => (
          <Code key={i} x={42} y={open + step * (i + 1)} parts={line} />
        ))}
        <Code x={32} y={open + step * (body.length + 1)} parts={[['}', CODE_TONES.punctuation]]} />
      </g>

      <Arrow from={[238, 100]} to={[262, 100]} width={2.5} />
      <Chip x={240} y={74} label="201" tone="emerald" w={30} h={16} size={8.5} />

      <Window x={268} y={44} w={116} h={116}>
        <Label x={280} y={80} size={9.5} weight={700} tone="strong">
          {name}
        </Label>
        {result}
      </Window>

      <Chip x={60} y={188} label="REST API" tone="brand" h={22} size={9.5} />
      <Chip x={140} y={188} label="CLI" tone="slate" h={22} size={9.5} />
      <Chip x={186} y={188} label="MCP for AI tools" tone="violet" h={22} size={9.5} />
    </Stage>
  );
}
