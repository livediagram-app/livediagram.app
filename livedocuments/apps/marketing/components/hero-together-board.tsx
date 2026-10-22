import { FONT, TEAMMATE, YOU, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';

// The Collaborate window (docs/specs/019-marketing/marketing-site.md "Story beats"): two people on
// one page at once. A one-page brief lands; you write its headline while a teammate arrives, selects
// the chart (their colour glowing round it, their initials in its corner) and leaves a comment that
// opens as a thread beside the page; you reply, and an action is handed to them. Every piece plays at
// its own --d (hero-scenes/pages.css).

const INK = '#1e293b';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SKY = '#0ea5e9';
const VIOLET = '#8b5cf6';

const PAGE = { w: 210, h: 297 };

function Lines({ x, y, w, count }: { x: number; y: number; w: number; count: number }) {
  return (
    <g fill={LINE}>
      {Array.from({ length: count }, (_, i) => (
        <rect key={i} x={x} y={y + i * 9} width={i === count - 1 ? w * 0.6 : w} height="4" rx="2" />
      ))}
    </g>
  );
}

function Page({ x, y }: { x: number; y: number }) {
  const chart = { x: x + 18, y: y + 150, w: PAGE.w - 36, h: 78 };
  const bars = [34, 52, 44, 66];
  return (
    <g>
      <text x={x} y={y - 8} fontFamily={FONT} fontSize="9" fontWeight="600" fill={MUTED}>
        Brief
      </text>
      <rect
        className="hm-pop"
        style={at(0.2)}
        x={x}
        y={y}
        width={PAGE.w}
        height={PAGE.h}
        rx="4"
        fill="#ffffff"
        stroke={LINE}
      />
      <rect
        className="hm-fade"
        style={at(0.5)}
        x={x}
        y={y}
        width={PAGE.w}
        height="8"
        rx="2"
        fill={SKY}
      />
      <text
        className="hm-type"
        style={at(0.8, { '--steps': 14 })}
        x={x + 18}
        y={y + 40}
        fontFamily={FONT}
        fontSize="17"
        fontWeight="800"
        fill={INK}
      >
        Spring launch
      </text>
      <g className="hm-fade" style={at(1.5)}>
        <Lines x={x + 18} y={y + 56} w={PAGE.w - 36} count={4} />
      </g>
      <g className="hm-fade" style={at(1.9)}>
        <Lines x={x + 18} y={y + 100} w={PAGE.w - 36} count={4} />
      </g>
      {/* The chart the teammate selects. */}
      <g className="hm-fade" style={at(2.2)}>
        <rect
          x={chart.x}
          y={chart.y}
          width={chart.w}
          height={chart.h}
          rx="4"
          fill="#f8fafc"
          stroke={LINE}
        />
        {bars.map((h, i) => (
          <rect
            key={i}
            className="hm-grow"
            style={at(2.4 + i * 0.15)}
            x={chart.x + 18 + i * 38}
            y={chart.y + chart.h - 10 - h}
            width="22"
            height={h}
            rx="2"
            fill={i === 3 ? VIOLET : SKY}
          />
        ))}
      </g>
      {/* Their selection: their colour round it and their initials in its corner. */}
      <g className="hm-fade" style={at(4.2)}>
        <rect
          x={chart.x - 4}
          y={chart.y - 4}
          width={chart.w + 8}
          height={chart.h + 8}
          rx="6"
          fill="none"
          stroke={TEAMMATE}
          strokeWidth="2"
        />
        <rect
          x={chart.x + chart.w - 14}
          y={chart.y - 12}
          width="20"
          height="12"
          rx="3"
          fill={TEAMMATE}
        />
        <text
          x={chart.x + chart.w - 4}
          y={chart.y - 3.5}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="7.5"
          fontWeight="700"
          fill="#ffffff"
        >
          JR
        </text>
      </g>
      {/* The comment badge on the chart. */}
      <g className="hm-pop" style={at(5.2)}>
        <circle cx={chart.x + chart.w + 4} cy={chart.y + 18} r="9" fill={TEAMMATE} />
        <text
          x={chart.x + chart.w + 4}
          y={chart.y + 21.5}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="9"
          fontWeight="700"
          fill="#ffffff"
        >
          1
        </text>
      </g>
      <g className="hm-fade" style={at(2.8)}>
        <Lines x={x + 18} y={y + 246} w={PAGE.w - 36} count={3} />
      </g>
    </g>
  );
}

function Message({
  x,
  y,
  colour,
  who,
  text,
  d,
}: {
  x: number;
  y: number;
  colour: string;
  who: string;
  text: string;
  d: number;
}) {
  return (
    <g className="hm-pop" style={at(d)}>
      <circle cx={x + 9} cy={y + 9} r="9" fill={colour} />
      <text
        x={x + 9}
        y={y + 12}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="7.5"
        fontWeight="700"
        fill="#ffffff"
      >
        {who}
      </text>
      <text x={x + 24} y={y + 12} fontFamily={FONT} fontSize="9.5" fill={INK}>
        {text}
      </text>
    </g>
  );
}

function Thread({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <g className="hm-pop" style={at(5.4)}>
        <rect x={x} y={y} width="220" height="150" rx="8" fill="#ffffff" stroke={LINE} />
        <text x={x + 14} y={y + 22} fontFamily={FONT} fontSize="11" fontWeight="700" fill={INK}>
          Comments
        </text>
      </g>
      <Message
        x={x + 14}
        y={y + 34}
        colour={TEAMMATE}
        who="JR"
        text="Can Q2 be its own bar?"
        d={5.8}
      />
      <Message x={x + 14} y={y + 62} colour={YOU} who="TM" text="Yes, splitting it now." d={6.8} />
      {/* The action handed to the teammate. */}
      <g className="hm-pop" style={at(7.6)}>
        <rect
          x={x + 14}
          y={y + 96}
          width="192"
          height="40"
          rx="6"
          fill="#f5f3ff"
          stroke="#ddd6fe"
        />
        <text x={x + 24} y={y + 113} fontFamily={FONT} fontSize="9" fontWeight="700" fill={VIOLET}>
          Action for JR
        </text>
        <text x={x + 24} y={y + 127} fontFamily={FONT} fontSize="9" fill={INK}>
          Check the Q2 numbers by Friday
        </text>
      </g>
    </g>
  );
}

export function TogetherBoard() {
  const page = { x: 70, y: -40 };
  const thread = { x: 330, y: 60 };
  return (
    <>
      <Page x={page.x} y={page.y} />
      <Thread x={thread.x} y={thread.y} />
      {/* You, writing the headline. */}
      <g
        className="hm-cursor"
        style={at(0.6, {
          '--sx': `${page.x - 60}px`,
          '--sy': '320px',
          '--cx': `${page.x + 150}px`,
          '--cy': `${page.y + 34}px`,
        })}
      >
        <CursorMark colour={YOU} label="TM" />
      </g>
      {/* The teammate, arriving on the chart. */}
      <g
        className="hm-cursor"
        style={at(3.4, {
          '--sx': '640px',
          '--sy': '300px',
          '--cx': `${page.x + 150}px`,
          '--cy': `${page.y + 200}px`,
        })}
      >
        <CursorMark colour={TEAMMATE} label="JR" />
      </g>
    </>
  );
}
