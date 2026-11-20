import { Cursor, Label, SelectionBox } from '@liveworkspace/help-site/art/primitives';
import { Stage } from '@liveworkspace/help-site/art/parts';
import { Card, Icon, Strip, stripSlot } from '../illustrations/editor-chrome';
import { Plant, Room, Rug, Sofa } from '../illustrations/space-furniture';

// The rows of Seats' flyout drawn here: a name and its glyph.
const ROWS: readonly [string, string][] = [
  [
    'Chair',
    'M5 9V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 11a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3ZM5 16v3M19 16v3',
  ],
  ['Sofa', 'M4 10V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2M2 12h20v5H2zM5 17v2M19 17v2'],
  ['Desk', 'M4 11h16M6 11v8M18 11v8M9 4h6v5H9zM12 9v2'],
  ['Bean Bag', 'M4 16c0-5 3-9 8-9s8 4 8 9H4ZM9 13h6'],
];

// Palette: the strip with Seats open, its flyout listing the seats, and a sofa just dragged out of it onto the
// Lounge's rug.
export function PaletteArt() {
  const fx = stripSlot(40, 'seats') - 40;
  return (
    <Stage>
      <Room x={210} y={70} w={170} h={130} name="Lounge" />
      <Rug cx={300} cy={140} rx={44} ry={22} />
      <Plant cx={360} cy={180} />
      <Strip x={40} y={10} open="seats" />
      <Card x={fx} y={42} w={120} h={130} r={7}>
        <Label x={fx + 10} y={56} size={10} weight={650} tone="strong">
          Seats
        </Label>
        {ROWS.map(([name, d], i) => {
          const ry = 68 + i * 25;
          const on = name === 'Sofa';
          return (
            <g key={name}>
              {on && (
                <rect
                  x={fx + 4}
                  y={ry - 2}
                  width={112}
                  height={23}
                  rx={5}
                  className="fill-brand-50"
                />
              )}
              <rect
                x={fx + 9}
                y={ry}
                width={19}
                height={19}
                rx={5}
                className="fill-white stroke-slate-200"
                strokeWidth={0.75}
              />
              <Icon prims={[{ t: 'path', d }]} x={fx + 18.5} y={ry + 9.5} size={10} />
              <Label
                x={fx + 35}
                y={ry + 10}
                size={9.5}
                weight={600}
                tone={on ? 'accent' : 'strong'}
              >
                {name}
              </Label>
            </g>
          );
        })}
      </Card>
      <path
        d={`M${fx + 110} 98 C 230 96, 260 110, 278 126`}
        className="fill-none stroke-slate-400"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <Sofa x={280} y={128} />
      <SelectionBox x={276} y={124} w={48} h={26} />
      <Cursor x={312} y={142} />
    </Stage>
  );
}
