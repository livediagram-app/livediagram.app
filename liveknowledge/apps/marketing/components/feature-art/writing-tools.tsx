// Feature art for the tools around the writing (docs/specs/019-marketing/marketing-site.md): the Find bar over a page
// with its matches tinted (docs/specs/007-editor/find-and-replace.md), and a Word or PowerPoint file arriving as an
// article or a tab of slides and back out again (docs/specs/020-import-export/office-import.md), and the Export Tab dialog
// turning an article into one PDF. Built on ./page-kit so the pages read
// as paper in light and in dark.

import {
  AMBER,
  at,
  INK,
  INK_SOFT,
  Lines,
  Page,
  Panel,
  ROSE,
  SKY,
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';

/** Find and replace: the Find bar with its count and Replace row, over a page whose matches are tinted. */
export function FindReplaceArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Page x={70} y={14} w={96} h={82}>
          <text x={78} y={26} fontSize="6" fontWeight="700" className={INK} fill="#1e293b">
            Launch plan
          </text>
          {/* Lines of writing with the matches tinted, the one in hand stronger. */}
          <rect x={77} y={30.6} width={14} height={4} rx={0.8} fill={AMBER} fillOpacity="0.3" />
          <Lines x={94} y={31.8} w={62} count={1} />
          <Lines x={78} y={38} w={78} count={1} />
          <Lines x={78} y={44.2} w={30} count={1} />
          <rect x={111} y={43} width={14} height={4} rx={0.8} fill={AMBER} fillOpacity="0.85" />
          <Lines x={128} y={44.2} w={28} count={1} />
          <Lines x={78} y={50.4} w={70} count={1} />
          {/* A box whose label holds a match, ringed. */}
          <rect
            x={77}
            y={58}
            width={36}
            height={16}
            rx={2.4}
            fill="none"
            stroke={AMBER}
            strokeWidth="0.8"
            strokeDasharray="2 1.4"
          />
          <rect x={79} y={60} width={32} height={12} rx={1.8} fill={SKY} fillOpacity="0.14" />
          <rect x={86} y={65.2} width={18} height={1.7} rx={0.85} fill={SKY} />
          <Lines x={118} y={60} w={38} count={3} />
        </Page>
        {/* The Find bar, at the top right of the canvas. */}
        <Panel x={142} y={6} w={92} h={30}>
          <rect
            className="fill-white stroke-sky-300 dark:fill-slate-900 dark:stroke-sky-700"
            x={147}
            y={10}
            width={50}
            height={9}
            rx={2}
            fill="#ffffff"
            stroke="#7dd3fc"
            strokeWidth="0.6"
          />
          <text x={150} y={16.2} fontSize="4" className={INK} fill="#1e293b">
            launch
          </text>
          <text
            x={194}
            y={16.2}
            fontSize="3.4"
            textAnchor="end"
            className={INK_SOFT}
            fill="#64748b"
          >
            2 of 5
          </text>
          <text x={201} y={16.2} fontSize="3.6" fontWeight="700" className={INK} fill="#1e293b">
            Aa
          </text>
          <path
            d="M212 13.2v4.6M210 15.2l2-2 2 2M220 17.8v-4.6M218 15.8l2 2 2-2"
            fill="none"
            className="stroke-slate-500 dark:stroke-slate-400"
            stroke="#64748b"
            strokeWidth="0.6"
            strokeLinecap="round"
          />
          <path
            d="M226 13.4l3.4 3.4M229.4 13.4l-3.4 3.4"
            className="stroke-slate-500 dark:stroke-slate-400"
            stroke="#64748b"
            strokeWidth="0.6"
            strokeLinecap="round"
          />
          {/* The Replace row: the new words, then Replace All. */}
          <rect
            className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
            x={147}
            y={22.5}
            width={50}
            height={9}
            rx={2}
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="0.6"
          />
          <text x={150} y={28.7} fontSize="4" className={INK} fill="#1e293b">
            release
          </text>
          <rect x={200} y={22.5} width={30} height={9} rx={2} fill={SKY} />
          <text x={215} y={28.5} fontSize="3.6" fontWeight="700" textAnchor="middle" fill="#ffffff">
            Replace All
          </text>
        </Panel>
      </svg>
    </Frame>
  );
}

const WORD_BLUE = '#2563eb';
const POWERPOINT_ORANGE = '#ea580c';

/** A file's icon with its letter on a coloured band, as the Import dialog's cards show them. */
function FileIcon({
  x,
  y,
  letter,
  colour,
}: {
  x: number;
  y: number;
  letter: string;
  colour: string;
}) {
  return (
    <g>
      <path
        className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
        d={`M${x} ${y} h18 l8 8 v26 h-26 Z`}
        fill="#ffffff"
        stroke="#e2e8f0"
        strokeWidth="0.7"
      />
      <path
        className="fill-slate-100 dark:fill-slate-700"
        d={`M${x + 18} ${y} v8 h8 Z`}
        fill="#f1f5f9"
      />
      <rect x={x - 4} y={y + 14} width={18} height={14} rx={2} fill={colour} />
      <text x={x + 5} y={y + 24.4} fontSize="9" fontWeight="800" textAnchor="middle" fill="#ffffff">
        {letter}
      </text>
      <g className="fill-slate-200 dark:fill-slate-600" fill="#e2e8f0">
        <rect x={x + 16} y={y + 16} width={6} height={1.4} rx={0.7} />
        <rect x={x + 16} y={y + 20} width={6} height={1.4} rx={0.7} />
        <rect x={x + 16} y={y + 24} width={6} height={1.4} rx={0.7} />
      </g>
    </g>
  );
}

/** The arrow from the file to what it becomes. */
function Into({ x }: { x: number }) {
  return (
    <g stroke={SKY} strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${x} 48 h22`} strokeDasharray="2 1.8" />
      <path d={`M${x + 19} 44.6 l3.6 3.4 -3.6 3.4`} />
    </g>
  );
}

/** A Word document (or a Google Doc) arriving as an article: a title, headings, lines and a picture in the text. */
export function WordImportArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <FileIcon x={70} y={30} letter="W" colour={WORD_BLUE} />
        <Into x={106} />
        <Page x={140} y={10} w={70} h={82}>
          <text x={147} y={22} fontSize="5.4" fontWeight="700" className={INK} fill="#1e293b">
            Field Report
          </text>
          <Lines x={147} y={27} w={56} count={3} />
          <rect x={147} y={41} width={56} height={18} rx={1.4} fill={SKY} fillOpacity="0.16" />
          <path d="M152 56 l10 -9 7 6 6 -4 9 7" fill="none" stroke={SKY} strokeWidth="0.8" />
          <text x={147} y={66} fontSize="4" fontWeight="700" className={INK} fill="#1e293b">
            Findings
          </text>
          <Lines x={147} y={70} w={56} count={4} />
        </Page>
      </svg>
    </Frame>
  );
}

/** A file's name under its icon. */
function FileName({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text x={x} y={y} fontSize="3.8" textAnchor="middle" className={INK_SOFT} fill="#64748b">
      {children}
    </text>
  );
}

// The deck's slides as they arrive: each a slide page with its title and what it held.
const SLIDES = ['Q3 Review', 'Revenue', 'Next quarter'];

/** A PowerPoint deck (or Google Slides) arriving as a tab of slide pages, its speaker notes kept with their slide,
 *  then exported back out as an editable PowerPoint file. */
export function PowerPointImportArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <FileIcon x={16} y={22} letter="P" colour={POWERPOINT_ORANGE} />
        <FileName x={25} y={65}>
          Q3 Review.pptx
        </FileName>
        <g transform="translate(-50 -9)">
          <Into x={99} />
        </g>
        {SLIDES.map((title, i) => {
          const x = 78 + i * 54;
          const y = 15;
          return (
            <g key={title}>
              <text
                x={x}
                y={y - 3}
                fontSize="3.6"
                fontWeight="600"
                className={INK_SOFT}
                fill="#64748b"
              >
                Slide {i + 1}
              </text>
              <Page x={x} y={y} w={49} h={27.5}>
                <text
                  x={x + 5}
                  y={y + 9}
                  fontSize={i === 0 ? 5.6 : 4.8}
                  fontWeight="800"
                  className={INK}
                  fill="#1e293b"
                >
                  {title}
                </text>
                {i === 0 ? (
                  <>
                    <rect x={x + 5} y={y + 13} width={18} height={1.6} rx={0.8} fill={SKY} />
                    <Lines x={x + 5} y={y + 18} w={28} count={1} height={1.3} />
                  </>
                ) : i === 1 ? (
                  <g>
                    {[6, 9, 8, 13].map((h, b) => (
                      <rect
                        key={b}
                        x={x + 6 + b * 6}
                        y={y + 24 - h}
                        width={4}
                        height={h}
                        rx={0.6}
                        fill={SKY}
                        fillOpacity={b === 3 ? 1 : 0.5}
                      />
                    ))}
                    <Lines x={x + 32} y={y + 13} w={12} count={3} gap={3.4} height={1.2} />
                  </g>
                ) : (
                  <g>
                    {[0, 1, 2].map((r) => (
                      <circle key={r} cx={x + 6.5} cy={y + 14 + r * 4.4} r={0.9} fill={SKY} />
                    ))}
                    <Lines x={x + 9} y={y + 13.4} w={30} count={3} gap={4.4} height={1.2} />
                  </g>
                )}
              </Page>
              {/* Its speaker notes, kept with the slide. */}
              <rect
                className="fill-amber-50 stroke-amber-200 dark:fill-amber-950 dark:stroke-amber-800"
                x={x}
                y={y + 31}
                width={49}
                height={13}
                rx={2}
                fill="#fffbeb"
                stroke="#fde68a"
                strokeWidth="0.6"
              />
              <text
                x={x + 4}
                y={y + 36.4}
                fontSize="3.2"
                fontWeight="700"
                fill="#b45309"
                className="fill-amber-700 dark:fill-amber-300"
              >
                Notes
              </text>
              <Lines
                x={x + 4}
                y={y + 39}
                w={i === 1 ? 34 : 41}
                count={1}
                height={1.2}
                className="fill-amber-200 dark:fill-amber-800"
              />
            </g>
          );
        })}
        {/* Exported back out: an editable PowerPoint file, the caption under the file it makes. */}
        <text x={275} y={72} fontSize="3.6" textAnchor="middle" className={INK_SOFT} fill="#64748b">
          Export as PowerPoint
        </text>
        <g transform="translate(152 -9)">
          <Into x={84} />
        </g>
        <FileIcon x={266} y={22} letter="P" colour={POWERPOINT_ORANGE} />
        <FileName x={275} y={65}>
          Q3 Review.pptx
        </FileName>
      </svg>
    </Frame>
  );
}

/** A PDF at true page size: the Export Tab dialog's formats for an article, PDF picked, and the one PDF it makes,
 *  each page its own sheet and its contents first. */
export function ArticleExportArt() {
  // An article's format cards in the dialog's order (liveknowledge/apps/editor/components/dialogs/export-formats.ts
  // PAGES_FORMATS, as ExportTabDialog filters it for an article: PowerPoint is a deck's, Word and Markdown an
  // article's), three to a row as the dialog's grid lays them out.
  const cards: [string, string][] = [
    ['PDF', '#e11d48'],
    ['Print', '#94a3b8'],
    ['PNG', '#0ea5e9'],
    ['SVG', '#8b5cf6'],
    ['Word', WORD_BLUE],
    ['Markdown', '#64748b'],
    ['JSON', '#475569'],
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Panel x={18} y={8} w={150} h={82} title="Export Tab">
          <text x="24" y="25" fontSize="4.2" className={INK_SOFT} fill="#64748b">
            Pick a format to export the pages.
          </text>
          {cards.map(([label, colour], i) => {
            const cx = 24 + (i % 3) * 47;
            const cy = 29.5 + Math.floor(i / 3) * 19.5;
            const on = i === 0;
            return (
              <g key={label}>
                <rect
                  className={
                    on
                      ? 'fill-sky-50 stroke-sky-500 dark:fill-sky-950 dark:stroke-sky-400'
                      : 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600'
                  }
                  x={cx}
                  y={cy}
                  width="44"
                  height="17"
                  rx="3"
                  fill={on ? '#f0f9ff' : '#ffffff'}
                  stroke={on ? '#0ea5e9' : '#e2e8f0'}
                  strokeWidth={on ? 0.9 : 0.6}
                />
                <rect x={cx + 4.5} y={cy + 4} width="9" height="9" rx="2" fill={colour} />
                <text
                  x={cx + 17}
                  y={cy + 10.2}
                  fontSize="4.6"
                  fontWeight="700"
                  className={on ? 'fill-sky-700 dark:fill-sky-300' : INK}
                  fill={on ? '#0369a1' : '#1e293b'}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </Panel>
        <Into x={176} />
        {/* The one PDF: each page its sheet, the contents first. */}
        <g className="fa-e-pop" style={at(1.2)}>
          {[2, 1, 0].map((i) => (
            <Page key={i} x={208 + i * 6} y={12 + i * 3} w={54} h={72}>
              {i === 0 ? (
                <>
                  <text x={215} y={25} fontSize="5" fontWeight="700" className={INK} fill="#1e293b">
                    Contents
                  </text>
                  {['Summary', 'Results', 'Next steps'].map((h, r) => (
                    <g key={h}>
                      <text x={215} y={34 + r * 6.5} fontSize="3.8" className={INK} fill="#334155">
                        {h}
                      </text>
                      <text
                        x={255}
                        y={34 + r * 6.5}
                        fontSize="3.8"
                        textAnchor="end"
                        className={INK}
                        fill="#334155"
                      >
                        {r + 2}
                      </text>
                    </g>
                  ))}
                  <rect x={215} y={62} width={17} height={8} rx={1.6} fill={ROSE} />
                  <text
                    x={223.5}
                    y={67.6}
                    textAnchor="middle"
                    fontSize="4.4"
                    fontWeight="800"
                    fill="#ffffff"
                  >
                    PDF
                  </text>
                  <text
                    x={255}
                    y={79}
                    fontSize="3.6"
                    textAnchor="end"
                    className={INK_SOFT}
                    fill="#64748b"
                  >
                    A4 · 6 pages
                  </text>
                </>
              ) : null}
            </Page>
          ))}
        </g>
      </svg>
    </Frame>
  );
}
