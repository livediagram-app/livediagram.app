import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { pv } from '@liveworkspace/template-previews/motion';

// Group 25: the Value Proposition Canvas (docs/specs/008-canvas/canvas-and-palette.md "Templates"), drawn small as it
// opens, with a hover story of what the template does.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const INK = 'rgb(15 23 42)';
const MUTED = 'rgb(148 163 184)';
const LINE = 'rgb(100 116 139)';
const PAPER = 'white';

// A short bar standing for a line of text.
const Bar = ({
  x,
  y,
  w,
  fill = MUTED,
  h = 1,
}: {
  x: number;
  y: number;
  w: number;
  fill?: string;
  h?: number;
}) => <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} />;

export function templatePreviewGroup25(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'value-proposition-canvas':
      // The Value Map square split into products, gain creators and pain relievers, the Customer Profile circle
      // split into gains, pains and jobs, stickies in each section's hue, and the session rail. Hover story: a fit
      // line draws from a pain reliever to the pain it kills.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="2"
            y="4"
            width="10"
            height="42"
            rx="1"
            fill="rgb(248 250 252)"
            stroke={MUTED}
            strokeWidth="0.25"
          />
          {[7, 15, 23].map((y) => (
            <g key={y}>
              <circle cx="4.4" cy={y} r="1" fill="rgb(99 102 241)" />
              <Bar x={6} y={y - 0.4} w={4.4} h={0.8} />
            </g>
          ))}
          <circle cx="7" cy="33" r="3" fill="none" stroke={LINE} strokeWidth="0.5" />
          <rect x="3.5" y="39" width="7" height="4" rx="0.8" fill="rgb(245 158 11)" />
          <rect
            x="15"
            y="9"
            width="28"
            height="32"
            rx="0.6"
            fill={PAPER}
            stroke={INK}
            strokeWidth="0.5"
          />
          <line x1="29" y1="9" x2="29" y2="41" stroke={INK} strokeWidth="0.4" />
          <line x1="29" y1="25" x2="43" y2="25" stroke={INK} strokeWidth="0.4" />
          <circle cx="63" cy="25" r="15" fill={PAPER} stroke={INK} strokeWidth="0.5" />
          <path d="M68 10.9 L68 39.1 M48 25 L68 25" stroke={INK} strokeWidth="0.4" />
          {[
            [17, 12, 'rgb(199 210 254)'],
            [21, 18, 'rgb(199 210 254)'],
            [17, 28, 'rgb(199 210 254)'],
            [31, 12, 'rgb(187 247 208)'],
            [36, 17, 'rgb(187 247 208)'],
            [31, 28, 'rgb(254 205 211)'],
            [36, 33, 'rgb(254 205 211)'],
            [55, 14, 'rgb(187 247 208)'],
            [60, 18, 'rgb(187 247 208)'],
            [53, 28, 'rgb(254 205 211)'],
            [58, 32, 'rgb(254 205 211)'],
            [70, 17, 'rgb(253 230 138)'],
            [70, 24, 'rgb(253 230 138)'],
            [70, 31, 'rgb(253 230 138)'],
          ].map(([x, y, fill]) => (
            <rect
              key={`${x}-${y}`}
              x={x as number}
              y={y as number}
              width="5.4"
              height="4.4"
              rx="0.4"
              fill={fill as string}
            />
          ))}
          <path
            className="pv-draw"
            pathLength="1"
            d="M41.4 30 Q48 34 53 30.4"
            fill="none"
            stroke="rgb(190 18 60)"
            strokeWidth="0.55"
            strokeDasharray="1 0.6"
            style={pv({ '--pv-at': '700ms', '--pv-dur': '800ms' })}
          />
          <path
            className="pv-draw"
            pathLength="1"
            d="M41.4 19 Q48 14 55 16"
            fill="none"
            stroke="rgb(21 128 61)"
            strokeWidth="0.55"
            strokeDasharray="1 0.6"
            style={pv({ '--pv-at': '1500ms', '--pv-dur': '800ms' })}
          />
        </svg>
      );
    default:
      return null;
  }
}
