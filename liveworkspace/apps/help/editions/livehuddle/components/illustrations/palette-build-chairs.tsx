// Scenes for the palette article on Chairs
// (docs/specs/009-elements/chair.md), drawn with the labels the
// editor prints.

import { Scene, Label, Avatar } from '@liveworkspace/help-site/art/primitives';

/** One chair drawn from above-front: a back, a seat and a shadow. `facing` is the way a sitter
 *  looks, as the Chair menu names it. */
function Chair({
  x,
  y,
  facing,
  label,
  sitter,
}: {
  x: number;
  y: number;
  facing: 'down' | 'up' | 'left' | 'right';
  label?: string;
  sitter?: { name: string; initial: string };
}) {
  // The back sits on the side the sitter faces away from.
  const rotate = { down: 0, left: 90, up: 180, right: 270 }[facing];
  return (
    <g>
      <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
        <ellipse cx={0} cy={14} rx={17} ry={4} className="fill-slate-200" />
        <rect x={-15} y={-16} width={30} height={9} rx={4} className="fill-brand-300" />
        <rect
          x={-15}
          y={-6}
          width={30}
          height={18}
          rx={5}
          className="fill-brand-100 stroke-brand-300"
        />
      </g>
      {/* Taken: the sitter in it and their name pill, with no ring (chair.md "Occupied"). */}
      {sitter ? (
        <g>
          <Avatar cx={x} cy={y + 2} r={9} initial={sitter.initial} colour="emerald" />
          <rect
            x={x - 22}
            y={y - 46}
            width={44}
            height={16}
            rx={8}
            className="fill-emerald-500 dark:fill-emerald-700"
          />
          <Label x={x} y={y - 38} size={10} weight={600} tone="onAccent" anchor="middle">
            {sitter.name}
          </Label>
        </g>
      ) : null}
      {label ? (
        <Label x={x} y={y + 38} size={10} tone="muted" anchor="middle">
          {label}
        </Label>
      ) : null}
    </g>
  );
}

/** Four chairs round a drawn table, facing in, one of them taken. */
export function ChairSeating() {
  return (
    <Scene w={420} h={230}>
      <rect
        x={150}
        y={84}
        width={120}
        height={64}
        rx={10}
        className="fill-slate-100 stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={210} y={117} size={11} tone="muted" anchor="middle">
        Table
      </Label>
      <Chair x={210} y={52} facing="down" label="" sitter={{ name: 'Priya', initial: 'P' }} />
      <Chair x={210} y={180} facing="up" label="Scribe" />
      <Chair x={110} y={116} facing="right" label="Facilitator" />
      <Chair x={310} y={116} facing="left" />
    </Scene>
  );
}
