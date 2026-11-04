// livehuddle's Spaces in miniature: a Virtual Office, a Team Pod, a Coworking Space and an All-Hands Hall, each its
// floor plan seen from above, laid out as its template lays it out (livehuddle/docs/specs/012-collaboration/
// virtual-office-template.md), with a few people's avatars in it. In work-art's house style (work-art.tsx): white
// floor, slate walls and furniture, the `brand` ramp for rugs, the stage and the plants. An avatar is a disc in its
// person's colour with a ring of the floor round it, as a call's bubble is. Static, and no colour of their own beyond
// the avatars' hues, which explorer.css and help-art.css leave as drawn in dark.

import { Bar, Paper, type WorkBox } from './work-art-parts';

type Box = WorkBox;

// The people in a space, each a hue that reads on the floor and its rugs in either appearance.
const PEOPLE = [
  'fill-brand-500',
  'fill-amber-400',
  'fill-sky-400',
  'fill-rose-400',
  'fill-violet-400',
] as const;
type Person = (typeof PEOPLE)[number];

/** The plan's inner floor: the box less a margin, the stroke widths and an avatar's size scaled to it. */
function plan({ x, y, w, h }: Box) {
  const pad = Math.max(2, w * 0.05);
  return {
    x: x + pad,
    y: y + pad,
    w: w - pad * 2,
    h: h - pad * 2,
    wall: Math.max(0.8, Math.min(w, h * 1.6) * 0.01),
    r: Math.max(1.6, Math.min(w, h * 1.6) * 0.03),
  };
}

/** A room: floor inside a slate wall. */
function Room({ x, y, w, h, wall }: Box & { wall: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={Math.min(1.5, w * 0.04)}
      className="fill-white stroke-slate-300"
      strokeWidth={wall}
    />
  );
}

/** A doorway: the wall broken where it opens, drawn as a piece of floor over it. */
function Door({ x, y, w, wall }: { x: number; y: number; w: number; wall: number }) {
  return <rect x={x} y={y - wall} width={w} height={wall * 2} className="fill-white" />;
}

/** A person: a disc in their colour, ringed with the floor so two side by side stay apart. */
function Avatar({ cx, cy, r, tone }: { cx: number; cy: number; r: number; tone: Person }) {
  return <circle cx={cx} cy={cy} r={r} className={`${tone} stroke-white`} strokeWidth={r * 0.4} />;
}

/** A piece of furniture seen from above: a desk, a table, a sofa or a counter. */
function Piece({ x, y, w, h, className = 'fill-slate-200' }: Box & { className?: string }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={Math.min(1.2, Math.min(w, h) * 0.25)}
      className={className}
    />
  );
}

/** A rug: a soft patch of the brand under a sitting area or a stage. */
function Rug({ x, y, w, h, className = 'fill-brand-100' }: Box & { className?: string }) {
  return <rect x={x} y={y} width={w} height={h} rx={Math.min(2, h * 0.2)} className={className} />;
}

/** A plant seen from above: a pale leafy disc with a darker edge, so it never reads as a person. */
function Plant({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      className="fill-brand-200 stroke-brand-400"
      strokeWidth={r * 0.3}
      strokeDasharray={`${r * 0.5} ${r * 0.28}`}
    />
  );
}

/** A chair: a dot. */
function Dot({ cx, cy, r, className }: { cx: number; cy: number; r: number; className: string }) {
  return <circle cx={cx} cy={cy} r={r} className={className} />;
}

/** A Virtual Office: six rooms either side of a corridor (Reception, Desks and the Meeting Room over the Kitchen, the
 *  Lounge and a Focus Room), people at work in them and one walking in from the corridor's Walk In. */
export function MiniVirtualOffice(box: Box) {
  const p = plan(box);
  const { wall, r } = p;
  const corridor = p.h * 0.2;
  const rowH = (p.h - corridor) / 2;
  const top = [0.3, 0.4, 0.3];
  const bottom = [0.34, 0.36, 0.3];
  const lefts = (fs: number[]) => {
    let left = p.x;
    return fs.map((f) => {
      const l = left;
      left += f * p.w;
      return { x: l, w: f * p.w };
    });
  };
  const [reception, desks, meeting] = lefts(top) as [Col, Col, Col];
  const [kitchen, lounge, focus] = lefts(bottom) as [Col, Col, Col];
  const ty = p.y;
  const by = p.y + rowH + corridor;
  const cy = p.y + rowH + corridor / 2;
  const door = Math.min(reception.w, kitchen.w) * 0.3;
  const deskW = desks.w * 0.18;
  const deskH = rowH * 0.16;
  const tableW = meeting.w * 0.56;
  const tableH = rowH * 0.24;
  const tableX = meeting.x + (meeting.w - tableW) / 2;
  const tableY = ty + rowH * 0.42;
  return (
    <g>
      <Paper x={box.x} y={box.y} w={box.w} h={box.h} />
      {[reception, desks, meeting].map((c, i) => (
        <Room key={`t${i}`} x={c.x} y={ty} w={c.w} h={rowH} wall={wall} />
      ))}
      {[kitchen, lounge, focus].map((c, i) => (
        <Room key={`b${i}`} x={c.x} y={by} w={c.w} h={rowH} wall={wall} />
      ))}
      {[reception, desks, meeting].map((c, i) => (
        <Door key={`td${i}`} x={c.x + (c.w - door) / 2} y={ty + rowH} w={door} wall={wall} />
      ))}
      {[kitchen, lounge, focus].map((c, i) => (
        <Door key={`bd${i}`} x={c.x + (c.w - door) / 2} y={by} w={door} wall={wall} />
      ))}
      {/* Reception: a sofa on a rug, a plant either side. */}
      <Rug
        x={reception.x + reception.w * 0.2}
        y={ty + rowH * 0.22}
        w={reception.w * 0.6}
        h={rowH * 0.5}
      />
      <Piece
        x={reception.x + reception.w * 0.28}
        y={ty + rowH * 0.28}
        w={reception.w * 0.44}
        h={rowH * 0.16}
        className="fill-slate-300"
      />
      <Plant cx={reception.x + reception.w * 0.12} cy={ty + rowH * 0.2} r={r * 0.7} />
      <Plant cx={reception.x + reception.w * 0.88} cy={ty + rowH * 0.2} r={r * 0.7} />
      {/* Desks: two rows of three, one taken. */}
      {[0, 1].flatMap((row) =>
        [0, 1, 2].map((col) => (
          <Piece
            key={`d${row}${col}`}
            x={desks.x + desks.w * (0.12 + col * 0.29)}
            y={ty + rowH * (0.18 + row * 0.42)}
            w={deskW}
            h={deskH}
          />
        )),
      )}
      <Avatar
        cx={desks.x + desks.w * 0.12 + deskW / 2}
        cy={ty + rowH * 0.18 + deskH + r * 1.3}
        r={r}
        tone="fill-amber-400"
      />
      <Avatar
        cx={desks.x + desks.w * 0.7 + deskW / 2}
        cy={ty + rowH * 0.6 + deskH + r * 1.3}
        r={r}
        tone="fill-sky-400"
      />
      {/* The Meeting Room: a table of six, two in a call at it. */}
      <Piece x={tableX} y={tableY} w={tableW} h={tableH} />
      {[0.2, 0.5, 0.8].flatMap((f, i) => [
        <Dot
          key={`mt${i}`}
          cx={tableX + tableW * f}
          cy={tableY - r * 0.9}
          r={r * 0.55}
          className="fill-slate-300"
        />,
        <Dot
          key={`mb${i}`}
          cx={tableX + tableW * f}
          cy={tableY + tableH + r * 0.9}
          r={r * 0.55}
          className="fill-slate-300"
        />,
      ])}
      <Avatar cx={tableX + tableW * 0.2} cy={tableY - r * 0.9} r={r} tone="fill-violet-400" />
      <Avatar
        cx={tableX + tableW * 0.8}
        cy={tableY + tableH + r * 0.9}
        r={r}
        tone="fill-rose-400"
      />
      {/* The corridor: someone walking in from Walk In at its end, their steps behind them. */}
      <rect
        x={p.x + p.w - p.w * 0.13}
        y={cy - corridor * 0.24}
        width={p.w * 0.11}
        height={corridor * 0.48}
        rx={corridor * 0.24}
        className="fill-brand-500"
      />
      {[0.66, 0.72, 0.78].map((f, i) => (
        <Dot key={`s${i}`} cx={p.x + p.w * f} cy={cy} r={r * 0.28} className="fill-brand-300" />
      ))}
      <Avatar cx={p.x + p.w * 0.58} cy={cy} r={r} tone="fill-brand-500" />
      {/* The Kitchen: a counter along the wall and a chair facing it. */}
      <Piece
        x={kitchen.x + kitchen.w * 0.1}
        y={by + rowH * 0.74}
        w={kitchen.w * 0.8}
        h={rowH * 0.14}
      />
      <Dot
        cx={kitchen.x + kitchen.w * 0.3}
        cy={by + rowH * 0.5}
        r={r * 0.55}
        className="fill-slate-300"
      />
      <Dot
        cx={kitchen.x + kitchen.w * 0.7}
        cy={by + rowH * 0.5}
        r={r * 0.55}
        className="fill-slate-300"
      />
      {/* The Lounge: a sofa on a rug, two chairs facing in. */}
      <Rug x={lounge.x + lounge.w * 0.16} y={by + rowH * 0.3} w={lounge.w * 0.68} h={rowH * 0.5} />
      <Piece
        x={lounge.x + lounge.w * 0.26}
        y={by + rowH * 0.62}
        w={lounge.w * 0.48}
        h={rowH * 0.16}
        className="fill-slate-300"
      />
      <Dot
        cx={lounge.x + lounge.w * 0.32}
        cy={by + rowH * 0.42}
        r={r * 0.6}
        className="fill-slate-300"
      />
      <Dot
        cx={lounge.x + lounge.w * 0.68}
        cy={by + rowH * 0.42}
        r={r * 0.6}
        className="fill-slate-300"
      />
      {/* The Focus Room: one desk on its own, someone heads down at it, a plant. */}
      <Piece x={focus.x + focus.w * 0.3} y={by + rowH * 0.56} w={focus.w * 0.4} h={deskH} />
      <Avatar
        cx={focus.x + focus.w * 0.5}
        cy={by + rowH * 0.56 - r * 1.3}
        r={r}
        tone="fill-amber-400"
      />
      <Plant cx={focus.x + focus.w * 0.84} cy={by + rowH * 0.8} r={r * 0.7} />
    </g>
  );
}
type Col = { x: number; w: number };

// The Team Board's stickies: This week, Blocked on, Wins, Questions.
const STICKIES = ['fill-amber-200', 'fill-sky-200', 'fill-emerald-200', 'fill-violet-100'];

/** A Team Pod: one room for a small team, its cluster of four desks (three taken), a round table for the stand-up, a
 *  coffee machine and a plant, and beside it the Team Board of four stickies. */
export function MiniTeamPod(box: Box) {
  const p = plan(box);
  const { wall, r } = p;
  const roomW = p.w * 0.6;
  const boardX = p.x + roomW + p.w * 0.06;
  const boardW = p.w - roomW - p.w * 0.06;
  // The cluster: two desks over two, facing across the middle, at the room's left.
  const dw = roomW * 0.2;
  const dh = p.h * 0.17;
  const cx0 = p.x + roomW * 0.12;
  const cy0 = p.y + p.h * 0.24;
  const tcx = p.x + roomW * 0.72;
  const tcy = p.y + p.h * 0.58;
  const tr = Math.min(roomW * 0.13, p.h * 0.17);
  const gap = boardW * 0.08;
  const noteW = (boardW - gap * 3) / 2;
  const noteH = Math.min(noteW, (p.h * 0.8 - gap * 3) / 2);
  const text = Math.max(0.8, noteH * 0.09);
  return (
    <g>
      <Paper x={box.x} y={box.y} w={box.w} h={box.h} />
      <Room x={p.x} y={p.y} w={roomW} h={p.h} wall={wall} />
      <Door x={p.x + roomW * 0.42} y={p.y + p.h} w={roomW * 0.18} wall={wall} />
      {[0, 1].flatMap((row) =>
        [0, 1].map((col) => (
          <Piece
            key={`d${row}${col}`}
            x={cx0 + col * (dw + wall)}
            y={cy0 + row * (dh + wall)}
            w={dw}
            h={dh}
          />
        )),
      )}
      <Avatar cx={cx0 + dw / 2} cy={cy0 - r * 1.3} r={r} tone="fill-brand-500" />
      <Avatar cx={cx0 + dw * 1.5 + wall} cy={cy0 - r * 1.3} r={r} tone="fill-amber-400" />
      <Avatar cx={cx0 + dw / 2} cy={cy0 + dh * 2 + wall + r * 1.3} r={r} tone="fill-sky-400" />
      <Dot
        cx={cx0 + dw * 1.5 + wall}
        cy={cy0 + dh * 2 + wall + r * 1.3}
        r={r * 0.55}
        className="fill-slate-300"
      />
      {/* The stand-up table, someone at it, and the coffee machine and plant in the far corner. */}
      <circle cx={tcx} cy={tcy} r={tr} className="fill-slate-200" />
      {[0, 1, 2, 3].map((i) => {
        const a = (Math.PI / 2) * i + Math.PI / 4;
        return (
          <Dot
            key={`c${i}`}
            cx={tcx + Math.cos(a) * (tr + r * 0.9)}
            cy={tcy + Math.sin(a) * (tr + r * 0.9)}
            r={r * 0.55}
            className="fill-slate-300"
          />
        );
      })}
      <Avatar
        cx={tcx + Math.cos(-Math.PI / 4) * (tr + r * 0.9)}
        cy={tcy + Math.sin(-Math.PI / 4) * (tr + r * 0.9)}
        r={r}
        tone="fill-rose-400"
      />
      <Piece
        x={p.x + roomW * 0.62}
        y={p.y + p.h * 0.1}
        w={roomW * 0.12}
        h={p.h * 0.12}
        className="fill-slate-400"
      />
      <Plant cx={p.x + roomW * 0.86} cy={p.y + p.h * 0.16} r={r * 0.75} />
      {/* The Team Board. */}
      <rect
        x={boardX}
        y={p.y}
        width={boardW}
        height={p.h}
        rx={Math.min(1.5, boardW * 0.05)}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={wall * 0.8}
      />
      <Bar
        x={boardX + gap}
        y={p.y + p.h * 0.08}
        w={boardW * 0.5}
        h={Math.max(1, p.h * 0.05)}
        className="fill-slate-500"
      />
      {STICKIES.map((tone, i) => {
        const nx = boardX + gap + (i % 2) * (noteW + gap);
        const ny = p.y + p.h * 0.22 + Math.floor(i / 2) * (noteH + gap);
        return (
          <g key={tone}>
            <rect
              x={nx}
              y={ny}
              width={noteW}
              height={noteH}
              rx={Math.min(1, noteW * 0.06)}
              className={tone}
            />
            <Bar
              x={nx + noteW * 0.16}
              y={ny + noteH * 0.24}
              w={noteW * 0.62}
              h={text}
              className="fill-slate-600/40"
            />
            <Bar
              x={nx + noteW * 0.16}
              y={ny + noteH * 0.46}
              w={noteW * 0.42}
              h={text}
              className="fill-slate-600/40"
            />
          </g>
        );
      })}
    </g>
  );
}

/** A Coworking Space: one open floor of two desk clusters, a coffee bar, a lounge round a rug, and two phone booths
 *  along the right wall, one with someone on a call in it. */
export function MiniCoworking(box: Box) {
  const p = plan(box);
  const { wall, r } = p;
  const boothW = p.w * 0.16;
  const boothH = p.h * 0.36;
  const boothX = p.x + p.w - boothW;
  const dw = p.w * 0.11;
  const dh = p.h * 0.13;
  const clusters = [
    { x: p.x + p.w * 0.07, y: p.y + p.h * 0.14 },
    { x: p.x + p.w * 0.07, y: p.y + p.h * 0.56 },
  ];
  const seated: { tone: Person; cluster: number; col: number; above: boolean }[] = [
    { tone: 'fill-brand-500', cluster: 0, col: 0, above: true },
    { tone: 'fill-violet-400', cluster: 0, col: 1, above: false },
    { tone: 'fill-amber-400', cluster: 1, col: 1, above: true },
  ];
  const barX = p.x + p.w * 0.42;
  const rugX = p.x + p.w * 0.42;
  const rugY = p.y + p.h * 0.48;
  const rugW = p.w * 0.32;
  const rugH = p.h * 0.38;
  return (
    <g>
      <Paper x={box.x} y={box.y} w={box.w} h={box.h} />
      <Room x={p.x} y={p.y} w={p.w} h={p.h} wall={wall} />
      {[0, 1].map((i) => (
        <g key={`b${i}`}>
          <Room x={boothX} y={p.y + i * boothH} w={boothW} h={boothH} wall={wall} />
          <Door
            x={boothX - wall}
            y={p.y + i * boothH + boothH * 0.5}
            w={wall * 2}
            wall={boothH * 0.2}
          />
          <Dot
            cx={boothX + boothW * 0.55}
            cy={p.y + i * boothH + boothH * 0.5}
            r={r * 0.55}
            className="fill-slate-300"
          />
        </g>
      ))}
      <Avatar cx={boothX + boothW * 0.55} cy={p.y + boothH * 0.5} r={r} tone="fill-sky-400" />
      {/* Two clusters of four desks, each pair facing across a shared bench. */}
      {clusters.flatMap((c, ci) =>
        [0, 1].flatMap((row) =>
          [0, 1].map((col) => (
            <Piece
              key={`d${ci}${row}${col}`}
              x={c.x + col * (dw + wall)}
              y={c.y + row * (dh + wall)}
              w={dw}
              h={dh}
            />
          )),
        ),
      )}
      {seated.map((s) => {
        const c = clusters[s.cluster]!;
        return (
          <Avatar
            key={`${s.cluster}${s.col}`}
            cx={c.x + s.col * (dw + wall) + dw / 2}
            cy={s.above ? c.y - r * 1.3 : c.y + dh * 2 + wall + r * 1.3}
            r={r}
            tone={s.tone}
          />
        );
      })}
      {/* The coffee bar: a counter with its machine, along the top wall. */}
      <Piece x={barX} y={p.y + p.h * 0.08} w={p.w * 0.3} h={p.h * 0.12} />
      <Piece
        x={barX + p.w * 0.03}
        y={p.y + p.h * 0.1}
        w={p.w * 0.06}
        h={p.h * 0.08}
        className="fill-slate-400"
      />
      <Plant cx={barX + p.w * 0.24} cy={p.y + p.h * 0.14} r={r * 0.6} />
      {/* The lounge: a sofa and two chairs round a rug, two people talking on it. */}
      <Rug x={rugX} y={rugY} w={rugW} h={rugH} />
      <Piece
        x={rugX + rugW * 0.18}
        y={rugY + rugH * 0.66}
        w={rugW * 0.64}
        h={rugH * 0.2}
        className="fill-slate-300"
      />
      <Avatar cx={rugX + rugW * 0.32} cy={rugY + rugH * 0.34} r={r} tone="fill-rose-400" />
      <Avatar cx={rugX + rugW * 0.68} cy={rugY + rugH * 0.34} r={r} tone="fill-brand-500" />
    </g>
  );
}

/** An All-Hands Hall: a stage at the front with the presenter on it, held in Bring Focus's ring, and rows of chairs
 *  facing it either side of a centre aisle, an audience filling them. */
export function MiniAllHands(box: Box) {
  const p = plan(box);
  const { wall, r } = p;
  const stageW = p.w * 0.42;
  const stageH = p.h * 0.22;
  const stageX = p.x + (p.w - stageW) / 2;
  const stageY = p.y + p.h * 0.06;
  const pcx = p.x + p.w / 2;
  const pcy = stageY + stageH / 2;
  const rows = 4;
  const perSide = 4;
  const aisle = p.w * 0.1;
  const sideW = (p.w * 0.8 - aisle) / 2;
  const seat = sideW / perSide;
  const rowGap = (p.h * 0.6) / rows;
  const firstRow = p.y + p.h * 0.4;
  // Who is in which seat: [row, side, seat] and their colour.
  const audience: { row: number; seat: number; tone: Person }[] = [
    { row: 0, seat: 1, tone: 'fill-amber-400' },
    { row: 0, seat: 6, tone: 'fill-sky-400' },
    { row: 1, seat: 2, tone: 'fill-violet-400' },
    { row: 1, seat: 5, tone: 'fill-rose-400' },
    { row: 2, seat: 0, tone: 'fill-brand-500' },
    { row: 2, seat: 4, tone: 'fill-amber-400' },
    { row: 3, seat: 3, tone: 'fill-sky-400' },
    { row: 3, seat: 7, tone: 'fill-violet-400' },
  ];
  const seatX = (s: number) => {
    const side = s < perSide ? 0 : 1;
    const left = p.x + p.w * 0.1 + side * (sideW + aisle);
    return left + ((s % perSide) + 0.5) * seat;
  };
  const chairW = seat * 0.62;
  const chairH = Math.min(rowGap * 0.42, chairW);
  return (
    <g>
      <Paper x={box.x} y={box.y} w={box.w} h={box.h} />
      <Room x={p.x} y={p.y} w={p.w} h={p.h} wall={wall} />
      <Door x={pcx - p.w * 0.06} y={p.y + p.h} w={p.w * 0.12} wall={wall} />
      <Rug x={stageX} y={stageY} w={stageW} h={stageH} className="fill-brand-200" />
      <circle
        cx={pcx}
        cy={pcy}
        r={r * 2.1}
        className="fill-none stroke-brand-400"
        strokeWidth={wall}
        strokeDasharray={`${r * 0.9} ${r * 0.6}`}
      />
      <Avatar cx={pcx} cy={pcy} r={r} tone="fill-brand-500" />
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: perSide * 2 }, (_, s) => (
          <Piece
            key={`c${row}${s}`}
            x={seatX(s) - chairW / 2}
            y={firstRow + row * rowGap}
            w={chairW}
            h={chairH}
          />
        )),
      )}
      {audience.map((a) => (
        <Avatar
          key={`a${a.row}${a.seat}`}
          cx={seatX(a.seat)}
          cy={firstRow + a.row * rowGap + chairH * 0.2}
          r={r * 0.9}
          tone={a.tone}
        />
      ))}
      <Plant cx={p.x + p.w * 0.06} cy={p.y + p.h * 0.1} r={r * 0.8} />
      <Plant cx={p.x + p.w * 0.94} cy={p.y + p.h * 0.1} r={r * 0.8} />
    </g>
  );
}
