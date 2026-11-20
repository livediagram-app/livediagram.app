import { lucideSparkles } from '@liveworkspace/icons/lucide';
import { FONT, at } from '@/components/art-tokens';
import {
  CONTENT,
  InfoFooter,
  InfoIcon,
  InfoSheet,
  MARGIN,
  NAVY,
  SHEET,
} from './hero-infographic-parts';

// Page 1 of the hero's Infographic window, the Year in Review template's cover: a deep navy page
// on which the studio's mark, the year set huge, the title and its line land in turn, then a
// harbour picture at dusk wipes in and a sparkle sticker is pressed on the corner.

const SKY_TOP = '#1e3a8a';
const DUSK = '#f59e0b';

export function CoverPage({ x, y, of }: { x: number; y: number; of: number }) {
  const left = x + MARGIN;
  const pic = { x: left, y: y + 172, w: CONTENT, h: 92 };
  return (
    <InfoSheet x={x} y={y} name="Cover" n={1} of={of} dark>
      {/* Two soft rings of light behind the year, the cover's only ornament. */}
      <g className="hm-fade" style={at(0.2)}>
        <svg x={x} y={y} width={SHEET.w} height={SHEET.h} overflow="hidden">
          <circle cx={SHEET.w - 20} cy={40} r="70" fill="#38bdf8" opacity="0.08" />
          <circle cx={SHEET.w - 4} cy={18} r="38" fill="#2dd4bf" opacity="0.1" />
        </svg>
      </g>

      {/* The studio's mark. */}
      <g className="hm-pop" style={at(0.5)}>
        <circle cx={left + 6} cy={y + 22} r="6" fill="#2dd4bf" />
        <circle cx={left + 6} cy={y + 22} r="2.4" fill={NAVY} />
        <text
          x={left + 17}
          y={y + 24.5}
          fontFamily={FONT}
          fontSize="6.5"
          fontWeight="800"
          letterSpacing="1"
          fill="white"
        >
          HARBOUR STUDIO
        </text>
      </g>

      {/* The year, the cover's headline. */}
      <text
        className="hm-pop"
        style={at(0.8)}
        x={left - 2}
        y={y + 104}
        fontFamily={FONT}
        fontSize="58"
        fontWeight="800"
        letterSpacing="-2.5"
        fill="white"
      >
        2026
      </text>
      <g className="hm-pop" style={at(1.15)}>
        <text x={left} y={y + 128} fontFamily={FONT} fontSize="15" fontWeight="800" fill="#5eead4">
          Our Year in Review
        </text>
        <text x={left} y={y + 144} fontFamily={FONT} fontSize="7" fill="#cbd5e1">
          Forty-two projects, our first app, two new
        </text>
        <text x={left} y={y + 154} fontFamily={FONT} fontSize="7" fill="#cbd5e1">
          faces and a lot of good coffee.
        </text>
      </g>

      {/* The picture: the harbour at dusk, its sky, sun, hills and water. */}
      <g className="hm-wipe" style={at(1.6)}>
        <svg
          x={pic.x}
          y={pic.y}
          width={pic.w}
          height={pic.h}
          viewBox="0 0 180 92"
          overflow="hidden"
        >
          <rect width="180" height="92" rx="4" fill={SKY_TOP} />
          <rect y="30" width="180" height="62" fill="#7c3aed" opacity="0.55" />
          <rect y="48" width="180" height="44" fill="#fb7185" opacity="0.55" />
          <circle cx="122" cy="54" r="15" fill="#fde68a" />
          <circle cx="122" cy="54" r="22" fill={DUSK} opacity="0.25" />
          <path d="M0 62 Q28 44 56 58 T112 56 T180 52 V92 H0 Z" fill="#312e81" />
          <path d="M0 70 Q40 58 84 68 T180 64 V92 H0 Z" fill="#1e1b4b" />
          <rect y="74" width="180" height="18" fill="#0f172a" />
          {[80, 84, 88].map((wy, i) => (
            <line
              key={wy}
              x1={96 + i * 6}
              y1={wy}
              x2={148 - i * 6}
              y2={wy}
              stroke="#fde68a"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity={0.7 - i * 0.2}
            />
          ))}
          {/* A boat on the water. */}
          <path d="M36 78 h22 l-4 5 h-14 z" fill="#0b1120" />
          <path d="M47 77 V62 l9 13 z" fill="#e2e8f0" />
        </svg>
      </g>

      {/* The sticker: a sparkle on a white tile, pressed on at a tilt. */}
      <g className="hm-pop" style={at(2.1)}>
        <g transform={`rotate(8 ${x + SHEET.w - 30} ${y + 50})`}>
          <rect
            x={x + SHEET.w - 44}
            y={y + 36}
            width="28"
            height="28"
            rx="7"
            fill="white"
            stroke="#e2e8f0"
            strokeWidth="0.8"
          />
          <InfoIcon
            prims={lucideSparkles}
            x={x + SHEET.w - 39}
            y={y + 41}
            size={18}
            colour="#f59e0b"
            weight={2}
          />
        </g>
      </g>

      <InfoFooter x={x} y={y} n={1} of={of} dark />
    </InfoSheet>
  );
}
