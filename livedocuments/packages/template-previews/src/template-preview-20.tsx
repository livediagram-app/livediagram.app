import type { ReactElement } from 'react';
import type { TemplateKind } from '@livedocuments/templates';
import { pv } from './motion';

// Group 20: the blanks of a page kind (docs/specs/007-editor/start-diagramming.md "Recommended and groups"): Blank
// Slide Deck, Blank Article and Blank Infographic. Each draws its one empty page in its own proportions
// (a 16:9 slide, an A4 page) with the dashed edge, faint guides and brand "+" of Blank
// Illustration's page, so the Pages blanks read as a set. Hover story: the guides light up, what the page is for.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const EDGE = 'rgb(148 163 184)';
const GUIDE = 'rgb(226 232 240)';
const LINE = 'rgb(203 213 225)';

// The empty page: white paper with a dashed edge.
function Page(p: { x: number; y: number; width: number; height: number }) {
  return (
    <rect {...p} rx="2" fill="white" stroke={EDGE} strokeWidth="0.8" strokeDasharray="2 1.4" />
  );
}

// The "+" that starts it, as on Blank Illustration's page.
function Plus({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r="2" style={{ fill: 'var(--color-brand-500)' }} />
      <path
        d={`M${cx} ${cy - 1.1} V${cy + 1.1} M${cx - 1.1} ${cy} H${cx + 1.1}`}
        stroke="white"
        strokeWidth="0.6"
      />
    </>
  );
}

export function templatePreviewGroup20(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'blank-slide-deck':
      // One empty 16:9 slide: the faint title and subtitle a first slide waits for. Hover story: they light up.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={13} y={10.5} width={54} height={30.4} />
          <g className="pv-pulse" style={pv({ '--pv-at': '500ms' })}>
            <rect x="25" y="19" width="30" height="3.2" rx="1" fill={GUIDE} />
            <rect x="30" y="24.6" width="20" height="1.6" rx="0.8" fill={GUIDE} />
          </g>
          <Plus cx={40} cy={33.5} />
        </svg>
      );
    case 'blank-article':
      // One empty A4 page of writing: a title, then lines of text. Hover story: the writing lights up.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={25} y={3} width={30} height={44} />
          <g className="pv-pulse" style={pv({ '--pv-at': '500ms' })}>
            <rect x="29" y="8" width="15" height="2.6" rx="0.8" fill={EDGE} />
            {[14, 17, 20, 23, 26, 29].map((y, i) => (
              <rect
                key={y}
                x="29"
                y={y}
                width={i === 2 ? 17 : i === 5 ? 12 : 22}
                height="1.3"
                rx="0.6"
                fill={LINE}
              />
            ))}
          </g>
          <Plus cx={40} cy={40.5} />
        </svg>
      );
    case 'blank-infographic':
      // One empty A4 infographic page: faint blocks where a layout goes (a header, a stat, a chart, a strip). Hover
      // story: the blocks light up, the layout it can start from.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={25} y={3} width={30} height={44} />
          <g className="pv-pulse" style={pv({ '--pv-at': '500ms' })}>
            <rect
              x="29"
              y="7"
              width="22"
              height="5"
              rx="1.2"
              style={{ fill: 'var(--color-brand-50)' }}
            />
            <rect
              x="33"
              y="8.8"
              width="14"
              height="1.4"
              rx="0.7"
              style={{ fill: 'var(--color-brand-300)' }}
            />
            <rect
              x="29"
              y="14"
              width="10.5"
              height="10"
              rx="1.2"
              style={{ fill: 'var(--color-brand-50)' }}
            />
            <circle
              cx="34.25"
              cy="19"
              r="2.8"
              fill="none"
              strokeWidth="1.4"
              style={{ stroke: 'var(--color-brand-300)' }}
            />
            <rect
              x="40.5"
              y="14"
              width="10.5"
              height="10"
              rx="1.2"
              style={{ fill: 'var(--color-brand-50)' }}
            />
            <rect
              x="42.5"
              y="19"
              width="1.6"
              height="3.5"
              rx="0.4"
              style={{ fill: 'var(--color-brand-300)' }}
            />
            <rect
              x="45"
              y="17"
              width="1.6"
              height="5.5"
              rx="0.4"
              style={{ fill: 'var(--color-brand-300)' }}
            />
            <rect
              x="47.5"
              y="18"
              width="1.6"
              height="4.5"
              rx="0.4"
              style={{ fill: 'var(--color-brand-300)' }}
            />
            <rect
              x="29"
              y="26"
              width="22"
              height="9"
              rx="1.2"
              style={{ fill: 'var(--color-brand-50)' }}
            />
            {[29, 31.5].map((y, i) => (
              <rect
                key={y}
                x="32"
                y={y}
                width={i === 1 ? 10 : 16}
                height="1.2"
                rx="0.6"
                fill={LINE}
              />
            ))}
          </g>
          <Plus cx={40} cy={41} />
        </svg>
      );
    default:
      return null;
  }
}
