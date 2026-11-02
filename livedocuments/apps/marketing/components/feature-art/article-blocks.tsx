// Feature art for the blocks an article's writing holds (docs/specs/019-marketing/marketing-site.md,
// docs/specs/007-editor/article-pages.md "Tables", "Table of contents" and "Headers and footers"): a table running
// from one page onto the next with its header row repeated, and a page with its header, a contents block with dotted
// leaders, and its footer. Built on ./page-kit so the pages read as paper in light and in dark.

import {
  INK,
  INK_SOFT,
  Lines,
  Page,
  SKY,
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';

/** A table of `rows` body rows under its header row, `w` wide, at (x, y). */
function Table({ x, y, w, rows }: { x: number; y: number; w: number; rows: number }) {
  const rowH = 6.4;
  const cols = [0.44, 0.28, 0.28];
  const h = rowH * (rows + 1);
  let at = x;
  const rules = cols.slice(0, -1).map((c) => {
    at += c * w;
    return at;
  });
  return (
    <g>
      {/* The header row, on a soft tint of the accent. */}
      <rect x={x} y={y} width={w} height={rowH} fill={SKY} fillOpacity="0.16" />
      <g className="fill-slate-500 dark:fill-slate-300" fill="#64748b">
        <rect x={x + 2} y={y + 2.4} width={w * 0.26} height={1.7} rx={0.85} />
        <rect x={rules[0]! + 2} y={y + 2.4} width={w * 0.14} height={1.7} rx={0.85} />
        <rect x={rules[1]! + 2} y={y + 2.4} width={w * 0.14} height={1.7} rx={0.85} />
      </g>
      <g className="fill-slate-200 dark:fill-slate-600" fill="#e2e8f0">
        {Array.from({ length: rows }, (_, r) => {
          const ry = y + rowH * (r + 1) + 2.4;
          return (
            <g key={r}>
              <rect x={x + 2} y={ry} width={w * (0.2 + (r % 3) * 0.05)} height={1.6} rx={0.8} />
              <rect x={rules[0]! + 2} y={ry} width={w * 0.12} height={1.6} rx={0.8} />
              <rect x={rules[1]! + 2} y={ry} width={w * 0.1} height={1.6} rx={0.8} />
            </g>
          );
        })}
      </g>
      <g className="stroke-slate-300 dark:stroke-slate-600" stroke="#cbd5e1" strokeWidth="0.4">
        <rect x={x} y={y} width={w} height={h} fill="none" />
        {Array.from({ length: rows }, (_, r) => (
          <line key={r} x1={x} y1={y + rowH * (r + 1)} x2={x + w} y2={y + rowH * (r + 1)} />
        ))}
        {rules.map((rx) => (
          <line key={rx} x1={rx} y1={y} x2={rx} y2={y + h} />
        ))}
      </g>
    </g>
  );
}

/** Tables in the text: a table that runs off the foot of one page and carries on, header row first, on the next. */
export function ArticleTableArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Page x={58} y={8} w={84} h={84}>
          <text x={66} y={20} fontSize="5.6" fontWeight="700" className={INK} fill="#1e293b">
            Results
          </text>
          <Lines x={66} y={25} w={68} count={2} />
          <Table x={66} y={36} w={68} rows={7} />
        </Page>
        <Page x={158} y={8} w={84} h={84}>
          {/* The header row again, at the top of the page the table continues onto. */}
          <Table x={166} y={16} w={68} rows={4} />
          <Lines x={166} y={52} w={68} count={4} />
        </Page>
        {/* The table flowing from one page to the next. */}
        <path
          d="M144 60 C150 60 150 22 156 22"
          fill="none"
          stroke={SKY}
          strokeWidth="0.9"
          strokeDasharray="2 1.6"
          strokeLinecap="round"
        />
        <path d="M153.6 19.8 L156.6 22 L153.6 24.2" fill="none" stroke={SKY} strokeWidth="0.9" />
      </svg>
    </Frame>
  );
}

const CONTENTS: { label: number; depth: number; page: string }[] = [
  { label: 30, depth: 0, page: '2' },
  { label: 24, depth: 0, page: '3' },
  { label: 22, depth: 1, page: '3' },
  { label: 26, depth: 1, page: '4' },
  { label: 28, depth: 0, page: '5' },
];

/** Contents, headers and footers: a page with its header, a contents block with its leaders, and its footer. */
export function ArticleContentsArt() {
  const x = 104;
  const w = 92;
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Page x={x} y={6} w={w} h={86}>
          {/* The header: a line of text left and right in the top margin. */}
          <text x={x + 8} y={14.4} fontSize="3.4" className={INK_SOFT} fill="#64748b">
            Acme Ltd
          </text>
          <text
            x={x + w - 8}
            y={14.4}
            fontSize="3.4"
            textAnchor="end"
            className={INK_SOFT}
            fill="#64748b"
          >
            Annual Report
          </text>
          <text x={x + 10} y={27} fontSize="6" fontWeight="700" className={INK} fill="#1e293b">
            Contents
          </text>
          {CONTENTS.map((entry, i) => {
            const ey = 36 + i * 8;
            const ex = x + 10 + entry.depth * 6;
            return (
              <g key={i}>
                <rect
                  className={
                    entry.depth
                      ? 'fill-slate-300 dark:fill-slate-500'
                      : 'fill-slate-500 dark:fill-slate-300'
                  }
                  fill={entry.depth ? '#cbd5e1' : '#64748b'}
                  x={ex}
                  y={ey - 1.6}
                  width={entry.label}
                  height={1.8}
                  rx={0.9}
                />
                <line
                  x1={ex + entry.label + 2}
                  y1={ey}
                  x2={x + w - 15}
                  y2={ey}
                  className="stroke-slate-300 dark:stroke-slate-600"
                  stroke="#cbd5e1"
                  strokeWidth="0.7"
                  strokeDasharray="0.6 1.6"
                  strokeLinecap="round"
                />
                <text
                  x={x + w - 10}
                  y={ey + 1.3}
                  fontSize="3.6"
                  textAnchor="end"
                  className={INK}
                  fill="#1e293b"
                >
                  {entry.page}
                </text>
              </g>
            );
          })}
          {/* The footer: the page number and the page count, centred at the foot. */}
          <text
            x={x + w / 2}
            y={87}
            fontSize="3.4"
            textAnchor="middle"
            className={INK_SOFT}
            fill="#64748b"
          >
            Page 2 of 5
          </text>
        </Page>
        {/* Marks naming the header and footer, in the accent. */}
        <g fill={SKY}>
          <rect x={x - 12} y={12.2} width={7} height={2.6} rx={1.3} />
          <rect x={x - 12} y={84.8} width={7} height={2.6} rx={1.3} />
        </g>
      </svg>
    </Frame>
  );
}
