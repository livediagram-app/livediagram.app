import type { ReactElement } from 'react';
import type { TemplateKind } from '@livedesign/templates';
import { pv } from './motion';

// Group 20: the blanks of a page kind (docs/specs/007-editor/start-diagramming.md "Recommended and groups"): Blank
// Logo and Photo Edit. Each draws its one empty page in its own proportions (the square artboard, a landscape
// photo) with the dashed edge, faint guides and sky "+" of Blank
// Illustration's page, so the Pages blanks read as a set. Hover story: the guides light up, what the page is for.
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
    case 'photo-edit':
      // One photo page, its picture still to come: the checkerboard with hills and a sun on it, a layer stack in its
      // corner. Hover story: the sun lights up.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Page x={12} y={8} width={56} height={34} />
          <path
            d="M14 38 L28 26 L38 33 L48 24 L66 38 Z"
            fill={TINT}
            stroke={SOFT_SKY}
            strokeWidth="0.8"
          />
          <circle
            className="pv-pulse"
            cx="56"
            cy="16"
            r="3.5"
            fill={TINT}
            stroke={SOFT_SKY}
            strokeWidth="0.8"
            style={pv({ '--pv-at': '500ms' })}
          />
          <rect x="16" y="12" width="10" height="1.8" rx="0.9" fill={LINE} />
          <rect x="16" y="15" width="10" height="1.8" rx="0.9" fill={SOFT_SKY} />
          <Plus cx={40} cy={25} />
        </svg>
      );
    default:
      return null;
  }
}
