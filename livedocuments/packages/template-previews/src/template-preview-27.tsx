import type { ReactElement, ReactNode } from 'react';
import type { TemplateKind } from '@livedocuments/templates';
import { pv } from '@liveworkspace/template-previews/motion';

// Group 27: the written documents (docs/specs/008-canvas/canvas-and-palette.md "Written documents"): Meeting Notes,
// Lesson Plan, Business Proposal, Design Doc, Status Report and Cover Letter. Each draws its A4 page as it opens, with
// what makes it that document in front: the tables, the contents, the header and footer, the code, the signature.
// Hover stories show the document doing its job: actions ticked off, a lesson's stages filled in, the contents
// written, code typed, the status lights checked, the letter signed.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const INK = 'rgb(15 23 42)';
const MUTED = 'rgb(148 163 184)';
const LINE = 'rgb(203 213 225)';
const SOFT = 'rgb(100 116 139)';
const PAPER = 'white';
const ACCENT = 'rgb(37 99 235)';
const ACCENT_DARK = 'rgb(30 64 175)';
const TINT = 'rgb(219 234 254)';
// The design doc's code, a colour a line.
const CODE_INKS = ['rgb(196 181 253)', 'rgb(125 211 252)', 'rgb(134 239 172)', 'rgb(196 181 253)'];

const at = (ms: number) => pv({ '--pv-at': `${ms}ms` });

// An A4 page, 34 x 46, its top left at (x, y).
function Page({ x, y = 2, fill = PAPER }: { x: number; y?: number; fill?: string }) {
  return (
    <rect
      x={x}
      y={y}
      width="34"
      height="46"
      rx="0.8"
      fill={fill}
      stroke={MUTED}
      strokeWidth="0.3"
    />
  );
}

// A line of text, a bar.
function Bar({
  x,
  y,
  w,
  h = 0.9,
  fill = MUTED,
  grow,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  fill?: string;
  // Writes itself in, at this many ms into the story.
  grow?: number;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={h / 2}
      fill={fill}
      {...(grow === undefined ? {} : { className: 'pv-grow-x', style: at(grow) })}
    />
  );
}

// A table: its rows' tops, its column edges, a tinted header row, and each cell's text width (a row of widths a row).
function Table({
  x,
  y,
  cols,
  row,
  cells,
  head = TINT,
  grow,
}: {
  x: number;
  y: number;
  // The column widths.
  cols: readonly number[];
  row: number;
  cells: readonly (readonly number[])[];
  head?: string;
  // The body rows write themselves in, one after another, from this many ms.
  grow?: number;
}) {
  const width = cols.reduce((n, w) => n + w, 0);
  const lefts = cols.map((_, i) => x + cols.slice(0, i).reduce((n, w) => n + w, 0));
  const height = row * cells.length;
  const parts: ReactNode[] = [
    <rect key="head" x={x} y={y} width={width} height={row} fill={head} />,
    <rect
      key="frame"
      x={x}
      y={y}
      width={width}
      height={height}
      fill="none"
      stroke={LINE}
      strokeWidth="0.3"
    />,
  ];
  for (let r = 1; r < cells.length; r++)
    parts.push(
      <line
        key={`r${r}`}
        x1={x}
        y1={y + r * row}
        x2={x + width}
        y2={y + r * row}
        stroke={LINE}
        strokeWidth="0.25"
      />,
    );
  for (let c = 1; c < cols.length; c++)
    parts.push(
      <line
        key={`c${c}`}
        x1={lefts[c]}
        y1={y}
        x2={lefts[c]}
        y2={y + height}
        stroke={LINE}
        strokeWidth="0.25"
      />,
    );
  cells.forEach((widths, r) =>
    widths.forEach((w, c) => {
      if (w <= 0) return;
      parts.push(
        <Bar
          key={`t${r}-${c}`}
          x={lefts[c]! + 0.9}
          y={y + r * row + row / 2 - 0.4}
          w={w}
          h={0.8}
          fill={r === 0 ? ACCENT_DARK : MUTED}
          grow={grow === undefined || r === 0 ? undefined : grow + (r - 1) * 260}
        />,
      );
    }),
  );
  return <g>{parts}</g>;
}

// A to-do box, ticked or not; a tick the story draws is hidden at rest.
function Todo({ x, y, ticked, draw }: { x: number; y: number; ticked?: boolean; draw?: number }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="1.8"
        height="1.8"
        rx="0.3"
        fill={ticked ? ACCENT : PAPER}
        stroke={ticked ? ACCENT : SOFT}
        strokeWidth="0.3"
      />
      {ticked ? (
        <path
          d={`M${x + 0.4} ${y + 0.95} L${x + 0.8} ${y + 1.35} L${x + 1.45} ${y + 0.5}`}
          fill="none"
          stroke={PAPER}
          strokeWidth="0.35"
          strokeLinecap="round"
        />
      ) : null}
      {draw !== undefined ? (
        <path
          className="pv-draw"
          pathLength="1"
          strokeDasharray="0 1"
          d={`M${x + 0.3} ${y + 0.9} L${x + 0.8} ${y + 1.5} L${x + 2.2} ${y - 0.6}`}
          fill="none"
          stroke="rgb(16 185 129)"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={pv({ '--pv-at': `${draw}ms`, '--pv-dur': '360ms' })}
        />
      ) : null}
    </g>
  );
}

// A header or footer: a left and a right part, a hairline between it and the writing.
function Band({
  x,
  y,
  left,
  right,
  rule,
}: {
  x: number;
  y: number;
  left: number;
  right: number;
  rule: number;
}) {
  return (
    <g>
      <Bar x={x + 3} y={y} w={left} h={0.7} />
      <Bar x={x + 31 - right} y={y} w={right} h={0.7} />
      <line x1={x + 3} y1={rule} x2={x + 31} y2={rule} stroke={LINE} strokeWidth="0.25" />
    </g>
  );
}

export function templatePreviewGroup27(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'meeting-notes':
      // The notes as they open: the header (the document's name and the date), the title, who came in a table, the
      // decisions heading and the actions as a to-do list, one already done. Hover story: the actions are ticked off.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={23} />
          <Band x={23} y={4} left={9} right={6} rule={5.8} />
          <Bar x={26} y={7.6} w={19} h={2.4} fill={INK} />
          <Bar x={26} y={11} w={24} h={1} fill={SOFT} />
          <Table
            x={26}
            y={13.6}
            cols={[9, 19]}
            row={2.4}
            cells={[
              [5, 6],
              [4, 10],
              [5, 15],
            ]}
          />
          <Bar x={26} y={22} w={9} h={1.3} fill={ACCENT_DARK} />
          <Table
            x={26}
            y={24.4}
            cols={[14, 8, 6]}
            row={2.4}
            cells={[
              [7, 4, 3],
              [11, 4, 3],
              [9, 3, 3],
            ]}
          />
          <Bar x={26} y={32.6} w={7} h={1.3} fill={ACCENT_DARK} />
          {[35.2, 37.8, 40.4].map((y, i) => (
            <g key={y}>
              <Todo x={26} y={y} draw={600 + i * 420} />
              <Bar x={29} y={y + 0.5} w={[20, 15, 18][i]!} />
            </g>
          ))}
          <Todo x={26} y={43} ticked />
          <Bar x={29} y={43.5} w={13} fill={LINE} />
        </svg>
      );
    case 'lesson-plan':
      // The Notebook look: a cream page, ruled, with a margin line; the title, the objectives as a numbered list and
      // the lesson's timings in a table; the footer with its page number. Hover story: the lesson's stages fill in,
      // row after row.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={23} fill="rgb(254 252 240)" />
          {[9, 12, 15, 18, 21].map((y) => (
            <line key={y} x1={23.4} y1={y} x2={56.6} y2={y} stroke={TINT} strokeWidth="0.3" />
          ))}
          <line
            x1={25.4}
            y1={2.4}
            x2={25.4}
            y2={47.6}
            stroke="rgb(252 165 165)"
            strokeWidth="0.35"
          />
          <Bar x={27} y={5} w={18} h={2.4} fill={INK} />
          <Bar x={27} y={8.4} w={22} h={1} fill={SOFT} />
          <Bar x={27} y={11.4} w={11} h={1.3} fill="rgb(21 128 61)" />
          {[14, 16.6, 19.2].map((y, i) => (
            <g key={y}>
              <circle cx={28} cy={y + 0.45} r="0.9" fill="rgb(34 197 94)" />
              <Bar x={30} y={y} w={[19, 22, 16][i]!} />
            </g>
          ))}
          <Table
            x={27}
            y={23}
            cols={[5, 8, 14]}
            row={3}
            head="rgb(220 252 231)"
            grow={500}
            cells={[
              [3, 5, 6],
              [3, 5, 11],
              [3, 6, 12],
              [3, 5, 10],
              [3, 4, 9],
            ]}
          />
          <line x1={26} y1={44.6} x2={54} y2={44.6} stroke={LINE} strokeWidth="0.25" />
          <Bar x={27} y={45.4} w={9} h={0.7} />
          <Bar x={50} y={45.4} w={4} h={0.7} />
        </svg>
      );
    case 'business-proposal':
      // Two pages side by side: the title page (a deep band with the title, no header or footer), then the contents
      // with their dotted leaders and page numbers over the pricing table, its total in bold, the footer's "Page 2 of
      // 4". Hover story: the contents write themselves, then the total swells.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={6} />
          <rect x={6} y={2} width="34" height="20" rx="0.8" fill="rgb(15 23 42)" />
          <rect x={6} y={21} width="34" height="1" fill="rgb(15 23 42)" />
          <rect x={9} y={8} width="3" height="0.7" rx="0.35" fill="rgb(96 165 250)" />
          <rect x={9} y={10.4} width="24" height="2.4" rx="0.6" fill={PAPER} />
          <rect x={9} y={14} width="17" height="2.4" rx="0.6" fill={PAPER} />
          <rect x={9} y={18} width="20" height="0.9" rx="0.45" fill="rgb(148 163 184)" />
          <Bar x={9} y={26} w={8} h={0.9} fill={SOFT} />
          <Bar x={9} y={28} w={15} />
          <Bar x={9} y={31.4} w={8} h={0.9} fill={SOFT} />
          <Bar x={9} y={33.4} w={13} />
          <Page x={42} />
          <Band x={42} y={4} left={8} right={10} rule={5.8} />
          <Bar x={45} y={8} w={9} h={1.4} fill={ACCENT_DARK} />
          {[11, 13.2, 15.4, 17.6, 19.8].map((y, i) => (
            <g key={y}>
              <Bar x={45} y={y} w={[9, 7, 10, 6, 8][i]!} fill={INK} grow={300 + i * 200} />
              <line
                x1={45 + [9, 7, 10, 6, 8][i]! + 1}
                y1={y + 0.6}
                x2={70.4}
                y2={y + 0.6}
                stroke={MUTED}
                strokeWidth="0.25"
                strokeDasharray="0.4 0.6"
              />
              <Bar x={71} y={y} w={2} fill={SOFT} />
            </g>
          ))}
          <Bar x={45} y={23.6} w={8} h={1.3} fill={ACCENT_DARK} />
          <Table
            x={45}
            y={26.2}
            cols={[17, 11]}
            row={2.6}
            cells={[
              [7, 4],
              [12, 6],
              [10, 7],
              [11, 6],
            ]}
          />
          <rect
            className="pv-pulse"
            x={45}
            y={36.6}
            width="28"
            height="2.6"
            fill="rgb(254 243 199)"
            stroke="rgb(245 158 11)"
            strokeWidth="0.3"
            style={at(1500)}
          />
          <Bar x={45.9} y={37.5} w={5} h={0.9} fill={INK} />
          <Bar x={62.9} y={37.5} w={7} h={0.9} fill={INK} />
          <line x1={45} y1={44.6} x2={73} y2={44.6} stroke={LINE} strokeWidth="0.25" />
          <Bar x={45} y={45.4} w={7} h={0.7} />
          <Bar x={66} y={45.4} w={7} h={0.7} />
        </svg>
      );
    case 'design-doc':
      // The doc's header (its name and status), the title and authors, the contents, the code block and the options
      // weighed in a table, each marked for and against. Hover story: the code types itself in, line by line.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={23} />
          <Band x={23} y={4} left={11} right={7} rule={5.8} />
          <rect x={47} y={3.7} width="7" height="1.3" rx="0.65" fill="rgb(254 243 199)" />
          <Bar x={26} y={7.6} w={22} h={2.4} fill={INK} />
          <Bar x={26} y={11} w={26} h={1} fill={SOFT} />
          {[13.6, 15.4, 17.2].map((y, i) => (
            <g key={y}>
              <Bar x={26 + (i === 1 ? 2 : 0)} y={y} w={[10, 8, 12][i]!} fill={ACCENT} />
              <Bar x={52} y={y} w={1.6} fill={MUTED} />
            </g>
          ))}
          <Bar x={26} y={20} w={13} h={1.3} fill={INK} />
          <rect x={26} y={22.6} width="28" height="9.4" rx="0.8" fill="rgb(30 41 59)" />
          {[24.2, 26, 27.8, 29.6].map((y, i) => (
            <g key={y}>
              <Bar
                x={28 + (i === 0 || i === 3 ? 0 : 2)}
                y={y}
                w={[9, 12, 10, 2][i]!}
                h={0.8}
                fill={CODE_INKS[i]}
                grow={400 + i * 300}
              />
            </g>
          ))}
          <Table
            x={26}
            y={34}
            cols={[8, 10, 10]}
            row={2.6}
            cells={[
              [4, 3, 5],
              [6, 0, 0],
              [5, 0, 0],
              [6, 0, 0],
            ]}
          />
          {[0, 1, 2].map((r) => (
            <g key={r}>
              <circle cx={35.5} cy={37.9 + r * 2.6} r="0.6" fill="rgb(34 197 94)" />
              <Bar x={36.6} y={37.5 + r * 2.6} w={[5, 3, 6][r]!} h={0.8} />
              <circle
                cx={45.5}
                cy={37.9 + r * 2.6}
                r="0.6"
                fill={r === 2 ? 'rgb(245 158 11)' : 'rgb(239 68 68)'}
              />
              <Bar x={46.6} y={37.5 + r * 2.6} w={[6, 4, 5][r]!} h={0.8} />
            </g>
          ))}
        </svg>
      );
    case 'status-report':
      // The report's header and page numbers, the title, the headline in bold, and the workstreams in a table with
      // a status light each (done, on track, at risk, blocked), over the risks. Hover story: each light is checked
      // in turn.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={23} />
          <Band x={23} y={4} left={10} right={9} rule={5.8} />
          <Bar x={26} y={7.6} w={21} h={2.4} fill={INK} />
          <Bar x={26} y={11} w={24} h={1} fill={SOFT} />
          <rect x={26} y={13.4} width="0.7" height="4.6" fill={ACCENT} />
          <Bar x={27.8} y={13.8} w={22} fill={INK} />
          <Bar x={27.8} y={15.6} w={24} />
          <Bar x={27.8} y={17.2} w={14} />
          <Table
            x={26}
            y={20.2}
            cols={[8, 6, 14]}
            row={2.8}
            cells={[
              [5, 3, 5],
              [4, 0, 11],
              [4, 0, 12],
              [5, 0, 9],
              [5, 0, 10],
            ]}
          />
          {['rgb(14 165 233)', 'rgb(34 197 94)', 'rgb(245 158 11)', 'rgb(239 68 68)'].map(
            (c, i) => (
              <rect
                key={c}
                className="pv-pulse"
                x={34.8}
                y={23.6 + i * 2.8}
                width="4.4"
                height="1.4"
                rx="0.7"
                fill={c}
                style={at(500 + i * 320)}
              />
            ),
          )}
          <Bar x={26} y={35.8} w={11} h={1.3} fill={ACCENT_DARK} />
          <Bar x={26} y={38.4} w={26} />
          <Bar x={26} y={40.2} w={21} />
          <line x1={26} y1={44.6} x2={54} y2={44.6} stroke={LINE} strokeWidth="0.25" />
          <Bar x={26} y={45.4} w={8} h={0.7} />
          <Bar x={47} y={45.4} w={7} h={0.7} />
        </svg>
      );
    case 'cover-letter':
      // A letter in the Classic look: the sender's name and details centred over a rule, the date, the greeting,
      // three paragraphs and the sign-off. Hover story: the letter is signed.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={23} />
          <Bar x={32} y={5} w={16} h={2.4} fill={INK} />
          <Bar x={28} y={8.6} w={24} h={0.8} fill={SOFT} />
          <line x1={26.5} y1={10.8} x2={53.5} y2={10.8} stroke={INK} strokeWidth="0.3" />
          <Bar x={26.5} y={13} w={7} />
          <Bar x={26.5} y={15} w={20} />
          <Bar x={26.5} y={17.6} w={8} fill={INK} />
          {[
            [20.2, [27, 27, 27, 15]],
            [26.6, [27, 27, 26, 27, 9]],
            [34.4, [27, 24]],
          ].map(([y, ws]) => (
            <g key={y as number}>
              {(ws as number[]).map((w, i) => (
                <Bar key={i} x={26.5} y={(y as number) + i * 1.5} w={w} h={0.8} />
              ))}
            </g>
          ))}
          <Bar x={26.5} y={38.4} w={11} />
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M27 43.4 C28 40.6 29.4 40.6 29.2 42.6 C29 44.4 30.6 41.4 31.6 41.8 C32.6 42.2 32 43.8 33.4 42.6 C34.4 41.8 35.2 42.4 36.8 41.6"
            fill="none"
            stroke={ACCENT_DARK}
            strokeWidth="0.5"
            strokeLinecap="round"
            style={pv({ '--pv-at': '700ms', '--pv-dur': '1100ms' })}
          />
          <Bar x={26.5} y={45} w={10} fill={INK} />
        </svg>
      );
    default:
      return null;
  }
}
