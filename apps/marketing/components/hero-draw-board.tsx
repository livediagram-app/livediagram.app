import type { CSSProperties } from 'react';
import type { StickerDef } from '@liveplanner/icons';
import { FONT, at } from '@/components/art-tokens';
import { DRAW_COPY as COPY } from '@/components/hero-draw-copy';
import {
  Hand,
  INKS,
  ringLen,
  ringPath,
  roughRect,
  roughRectLen,
  starPath,
  Sticker,
  StickyNote,
  Stroke,
  wavyPath,
  type StickyPaper,
} from '@/components/hero-draw-marks';

// The hero's Draw window (docs/specs/019-marketing/marketing-site.md "Hero"): a sprint retro drawn
// as a sketchnote in Draw mode's marks (docs/specs/007-editor/editor-modes.md), every word in the
// hand face. A title banner is drawn and lettered, four stickies land on the editor's pad colours,
// the highlighter swipes a line, a teammate's blue marker rings the best note (their pen riding
// the stroke) and arrows it to a red star, "Do more of this!"; then a Shout-outs box is drawn and
// ticked off, a velocity sketch climbs, and a party popper sticker lands on the banner. Strokes
// draw on along their length and words are written on from the left (hm-draw, hd-write), each at
// its own --d delay (hero-mode-animations.css, app/hero-scenes/draw.css).

// The pad colours the four notes are on (STICKY_PRESETS: Classic, Rose, Mint, Sky), each with its
// readable ink.
const PAPERS: StickyPaper[] = [
  { fill: '#fde68a', ink: '#451a03' },
  { fill: '#fecdd3', ink: '#4c0519' },
  { fill: '#bbf7d0', ink: '#052e16' },
  { fill: '#bae6fd', ink: '#082f49' },
];
const TILTS = [-3, 2, -1.5, 2.5];
// The note the teammate rings: Pairing on the hard bits.
const BEST = 1;

const NOTE = { w: 118, h: 98 };

const PARTY: StickerDef = {
  id: 'emoji-party-popper',
  kind: 'emoji',
  glyph: '🎉',
  label: 'Party popper',
  keywords: '',
};
const ROCKET: StickerDef = {
  id: 'emoji-rocket',
  kind: 'emoji',
  glyph: '🚀',
  label: 'Rocket',
  keywords: '',
};

type Pt = readonly [number, number];
type Layout = {
  banner: { x: number; y: number; w: number; h: number; size: number };
  subtitle: Pt;
  subtitleSize: number;
  notes: Pt[];
  ring: { rx: number; ry: number };
  // The arrow from the ring to the star: start, two controls, end.
  arrow: [Pt, Pt, Pt, Pt];
  star: { x: number; y: number; r: number };
  keep: { x: number; y: number; anchor?: 'middle' };
  box: { x: number; y: number; w: number; h: number; size: number; gap: number };
  chart: { x: number; y: number; w: number; h: number };
  party: { x: number; y: number };
  rocket: { x: number; y: number };
};

const LANDSCAPE: Layout = {
  banner: { x: 176, y: -52, w: 248, h: 40, size: 31 },
  subtitle: [300, 6],
  subtitleSize: 17,
  notes: [
    [20, 30],
    [160, 34],
    [302, 28],
    [446, 34],
  ],
  ring: { rx: 78, ry: 60 },
  arrow: [
    [270, 136],
    [282, 176],
    [288, 204],
    [300, 222],
  ],
  star: { x: 322, y: 244, r: 24 },
  keep: { x: 322, y: 300, anchor: 'middle' },
  box: { x: 20, y: 172, w: 204, h: 152, size: 17, gap: 30 },
  chart: { x: 404, y: 166, w: 172, h: 126 },
  party: { x: 424, y: -62 },
  rocket: { x: 540, y: 150 },
};

// On a phone: the notes two by two, the ringed one bottom right so its arrow runs down to the star
// under it, then the Shout-outs box and the sketch side by side.
const PORTRAIT: Layout = {
  banner: { x: 62, y: -36, w: 236, h: 38, size: 29 },
  subtitle: [180, 20],
  subtitleSize: 16,
  notes: [
    [26, 36],
    [26, 146],
    [210, 40],
    [210, 150],
  ],
  ring: { rx: 74, ry: 58 },
  arrow: [
    [250, 256],
    [240, 278],
    [214, 288],
    [178, 286],
  ],
  star: { x: 152, y: 284, r: 21 },
  keep: { x: 152, y: 330, anchor: 'middle' },
  box: { x: 6, y: 346, w: 180, h: 128, size: 14, gap: 26 },
  chart: { x: 198, y: 346, w: 154, h: 124 },
  party: { x: 290, y: -50 },
  rocket: { x: 318, y: 312 },
};

// Which note sits where: on a phone the ringed note takes the bottom-right slot.
const ORDER = { landscape: [0, 1, 2, 3], portrait: [0, 3, 2, 1] };

// The arrowhead at the end of a cubic, opened back along its last control.
function head([, , c2, p3]: [Pt, Pt, Pt, Pt]): string {
  const a = Math.atan2(p3[1] - c2[1], p3[0] - c2[0]);
  const wing = (s: number) =>
    `${(p3[0] - Math.cos(a + s) * 11).toFixed(1)} ${(p3[1] - Math.sin(a + s) * 11).toFixed(1)}`;
  return `M${wing(0.5)} L${p3[0]} ${p3[1]} L${wing(-0.5)}`;
}

export function DrawBoard({ portrait = false }: { portrait?: boolean }) {
  const L = portrait ? PORTRAIT : LANDSCAPE;
  const order = portrait ? ORDER.portrait : ORDER.landscape;
  const { banner: b, box, chart: c } = L;

  // The ringed note's centre, the ring round it, and the pen's whole ride: ring, glide, arrow.
  const best = L.notes[order.indexOf(BEST)]!;
  const cx = best[0] + NOTE.w / 2;
  const cy = best[1] + NOTE.h / 2;
  const ring = ringPath(cx, cy, L.ring.rx, L.ring.ry);
  const rLen = ringLen(L.ring.rx, L.ring.ry);
  const [a0, a1, a2, a3] = L.arrow;
  const arrow = `M${a0[0]} ${a0[1]} C${a1[0]} ${a1[1]} ${a2[0]} ${a2[1]} ${a3[0]} ${a3[1]}`;
  const aLen = Math.ceil(Math.hypot(a3[0] - a0[0], a3[1] - a0[1]) * 1.35);
  const ringEnd: Pt = [cx + L.ring.rx * 0.22, cy - L.ring.ry * 0.93];
  const glide = Math.hypot(a0[0] - ringEnd[0], a0[1] - ringEnd[1]);
  const total = rLen + glide + aLen;
  const pen = {
    offsetPath: `path('${ring} L${a0[0]} ${a0[1]} ${arrow.slice(arrow.indexOf('C'))}')`,
    '--p1': `${((rLen / total) * 100).toFixed(1)}%`,
    '--p2': `${(((rLen + glide) / total) * 100).toFixed(1)}%`,
  } as CSSProperties;

  // The banner's swallow-tailed ends, drawn behind it.
  const tail = (side: -1 | 1) => {
    const ex = side < 0 ? b.x : b.x + b.w;
    const out = ex + side * 30;
    const inner = ex - side * 14;
    const y0 = b.y + 9;
    const y1 = b.y + b.h + 9;
    return `M${inner} ${y0} L${out} ${y0} L${out - side * 10} ${(y0 + y1) / 2} L${out} ${y1} L${inner} ${y1} M${ex} ${b.y + b.h} L${inner} ${y1}`;
  };

  // The velocity sketch: axes, then a line climbing to its last sprint.
  const pts: Pt[] = [0.06, 0.24, 0.42, 0.6, 0.78, 0.94].map((f, i) => [
    c.x + 14 + f * (c.w - 22),
    c.y + c.h - 30 - [0.12, 0.2, 0.16, 0.42, 0.55, 0.82][i]! * (c.h - 62),
  ]);
  const line = `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}`;
  const last = pts[pts.length - 1]!;

  return (
    <>
      {/* The title banner, drawn and lettered. */}
      <Stroke
        d={tail(-1)}
        d0={0.2}
        dur={0.4}
        len={170}
        ink="black"
        width={2.2}
        className="fill-(--art-paper)"
      />
      <Stroke
        d={tail(1)}
        d0={0.2}
        dur={0.4}
        len={170}
        ink="black"
        width={2.2}
        className="fill-(--art-paper)"
      />
      <Stroke
        d={roughRect(b.x, b.y, b.w, b.h, 11)}
        d0={0.3}
        dur={0.7}
        len={roughRectLen(b.w, b.h)}
        ink="black"
        width={2.4}
        className="fill-(--art-paper)"
      />
      <Hand x={b.x + b.w / 2} y={b.y + b.h * 0.74} size={b.size} anchor="middle" d={0.8} dur={0.8}>
        {COPY.title}
      </Hand>
      <Hand
        x={L.subtitle[0]}
        y={L.subtitle[1]}
        size={L.subtitleSize}
        ink="green"
        anchor="middle"
        d={1.4}
      >
        {COPY.subtitle}
      </Hand>

      {/* The notes land, in the order they were written. */}
      {order.map((n, slot) => {
        const [x, y] = L.notes[slot]!;
        return (
          <StickyNote
            key={n}
            x={x}
            y={y}
            w={NOTE.w}
            h={NOTE.h}
            tilt={TILTS[n]!}
            paper={PAPERS[n]!}
            lines={COPY.stickies[n]!}
            d={1.9 + n * 0.3}
            under={
              n === BEST ? (
                // The highlighter swipes the note's first line, under the writing.
                <Stroke
                  d={`M${x + 8} ${y + 30} L${x + NOTE.w - 12} ${y + 31.5}`}
                  d0={3.4}
                  dur={0.45}
                  len={100}
                  width={15}
                  className="hm-highlight hd-highlight stroke-[#facc15]"
                />
              ) : null
            }
          />
        );
      })}

      {/* The teammate's blue marker rings the best note, then arrows it to a star. */}
      <Stroke d={ring} d0={4} dur={1.2} len={rLen} ink="blue" width={3} />
      <Stroke d={arrow} d0={5.45} dur={0.55} len={aLen} ink="blue" width={3} />
      <Stroke d={head(L.arrow)} d0={5.95} dur={0.2} len={30} ink="blue" width={3} />
      <Stroke
        d={starPath(L.star.x, L.star.y, L.star.r)}
        d0={6.2}
        dur={0.8}
        len={Math.ceil(L.star.r * 9.6)}
        ink="red"
        width={2.8}
      />
      <Hand
        x={L.keep.x}
        y={L.keep.y}
        size={portrait ? 21 : 23}
        ink="red"
        anchor={L.keep.anchor}
        d={6.9}
        dur={0.7}
      >
        {COPY.keep}
      </Hand>

      {/* Shout-outs: a box, its heading underlined, three names ticked off. */}
      <Stroke
        d={roughRect(box.x, box.y, box.w, box.h, 29)}
        d0={7.4}
        dur={0.8}
        len={roughRectLen(box.w, box.h)}
        ink="black"
        width={2.2}
      />
      <Hand x={box.x + 14} y={box.y + 30} size={box.size + 7} ink="violet" d={8}>
        {COPY.shoutOuts}
      </Hand>
      <Stroke
        d={wavyPath(box.x + 14, box.y + 39, portrait ? 92 : 100)}
        d0={8.5}
        dur={0.35}
        len={130}
        ink="violet"
        width={2}
      />
      {COPY.thanks.map((t, i) => {
        const ty = box.y + 39 + box.gap * (i + 1);
        return (
          <g key={t}>
            <Stroke
              d={`M${box.x + 14} ${ty - 6} l4 5 l9 -11`}
              d0={8.8 + i * 0.45}
              dur={0.2}
              len={24}
              ink="green"
              width={2.4}
            />
            <Hand x={box.x + 34} y={ty} size={box.size + 2} d={8.95 + i * 0.45} dur={0.5}>
              {t}
            </Hand>
          </g>
        );
      })}

      {/* A velocity sketch: axes, the line climbing, its best sprint ringed. */}
      <Hand x={c.x + 4} y={c.y + 14} size={portrait ? 20 : 22} ink="blue" d={7.6}>
        {COPY.chart}
      </Hand>
      <Stroke
        d={`M${c.x + 8} ${c.y + 28} L${c.x + 9} ${c.y + c.h - 18} L${c.x + c.w} ${c.y + c.h - 19}`}
        d0={7.9}
        dur={0.5}
        len={Math.ceil(c.w + c.h)}
        ink="black"
        width={2}
      />
      {[0.25, 0.5, 0.75].map((f) => (
        <Stroke
          key={f}
          d={`M${(c.x + 9 + f * (c.w - 9)).toFixed(1)} ${c.y + c.h - 23} l0 8`}
          d0={8.3}
          dur={0.15}
          len={10}
          ink="black"
          width={1.6}
        />
      ))}
      <Stroke d={line} d0={8.5} dur={0.9} len={Math.ceil(c.w * 1.4)} ink="green" width={2.8} />
      <circle
        className={`hm-pop ${INKS.green.fill}`}
        style={at(9.4)}
        cx={last[0]}
        cy={last[1]}
        r="4.5"
      />
      <Hand
        x={last[0] - 8}
        y={last[1] - 12}
        size={portrait ? 17 : 19}
        ink="green"
        anchor="end"
        d={9.6}
      >
        {COPY.gain}
      </Hand>

      {/* Stickers, slapped on last. */}
      <Sticker
        def={PARTY}
        x={L.party.x}
        y={L.party.y}
        size={portrait ? 34 : 38}
        tilt={12}
        d={10.1}
      />
      <Sticker
        def={ROCKET}
        x={L.rocket.x}
        y={L.rocket.y}
        size={portrait ? 30 : 34}
        tilt={-10}
        d={10.4}
      />

      {/* The teammate's pen rides the ring and the arrow as they are drawn. */}
      <g className="hd-pen" style={pen} aria-hidden>
        <g transform="translate(-2 -26)">
          <path
            d="M2 24 L6 12 L16 2 L22 8 L12 18 Z"
            className="fill-[#2563eb] dark:fill-[#60a5fa]"
            stroke="white"
            strokeWidth="1.5"
          />
          <rect x="16" y="-13" width="22" height="13" rx="3" fill="#ec4899" />
          <text
            x="27"
            y="-3.5"
            textAnchor="middle"
            fontFamily={FONT}
            fontSize="8"
            fontWeight="700"
            fill="white"
          >
            JR
          </text>
        </g>
      </g>
    </>
  );
}
