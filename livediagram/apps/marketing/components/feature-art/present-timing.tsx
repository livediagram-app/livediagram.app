// The presenter's clock (docs/specs/012-collaboration/presentation-mode.md): a talk kept to time while
// presenting a slide deck.

import { YOU } from '@/components/art-tokens';
import { HAIRLINE, PANEL, SHADOW, Scene, TEXT_BODY, TEXT_MUTED, TEXT_STRONG } from './canvas-marks';
import { Pill } from './mode-parts';
import { AMBER, Frame, SKY } from './shared';

// Keeping time: the presenter's corner while a slide is up, the elapsed time counting and this
// slide's budget gone amber as it runs over, beside the slide itself.
export function SlideTimingArt() {
  return (
    <Frame>
      <Scene>
        {/* The slide, full screen. */}
        <rect className="fill-slate-900" x="10" y="8" width="160" height="80" rx="3" />
        <text x="22" y="30" fontSize="9" fontWeight="800" fill="#fff">
          Q3 results
        </text>
        {[24, 40, 32, 52].map((h, i) => (
          <rect
            key={i}
            x={26 + i * 20}
            y={80 - h}
            width="12"
            height={h}
            rx="1"
            fill={SKY}
            fillOpacity={0.5 + i * 0.15}
          />
        ))}
        <text x="164" y="83" fontSize="5" fill="#94a3b8" textAnchor="end">
          4 / 12
        </text>
        {/* The readouts. */}
        <g className={SHADOW}>
          <rect className={PANEL} x="184" y="16" width="104" height="64" rx="5" strokeWidth="0.8" />
        </g>
        <text className={TEXT_MUTED} x="192" y="30" fontSize="5" fontWeight="700">
          ELAPSED
        </text>
        <text className={TEXT_STRONG} x="280" y="30" fontSize="7" fontWeight="700" textAnchor="end">
          12:40
        </text>
        <line className={HAIRLINE} x1="192" x2="280" y1="38" y2="38" strokeWidth="0.8" />
        <text className={TEXT_MUTED} x="192" y="50" fontSize="5" fontWeight="700">
          THIS SLIDE
        </text>
        <g className="fa-d-ring">
          <Pill x={240} y={44} text="4:20 / 4:00" tone="amber" w={42} />
        </g>
        <rect
          className="fill-slate-100 dark:fill-slate-700"
          x="192"
          y="60"
          width="88"
          height="4"
          rx="2"
        />
        <rect x="192" y="60" width="88" height="4" rx="2" fill={AMBER} />
        <circle cx="194" cy="73" r="2.4" fill={YOU} />
        <text className={TEXT_BODY} x="200" y="75" fontSize="5">
          Only you see these
        </text>
      </Scene>
    </Frame>
  );
}
