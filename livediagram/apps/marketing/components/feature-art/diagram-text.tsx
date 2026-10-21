// Feature illustrations: Markdown and Mermaid coming in as diagrams, split from ./versatility-more.
// Same stage and motion as the rest of the versatility cards.

import { Frame } from './shared';
import {
  ArrowHead,
  HAIRLINE,
  LINK,
  MONO,
  MUTED_TEXT,
  Node,
  PANEL,
  PANEL_TEXT,
  STAGE,
  delay,
} from './versatility-parts';

/* ──────────────── Markdown and Mermaid ──────────────── */

// A code card: its file name, then its lines in mono, each line [indent, text, highlight?].
function SourceCard({
  name,
  lines,
  size = 6.4,
}: {
  name: string;
  lines: [number, string, boolean?][];
  size?: number;
}) {
  return (
    <g>
      <rect className={PANEL} x="10" y="6" width="108" height="84" rx="6" strokeWidth="1" />
      <path className={HAIRLINE} d="M10 17 H118" strokeWidth="0.8" />
      <circle className="fill-rose-400" cx="16" cy="11.5" r="1.4" />
      <circle className="fill-amber-400" cx="20.5" cy="11.5" r="1.4" />
      <circle className="fill-emerald-400" cx="25" cy="11.5" r="1.4" />
      <text
        className={MUTED_TEXT}
        x="112"
        y="13.6"
        fontSize="5.6"
        fontWeight="600"
        textAnchor="end"
        style={{ fontFamily: MONO }}
      >
        {name}
      </text>
      {lines.map(([indent, text, hi], i) => (
        <text
          key={i}
          className={hi ? 'fill-brand-600 dark:fill-brand-300' : PANEL_TEXT}
          x={17 + indent * 8}
          y={28 + i * 10}
          fontSize={size}
          fontWeight={hi ? 700 : 500}
          style={{ fontFamily: MONO }}
        >
          {text}
        </text>
      ))}
    </g>
  );
}

// The arrow from the source to what it became.
function ImportArrow() {
  return (
    <g>
      <circle className="fill-brand-500" cx="132" cy="48" r="7" />
      <path
        d="M129.3 48 H134.7 M132.4 45.3 L135.1 48 L132.4 50.7"
        stroke="#fff"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

// Markdown import: an outline from your notes on the left, and the themed node-link tree it lands
// as on the right, each node arriving in turn.
export function MarkdownImportArt() {
  const children: [string, number, 'violet' | 'emerald' | 'amber', string][] = [
    ['Design', 10, 'violet', 'Wireframes'],
    ['Build', 38, 'emerald', 'API'],
    ['Ship', 66, 'amber', 'Announce'],
  ];
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        <SourceCard
          name="launch.md"
          lines={[
            [0, '# Launch', true],
            [0, '- Design'],
            [1, '- Wireframes'],
            [0, '- Build'],
            [1, '- API'],
            [0, '- Ship'],
            [1, '- Announce'],
          ]}
        />
        <ImportArrow />
        {children.map(([label, y, tone, leaf], i) => (
          <g key={label} className="fa-pop" style={delay(0.4 + i * 0.3)}>
            <path
              className={LINK}
              d={`M188 48 C 196 48, 196 ${y + 9}, 204 ${y + 9}`}
              fill="none"
              strokeWidth="1.2"
            />
            <Node x={204} y={y} w={38} h={18} label={label} tone={tone} size={6.6} />
            <path className={LINK} d={`M242 ${y + 9} H248`} strokeWidth="1.2" />
            <Node x={248} y={y + 2} w={42} h={14} label={leaf} tone={tone} size={5.8} />
          </g>
        ))}
        <g className="fa-pop">
          <Node x={148} y={38} w={40} h={20} label="Launch" tone="sky" shape="pill" size={7.4} />
        </g>
      </svg>
    </Frame>
  );
}

// Mermaid: flowchart text on the left, and the graph it lays out on the right, every connection
// kept, the decision's "no" looping back to the start.
export function MermaidArt() {
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        <defs>
          <ArrowHead id="fac-mmd-head" />
        </defs>
        <SourceCard
          name="flow.mmd"
          size={6}
          lines={[
            [0, 'flowchart LR', true],
            [0, 'A[Cart] --> B{Paid?}'],
            [0, 'B -->|yes| C[Ship]'],
            [0, 'B -->|no| A'],
          ]}
        />
        <ImportArrow />
        <g className="fa-pop">
          <Node x={150} y={28} w={36} h={20} label="Cart" tone="sky" size={7} />
        </g>
        <g className="fa-pop" style={delay(0.3)}>
          <Node
            x={198}
            y={18}
            w={44}
            h={40}
            label="Paid?"
            tone="amber"
            shape="diamond"
            size={6.8}
          />
        </g>
        <g className="fa-pop" style={delay(0.6)}>
          <Node x={256} y={28} w={34} h={20} label="Ship" tone="emerald" size={7} />
        </g>
        <g className="fa-pop" style={delay(0.9)}>
          <path
            className={LINK}
            d="M186 38 H197"
            strokeWidth="1.2"
            markerEnd="url(#fac-mmd-head)"
          />
          <path
            className={LINK}
            d="M242 38 H255"
            strokeWidth="1.2"
            markerEnd="url(#fac-mmd-head)"
          />
          <text
            className={MUTED_TEXT}
            x="248.5"
            y="33"
            fontSize="5.6"
            fontWeight="600"
            textAnchor="middle"
          >
            yes
          </text>
          <path
            className={LINK}
            d="M220 58 C 220 84, 168 84, 168 49.5"
            fill="none"
            strokeWidth="1.2"
            markerEnd="url(#fac-mmd-head)"
          />
          <rect className="fill-(--art-paper)" x="187" y="74.5" width="14" height="9" rx="2" />
          <text
            className={MUTED_TEXT}
            x="194"
            y="81"
            fontSize="5.6"
            fontWeight="600"
            textAnchor="middle"
          >
            no
          </text>
        </g>
      </svg>
    </Frame>
  );
}
