// Feature art for Pages mode's last steps (docs/specs/007-editor/pages-mode.md): a diagram split
// onto pages, and every page exported print-ready. Split from ./infographics; built on ./page-kit like it.

import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
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
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';

/** Every page, print-ready: the pages, the export panel set to PDF, and the file it makes. */
export function PagesExportArt() {
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
