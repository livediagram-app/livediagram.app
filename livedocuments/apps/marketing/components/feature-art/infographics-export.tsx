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
          {/* The export panel as the editor's Export Tab dialog shows PDF (livedocuments/apps/editor/components/
              dialogs/ImageExportPanel.tsx): back to All formats, All pages or One page, the preview, Download PDF. */}
          <Panel x={86} y={8} w={86} h={82} title="Export Tab">
            <path
              d="M93.6 22.4l-1.6 1.6 1.6 1.6"
              fill="none"
              className="stroke-slate-400"
              stroke="#94a3b8"
              strokeWidth="0.7"
              strokeLinecap="round"
            />
            <text x="96" y="25.6" fontSize="4" className={INK_SOFT} fill="#64748b">
              All formats
              <tspan dx="2">/</tspan>
              <tspan dx="2" fontWeight="700" className={INK} fill="#1e293b">
                PDF
              </tspan>
            </text>
            {/* Pages to export: All pages chosen. */}
            <rect
              className="fill-slate-100 dark:fill-slate-800"
              x="92"
              y="29"
              width="74"
              height="10"
              rx="3"
              fill="#f1f5f9"
            />
            <rect
              className="fill-white dark:fill-slate-700"
              x="93"
              y="30"
              width="36"
              height="8"
              rx="2.4"
              fill="#ffffff"
            />
            {['All pages', 'One page'].map((f, i) => (
              <text
                key={f}
                x={111 + i * 36.5}
                y={35.5}
                textAnchor="middle"
                fontSize="4.2"
                fontWeight={i === 0 ? 700 : 500}
                className={i === 0 ? INK : INK_SOFT}
                fill={i === 0 ? '#1e293b' : '#64748b'}
              >
                {f}
              </text>
            ))}
            {/* The page as it will download. */}
            <rect
              className="fill-slate-50 stroke-slate-200 dark:fill-slate-950 dark:stroke-slate-700"
              x="92"
              y="42"
              width="74"
              height="29"
              rx="2.4"
              fill="#f8fafc"
              stroke="#e2e8f0"
              strokeWidth="0.6"
            />
            <Page x={120} y={45} w={18} h={23}>
              <rect
                x={122.5}
                y={47.5}
                width="13"
                height="5"
                rx="0.8"
                fill={SKY}
                fillOpacity="0.85"
              />
              <Lines x={122.5} y={55} w={12} count={3} gap={2.6} height={0.9} />
            </Page>
            {/* Download PDF: the panel's primary button, brand-filled, at the right. */}
            <rect
              className="fill-brand-700 dark:fill-brand-600"
              x="122"
              y="75"
              width="44"
              height="10"
              rx="3"
              fill="#b45309"
            />
            <text
              x="144"
              y="81.6"
              textAnchor="middle"
              fontSize="4.6"
              fontWeight="700"
              fill="#ffffff"
            >
              Download PDF
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
