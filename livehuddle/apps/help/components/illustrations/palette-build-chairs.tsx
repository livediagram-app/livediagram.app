// Scenes for the palette articles on Bring Focus and Chairs
// (docs/specs/012-collaboration/bring-focus.md, docs/specs/009-elements/chair.md), drawn with the labels the
// editor prints.

import {
  Scene,
  Label,
  Dialog,
  Button,
  Avatar,
  TextBar,
} from '@liveworkspace/help-site/art/primitives';

/** The invitation everyone else gets when somebody presses Bring Focus. */
export function BringFocusInvite() {
  return (
    <Scene w={400} h={210}>
      {/* The canvas behind, where the reader currently is. */}
      <rect x={24} y={28} width={86} height={46} rx={8} className="fill-white stroke-slate-300" />
      <rect x={290} y={130} width={90} height={50} rx={8} className="fill-white stroke-slate-300" />
      <Dialog x={70} y={46} w={260} h={118} sceneW={400} sceneH={210}>
        <Label x={88} y={64} size={9} weight={700} tone="accent">
          BRING FOCUS
        </Label>
        <Label x={88} y={82} size={12} weight={700} tone="strong">
          Sam wants you to look at something
        </Label>
        {/* The fixed sentence about moving your view, drawn as text lines. */}
        <TextBar x={88} y={100} w={220} tone="faint" />
        <TextBar x={88} y={111} w={150} tone="faint" />
        <Button x={150} y={128} w={72} h={24} label="Not now" variant="ghost" />
        <Button x={230} y={128} w={88} h={24} label="Take me there" variant="primary" />
      </Dialog>
    </Scene>
  );
}

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
        {/* Taken: a soft ring in the sitter's colour on the seat, where their feet land. */}
        {sitter ? (
          <ellipse
            cx={0}
            cy={3}
            rx={21}
            ry={13}
            className="fill-none stroke-emerald-500"
            strokeWidth={3}
            strokeOpacity={0.85}
          />
        ) : null}
      </g>
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
