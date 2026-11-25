// Scenes for the palette articles on Bring Focus and the Build elements (Diagram mode's Concepts and Layout)
// (docs/specs/012-collaboration/bring-focus.md, docs/specs/010-palette/build-category.md),
// drawn with the labels the editor prints.

import {
  Scene,
  Label,
  Dialog,
  Button,
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

/** Diagram mode's Layout category open on its Containers group: rows with a one-line description, because five
 *  containers look alike as icons. Names and blurbs as the palette prints them (tile-defs, palette-layouts.ts). */
export function BuildRows() {
  const rows: {
    name: string;
    blurb: string;
    glyph: 'lane' | 'frame' | 'stack' | 'boundary' | 'table';
  }[] = [
    { name: 'Lane', blurb: 'A titled band that carries its steps', glyph: 'lane' },
    { name: 'Frame', blurb: 'A labelled box that groups a section', glyph: 'frame' },
    { name: 'Stack', blurb: 'Lines things up with even gaps', glyph: 'stack' },
    { name: 'Boundary', blurb: 'A titled zone: a region, a VPC, a system', glyph: 'boundary' },
    { name: 'Table', blurb: 'An editable grid of cells', glyph: 'table' },
  ];
  const px = 62;
  const py = 12;
  return (
    <Scene w={420} h={260} bg="plain">
      <Panel x={px} y={py} w={296} h={238} title="LAYOUT">
        <Label x={px + 12} y={py + 36} size={9} weight={700} tone="muted">
          Containers
        </Label>
        {rows.map((r, i) => {
          const y = py + 48 + i * 37;
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
                {r.glyph === 'table' ? (
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
                ) : r.glyph === 'stack' ? (
                  <>
                    <rect x={gx - 9} y={gy - 5} width={5} height={9} rx={1} />
                    <rect x={gx - 2.5} y={gy - 5} width={5} height={9} rx={1} />
                    <rect x={gx + 4} y={gy - 5} width={5} height={9} rx={1} />
                  </>
                ) : (
                  <>
                    <rect
                      x={gx - 9}
                      y={gy - 7}
                      width={18}
                      height={13}
                      rx={2}
                      strokeDasharray="2.5 2"
                    />
                    <path d={`M${gx - 6} ${gy + 3} H${gx - 1}`} />
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
