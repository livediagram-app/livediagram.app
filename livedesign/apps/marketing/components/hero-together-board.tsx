import { capBandBaselineY } from '@liveworkspace/icons';
import { FONT, TEAMMATE, YOU, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';

// The Collaborate window (docs/specs/019-marketing/marketing-site.md "Story beats"): two people on
// one page at once. A phone wireframe page lands; you write its headline while a teammate arrives, selects
// the picture's placeholder (their colour glowing round it, their initials in its corner) and leaves a
// comment that opens as a thread beside the page; you reply, and an action is handed to them. Every piece
// plays at its own --d (hero-scenes/pages.css).

const INK = '#1e293b';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const WIRE = '#cbd5e1';
const SKY = '#0ea5e9';
const VIOLET = '#8b5cf6';

// The phone's frame, in canvas units: a screen the shape of an iPhone's.
const PHONE = { w: 170, h: 330 };

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
  const pad = 16;
  const inner = PHONE.w - pad * 2;
  const pic = { x: x + pad, y: y + 112, w: inner, h: 96 };
  return (
    <g>
      <text x={x} y={y - 8} fontFamily={FONT} fontSize="9" fontWeight="600" fill={MUTED}>
        Home · Phone
      </text>
      <rect
        className="hm-pop"
        style={at(0.2)}
        x={x}
        y={y}
        width={PHONE.w}
        height={PHONE.h}
        rx="22"
        fill="#ffffff"
        stroke={INK}
        strokeWidth="3"
      />
      {/* The island and the status bar. */}
      <rect x={x + PHONE.w / 2 - 22} y={y + 10} width="44" height="10" rx="5" fill={INK} />
      <text
        className="hm-type"
        style={at(0.8, { '--steps': 13 })}
        x={x + pad}
        y={y + 56}
        fontFamily={FONT}
        fontSize="16"
        fontWeight="800"
        fill={INK}
      >
        Spring launch
      </text>
      <g className="hm-fade" style={at(1.5)}>
        <Lines x={x + pad} y={y + 70} w={inner} count={3} />
      </g>
      {/* The picture's placeholder the teammate selects, crossed as a wireframe draws one. */}
      <g className="hm-fade" style={at(2.2)}>
        <rect
          x={pic.x}
          y={pic.y}
          width={pic.w}
          height={pic.h}
          rx="6"
          fill="#f8fafc"
          stroke={WIRE}
        />
        <path
          d={`M${pic.x} ${pic.y}L${pic.x + pic.w} ${pic.y + pic.h}M${pic.x + pic.w} ${pic.y}L${pic.x} ${pic.y + pic.h}`}
          stroke={WIRE}
          strokeWidth="1.2"
        />
      </g>
      <g className="hm-fade" style={at(2.6)}>
        <Lines x={x + pad} y={y + 222} w={inner} count={2} />
      </g>
      <g className="hm-pop" style={at(2.9)}>
        <rect x={x + pad} y={y + 252} width={inner} height="28" rx="14" fill={SKY} />
        <text
          x={x + PHONE.w / 2}
          y={y + 270}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="10"
          fontWeight="700"
          fill="#ffffff"
        >
          Get started
        </text>
      </g>
      <rect x={x + PHONE.w / 2 - 30} y={y + PHONE.h - 12} width="60" height="4" rx="2" fill={INK} />
      {/* Their selection: their colour round it and their initials in its corner. */}
      <g className="hm-fade" style={at(4.2)}>
        <rect
          x={pic.x - 4}
          y={pic.y - 4}
          width={pic.w + 8}
          height={pic.h + 8}
          rx="8"
          fill="none"
          stroke={TEAMMATE}
          strokeWidth="2"
        />
        <rect x={pic.x + pic.w - 14} y={pic.y - 12} width="20" height="12" rx="3" fill={TEAMMATE} />
        <text
          x={pic.x + pic.w - 4}
          // The letters centre on their cap band (optical-alignment.md "SVG text centres on its cap band too").
          y={capBandBaselineY(pic.y - 6, 7.5)}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="7.5"
          fontWeight="700"
          fill="#ffffff"
        >
          JR
        </text>
      </g>
      {/* The comment badge on the picture. */}
      <g className="hm-pop" style={at(5.2)}>
        <circle cx={pic.x + pic.w + 4} cy={pic.y + 18} r="9" fill={TEAMMATE} />
        <text
          x={pic.x + pic.w + 4}
          // The numeral centres on its cap band (optical-alignment.md "SVG text centres on its cap band too").
          y={capBandBaselineY(pic.y + 18, 9)}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="9"
          fontWeight="700"
          fill="#ffffff"
        >
          1
        </text>
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
        // The initials centre on their cap band (optical-alignment.md "SVG text centres on its cap band too").
        y={capBandBaselineY(y + 9, 7.5)}
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
        text="Can the photo run edge to edge?"
        d={5.8}
      />
      <Message x={x + 14} y={y + 62} colour={YOU} who="TM" text="Yes, widening it now." d={6.8} />
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
          Swap in the final photo by Friday
        </text>
      </g>
    </g>
  );
}

export function TogetherBoard() {
  const page = { x: 90, y: -40 };
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
          '--cx': `${page.x + 130}px`,
          '--cy': `${page.y + 50}px`,
        })}
      >
        <CursorMark colour={YOU} label="TM" />
      </g>
      {/* The teammate, arriving on the picture. */}
      <g
        className="hm-cursor"
        style={at(3.4, {
          '--sx': '640px',
          '--sy': '300px',
          '--cx': `${page.x + 110}px`,
          '--cy': `${page.y + 170}px`,
        })}
      >
        <CursorMark colour={TEAMMATE} label="JR" />
      </g>
    </>
  );
}
