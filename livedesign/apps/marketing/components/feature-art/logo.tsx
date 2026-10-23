// The logo page card art (the Logos & wireframes section): a square artboard with its construction
// guides, a mark drawn with Mirror on, a wordmark under it, and the Logo Kit it exports. Same
// vocabulary as ./pages (page-kit's paper and panel, the fa-e-* loops in
// app/feature-art/pages.css); under reduced motion it shows the finished mark.

import type { CSSProperties } from 'react';
import { Frame } from './shared';
import { at, INK, INK_SOFT, Page, Panel, SKY, VIOLET } from './page-kit';

// The artboard: a square page, its centre, and the keyline circle the mark is built on.
const BOARD = { x: 24, y: 10, size: 76 };
const CX = BOARD.x + BOARD.size / 2;
const CY = BOARD.y + 34;
const KEYLINE = 24;
const GUIDE = 'stroke-sky-400/60 dark:stroke-sky-300/40';

// One half of the mark, a petal from the base to the tip; Mirror draws its twin.
const PETAL = `M${CX} ${CY + 18} C${CX - 17} ${CY + 8} ${CX - 15} ${CY - 12} ${CX} ${CY - 18}`;
const PETAL_LENGTH = 46;

/** The finished mark at any size: two mirrored petals round a dot, for the kit's icon tiles. */
function Mark({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(${-CX} ${-CY})`}>
      <path d={PETAL} fill="none" stroke={SKY} strokeWidth="4" strokeLinecap="round" />
      <path
        d={PETAL}
        transform={`translate(${2 * CX} 0) scale(-1 1)`}
        fill="none"
        stroke={SKY}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx={CX} cy={CY} r="5" fill={VIOLET} />
    </g>
  );
}

/** A logo page: guides, a mirrored mark drawing itself, a wordmark, and the Logo Kit it exports. */
export function LogoPageArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Page x={BOARD.x} y={BOARD.y} w={BOARD.size} h={BOARD.size}>
          {/* Construction guides: the safe area, centre lines, diagonals and keyline circles. */}
          <g fill="none" strokeWidth="0.4" className={GUIDE} stroke="#38bdf8" strokeOpacity="0.6">
            <rect
              x={BOARD.x + 7.6}
              y={BOARD.y + 7.6}
              width={BOARD.size - 15.2}
              height={BOARD.size - 15.2}
              strokeDasharray="1.2 1.2"
            />
            <line x1={BOARD.x} y1={CY} x2={BOARD.x + BOARD.size} y2={CY} />
            <line x1={BOARD.x} y1={BOARD.y} x2={BOARD.x + BOARD.size} y2={BOARD.y + BOARD.size} />
            <line x1={BOARD.x + BOARD.size} y1={BOARD.y} x2={BOARD.x} y2={BOARD.y + BOARD.size} />
            <circle cx={CX} cy={CY} r={KEYLINE} />
            <circle cx={CX} cy={CY} r={KEYLINE * 0.58} />
          </g>
          {/* The mirror axis, solid over the guides. */}
          <line
            x1={CX}
            y1={BOARD.y}
            x2={CX}
            y2={BOARD.y + BOARD.size}
            className="stroke-violet-500/70 dark:stroke-violet-400/70"
            stroke={VIOLET}
            strokeOpacity="0.7"
            strokeWidth="0.6"
          />
          {/* One stroke drawn, its twin drawn with it. The mirror sits on a group, because reduced
              motion's transform reset would wipe it off the animated path. */}
          {[undefined, `translate(${2 * CX} 0) scale(-1 1)`].map((transform, i) => (
            <g key={i} transform={transform}>
              <path
                d={PETAL}
                className="fa-e-draw"
                style={{ ...at(0.2), '--e-len': PETAL_LENGTH } as CSSProperties}
                fill="none"
                stroke={SKY}
                strokeWidth="4"
                strokeLinecap="round"
              />
            </g>
          ))}
          <circle className="fa-e-pop" style={at(1.4)} cx={CX} cy={CY} r="5" fill={VIOLET} />
          {/* The wordmark: spaced capitals under the mark. */}
          <text
            className={`fa-e-in ${INK}`}
            style={at(1.9)}
            x={CX}
            y={BOARD.y + BOARD.size - 6}
            textAnchor="middle"
            fontSize="6.4"
            fontWeight="800"
            letterSpacing="1.6"
            fill="#1e293b"
          >
            BRAND
          </text>
        </Page>

        {/* The Logo Kit: what the .zip holds, and its download button. */}
        <Panel x={118} y={14} w={80} h={68} title="Logo Kit">
          {[
            ['logo.svg', 'Vector'],
            ['PNG', '16 to 1024'],
            ['favicon.ico', 'Tab icon'],
          ].map(([file, note], i) => (
            <g key={file} className="fa-e-in" style={at(2.4 + i * 0.3)}>
              <rect
                className="fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
                x="124"
                y={27 + i * 11}
                width="68"
                height="9"
                rx="2"
                fill="#f8fafc"
                stroke="#e2e8f0"
                strokeWidth="0.6"
              />
              <text
                x="128"
                y={33 + i * 11}
                fontSize="4.4"
                fontWeight="700"
                className={INK}
                fill="#1e293b"
              >
                {file}
              </text>
              <text
                x="188"
                y={33 + i * 11}
                textAnchor="end"
                fontSize="3.8"
                className={INK_SOFT}
                fill="#64748b"
              >
                {note}
              </text>
            </g>
          ))}
          <rect x="124" y="64" width="68" height="12" rx="3" fill={SKY} />
          <text x="158" y="71.8" textAnchor="middle" fontSize="4.8" fontWeight="700" fill="#ffffff">
            Download .zip
          </text>
        </Panel>

        {/* The mark at icon sizes: on paper, and see-through over a dark tab. */}
        <g className="fa-e-pop" style={at(3.4)}>
          {[
            { x: 214, size: 30, dark: false },
            { x: 250, size: 20, dark: true },
            { x: 276, size: 12, dark: false },
          ].map(({ x, size, dark }) => (
            <g key={x}>
              <rect
                className={
                  dark
                    ? 'fill-slate-900 stroke-slate-700'
                    : 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600'
                }
                x={x}
                y={48 - size / 2}
                width={size}
                height={size}
                rx={size * 0.22}
                fill={dark ? '#0f172a' : '#ffffff'}
                stroke={dark ? '#334155' : '#e2e8f0'}
                strokeWidth="0.6"
              />
              <Mark x={x + size / 2} y={48} s={size / 52} />
            </g>
          ))}
        </g>
      </svg>
    </Frame>
  );
}
