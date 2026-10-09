// Feature art for Illustrate's pages (docs/specs/019-marketing/marketing-site.md,
// docs/specs/007-editor/illustrate-pages.md, article-pages.md): pages in three formats, a page
// placed from the layout picker, backgrounds painted from the theme, a diagram split onto pages,
// and the export (the article page lives in ./article). Each is a small mock of the real surface, built on
// ./page-kit so a page reads as paper on the canvas in light and in dark.

import type { CSSProperties } from 'react';
import { Frame } from './shared';
import {
  AMBER,
  at,
  Cursor,
  EMERALD,
  INK,
  INK_SOFT,
  Lines,
  Page,
  Panel,
  ROSE,
  SERIF,
  SKY,
  SKY_DEEP,
  VIOLET,
} from './page-kit';

const TRACK = 'stroke-slate-200 dark:stroke-slate-600';

// The small caption over a page, as the editor labels its pages.
function PageLabel({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text x={x} y={y} fontSize="4.6" fontWeight="600" className={INK_SOFT} fill="#64748b">
      {children}
    </text>
  );
}

/** Pages for print and social: an A4 report, a 16:9 slide and a square post, side by side. */
export function IllustratePagesArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <g transform="translate(14 0)">
          {/* A4 portrait: a report cover with a big figure and a rising chart. */}
          <g className="fa-e-in" style={at(0)}>
            <PageLabel x={20} y={11}>
              A4
            </PageLabel>
            <Page x={20} y={14} w={46} h={65}>
              <text x="25" y="22" fontSize="3.6" fontWeight="700" letterSpacing="0.4" fill={SKY}>
                ANNUAL REPORT
              </text>
              <text x="25" y="34" fontSize="11" fontWeight="800" className={INK} fill="#1e293b">
                2026
              </text>
              <Lines x={25} y={38} w={34} count={2} gap={3.4} height={1.4} />
              <g fill={SKY}>
                {[
                  [27, 8],
                  [34, 12],
                  [41, 10],
                  [48, 17],
                  [55, 22],
                ].map(([x, h], i) => (
                  <rect
                    key={x}
                    className="fa-e-rise"
                    style={at(0.5 + i * 0.12)}
                    x={x}
                    y={73 - h!}
                    width="4.6"
                    height={h}
                    rx="0.8"
                    fillOpacity={i === 4 ? 1 : 0.45}
                  />
                ))}
              </g>
            </Page>
          </g>
        </g>
        <g transform="translate(40 0)">
          {/* 16:9: a slide with a headline and a ring. */}
          <g className="fa-e-in" style={at(0.25)}>
            <PageLabel x={76} y={21}>
              16:9 slide
            </PageLabel>
            <Page x={76} y={24} w={74} h={41.6}>
              <text x="82" y="35" fontSize="5.6" fontWeight="800" className={INK} fill="#1e293b">
                Q3 at a glance
              </text>
              <Lines x={82} y={40} w={32} count={3} gap={3.6} height={1.4} />
              <circle
                cx="133"
                cy="45"
                r="9"
                fill="none"
                strokeWidth="3.4"
                className={TRACK}
                stroke="#e2e8f0"
              />
              <path
                className="fa-e-draw"
                style={{ ...at(0.8), '--e-len': 41 } as CSSProperties}
                d="M133 36 A9 9 0 1 1 124.17 46.72"
                fill="none"
                stroke={VIOLET}
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <text
                x="133"
                y="47"
                textAnchor="middle"
                fontSize="4.6"
                fontWeight="800"
                className={INK}
                fill="#1e293b"
              >
                72%
              </text>
            </Page>
          </g>
        </g>
        <g transform="translate(66 0)">
          {/* 1:1: a social post, full bleed. */}
          <g className="fa-e-in" style={at(0.5)}>
            <PageLabel x={160} y={25}>
              1:1 post
            </PageLabel>
            <defs>
              <linearGradient id="pe-post" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={VIOLET} />
                <stop offset="1" stopColor={SKY} />
              </linearGradient>
            </defs>
            <Page x={160} y={28} w={40} h={40} fill="url(#pe-post)" className="">
              <circle cx="191" cy="37" r="9" fill="#ffffff" fillOpacity="0.14" />
              <text x="165" y="51" fontSize="10" fontWeight="800" fill="#ffffff">
                +48%
              </text>
              <text
                x="165"
                y="58"
                fontSize="4.2"
                fontWeight="600"
                fill="#ffffff"
                fillOpacity="0.85"
              >
                new members
              </text>
              <rect
                x="165"
                y="61.5"
                width="9"
                height="1.4"
                rx="0.7"
                fill="#ffffff"
                fillOpacity="0.6"
              />
            </Page>
          </g>
        </g>
      </svg>
    </Frame>
  );
}

// One layout tile in the picker: a tiny page with the layout's shape on it.
function LayoutTile({
  x,
  y,
  chosen = false,
  kind,
}: {
  x: number;
  y: number;
  chosen?: boolean;
  kind: 'title' | 'stats' | 'chart' | 'quote' | 'timeline' | 'matrix';
}) {
  return (
    <g>
      <rect
        className={
          chosen
            ? 'fill-sky-50 dark:fill-sky-950'
            : 'fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700'
        }
        x={x}
        y={y}
        width="26"
        height="18"
        rx="2"
        fill={chosen ? '#f0f9ff' : '#f8fafc'}
        stroke={chosen ? SKY : '#e2e8f0'}
        strokeWidth={chosen ? 1.1 : 0.6}
      />
      <rect x={x + 3} y={y + 3} width="11" height="1.6" rx="0.8" fill={SKY} />
      {kind === 'stats' ? (
        <g fill={SKY} fillOpacity="0.35">
          <rect x={x + 3} y={y + 7} width="6" height="5" rx="1" />
          <rect x={x + 10} y={y + 7} width="6" height="5" rx="1" />
          <rect x={x + 17} y={y + 7} width="6" height="5" rx="1" />
        </g>
      ) : kind === 'chart' ? (
        <g fill={SKY} fillOpacity="0.45">
          <rect x={x + 4} y={y + 10} width="3" height="5" />
          <rect x={x + 9} y={y + 8} width="3" height="7" />
          <rect x={x + 14} y={y + 6} width="3" height="9" />
          <rect x={x + 19} y={y + 9} width="3" height="6" />
        </g>
      ) : kind === 'quote' ? (
        <g>
          <text x={x + 3} y={y + 12} fontSize="7" fill={VIOLET} fontFamily={SERIF}>
            “
          </text>
          <Lines x={x + 8} y={y + 8} w={14} count={2} gap={3} height={1.2} />
        </g>
      ) : kind === 'timeline' ? (
        <g>
          <path d={`M${x + 4} ${y + 11}h18`} stroke={EMERALD} strokeWidth="0.8" />
          {[4, 11, 18].map((d) => (
            <circle key={d} cx={x + d + 1} cy={y + 11} r="1.4" fill={EMERALD} />
          ))}
        </g>
      ) : kind === 'matrix' ? (
        <g fill={AMBER} fillOpacity="0.4">
          <rect x={x + 3} y={y + 6.5} width="9.5" height="4.5" rx="0.8" />
          <rect x={x + 13.5} y={y + 6.5} width="9.5" height="4.5" rx="0.8" />
          <rect x={x + 3} y={y + 12} width="9.5" height="4.5" rx="0.8" />
          <rect x={x + 13.5} y={y + 12} width="9.5" height="4.5" rx="0.8" />
        </g>
      ) : (
        <Lines x={x + 3} y={y + 8} w={18} count={2} gap={3} height={1.2} />
      )}
    </g>
  );
}

/** Start a page from a layout: the picker, Key stats chosen, and the page it fills. */
export function InfographicLayoutArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <g transform="translate(12 0)">
          <Panel x={28} y={8} w={68} h={82} title="Layouts">
            <LayoutTile x={34} y={20} kind="title" />
            <LayoutTile x={64} y={20} kind="stats" chosen />
            <LayoutTile x={34} y={42} kind="chart" />
            <LayoutTile x={64} y={42} kind="quote" />
            <LayoutTile x={34} y={62} kind="timeline" />
            <LayoutTile x={64} y={62} kind="matrix" />
          </Panel>
          <g
            className="fa-e-move"
            style={{ ...at(0), '--e-x': '-6px', '--e-y': '-4px' } as CSSProperties}
          >
            <Cursor x={84} y={34} color={SKY_DEEP} />
          </g>
        </g>
        {/* Placing it: the chosen tile carried onto the page. */}
        <g className="fa-e-in" style={at(0.5)}>
          <path
            className="stroke-sky-400 dark:stroke-sky-300"
            d="M112 31C140 20 160 24 182 36"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="0.9"
            strokeDasharray="2.2 1.8"
            strokeLinecap="round"
          />
          <path
            d="M178.6 32.6l3.6 3.6-5 1.2"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="146"
            y="20.5"
            textAnchor="middle"
            fontSize="4.2"
            fontWeight="600"
            className={INK_SOFT}
            fill="#64748b"
          >
            Press to place
          </text>
        </g>
        <g transform="translate(70 0)">
          {/* The page, the chosen layout landing on it. */}
          <Page x={118} y={7} w={58} h={82}>
            <g className="fa-e-in" style={at(0.9)}>
              <text x="124" y="16" fontSize="3.4" fontWeight="700" letterSpacing="0.4" fill={SKY}>
                2026 IN NUMBERS
              </text>
              <text x="124" y="24" fontSize="6.4" fontWeight="800" className={INK} fill="#1e293b">
                Key stats
              </text>
            </g>
            {[
              ['12', 'teams', SKY],
              ['48', 'launches', VIOLET],
              ['99%', 'uptime', EMERALD],
            ].map(([value, label, color], i) => (
              <g key={label} className="fa-e-pop" style={at(1.1 + i * 0.15)}>
                <rect
                  x={124 + i * 16.5}
                  y={29}
                  width="14.5"
                  height="15"
                  rx="2"
                  fill={color}
                  fillOpacity="0.12"
                />
                <text x={126 + i * 16.5} y={37.5} fontSize="5.4" fontWeight="800" fill={color}>
                  {value}
                </text>
                <text x={126 + i * 16.5} y={41.6} fontSize="3" className={INK_SOFT} fill="#64748b">
                  {label}
                </text>
              </g>
            ))}
            <g className="fa-e-in" style={at(1.6)}>
              <Lines x={124} y={50} w={46} count={2} gap={3.4} height={1.3} />
              <path d="M124 82.5h46" className={TRACK} stroke="#e2e8f0" strokeWidth="0.6" />
            </g>
            <g fill={SKY}>
              {[8, 13, 10, 18, 22].map((h, i) => (
                <rect
                  key={i}
                  className="fa-e-rise"
                  style={at(1.8 + i * 0.1)}
                  x={126 + i * 9}
                  y={82 - h}
                  width="6"
                  height={h}
                  rx="1"
                  fillOpacity={i === 4 ? 1 : 0.4}
                />
              ))}
            </g>
          </Page>
        </g>
      </svg>
    </Frame>
  );
}

/** Backgrounds from your theme: a tint with a grid, a gradient with dots, a dark page whose ink follows it. */
export function IllustrateBackgroundsArt() {
  const pages: {
    x: number;
    label: string;
    fill: string;
    className: string;
    pattern: string;
    ink: string;
    inkClass?: string;
    accent: string;
  }[] = [
    {
      x: 50,
      label: 'Theme tint',
      fill: '#e0f2fe',
      className: 'fill-sky-100 dark:fill-sky-950',
      pattern: 'url(#pe-grid)',
      ink: '#0c4a6e',
      inkClass: 'fill-sky-900 dark:fill-sky-100',
      accent: SKY,
    },
    {
      x: 130,
      label: 'Gradient',
      fill: 'url(#pe-dusk)',
      className: '',
      pattern: 'url(#pe-dots)',
      ink: '#7c2d12',
      accent: '#ea580c',
    },
    {
      x: 210,
      label: 'Dark page',
      fill: '#0f172a',
      className: 'dark:fill-slate-950',
      pattern: 'url(#pe-ruled)',
      ink: '#f8fafc',
      accent: '#7dd3fc',
    },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="pe-dusk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="1" stopColor="#fb7185" />
          </linearGradient>
          <pattern id="pe-grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M5 0H0V5" fill="none" stroke={SKY} strokeOpacity="0.22" strokeWidth="0.4" />
          </pattern>
          <pattern id="pe-dots" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.55" fill="#7c2d12" fillOpacity="0.28" />
          </pattern>
          <pattern id="pe-ruled" width="40" height="4.5" patternUnits="userSpaceOnUse">
            <path d="M0 4.2H40" stroke="#7dd3fc" strokeOpacity="0.18" strokeWidth="0.4" />
          </pattern>
        </defs>
        {pages.map((p, i) => (
          <g key={p.label} className="fa-e-in" style={at(i * 0.3)}>
            <PageLabel x={p.x} y={14}>
              {p.label}
            </PageLabel>
            <Page x={p.x} y={17} w={40} h={57} fill={p.fill} className={p.className}>
              <rect x={p.x} y={17} width="40" height="57" rx="1.6" fill={p.pattern} />
              <text
                x={p.x + 5}
                y={27}
                fontSize="3.4"
                fontWeight="700"
                letterSpacing="0.4"
                fill={p.accent}
              >
                SUMMIT
              </text>
              <text
                x={p.x + 5}
                y={35}
                fontSize="6.2"
                fontWeight="800"
                fontFamily={SERIF}
                className={p.inkClass}
                fill={p.ink}
              >
                Lisbon
              </text>
              <g fill={p.ink} fillOpacity="0.3" className={p.inkClass}>
                <rect x={p.x + 5} y={39} width="28" height="1.4" rx="0.7" />
                <rect x={p.x + 5} y={42.4} width="22" height="1.4" rx="0.7" />
              </g>
              <rect
                x={p.x + 5}
                y={50}
                width="30"
                height="16"
                rx="2"
                fill={p.accent}
                fillOpacity="0.22"
              />
              <circle cx={p.x + 12} cy={58} r="3.4" fill={p.accent} />
              <rect x={p.x + 18} y={55.5} width="13" height="1.4" rx="0.7" fill={p.accent} />
              <rect
                x={p.x + 18}
                y={59}
                width="9"
                height="1.4"
                rx="0.7"
                fill={p.accent}
                fillOpacity="0.6"
              />
            </Page>
          </g>
        ))}
        <g transform="translate(40 0)">
          {/* The theme's swatches, the page tint picked from them. */}
          <g className="fa-e-in" style={at(1.2)}>
            {[SKY, '#0284c7', VIOLET, AMBER, '#0f172a'].map((c, i) => (
              <circle
                key={c}
                cx={93 + i * 8.5}
                cy={84}
                r="2.6"
                fill={c}
                className={i === 4 ? 'dark:stroke-slate-500' : undefined}
                stroke={i === 0 ? '#ffffff' : 'none'}
                strokeWidth="0.8"
              />
            ))}
            <circle cx="93" cy="84" r="4" fill="none" stroke={SKY} strokeWidth="0.7" />
          </g>
        </g>
      </svg>
    </Frame>
  );
}

// A node of the loose diagram: the canvas's own shape colours.
function Node({ x, y, w = 22, label }: { x: number; y: number; w?: number; label: string }) {
  return (
    <g>
      <rect
        className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)"
        x={x}
        y={y}
        width={w}
        height="10"
        rx="3"
        fill="#f0f9ff"
        stroke={SKY}
        strokeWidth="0.9"
      />
      <text
        className="fill-(--art-ink-text)"
        x={x + w / 2}
        y={y + 6.6}
        textAnchor="middle"
        fontSize="4.2"
        fontWeight="700"
        fill="#075985"
      >
        {label}
      </text>
    </g>
  );
}

/** Turn any diagram into pages: a flow on the canvas, switched to Illustrate and split, a page per part. */
export function IllustrateIntoPagesArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <g transform="translate(14 0)">
          {/* The diagram, loose on the canvas, in two parts. */}
          <g>
            <Node x={14} y={18} label="Idea" />
            <Node x={14} y={38} label="Draft" />
            <Node x={44} y={56} label="Review" w={26} />
            <Node x={14} y={74} label="Ship" />
            <path
              className="stroke-(--art-arrow)"
              d="M25 28v10M36 43c8 0 21 2 21 13M44 61c-6 0-19 1-19 13"
              fill="none"
              stroke="#334155"
              strokeWidth="0.8"
            />
          </g>
        </g>
        <g transform="translate(44 0)">
          {/* The mode switch it goes through. */}
          <g className="fa-e-pop" style={at(0.4)}>
            <rect
              className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
              x="80"
              y="42"
              width="36"
              height="12"
              rx="6"
              fill="#ffffff"
              stroke="#e2e8f0"
              strokeWidth="0.8"
            />
            <rect
              x="83"
              y="45"
              width="5"
              height="6"
              rx="0.8"
              fill="none"
              stroke={VIOLET}
              strokeWidth="0.9"
            />
            <path d="M84.5 47h2M84.5 49h2" stroke={VIOLET} strokeWidth="0.6" />
            <text x="91" y="50" fontSize="4.6" fontWeight="700" fill={VIOLET}>
              Illustrate
            </text>
          </g>
          <path
            className="stroke-slate-400 dark:stroke-slate-500"
            d="M44 48h32M116 48h26M139 45.5l3 2.5-3 2.5"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </g>
        <g transform="translate(56 0)">
          {/* A page for each part, each at its own size. */}
          {[
            { x: 132, label: 'Page 1', nodes: ['Idea', 'Draft'] },
            { x: 172, label: 'Page 2', nodes: ['Review', 'Ship'] },
          ].map((page, i) => (
            <g key={page.label} className="fa-e-pop" style={at(0.9 + i * 0.3)}>
              <PageLabel x={page.x} y={18}>
                {page.label}
              </PageLabel>
              <Page x={page.x} y={21} w={34} h={48}>
                <text
                  x={page.x + 4}
                  y={28}
                  fontSize="3.2"
                  fontWeight="700"
                  letterSpacing="0.3"
                  fill={SKY}
                >
                  {i === 0 ? 'PART ONE' : 'PART TWO'}
                </text>
                <Node x={page.x + 6} y={33} label={page.nodes[0]!} />
                <path
                  d={`M${page.x + 17} 43v6`}
                  className="stroke-(--art-arrow)"
                  stroke="#334155"
                  strokeWidth="0.8"
                />
                <Node x={page.x + 6} y={49} label={page.nodes[1]!} />
                <Lines x={page.x + 4} y={63} w={22} count={1} height={1.2} />
              </Page>
            </g>
          ))}
        </g>
      </svg>
    </Frame>
  );
}

/** Every page, print-ready: the pages, the export panel set to PDF, and the file it makes. */
export function IllustrateExportArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <g transform="translate(16 0)">
          {/* The pages, fanned. */}
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${i * 9} ${i * -4})`}>
              <Page x={20} y={30} w={34} h={48}>
                <rect
                  x={24}
                  y={34}
                  width="26"
                  height="10"
                  rx="1.2"
                  fill={[SKY, VIOLET, EMERALD][i]}
                  fillOpacity="0.85"
                />
                <Lines x={24} y={48} w={24} count={4} gap={3.2} height={1.2} />
                <text
                  x={51}
                  y={75}
                  textAnchor="end"
                  fontSize="3"
                  className={INK_SOFT}
                  fill="#64748b"
                >
                  {i + 1}
                </text>
              </Page>
            </g>
          ))}
        </g>
        <g transform="translate(40 0)">
          {/* The export panel. */}
          <Panel x={86} y={12} w={86} h={74} title="Export pages">
            {/* Format: PDF chosen. */}
            <rect
              className="fill-slate-100 dark:fill-slate-800"
              x="92"
              y="26"
              width="74"
              height="11"
              rx="3"
              fill="#f1f5f9"
            />
            <rect
              className="fill-white dark:fill-slate-700"
              x="93"
              y="27"
              width="24"
              height="9"
              rx="2.4"
              fill="#ffffff"
            />
            {['PDF', 'PNG', 'SVG'].map((f, i) => (
              <text
                key={f}
                x={105 + i * 24.5}
                y={33.2}
                textAnchor="middle"
                fontSize="4.4"
                fontWeight="700"
                className={i === 0 ? INK : INK_SOFT}
                fill={i === 0 ? '#1e293b' : '#64748b'}
              >
                {f}
              </text>
            ))}
            {[
              ['Pages', 'All 3'],
              ['Size', 'A4, true size'],
            ].map(([k, v], i) => (
              <g key={k}>
                <text x="92" y={47 + i * 9} fontSize="4.4" className={INK_SOFT} fill="#64748b">
                  {k}
                </text>
                <text
                  x="166"
                  y={47 + i * 9}
                  textAnchor="end"
                  fontSize="4.4"
                  fontWeight="600"
                  className={INK}
                  fill="#1e293b"
                >
                  {v}
                </text>
              </g>
            ))}
            <rect x="92" y="67" width="74" height="12" rx="3" fill={SKY} />
            <text
              x="129"
              y="74.8"
              textAnchor="middle"
              fontSize="4.8"
              fontWeight="700"
              fill="#ffffff"
            >
              Export PDF
            </text>
          </Panel>
        </g>
        <g transform="translate(60 0)">
          {/* The file it makes. */}
          <g className="fa-e-pop" style={at(1.4)}>
            <path
              className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
              d="M182 30h16l6 6v26h-22z"
              fill="#ffffff"
              stroke="#e2e8f0"
              strokeWidth="0.8"
            />
            <path className="fill-slate-100 dark:fill-slate-700" d="M198 30v6h6z" fill="#f1f5f9" />
            <rect x="179" y="46" width="18" height="8" rx="1.6" fill={ROSE} />
            <text
              x="188"
              y="51.8"
              textAnchor="middle"
              fontSize="4.4"
              fontWeight="800"
              fill="#ffffff"
            >
              PDF
            </text>
            <text
              x="193"
              y="68"
              textAnchor="middle"
              fontSize="3.6"
              className={INK_SOFT}
              fill="#64748b"
            >
              3 pages
            </text>
          </g>
        </g>
      </svg>
    </Frame>
  );
}
