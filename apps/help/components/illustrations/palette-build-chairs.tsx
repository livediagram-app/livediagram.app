// The scene for the palette article on the Build category (docs/specs/010-palette/build-category.md), drawn with
// the labels the editor prints.

import { Scene, Label, Panel } from './primitives';

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
