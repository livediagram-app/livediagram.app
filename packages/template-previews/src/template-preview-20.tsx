import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';

// Group 20: the blanks of a page kind (docs/specs/007-editor/templates-by-mode.md "Blanks of a page kind"): Blank
// Slide Deck, Blank Article, Blank Infographic and Blank Logo. Each draws its one empty page in its own proportions
// (a 16:9 slide, an A4 page, the square artboard) with the dashed edge, faint guides and sky "+" of Blank
// Illustration's page, so the Illustrate blanks read as a set. Hover story: the guides light up, what the page is for.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const EDGE = 'rgb(148 163 184)';
const GUIDE = 'rgb(226 232 240)';
const LINE = 'rgb(203 213 225)';
const TINT = 'rgb(240 249 255)';
const SOFT_SKY = 'rgb(125 211 252)';
const SKY = 'rgb(14 165 233)';

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
      <circle cx={cx} cy={cy} r="2" fill={SKY} />
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
            <rect x="29" y="7" width="22" height="5" rx="1.2" fill={TINT} />
            <rect x="33" y="8.8" width="14" height="1.4" rx="0.7" fill={SOFT_SKY} />
            <rect x="29" y="14" width="10.5" height="10" rx="1.2" fill={TINT} />
            <circle cx="34.25" cy="19" r="2.8" fill="none" stroke={SOFT_SKY} strokeWidth="1.4" />
            <rect x="40.5" y="14" width="10.5" height="10" rx="1.2" fill={TINT} />
            <rect x="42.5" y="19" width="1.6" height="3.5" rx="0.4" fill={SOFT_SKY} />
            <rect x="45" y="17" width="1.6" height="5.5" rx="0.4" fill={SOFT_SKY} />
            <rect x="47.5" y="18" width="1.6" height="4.5" rx="0.4" fill={SOFT_SKY} />
            <rect x="29" y="26" width="22" height="9" rx="1.2" fill={TINT} />
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
    case 'blank-logo':
      // One empty square artboard: centre guides and a ring where the mark goes, a faint wordmark under it. Hover
      // story: the ring lights up.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={21} y={6} width={38} height={38} />
          <path d="M40 9 V41 M24 22 H56" stroke={GUIDE} strokeWidth="0.5" strokeDasharray="1.2 1" />
          <circle
            className="pv-pulse"
            cx="40"
            cy="22"
            r="8"
            fill={TINT}
            stroke={SOFT_SKY}
            strokeWidth="0.8"
            strokeDasharray="1.6 1.2"
            style={pv({ '--pv-at': '500ms' })}
          />
          <rect x="33" y="35" width="14" height="1.8" rx="0.9" fill={LINE} />
          <Plus cx={40} cy={22} />
        </svg>
      );
    default:
      return null;
  }
}
