// Feature art for the five article looks (docs/specs/007-editor/article-pages.md): one page in each of
// Clean, Classic, Report, Notebook and Bold. Split from ./documents; built on ./mode-parts like it.

import { at, BAR_SOFT, INK, MUTED, SERIF, Stage, SURFACE, TextLines } from './mode-parts';
import {
  AMBER as WARM,
  SKY as ACCENT,
} from '@liveworkspace/marketing-site/components/feature-art/shared';

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
        <rect x={xs[2]} y={8} width={W} height="17" rx="1.5" fill="#0f2a4a" />
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
