// Feature art for Illustrate's last steps (docs/specs/007-editor/illustrate-pages.md): a diagram split
// onto pages, and every page exported print-ready. Split from ./infographics; built on ./page-kit like it.

import { Frame } from './shared';
import {
  at,
  EMERALD,
  INK,
  INK_SOFT,
  Lines,
  Page,
  Panel,
  ROSE,
  SKY,
  VIOLET,
  PageLabel,
} from './page-kit';

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
