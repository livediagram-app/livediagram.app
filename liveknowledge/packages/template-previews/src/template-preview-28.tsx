import type { ReactElement } from 'react';
import type { TemplateKind } from '@liveknowledge/templates';
import {
  ACCENT,
  ACCENT_DARK,
  at,
  Band,
  Bar,
  INK,
  LINE,
  MUTED,
  Page,
  SOFT,
  Table,
  TINT,
  Todo,
} from './article-preview-parts';

// Group 28: more written documents (docs/specs/008-canvas/canvas-and-palette.md "Written documents"): Product
// One-Pager, Research Report, Newsletter, Case Study and Onboarding Handbook. Each draws its A4 page as it opens, in
// group 27's parts, with what makes it that document in front: the one-pager's two tables, the report's title page,
// contents and footnotes, the newsletter's bold masthead, the case study's results, the handbook's checklist. Hover stories show
// the document doing its job. Static SVG preview tiles; TemplatePreview chains the groups with ??.

// Contents: an entry a line, a dotted leader to its page number; the entries write themselves in from `grow` ms.
function Contents({
  x,
  y,
  widths,
  right,
  grow,
}: {
  x: number;
  y: number;
  widths: readonly number[];
  right: number;
  grow: number;
}) {
  return (
    <g>
      {widths.map((w, i) => (
        <g key={i}>
          <Bar x={x} y={y + i * 2} w={w} fill={INK} grow={grow + i * 180} />
          <line
            x1={x + w + 1}
            y1={y + i * 2 + 0.5}
            x2={right - 2.6}
            y2={y + i * 2 + 0.5}
            stroke={MUTED}
            strokeWidth="0.25"
            strokeDasharray="0.4 0.6"
          />
          <Bar x={right - 2} y={y + i * 2} w={2} fill={SOFT} />
        </g>
      ))}
    </g>
  );
}

export function templatePreviewGroup28(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'product-one-pager':
      // One page holding it all, in narrow margins: the header, the product's name, the problem, what we build in a
      // table and how we will know in a second, then what is not in the release. Hover story: the goals fill in.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={23} />
          <Band x={22} y={3.6} left={9} right={6} rule={5.2} />
          <Bar x={25.5} y={6.8} w={16} h={2.4} fill={INK} />
          <Bar x={25.5} y={10.2} w={26} h={0.9} fill={SOFT} />
          <Bar x={25.5} y={12.6} w={9} h={1.2} fill={INK} />
          <Bar x={25.5} y={14.6} w={29} />
          <Bar x={25.5} y={16.2} w={22} />
          <Table
            x={25.5}
            y={18.4}
            cols={[8, 21]}
            row={2.3}
            cells={[
              [5, 8],
              [6, 17],
              [5, 15],
              [5, 18],
            ]}
          />
          <Bar x={25.5} y={28.4} w={13} h={1.2} fill={INK} />
          <Table
            x={25.5}
            y={30.6}
            cols={[13, 7, 9]}
            row={2.3}
            grow={400}
            cells={[
              [7, 4, 6],
              [11, 2, 2],
              [10, 3, 4],
              [12, 5, 5],
            ]}
          />
          <Bar x={25.5} y={40.6} w={11} h={1.2} fill={INK} />
          <circle cx={26.2} cy={43.4} r="0.5" fill={ACCENT} />
          <Bar x={27.6} y={43} w={18} />
          <circle cx={26.2} cy={45.2} r="0.5" fill={ACCENT} />
          <Bar x={27.6} y={44.8} w={22} />
        </svg>
      );
    case 'research-report':
      // Two pages side by side: the title page (the title, the study in a line, who wrote it, no header or footer),
      // then the contents, the method in a table, and the footnotes under a short rule at the foot, over the "Page 2
      // of 6" footer. Hover story: the contents write themselves, then the method's rows fill in.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={6} />
          <rect x={9} y={10} width="3" height="0.7" rx="0.35" fill={ACCENT} />
          <Bar x={9} y={12.4} w={24} h={2.6} fill={ACCENT_DARK} />
          <Bar x={9} y={16.2} w={17} h={2.6} fill={ACCENT_DARK} />
          <Bar x={9} y={20.4} w={26} h={1} fill={SOFT} />
          <Bar x={9} y={22.2} w={20} h={1} fill={SOFT} />
          <line x1={9} y1={36} x2={37} y2={36} stroke={LINE} strokeWidth="0.25" />
          <Bar x={9} y={38} w={14} />
          <Bar x={9} y={40} w={11} />
          <Page x={42} />
          <Band x={42} y={4} left={11} right={8} rule={5.8} />
          <Bar x={45} y={7.8} w={9} h={1.3} fill={ACCENT_DARK} />
          <Contents x={45} y={10.4} widths={[8, 6, 10, 7]} right={73} grow={300} />
          <Bar x={45} y={19.4} w={13} h={1.2} fill={ACCENT_DARK} />
          <Bar x={45} y={21.6} w={26} />
          <Bar x={45} y={23.2} w={19} />
          <Table
            x={45}
            y={25.2}
            cols={[7, 13, 8]}
            row={2.4}
            grow={1200}
            cells={[
              [4, 5, 5],
              [4, 10, 4],
              [5, 9, 6],
              [4, 8, 4],
            ]}
          />
          <line x1={45} y1={38.6} x2={54} y2={38.6} stroke={LINE} strokeWidth="0.3" />
          {[39.8, 41.4].map((y, i) => (
            <g key={y}>
              <Bar x={45} y={y} w={1} h={0.7} fill={ACCENT} />
              <Bar x={46.6} y={y} w={[22, 17][i]!} h={0.7} />
            </g>
          ))}
          <Bar x={45} y={45.4} w={8} h={0.7} />
          <Bar x={66} y={45.4} w={7} h={0.7} />
        </svg>
      );
    case 'newsletter':
      // The Bold look: the masthead set large in the accent, the issue and date in the header, In This Issue as a
      // contents, a lead story with its quote, and the new coffees in a table. Hover story: the issue's stories are
      // listed, then the quote's bar lights.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={23} />
          <Band x={23} y={4} left={9} right={10} rule={5.8} />
          <Bar x={26} y={7.4} w={24} h={3.6} fill="rgb(194 65 12)" />
          <Bar x={26} y={12.4} w={22} h={1} fill={SOFT} />
          <Contents x={26} y={15} widths={[9, 11, 8]} right={54} grow={300} />
          <Bar x={26} y={21.8} w={14} h={1.6} fill="rgb(194 65 12)" />
          <Bar x={26} y={24.4} w={28} />
          <Bar x={26} y={26} w={24} />
          <rect
            className="pv-pulse"
            x={26}
            y={28.2}
            width="0.8"
            height="4"
            fill="rgb(234 88 12)"
            style={at(1200)}
          />
          <rect x={26} y={28.2} width="0.8" height="4" fill="rgb(253 186 116)" />
          <Bar x={28} y={28.6} w={24} fill={INK} />
          <Bar x={28} y={30.6} w={18} fill={INK} />
          <Table
            x={26}
            y={34.4}
            cols={[8, 9, 11]}
            row={2.3}
            head="rgb(255 237 213)"
            cells={[
              [5, 3, 6],
              [6, 6, 9],
              [6, 4, 8],
              [5, 4, 9],
            ]}
          />
        </svg>
      );
    case 'case-study':
      // The Report look: the header, the client's result as the title, the project at a glance in a row of four,
      // the results in a table with the +64% picked out, what made the difference, and the client's words. Hover
      // story: the result swells.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={23} />
          <Band x={23} y={4} left={10} right={7} rule={5.8} />
          <Bar x={26} y={7.6} w={24} h={2.4} fill={ACCENT_DARK} />
          <Bar x={26} y={11} w={27} h={1} fill={SOFT} />
          <Table
            x={26}
            y={13.4}
            cols={[7, 7, 7, 7]}
            row={2.3}
            cells={[
              [4, 5, 4, 5],
              [5, 4, 5, 4],
            ]}
          />
          <Bar x={26} y={19.2} w={10} h={1.3} fill={ACCENT_DARK} />
          <Table
            x={26}
            y={21.6}
            cols={[11, 5, 5, 7]}
            row={2.3}
            cells={[
              [7, 3, 3, 4],
              [9, 3, 3, 3],
              [8, 2, 2, 4],
            ]}
          />
          <rect
            className="pv-pulse"
            x={47}
            y={23.9}
            width="7"
            height="2.3"
            fill="rgb(220 252 231)"
            stroke="rgb(34 197 94)"
            strokeWidth="0.3"
            style={at(400)}
          />
          <Bar x={47.9} y={24.65} w={4} h={0.8} fill="rgb(21 128 61)" />
          <Bar x={26} y={30.4} w={14} h={1.3} fill={ACCENT_DARK} />
          {[33, 35, 37].map((y, i) => (
            <g key={y}>
              <Bar x={26} y={y} w={1.2} fill={ACCENT} />
              <Bar x={28.4} y={y} w={[22, 18, 24][i]!} />
            </g>
          ))}
          <rect x={26} y={41.6} width="0.7" height="3.4" fill={ACCENT} />
          <Bar x={27.8} y={41.8} w={24} fill={INK} />
          <Bar x={27.8} y={43.6} w={15} fill={INK} />
        </svg>
      );
    case 'onboarding-handbook':
      // The handbook as it opens: the header, the welcome, the contents, the first week as a checklist, and who to
      // ask in a table, over "Page 1 of 4". Hover story: the first week is ticked off, day by day.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={23} />
          <Band x={23} y={4} left={11} right={8} rule={5.8} />
          <Bar x={26} y={7.6} w={22} h={2.4} fill={INK} />
          <Bar x={26} y={11} w={26} h={1} fill={SOFT} />
          <Contents x={26} y={13.6} widths={[10, 8, 7]} right={54} grow={200} />
          <Bar x={26} y={20.4} w={12} h={1.3} fill={ACCENT_DARK} />
          {[22.8, 25, 27.2, 29.4].map((y, i) => (
            <g key={y}>
              <Todo x={26} y={y} draw={700 + i * 360} />
              <Bar x={29} y={y + 0.5} w={[21, 18, 23, 16][i]!} />
            </g>
          ))}
          <Bar x={26} y={32.4} w={9} h={1.3} fill={ACCENT_DARK} />
          <Table
            x={26}
            y={34.6}
            cols={[9, 10, 9]}
            row={2.2}
            head={TINT}
            cells={[
              [4, 3, 4],
              [7, 6, 6],
              [6, 8, 7],
            ]}
          />
          <line x1={26} y1={44.6} x2={54} y2={44.6} stroke={LINE} strokeWidth="0.25" />
          <Bar x={26} y={45.4} w={11} h={0.7} />
          <Bar x={47} y={45.4} w={7} h={0.7} />
        </svg>
      );
    default:
      return null;
  }
}
