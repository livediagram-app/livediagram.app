// Card-element illustrations for the Tools tab (spec/82 + spec/83): the dark
// monospace code block and the checkable checklist card. Split out from
// palette-tools.tsx (already at size) per the no-god-files rule; composed from
// the shared primitives plus raw rects for the token/row motifs the kit lacks.

import { Scene, Label, TextBar } from './primitives';

/** A code block on the canvas: the fixed dark editor-style card with coloured
 *  token bars standing in for highlighted code, and the language badge. */
export function CodeBlockCard() {
  const x = 100;
  const y = 44;
  const w = 220;
  const h = 132;
  // Each line: [indent, [width, tokenClass][]] approximating highlighted code.
  const lines: [number, [number, string][]][] = [
    [
      0,
      [
        [34, 'fill-violet-400'],
        [52, 'fill-slate-300'],
        [24, 'fill-slate-500'],
      ],
    ],
    [
      16,
      [
        [28, 'fill-violet-400'],
        [40, 'fill-sky-300'],
        [46, 'fill-emerald-400'],
      ],
    ],
    [
      16,
      [
        [52, 'fill-slate-300'],
        [18, 'fill-amber-300'],
      ],
    ],
    [16, [[64, 'fill-slate-500']]],
    [0, [[16, 'fill-slate-300']]],
  ];
  return (
    <Scene w={420} h={220}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        className="fill-slate-800 stroke-slate-600"
        strokeWidth={2}
      />
      {/* Language badge, top-right */}
      <rect x={x + w - 42} y={y + 12} width={30} height={16} rx={5} className="fill-slate-700" />
      <Label x={x + w - 27} y={y + 21} anchor="middle" size={9} weight={600} tone="muted">
        TS
      </Label>
      {/* Token bars */}
      {lines.map(([indent, tokens], row) => {
        let tx = x + 18 + indent;
        const ty = y + 26 + row * 20;
        return tokens.map(([tw, cls], i) => {
          const bar = (
            <rect
              key={`${row}-${i}`}
              x={tx}
              y={ty}
              width={tw}
              height={7}
              rx={3.5}
              className={cls}
            />
          );
          tx += tw + 8;
          return bar;
        });
      })}
    </Scene>
  );
}

/** A checklist card on the canvas: checkbox rows with two ticked (struck
 *  through and muted) and the done-count footer. */
export function ChecklistCard() {
  const x = 118;
  const y = 34;
  const w = 184;
  const h = 152;
  const rows: { done: boolean; tw: number }[] = [
    { done: true, tw: 88 },
    { done: true, tw: 64 },
    { done: false, tw: 96 },
    { done: false, tw: 72 },
  ];
  return (
    <Scene w={420} h={220}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      {rows.map(({ done, tw }, i) => {
        const ry = y + 18 + i * 28;
        return (
          <g key={i}>
            {done ? (
              <>
                <rect x={x + 16} y={ry} width={14} height={14} rx={4} className="fill-brand-500" />
                <path
                  d={`M${x + 19.5} ${ry + 7} l2.8 2.8 l5.2 -6`}
                  fill="none"
                  className="stroke-white"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            ) : (
              <rect
                x={x + 16}
                y={ry}
                width={14}
                height={14}
                rx={4}
                className="fill-white stroke-brand-400"
                strokeWidth={1.8}
              />
            )}
            <TextBar x={x + 40} y={ry + 4} w={tw} tone={done ? 'faint' : 'muted'} />
            {done && (
              <line
                x1={x + 38}
                y1={ry + 7}
                x2={x + 42 + tw}
                y2={ry + 7}
                className="stroke-slate-400"
                strokeWidth={1.5}
              />
            )}
          </g>
        );
      })}
      {/* Done-count footer, bottom-right */}
      <Label x={x + w - 16} y={y + h - 14} anchor="end" size={11} weight={600} tone="accent">
        2/4
      </Label>
    </Scene>
  );
}
