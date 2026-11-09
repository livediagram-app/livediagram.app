// Scenes for the palette articles on Bring Focus, Chairs and the Build category
// (docs/specs/012-collaboration/bring-focus.md, docs/specs/009-elements/chair.md,
// docs/specs/010-palette/build-category.md), drawn with the labels the editor prints.

import {
  Scene,
  Label,
  Dialog,
  Button,
  Avatar,
  TextBar,
  Panel,
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

/** The Build category: rows with a one-line description, because five containers look alike as
 *  icons. Blurbs as the palette prints them. */
export function BuildRows() {
  const rows: {
    name: string;
    blurb: string;
    glyph: 'mind' | 'lane' | 'frame' | 'timeline' | 'table' | 'sankey';
  }[] = [
    { name: 'Mind Node', blurb: 'Tab adds a child, Enter a sibling', glyph: 'mind' },
    { name: 'Table', blurb: 'An editable grid of cells', glyph: 'table' },
    { name: 'Lane', blurb: 'A titled band that carries its steps', glyph: 'lane' },
    { name: 'Frame', blurb: 'A labelled box that groups a section', glyph: 'frame' },
    { name: 'Timeline', blurb: 'A track for sequencing events', glyph: 'timeline' },
    { name: 'Sankey', blurb: 'Flows drawn as wide as the amount they carry', glyph: 'sankey' },
  ];
  const px = 62;
  const py = 12;
  return (
    <Scene w={420} h={260} bg="plain">
      <Panel x={px} y={py} w={296} h={238} title="BUILD">
        {rows.map((r, i) => {
          const y = py + 32 + i * 34;
          const gx = px + 26;
          const gy = y + 15;
          return (
            <g key={r.name}>
              <rect
                x={px + 12}
                y={y}
                width={28}
                height={28}
                rx={7}
                className="fill-slate-50 stroke-slate-200"
                strokeWidth={1.5}
              />
              <g className="stroke-brand-600" strokeWidth={1.6} fill="none" strokeLinecap="round">
                {r.glyph === 'mind' ? (
                  <>
                    <circle cx={gx - 4} cy={gy - 1} r={4} />
                    <path
                      d={`M${gx} ${gy - 1} L${gx + 6} ${gy - 6} M${gx} ${gy - 1} L${gx + 6} ${gy + 4}`}
                    />
                  </>
                ) : r.glyph === 'table' ? (
                  <>
                    <rect x={gx - 8} y={gy - 8} width={16} height={14} rx={1.5} />
                    <path d={`M${gx - 8} ${gy - 3} H${gx + 8} M${gx} ${gy - 8} V${gy + 6}`} />
                  </>
                ) : r.glyph === 'lane' ? (
                  <>
                    <rect x={gx - 9} y={gy - 6} width={18} height={11} rx={1.5} />
                    <path d={`M${gx - 4} ${gy - 6} V${gy + 5}`} />
                  </>
                ) : r.glyph === 'frame' ? (
                  <>
                    <rect x={gx - 8} y={gy - 7} width={16} height={13} />
                    <path d={`M${gx + 1} ${gy - 3} H${gx + 5}`} />
                  </>
                ) : r.glyph === 'sankey' ? (
                  <>
                    <path
                      d={`M${gx - 9} ${gy - 6} C${gx - 3} ${gy - 6} ${gx - 3} ${gy - 1} ${gx + 1} ${gy - 1}`}
                    />
                    <path
                      d={`M${gx - 9} ${gy + 5} C${gx - 3} ${gy + 5} ${gx - 3} ${gy + 2} ${gx + 1} ${gy + 2}`}
                    />
                    <path
                      d={`M${gx + 1} ${gy - 1} C${gx + 5} ${gy - 1} ${gx + 5} ${gy - 6} ${gx + 9} ${gy - 6}`}
                    />
                    <path
                      d={`M${gx + 1} ${gy + 2} C${gx + 5} ${gy + 2} ${gx + 5} ${gy + 6} ${gx + 9} ${gy + 6}`}
                    />
                  </>
                ) : (
                  <>
                    <path d={`M${gx - 9} ${gy + 3} H${gx + 9}`} />
                    <circle cx={gx - 5} cy={gy - 3} r={1.6} />
                    <circle cx={gx + 1} cy={gy - 3} r={1.6} />
                    <circle cx={gx + 7} cy={gy - 3} r={1.6} />
                  </>
                )}
              </g>
              <Label x={px + 50} y={y + 9} size={11} weight={600} tone="strong">
                {r.name}
              </Label>
              <Label x={px + 50} y={y + 22} size={10} tone="muted">
                {r.blurb}
              </Label>
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}
