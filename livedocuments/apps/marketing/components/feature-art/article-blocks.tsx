// Feature art for the blocks an article's writing holds (docs/specs/019-marketing/marketing-site.md,
// docs/specs/007-editor/article-pages.md "Tables", "Table of contents" and "Headers and footers"): a table running
// from one page onto the next with its header row repeated, and a contents page with its dotted leaders beside the
// page its first heading lands on, a footnote at its foot, both under the header and over the footer. Built on ./page-kit so the pages read as paper in light and in dark.

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

// The contents block on page 2: the article's headings, Heading 2s indented a level, each with its page.
const CONTENTS: { label: string; depth: number; page: string }[] = [
  { label: 'Our year', depth: 0, page: '3' },
  { label: 'Revenue', depth: 1, page: '3' },
  { label: 'People', depth: 1, page: '4' },
  { label: 'What comes next', depth: 0, page: '5' },
];

/** The header every page carries: the document name left, the year right, in the top margin. */
function Header({ x, w }: { x: number; w: number }) {
  return (
    <g fontSize="3.3" className={INK_SOFT} fill="#64748b">
      <text x={x + 7} y={12.6}>
        Northwind Annual Report
      </text>
      <text x={x + w - 7} y={12.6} textAnchor="end">
        2026
      </text>
    </g>
  );
}

/** The footer: the page number and the page count, centred at the foot. */
function Footer({ x, w, page }: { x: number; w: number; page: number }) {
  return (
    <text
      x={x + w / 2}
      y={88}
      fontSize="3.3"
      textAnchor="middle"
      className={INK_SOFT}
      fill="#64748b"
    >
      Page {page} of 5
    </text>
  );
}

/** A named mark beside the page, tied by a hairline to what it names. */
function Tag({ y, from, label }: { y: number; from: number; label: string }) {
  const w = label.length * 2.9 + 7;
  return (
    <g>
      <path d={`M${from} ${y}H230`} stroke={SKY} strokeWidth="0.6" strokeDasharray="1.2 1.2" />
      <rect x="230" y={y - 4} width={w} height="8" rx="4" fill={SKY} fillOpacity="0.14" />
      <text
        x={230 + w / 2}
        y={y + 1.5}
        textAnchor="middle"
        fontSize="4.2"
        fontWeight="700"
        fill="#0284c7"
        className="fill-sky-600 dark:fill-sky-300"
      >
        {label}
      </text>
    </g>
  );
}

/** Contents, headers and footers: a contents page with its dotted leaders and page numbers, and the page its first
 *  heading lands on, a footnote at its foot; both carry the article's header and footer. */
export function ArticleContentsArt() {
  const a = 34;
  const b = 130;
  const w = 88;
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* Page 2: the contents block. */}
        <Page x={a} y={4} w={w} h={89}>
          <Header x={a} w={w} />
          <text x={a + 9} y={27} fontSize="6" fontWeight="700" className={INK} fill="#1e293b">
            Contents
          </text>
          {CONTENTS.map((entry, i) => {
            const ey = 37 + i * 8.5;
            const ex = a + 9 + entry.depth * 6;
            const tw = entry.label.length * 2.05;
            return (
              <g key={entry.label}>
                <text
                  x={ex}
                  y={ey}
                  fontSize="4"
                  fontWeight={entry.depth ? 400 : 600}
                  className={entry.depth ? INK_SOFT : INK}
                  fill={entry.depth ? '#64748b' : '#1e293b'}
                >
                  {entry.label}
                </text>
                <line
                  x1={ex + tw + 2}
                  y1={ey - 0.4}
                  x2={a + w - 14}
                  y2={ey - 0.4}
                  className="stroke-slate-300 dark:stroke-slate-500"
                  stroke="#cbd5e1"
                  strokeWidth="0.7"
                  strokeDasharray="0.6 1.6"
                  strokeLinecap="round"
                />
                <text
                  x={a + w - 9}
                  y={ey}
                  fontSize="4"
                  textAnchor="end"
                  className={INK}
                  fill="#1e293b"
                >
                  {entry.page}
                </text>
              </g>
            );
          })}
          <Footer x={a} w={w} page={2} />
        </Page>

        {/* Page 3: the first heading, a footnote's reference in the text and its note at the foot. */}
        <Page x={b} y={4} w={w} h={89}>
          <Header x={b} w={w} />
          <text x={b + 9} y={27} fontSize="6" fontWeight="700" className={INK} fill="#1e293b">
            Our year
          </text>
          <text x={b + 9} y={35} fontSize="3.9" className={INK} fill="#334155">
            Revenue grew 18% on last year
            <tspan fontSize="2.6" dy="-1.6" fontWeight="700" fill={SKY}>
              1
            </tspan>
          </text>
          <Lines x={b + 9} y={38.6} w={w - 18} count={2} gap={4} height={1.5} />
          <text x={b + 9} y={53} fontSize="4.6" fontWeight="700" className={INK} fill="#1e293b">
            Revenue
          </text>
          <Lines x={b + 9} y={56.6} w={w - 18} count={3} gap={4} height={1.5} />
          {/* The note under its short rule, a third of the text width. */}
          <path
            d={`M${b + 9} 74H${b + 9 + (w - 18) / 3}`}
            className="stroke-slate-300 dark:stroke-slate-500"
            stroke="#cbd5e1"
            strokeWidth="0.6"
          />
          <text x={b + 9} y={79.4} fontSize="3.2" className={INK_SOFT} fill="#64748b">
            1 Unaudited, at 30 June 2026.
          </text>
          <Footer x={b} w={w} page={3} />
        </Page>

        <Tag y={11.4} from={b + w + 1} label="Header" />
        <Tag y={78.2} from={b + w + 1} label="Footnote" />
        <Tag y={87} from={b + w / 2 + 12} label="Footer" />
      </svg>
    </Frame>
  );
}
