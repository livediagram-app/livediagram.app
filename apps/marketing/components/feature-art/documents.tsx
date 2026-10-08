// Feature art for the Documents & slides category (docs/specs/019-marketing/marketing-site.md,
// docs/specs/007-editor/article-pages.md, illustrate-pages.md): writing that flows onto a new
// page, a picture and a drawing set in the text, a comment in the margin, the five article looks
// and a slide page taking a layout. Each is a finished spread at rest; the fa-f-* loops type the
// lines, turn the pages and move the hands (mode-parts.tsx).

import {
  at,
  Avatar,
  BAR,
  BAR_SOFT,
  Cursor,
  INK,
  MUTED,
  Pill,
  SERIF,
  Stage,
  SURFACE,
  TEAMMATE,
  TextLines,
  YOU,
} from './mode-parts';

const ACCENT = '#0ea5e9';
const WARM = '#f59e0b';

/** A page on the canvas, with the label the editor sets above it. */
function Page({
  x,
  y,
  w,
  h,
  label,
  dashed = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  dashed?: boolean;
}) {
  return (
    <g>
      {label ? (
        <text className={MUTED} x={x} y={y - 2.4} fontSize="5" fontWeight="600" fill="#64748b">
          {label}
        </text>
      ) : null}
      {dashed ? (
        <rect
          className="fill-white/50 stroke-sky-400 dark:fill-slate-800/40"
          x={x}
          y={y}
          width={w}
          height={h}
          rx="1.5"
          fill="#ffffff80"
          stroke="#38bdf8"
          strokeWidth="0.9"
          strokeDasharray="3 2"
        />
      ) : (
        <rect className={SURFACE} x={x} y={y} width={w} height={h} rx="1.5" strokeWidth="0.7" />
      )}
    </g>
  );
}

/** A small serif headline. */
function Headline({
  x,
  y,
  text,
  size = 7.6,
}: {
  x: number;
  y: number;
  text: string;
  size?: number;
}) {
  return (
    <text
      className={INK}
      x={x}
      y={y}
      fontFamily={SERIF}
      fontSize={size}
      fontWeight="700"
      fill="#1e293b"
    >
      {text}
    </text>
  );
}

/** Writing that runs off the first page and on to the next, a third page arriving as it grows. */
export function ArticleFlowArt() {
  const W = 58;
  const H = 80;
  const xs = [52, 121, 190];
  return (
    <Stage>
      <Page x={xs[0]!} y={12} w={W} h={H} label="Page 1 · Article" />
      <text
        className="fill-sky-600 dark:fill-sky-300"
        x={xs[0]! + 6}
        y={21}
        fontSize="4.6"
        fontWeight="800"
        letterSpacing="0.5"
        fill="#0284c7"
      >
        FIELD NOTES
      </text>
      <Headline x={xs[0]! + 6} y={30.5} text="Ship small," />
      <Headline x={xs[0]! + 6} y={38.5} text="ship often" />
      {/* A drop cap, then the paragraph. */}
      <text x={xs[0]! + 6} y={53} fontFamily={SERIF} fontSize="12" fontWeight="700" fill={ACCENT}>
        E
      </text>
      <TextLines x={xs[0]! + 15} y={44.5} w={37} widths={[1, 1, 0.92]} gap={4.2} h={1.8} />
      <TextLines
        x={xs[0]! + 6}
        y={57.1}
        w={46}
        widths={[1, 0.96, 1, 1, 0.98, 1, 1]}
        gap={4.2}
        h={1.8}
      />

      <Page x={xs[1]!} y={12} w={W} h={H} label="Page 2" />
      <TextLines x={xs[1]! + 6} y={19} w={46} widths={[1, 0.95, 0.6]} gap={4.2} h={1.8} />
      <Headline x={xs[1]! + 6} y={37} text="2. Demo day" size={6.4} />
      {/* The writing still arriving: each line lands as it is typed. */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} className="fa-f-in" style={at(0.25 + i * 0.3)}>
          <rect
            className={BAR}
            x={xs[1]! + 6}
            y={42 + i * 4.2}
            width={i === 5 ? 28 : 46 - (i % 2) * 3}
            height="1.8"
            rx="0.9"
            fill="#e2e8f0"
          />
        </g>
      ))}
      <rect className="fa-f-caret" x={xs[1]! + 35.5} y={62} width="0.9" height="5" fill={ACCENT} />
      <text
        className={MUTED}
        x={xs[1]! + W / 2}
        y={88.5}
        textAnchor="middle"
        fontSize="4.4"
        fill="#94a3b8"
      >
        2
      </text>
      <text
        className={MUTED}
        x={xs[0]! + W / 2}
        y={88.5}
        textAnchor="middle"
        fontSize="4.4"
        fill="#94a3b8"
      >
        1
      </text>

      {/* The next page, made as the writing needs it. */}
      <g className="fa-f-in" style={at(2.2)}>
        <Page x={xs[2]!} y={12} w={W} h={H} label="Page 3" dashed />
        <path
          className="stroke-sky-400"
          d={`M${xs[2]! + W / 2} 46 v8 M${xs[2]! + W / 2 - 4} 50 h8`}
          stroke="#38bdf8"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
    </Stage>
  );
}

/** A picture wrapped by the writing, and a drawing area opened in the text. */
export function ArticleWrapArt() {
  const W = 66;
  const H = 84;
  return (
    <Stage>
      <defs>
        <linearGradient id="fa-f-wrap-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#e0f2fe" />
        </linearGradient>
        <linearGradient id="fa-f-wrap-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
      </defs>

      {/* How the picture sits: in the line, wrapped, or floating free. Wrap chosen. */}
      <rect className={SURFACE} x="10" y="24" width="50" height="44" rx="4" strokeWidth="0.8" />
      {['Inline', 'Wrap', 'Float'].map((label, i) => (
        <g key={label}>
          {i === 1 ? (
            <rect
              className="fill-sky-100 dark:fill-sky-500/25"
              x={13}
              y={27 + i * 13}
              width="44"
              height="11"
              rx="2.5"
              fill="#e0f2fe"
            />
          ) : null}
          <text
            className={i === 1 ? 'fill-sky-700 dark:fill-sky-200' : MUTED}
            x={19}
            y={34.4 + i * 13}
            fontSize="6"
            fontWeight={i === 1 ? 700 : 500}
            fill={i === 1 ? '#0369a1' : '#64748b'}
          >
            {label}
          </text>
        </g>
      ))}

      <Page x={78} y={8} w={W} h={H} />
      <Headline x={84} y={18} text="The new office" size={6.6} />
      {/* The picture, selected, the text running down its right side. */}
      <g>
        <rect x={84} y={23} width="30" height="26" rx="1.2" fill="url(#fa-f-wrap-sky)" />
        <circle cx={106} cy={30} r="3.2" fill="#fde68a" />
        <path
          d="M84 49 L84 40 Q 92 32, 100 39 Q 106 34, 114 40 L114 49 Z"
          fill="url(#fa-f-wrap-hill)"
        />
        <path d="M84 49 L84 44 Q 96 38, 114 45 L114 49 Z" fill="#075985" opacity="0.7" />
        <rect
          className="fa-f-ring"
          x={82.5}
          y={21.5}
          width="33"
          height="29"
          rx="1.5"
          fill="none"
          stroke={ACCENT}
          strokeWidth="0.9"
        />
        {[
          [82.5, 21.5],
          [115.5, 21.5],
          [82.5, 50.5],
          [115.5, 50.5],
        ].map(([cx, cy]) => (
          <rect
            key={`${cx}-${cy}`}
            x={cx! - 1.4}
            y={cy! - 1.4}
            width="2.8"
            height="2.8"
            rx="0.5"
            fill="#fff"
            stroke={ACCENT}
            strokeWidth="0.7"
          />
        ))}
      </g>
      <TextLines x={118} y={25} w={20} widths={[1, 0.9, 1, 1, 0.85, 1]} gap={4.2} h={1.8} />
      <TextLines
        x={84}
        y={55}
        w={54}
        widths={[1, 0.97, 1, 0.94, 1, 0.98, 1, 0.6]}
        gap={4.2}
        h={1.8}
      />

      <Page x={154} y={8} w={W} h={H} />
      <TextLines x={160} y={15} w={54} widths={[1, 0.95, 1, 0.7]} gap={4.2} h={1.8} />
      {/* A drawing area in the text: a little diagram, with the writing carrying on beneath. */}
      <rect
        className="fill-sky-50/60 stroke-sky-300 dark:fill-sky-500/10 dark:stroke-sky-500/50"
        x={160}
        y={34}
        width="54"
        height="28"
        rx="2"
        fill="#f0f9ff"
        stroke="#7dd3fc"
        strokeWidth="0.7"
        strokeDasharray="2.4 1.8"
      />
      <g className="fa-f-in" style={at(0.4)}>
        <rect
          className="fill-white stroke-sky-500 dark:fill-slate-800"
          x={165}
          y={42}
          width="17"
          height="11"
          rx="2"
          fill="#fff"
          stroke={ACCENT}
          strokeWidth="0.9"
        />
        <rect
          className="fill-white stroke-sky-500 dark:fill-slate-800"
          x={192}
          y={42}
          width="17"
          height="11"
          rx="2"
          fill="#fff"
          stroke={ACCENT}
          strokeWidth="0.9"
        />
        <text
          className={INK}
          x={173.5}
          y={49.4}
          textAnchor="middle"
          fontSize="4.6"
          fontWeight="700"
          fill="#1e293b"
        >
          Desk
        </text>
        <text
          className={INK}
          x={200.5}
          y={49.4}
          textAnchor="middle"
          fontSize="4.6"
          fontWeight="700"
          fill="#1e293b"
        >
          Café
        </text>
      </g>
      <path
        className="fa-f-draw stroke-slate-500 dark:stroke-slate-300"
        style={at(0.9)}
        pathLength={1}
        d="M182 47.5 H190 M187.6 45.2 L190.2 47.5 L187.6 49.8"
        fill="none"
        stroke="#64748b"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text className={MUTED} x={160} y={67} fontSize="4.6" fontStyle="italic" fill="#64748b">
        Fig. 1 · The route in
      </text>
      <TextLines x={160} y={72} w={54} widths={[1, 0.96, 1, 0.5]} gap={4.2} h={1.8} />
      <g transform="translate(212 58)">
        <g className="fa-f-in" style={at(0.2)}>
          <Cursor colour={TEAMMATE} name="Maya" />
        </g>
      </g>
    </Stage>
  );
}

/** A comment on a phrase: highlighted in the text, its marker in the margin, its thread beside. */
export function MarginCommentsArt() {
  return (
    <Stage>
      <Page x={40} y={6} w={92} h={86} />
      <Headline x={48} y={18} text="Q3 review" size={7.4} />
      <TextLines x={48} y={25} w={76} widths={[1, 0.96, 1, 0.7]} gap={5} h={2} />
      {/* The commented words, picked out in the commenter's colour. */}
      <rect
        className="fill-pink-100 dark:fill-pink-500/30"
        x={47}
        y={46}
        width="50"
        height="5"
        rx="1"
        fill="#fce7f3"
      />
      <rect x={47} y={50.4} width="50" height="0.9" fill={TEAMMATE} />
      <TextLines x={48} y={47.5} w={76} widths={[1]} gap={5} h={2} />
      <TextLines x={48} y={55} w={76} widths={[1, 0.94, 1, 0.98, 0.55]} gap={5} h={2} />
      {/* The margin marker, keeping pace with the line. */}
      <circle cx={137} cy={48.5} r="3.6" fill={TEAMMATE} />
      <text x={137} y={50.6} textAnchor="middle" fontSize="5" fontWeight="800" fill="#fff">
        1
      </text>
      <path
        className="fa-f-draw"
        pathLength={1}
        d="M141 48.5 C 150 48.5, 150 28, 160 28"
        fill="none"
        stroke={TEAMMATE}
        strokeWidth="0.9"
        strokeDasharray="0"
      />

      {/* The thread: the comment, and the words handed on as an action. */}
      <g className="fa-f-in" style={at(0.5)}>
        <rect className={SURFACE} x={160} y={8} width="128" height="80" rx="5" strokeWidth="0.8" />
        <Avatar x={170} y={20} initials="MC" colour={TEAMMATE} r={5} />
        <text className={INK} x={179} y={19} fontSize="6.4" fontWeight="700" fill="#1e293b">
          Maya Chen
        </text>
        <text className={MUTED} x={179} y={26} fontSize="5.2" fill="#64748b">
          2 min ago
        </text>
        <text className={INK} x={167} y={39} fontSize="6.2" fill="#334155">
          Can we back this figure
        </text>
        <text className={INK} x={167} y={47} fontSize="6.2" fill="#334155">
          with the June numbers?
        </text>
        <path
          className="stroke-slate-100 dark:stroke-slate-700"
          d="M166 55 H282"
          stroke="#f1f5f9"
          strokeWidth="0.7"
        />
        <Pill x={166} y={60} text="Action" tone="emerald" />
        <Avatar x={203} y={64.5} initials="TM" colour={YOU} r={3.8} />
        <text className={INK} x={210} y={66.6} fontSize="5.8" fontWeight="600" fill="#1e293b">
          Due Friday
        </text>
        <rect
          className="fill-slate-100 stroke-slate-200 dark:fill-slate-900/60 dark:stroke-slate-700"
          x={166}
          y={73}
          width="80"
          height="10"
          rx="3"
          fill="#f8fafc"
          stroke="#e2e8f0"
          strokeWidth="0.6"
        />
        <text className={MUTED} x={170} y={79.8} fontSize="5.4" fill="#94a3b8">
          Reply…
        </text>
        <rect x={250} y={73} width="32" height="10" rx="3" fill={ACCENT} />
        <text x={266} y={79.8} textAnchor="middle" fontSize="5.4" fontWeight="700" fill="#fff">
          Resolve
        </text>
      </g>
    </Stage>
  );
}

/** The five article looks, one page in each: Clean, Classic, Report, Notebook and Bold. */
export function ArticleLooksArt() {
  const W = 46;
  const H = 62;
  const looks = ['Clean', 'Classic', 'Report', 'Notebook', 'Bold'];
  const x0 = 17;
  const gap = 8;
  const xs = looks.map((_, i) => x0 + i * (W + gap));
  const chosen = 2;
  return (
    <Stage>
      {xs.map((x, i) => (
        <g key={looks[i]} className="fa-f-in" style={at(i * 0.14)}>
          <rect className={SURFACE} x={x} y={8} width={W} height={H} rx="1.5" strokeWidth="0.7" />
        </g>
      ))}

      {/* Clean: an airy sans page, a thin accent rule. */}
      <g className="fa-f-in" style={at(0)}>
        <rect x={xs[0]! + 5} y={14} width="14" height="1.2" rx="0.6" fill={ACCENT} />
        <rect
          className="fill-slate-800 dark:fill-slate-100"
          x={xs[0]! + 5}
          y={19}
          width="30"
          height="3.4"
          rx="1"
          fill="#1e293b"
        />
        <TextLines
          x={xs[0]! + 5}
          y={28}
          w={36}
          widths={[1, 0.9, 1, 0.7]}
          gap={4.4}
          h={1.6}
          className={BAR_SOFT}
        />
        <TextLines
          x={xs[0]! + 5}
          y={49}
          w={36}
          widths={[1, 0.95, 0.6]}
          gap={4.4}
          h={1.6}
          className={BAR_SOFT}
        />
      </g>

      {/* Classic: a centred serif title, a rule, a drop cap and justified text. */}
      <g className="fa-f-in" style={at(0.14)}>
        <text
          className={INK}
          x={xs[1]! + W / 2}
          y={21}
          textAnchor="middle"
          fontFamily={SERIF}
          fontSize="5.6"
          fontWeight="700"
          fill="#1e293b"
        >
          The Harbour
        </text>
        <path
          className="stroke-slate-300 dark:stroke-slate-500"
          d={`M${xs[1]! + 17} 25 H${xs[1]! + 29}`}
          stroke="#cbd5e1"
          strokeWidth="0.6"
        />
        <text
          className={INK}
          x={xs[1]! + 5}
          y={37}
          fontFamily={SERIF}
          fontSize="10"
          fontWeight="700"
          fill="#1e293b"
        >
          T
        </text>
        <TextLines x={xs[1]! + 13} y={30} w={28} widths={[1, 1, 1]} gap={3.8} h={1.5} />
        <TextLines x={xs[1]! + 5} y={41.4} w={36} widths={[1, 1, 1, 1, 1, 0.5]} gap={3.8} h={1.5} />
      </g>

      {/* Report: a deep header band, a section number and a figure. */}
      <g className="fa-f-in" style={at(0.28)}>
        <rect x={xs[2]!} y={8} width={W} height="17" rx="1.5" fill="#0f2a4a" />
        <rect x={xs[2]! + 5} y={13} width="26" height="2.6" rx="1" fill="#fff" />
        <rect x={xs[2]! + 5} y={18.5} width="18" height="1.6" rx="0.8" fill="#7dd3fc" />
        <text
          className="fill-sky-700 dark:fill-sky-300"
          x={xs[2]! + 5}
          y={33}
          fontSize="5"
          fontWeight="800"
          fill="#0369a1"
        >
          01
        </text>
        <TextLines x={xs[2]! + 13} y={30} w={28} widths={[1, 0.8]} gap={3.6} h={1.5} />
        {[10, 16, 12, 20, 24].map((h, k) => (
          <rect
            key={k}
            x={xs[2]! + 6 + k * 7}
            y={60 - h}
            width="4.6"
            height={h}
            rx="0.8"
            fill={k === 4 ? WARM : '#38bdf8'}
          />
        ))}
        <path
          className="stroke-slate-300 dark:stroke-slate-500"
          d={`M${xs[2]! + 5} 60.4 H${xs[2]! + 41}`}
          stroke="#cbd5e1"
          strokeWidth="0.5"
        />
        <TextLines
          x={xs[2]! + 5}
          y={64}
          w={36}
          widths={[0.7]}
          gap={3.6}
          h={1.4}
          className={BAR_SOFT}
        />
      </g>

      {/* Notebook: ruled lines and a red margin, a handwritten heading. */}
      <g className="fa-f-in" style={at(0.42)}>
        {Array.from({ length: 11 }, (_, k) => (
          <path
            key={k}
            d={`M${xs[3]! + 2} ${20 + k * 4.6} H${xs[3]! + W - 2}`}
            stroke="#93c5fd"
            strokeOpacity="0.55"
            strokeWidth="0.45"
          />
        ))}
        <path
          d={`M${xs[3]! + 9} 9 V${8 + H - 1}`}
          stroke="#f87171"
          strokeOpacity="0.7"
          strokeWidth="0.6"
        />
        <path
          className="stroke-slate-700 dark:stroke-slate-200"
          d={`M${xs[3]! + 12} 17 c 2 -4, 4 -4, 5 0 s 3 4, 5 0 s 3 -4, 5 0 s 3 3, 6 -1`}
          fill="none"
          stroke="#334155"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        <TextLines
          x={xs[3]! + 12}
          y={23.4}
          w={30}
          widths={[1, 0.9, 1, 0.7, 1, 0.8, 0.5]}
          gap={4.6}
          h={1.2}
        />
      </g>

      {/* Bold: a heavy headline, an accent highlight and big type. */}
      <g className="fa-f-in" style={at(0.56)}>
        <rect x={xs[4]! + 4} y={12.6} width="32" height="7.4" rx="1" fill="#fde047" />
        {/* Dark type on the yellow highlight in either appearance. */}
        <text x={xs[4]! + 5} y={18.6} fontSize="7.4" fontWeight="900" fill="#0f172a">
          Go big.
        </text>
        <rect
          className="fill-slate-800 dark:fill-slate-100"
          x={xs[4]! + 5}
          y={23}
          width="34"
          height="3.4"
          rx="0.6"
          fill="#0f172a"
        />
        <TextLines
          x={xs[4]! + 5}
          y={32}
          w={36}
          widths={[1, 0.9, 1, 0.8, 1, 0.85, 0.5]}
          gap={5}
          h={2.4}
        />
      </g>

      {/* Report, chosen. */}
      <rect
        className="fa-f-ring"
        x={xs[chosen]! - 2.5}
        y={5.5}
        width={W + 5}
        height={H + 5}
        rx="3"
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.1"
      />
      <circle cx={xs[chosen]! + W} cy={8} r="4" fill={ACCENT} />
      <path
        d={`M${xs[chosen]! + W - 2} 8 l1.4 1.4 l2.6 -2.8`}
        fill="none"
        stroke="#fff"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {looks.map((label, i) => (
        <text
          key={label}
          className={i === chosen ? 'fill-sky-700 dark:fill-sky-200' : MUTED}
          x={xs[i]! + W / 2}
          y={83}
          textAnchor="middle"
          fontSize="6.2"
          fontWeight={i === chosen ? 700 : 500}
          fill={i === chosen ? '#0369a1' : '#64748b'}
        >
          {label}
        </text>
      ))}
    </Stage>
  );
}

/** A 16:9 slide page taking a layout from the picker, ready to add to the deck. */
export function SlideLayoutsArt() {
  const layouts = ['Title', 'Agenda', 'Two columns', 'Image + text'];
  const chosen = 3;
  return (
    <Stage>
      {/* The layouts. */}
      <rect className={SURFACE} x="8" y="6" width="74" height="86" rx="5" strokeWidth="0.8" />
      <text
        className={MUTED}
        x={14}
        y={15.5}
        fontSize="5.2"
        fontWeight="700"
        letterSpacing="0.4"
        fill="#64748b"
      >
        LAYOUTS
      </text>
      {layouts.map((label, i) => {
        const y = 20 + i * 17.5;
        const on = i === chosen;
        return (
          <g key={label}>
            {on ? (
              <rect
                className="fill-sky-50 stroke-sky-400 dark:fill-sky-500/15 dark:stroke-sky-400"
                x={11}
                y={y - 1.5}
                width="68"
                height="16"
                rx="3"
                fill="#f0f9ff"
                stroke="#38bdf8"
                strokeWidth="0.8"
              />
            ) : null}
            <rect
              className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-600"
              x={14}
              y={y}
              width="23"
              height="13"
              rx="1"
              fill="#fff"
              stroke="#e2e8f0"
              strokeWidth="0.6"
            />
            {i === 0 ? (
              <rect className={BAR} x={18} y={y + 5} width="15" height="2.4" rx="1" />
            ) : null}
            {i === 1 ? (
              <TextLines x={17} y={y + 3} w={17} widths={[0.6, 1, 1, 1]} gap={2.4} h={1} />
            ) : null}
            {i === 2 ? (
              <>
                <TextLines x={16.5} y={y + 3} w={8} widths={[1, 1, 1]} gap={2.6} h={1} />
                <TextLines x={26.5} y={y + 3} w={8} widths={[1, 1, 1]} gap={2.6} h={1} />
              </>
            ) : null}
            {i === 3 ? (
              <>
                <TextLines x={16.5} y={y + 3.5} w={9} widths={[1, 1, 0.7]} gap={2.6} h={1} />
                <rect x={27} y={y + 2.5} width="8" height="8" rx="0.8" fill="#7dd3fc" />
              </>
            ) : null}
            <text
              className={on ? 'fill-sky-700 dark:fill-sky-200' : MUTED}
              x={40.5}
              y={y + 8.6}
              fontSize="5.4"
              fontWeight={on ? 700 : 500}
              fill={on ? '#0369a1' : '#64748b'}
            >
              {label}
            </text>
          </g>
        );
      })}
      <g transform="translate(66 80)">
        <g className="fa-f-in" style={at(0)}>
          <Cursor colour={YOU} />
        </g>
      </g>

      {/* The slide: 16:9, the layout filled in. */}
      <text className={MUTED} x={94} y={11} fontSize="5" fontWeight="600" fill="#64748b">
        Page 3 · Slide · 16:9
      </text>
      <rect
        className={SURFACE}
        x={94}
        y={14}
        width="140"
        height="78.75"
        rx="1.5"
        strokeWidth="0.7"
      />
      <g className="fa-f-in" style={at(0.3)}>
        <rect x={94} y={14} width="3" height="78.75" fill={ACCENT} />
        <text
          className="fill-sky-600 dark:fill-sky-300"
          x={104}
          y={27}
          fontSize="4.8"
          fontWeight="800"
          letterSpacing="0.5"
          fill="#0284c7"
        >
          TRACTION
        </text>
        <text className={INK} x={104} y={38} fontSize="9" fontWeight="800" fill="#0f172a">
          3× faster
        </text>
        <text className={INK} x={104} y={47} fontSize="9" fontWeight="800" fill="#0f172a">
          launches
        </text>
        {[56, 63, 70].map((y) => (
          <g key={y}>
            <circle cx={105.5} cy={y + 1} r="1.2" fill={ACCENT} />
            <rect className={BAR} x={109} y={y} width="44" height="2" rx="1" />
          </g>
        ))}
      </g>
      <g className="fa-f-in" style={at(0.55)}>
        <defs>
          <linearGradient id="fa-f-slide-figure" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <rect x={168} y={24} width="56" height="58" rx="3" fill="url(#fa-f-slide-figure)" />
        {[14, 22, 30, 42].map((h, k) => (
          <rect
            key={k}
            x={176 + k * 11}
            y={74 - h}
            width="7"
            height={h}
            rx="1.5"
            fill="#fff"
            fillOpacity={k === 3 ? 1 : 0.55}
          />
        ))}
      </g>

      {/* Its size, and the deck it goes in. */}
      <rect className={SURFACE} x={240} y={14} width="50" height="13" rx="3.5" strokeWidth="0.7" />
      <rect
        className="fill-sky-100 dark:fill-sky-500/25"
        x={242}
        y={16}
        width="23"
        height="9"
        rx="2.5"
        fill="#e0f2fe"
      />
      <text
        className="fill-sky-700 dark:fill-sky-200"
        x={253.5}
        y={22.6}
        textAnchor="middle"
        fontSize="5.6"
        fontWeight="700"
        fill="#0369a1"
      >
        16:9
      </text>
      <text
        className={MUTED}
        x={277}
        y={22.6}
        textAnchor="middle"
        fontSize="5.6"
        fontWeight="500"
        fill="#64748b"
      >
        4:3
      </text>
      <rect x={240} y={78} width="50" height="14" rx="4" fill={ACCENT} />
      <text x={265} y={86.8} textAnchor="middle" fontSize="5.8" fontWeight="700" fill="#fff">
        + Add to deck
      </text>
      <g className="fa-f-in" style={at(1.2)}>
        <Pill x={240} y={34} text="In the deck" tone="emerald" w={50} />
      </g>
    </Stage>
  );
}
