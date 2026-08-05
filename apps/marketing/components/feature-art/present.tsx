// Feature art for the landing page's "Presentation tools built right in"
// section (spec/16, spec/31). Small stills, drawn from the same primitives as
// every other art block so the page reads as one hand.
//
// Each one shows the IDEA rather than a screenshot: a deck of slides built
// from a diagram, one slide filling a screen, notes only the presenter opens,
// the fact that nobody else is dragged along, and the board tilted into 3D.

import { BLUE_FILL, BLUE_STROKE, Frame, SKY } from './shared';

const SLATE_FILL = '#eef2f7';
const SLATE_STROKE = '#cbd5e1';

/** A diagram on the left, the slides it was cut into stacked on the right. */
export function SlideDeckArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* The diagram: four boxes and their connectors. */}
        <g opacity="0.75">
          <rect
            x="14"
            y="16"
            width="34"
            height="15"
            rx="4"
            fill={SLATE_FILL}
            stroke={SLATE_STROKE}
            strokeWidth="1.5"
          />
          <rect
            x="14"
            y="42"
            width="34"
            height="15"
            rx="4"
            fill={BLUE_FILL}
            stroke={BLUE_STROKE}
            strokeWidth="1.5"
          />
          <rect
            x="14"
            y="68"
            width="34"
            height="15"
            rx="4"
            fill={SLATE_FILL}
            stroke={SLATE_STROKE}
            strokeWidth="1.5"
          />
          <path
            d="M31 31v11M31 57v11"
            stroke={SLATE_STROKE}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>

        {/* Three slides cut from it, the middle one selected. */}
        <g>
          <rect
            x="78"
            y="12"
            width="58"
            height="34"
            rx="4"
            fill="#fff"
            stroke={SLATE_STROKE}
            strokeWidth="1.5"
          />
          <rect x="88" y="22" width="24" height="10" rx="2.5" fill={SLATE_FILL} />

          <rect
            x="90"
            y="34"
            width="58"
            height="34"
            rx="4"
            fill="#fff"
            stroke={BLUE_STROKE}
            strokeWidth="2"
          />
          <rect x="100" y="44" width="24" height="10" rx="2.5" fill={BLUE_FILL} />

          <rect
            x="102"
            y="56"
            width="58"
            height="34"
            rx="4"
            fill="#fff"
            stroke={SLATE_STROKE}
            strokeWidth="1.5"
          />
          <rect x="112" y="66" width="24" height="10" rx="2.5" fill={SLATE_FILL} />
        </g>

        {/* The order they run in. */}
        <g fill={BLUE_STROKE} fontSize="8" fontWeight="600">
          <text x="172" y="26">
            1
          </text>
          <text x="172" y="48">
            2
          </text>
          <text x="172" y="70">
            3
          </text>
        </g>
      </svg>
    </Frame>
  );
}

/** One slide filling the screen, with the position counter. */
export function FullScreenSlideArt() {
  return (
    <Frame>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect x="8" y="8" width="204" height="80" rx="6" fill="#0f172a" />
        {/* The slide's content, big. */}
        <rect
          x="52"
          y="28"
          width="52"
          height="26"
          rx="4"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        <rect
          x="124"
          y="28"
          width="52"
          height="26"
          rx="4"
          fill="#e2e8f0"
          stroke={SLATE_STROKE}
          strokeWidth="2"
        />
        <path
          d="M104 41h20"
          stroke={BLUE_STROKE}
          strokeWidth="2"
          strokeLinecap="round"
          markerEnd=""
        />
        <path d="M118 37l6 4-6 4" fill="none" stroke={BLUE_STROKE} strokeWidth="2" />
        {/* The HUD's counter, top right. */}
        <rect x="160" y="14" width="44" height="12" rx="6" fill="#ffffff" opacity="0.16" />
        <text x="168" y="23" fill="#ffffff" fontSize="8" fontWeight="600" opacity="0.9">
          3 / 12
        </text>
      </svg>
    </Frame>
  );
}

/** The notes only the presenter opens. */
export function PresenterNotesArt() {
  return (
    <Frame>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect x="8" y="8" width="204" height="80" rx="6" fill="#0f172a" />
        <rect
          x="26"
          y="28"
          width="60"
          height="30"
          rx="4"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        {/* The notes card, hanging off the HUD. */}
        <rect x="112" y="20" width="88" height="56" rx="5" fill="#ffffff" opacity="0.12" />
        <g fill="#ffffff" opacity="0.55">
          <rect x="120" y="30" width="70" height="4" rx="2" />
          <rect x="120" y="40" width="62" height="4" rx="2" />
          <rect x="120" y="50" width="66" height="4" rx="2" />
          <rect x="120" y="60" width="40" height="4" rx="2" />
        </g>
        <circle cx="196" cy="26" r="3.5" fill={SKY} />
      </svg>
    </Frame>
  );
}

/** Your screen runs the deck; everyone else keeps working. */
export function PresentLocallyArt() {
  return (
    <Frame>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* Yours: presenting. */}
        <rect x="14" y="20" width="86" height="56" rx="6" fill="#0f172a" />
        <rect
          x="34"
          y="38"
          width="46"
          height="20"
          rx="3"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        <text x="14" y="14" fill="#64748b" fontSize="8" fontWeight="600">
          You
        </text>

        {/* Theirs: the ordinary diagram, untouched. */}
        <text x="122" y="14" fill="#64748b" fontSize="8" fontWeight="600">
          Everyone else
        </text>
        <rect
          x="120"
          y="20"
          width="86"
          height="56"
          rx="6"
          fill="#fff"
          stroke={SLATE_STROKE}
          strokeWidth="1.5"
        />
        <g opacity="0.85">
          <rect
            x="132"
            y="30"
            width="28"
            height="12"
            rx="3"
            fill={SLATE_FILL}
            stroke={SLATE_STROKE}
            strokeWidth="1.2"
          />
          <rect
            x="168"
            y="30"
            width="26"
            height="12"
            rx="3"
            fill={SLATE_FILL}
            stroke={SLATE_STROKE}
            strokeWidth="1.2"
          />
          <rect
            x="132"
            y="52"
            width="28"
            height="12"
            rx="3"
            fill={BLUE_FILL}
            stroke={BLUE_STROKE}
            strokeWidth="1.2"
          />
          <path
            d="M146 42v10M181 42v10"
            stroke={SLATE_STROKE}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </Frame>
  );
}

/** The canvas tipped onto an angle, its layers lifted apart. */
export function IsometricArt() {
  return (
    <Frame>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* Three layers as isometric planes, each lifted above the last, so
            the depth is the point rather than the boxes. */}
        <g strokeLinejoin="round" strokeWidth="1.5">
          <path
            d="M40 74 110 92 180 74 110 56Z"
            fill={SLATE_FILL}
            stroke={SLATE_STROKE}
            opacity="0.85"
          />
          <path
            d="M40 58 110 76 180 58 110 40Z"
            fill="#e0f2fe"
            stroke={BLUE_STROKE}
            opacity="0.9"
          />
          <path d="M40 42 110 60 180 42 110 24Z" fill={BLUE_FILL} stroke={BLUE_STROKE} />
        </g>
        {/* Two elements standing on the top plane, to say the content is
            unchanged — only the way you are looking at it. */}
        <g strokeWidth="1.4" strokeLinejoin="round">
          <path d="M86 38 104 43 104 33 86 28Z" fill="#fff" stroke={BLUE_STROKE} />
          <path d="M120 44 138 39 138 29 120 34Z" fill="#fff" stroke={BLUE_STROKE} />
        </g>
        {/* The orbit handle. */}
        <g stroke={SKY} strokeWidth="1.6" fill="none" strokeLinecap="round">
          <path d="M188 20a10 10 0 1 0 6 4" />
          <path d="M188 14v6h6" />
        </g>
      </svg>
    </Frame>
  );
}
