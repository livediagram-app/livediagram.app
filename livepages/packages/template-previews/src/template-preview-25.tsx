import type { ReactElement } from 'react';
import type { TemplateKind } from '@livepages/templates';
import { pv } from './motion';

// Group 25: Working Backwards (docs/specs/008-canvas/canvas-and-palette.md "Templates"), drawn small as it opens,
// with a hover story of what the template does.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const INK = 'rgb(15 23 42)';
const MUTED = 'rgb(148 163 184)';
const LINE = 'rgb(100 116 139)';
const PAPER = 'white';

export function templatePreviewGroup25(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'working-backwards':
      // An A4 article page in the Report look: a headline and subheading, the dated opening paragraph, a quote with
      // its accent rule, and the FAQs' questions in bold, a second page behind it. Hover story: the press release
      // writes itself, line by line.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="31"
            y="3.4"
            width="31"
            height="44"
            rx="0.8"
            fill="rgb(241 245 249)"
            stroke={MUTED}
            strokeWidth="0.3"
          />
          <rect
            x="18"
            y="2"
            width="31"
            height="46"
            rx="0.8"
            fill={PAPER}
            stroke={MUTED}
            strokeWidth="0.3"
          />
          <rect x="21" y="5" width="25" height="2.4" rx="0.5" fill={INK} />
          <rect x="21" y="8.4" width="18" height="1.4" rx="0.4" fill={LINE} />
          <line x1="21" y1="11.6" x2="46" y2="11.6" stroke="rgb(37 99 235)" strokeWidth="0.35" />
          {[13.6, 15.4, 17.2, 19].map((y, i) => (
            <rect
              key={y}
              className="pv-grow-x"
              x="21"
              y={y}
              width={i === 3 ? 15 : 25}
              height="0.9"
              rx="0.45"
              fill={MUTED}
              style={pv({ '--pv-at': `${400 + i * 250}ms` })}
            />
          ))}
          <rect x="21" y="21.6" width="9" height="1.4" rx="0.4" fill="rgb(30 64 175)" />
          {[24.2, 26].map((y, i) => (
            <rect
              key={y}
              className="pv-grow-x"
              x="21"
              y={y}
              width={i ? 19 : 25}
              height="0.9"
              rx="0.45"
              fill={MUTED}
              style={pv({ '--pv-at': `${1400 + i * 250}ms` })}
            />
          ))}
          <rect x="21" y="28.6" width="0.8" height="5" fill="rgb(37 99 235)" />
          <rect x="23" y="29.2" width="21" height="0.9" rx="0.45" fill={LINE} />
          <rect x="23" y="31" width="18" height="0.9" rx="0.45" fill={LINE} />
          <rect x="23" y="32.8" width="10" height="0.9" rx="0.45" fill="rgb(37 99 235)" />
          <rect x="21" y="36" width="11" height="1.4" rx="0.4" fill="rgb(30 64 175)" />
          {[38.8, 40.6, 42.4].map((y, i) => (
            <rect
              key={y}
              x="21"
              y={y}
              width={[25, 22, 14][i]}
              height="0.9"
              rx="0.45"
              fill={MUTED}
            />
          ))}
          <rect x="52" y="7" width="7" height="1.2" rx="0.4" fill={INK} />
          {[10, 14, 18].map((y) => (
            <g key={y}>
              <rect x="52" y={y} width="8" height="1" rx="0.4" fill="rgb(30 64 175)" />
              <rect x="52" y={y + 1.8} width="8" height="0.7" rx="0.35" fill={MUTED} />
            </g>
          ))}
        </svg>
      );
    default:
      return null;
  }
}
