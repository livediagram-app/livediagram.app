// Feature illustrations for Pages mode's pages beyond layouts (docs/specs/007-editor/pages-mode.md):
// a live window onto another tab, the Contents sidebar, and a talk kept to time while presenting.

import { YOU } from '@/components/art-tokens';
import {
  ARROW,
  HAIRLINE,
  INK,
  INK_TEXT,
  PANEL,
  SHADOW,
  Scene,
  TEXT_BODY,
  TEXT_MUTED,
  TEXT_STRONG,
} from './canvas-marks';
import { Pill } from './mode-parts';
import { AMBER, Frame, SKY, VIOLET } from './shared';

/** A page as the canvas shows it: a white sheet with a soft shadow. */
function Sheet({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g className={SHADOW}>
      <rect className="fill-white dark:fill-slate-800" x={x} y={y} width={w} height={h} rx="1.5" />
    </g>
  );
}

// Tab window: a page holding a window onto the Logo tab, and that tab beside it, the dot just added
// to the mark on the tab appearing in the window too.
export function TabWindowArt() {
  const logo = (s: number, late: boolean) => (
    <g>
      <circle
        className={INK}
        cx={14 * s}
        cy={12 * s}
        r={10 * s}
        fill="none"
        strokeWidth={2.6 * s}
      />
      <g
        className={late ? 'fa-d-land' : undefined}
        style={late ? { animationDelay: '0.6s' } : undefined}
      >
        <circle cx={14 * s} cy={12 * s} r={3.6 * s} fill={VIOLET} />
      </g>
      <text className={INK_TEXT} x={30 * s} y={15 * s} fontSize={8 * s} fontWeight="800">
        Bloom
      </text>
    </g>
  );
  return (
    <Frame canvas>
      <Scene>
        {/* The page, its title and the window. */}
        <Sheet x={10} y={10} w={136} h={76} />
        <text className={TEXT_STRONG} x="18" y="24" fontSize="7" fontWeight="800">
          Brand sheet
        </text>
        <rect
          x="18"
          y="30"
          width="120"
          height="50"
          rx="2"
          className="fill-(--art-paper) stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="0.7"
          strokeDasharray="2 1.5"
        />
        <text className={TEXT_MUTED} x="22" y="37" fontSize="4.6" fontWeight="700">
          Logo
        </text>
        <g transform="translate(48 44)">{logo(1, true)}</g>
        {/* The tab itself. */}
        <text className={TEXT_MUTED} x="170" y="18" fontSize="5" fontWeight="700">
          LOGO TAB
        </text>
        <g transform="translate(176 32)">{logo(1.5, true)}</g>
        <path
          className={ARROW}
          d="M164 60 C156 60 152 56 146 56"
          strokeWidth="0.9"
          strokeDasharray="2 2"
          fill="none"
        />
      </Scene>
    </Frame>
  );
}

// Contents: the sidebar listing every page with a thumbnail, the current one highlighted, and Find a
// Page narrowing a long design.
export function ContentsSidebarArt() {
  const pages = ['Logo', 'Sign in', 'Home feed', 'Checkout'];
  return (
    <Frame canvas>
      <Scene>
        <g className={SHADOW}>
          <rect className={PANEL} x="8" y="6" width="92" height="84" rx="4" strokeWidth="0.8" />
        </g>
        <text className={TEXT_STRONG} x="15" y="17" fontSize="6.2" fontWeight="700">
          Contents
        </text>
        {pages.map((p, i) => (
          <g key={p}>
            {i === 2 ? (
              <rect
                className="fill-brand-500/15 dark:fill-brand-400/20"
                x="11"
                y={22 + i * 17}
                width="86"
                height="15"
                rx="2.5"
              />
            ) : null}
            <rect
              className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
              x="15"
              y={24 + i * 17}
              width="9"
              height="11"
              rx="0.8"
              strokeWidth="0.6"
            />
            <rect
              className="fill-slate-300 dark:fill-slate-600"
              x="16.6"
              y={26 + i * 17}
              width="5.8"
              height="1.2"
            />
            <rect
              className="fill-slate-200 dark:fill-slate-700"
              x="16.6"
              y={28.6 + i * 17}
              width="5"
              height="1"
            />
            <text className={TEXT_MUTED} x="30" y={31.6 + i * 17} fontSize="5" fontWeight="600">
              {i + 1}
            </text>
            <text
              className={i === 2 ? TEXT_STRONG : TEXT_BODY}
              x="37"
              y={31.6 + i * 17}
              fontSize="5.6"
              fontWeight={i === 2 ? 700 : 400}
            >
              {p}
            </text>
          </g>
        ))}
        {/* The page it took you to. */}
        <g transform="translate(120 8)">
          <Sheet x={0} y={0} w={64} h={82} />
          <text className={TEXT_STRONG} x="7" y="13" fontSize="6.4" fontWeight="800">
            Home feed
          </text>
          {[0, 1, 2, 3].map((r) => (
            <rect
              key={r}
              className="fill-slate-200 dark:fill-slate-600"
              x="7"
              y={20 + r * 5}
              width={r === 3 ? 34 : 50}
              height="2"
              rx="1"
            />
          ))}
          {/* A picture's placeholder, crossed as a wireframe draws one. */}
          <rect x="7" y="44" width="50" height="22" rx="1" fill={VIOLET} fillOpacity="0.2" />
          <path
            d="M7 44l50 22M57 44l-50 22"
            stroke={VIOLET}
            strokeOpacity="0.6"
            strokeWidth="0.6"
          />
          <text className={TEXT_MUTED} x="32" y="77" fontSize="4.6" textAnchor="middle">
            3
          </text>
        </g>
        <g transform="translate(196 8)" opacity="0.6">
          <Sheet x={0} y={0} w={64} h={82} />
          <text className={TEXT_STRONG} x="7" y="13" fontSize="6.4" fontWeight="800">
            Checkout
          </text>
        </g>
        <rect
          className="fa-d-ring stroke-brand-500 dark:stroke-brand-400"
          x="118"
          y="6"
          width="68"
          height="86"
          rx="2"
          fill="none"
          strokeWidth="1"
        />
      </Scene>
    </Frame>
  );
}

// Keeping time: the presenter's corner while a page is up, the elapsed time counting and this
// page's budget gone amber as it runs over, beside the page itself.
export function SlideTimingArt() {
  return (
    <Frame>
      <Scene>
        {/* The page, full screen: a logo on its artboard. */}
        <rect className="fill-slate-900" x="10" y="8" width="160" height="80" rx="3" />
        <rect x="62" y="16" width="56" height="56" rx="3" fill="#fff" />
        <circle cx="90" cy="38" r="11" fill="none" stroke={SKY} strokeWidth="3.4" />
        <circle cx="90" cy="38" r="4" fill={VIOLET} />
        <text x="90" y="63" fontSize="7" fontWeight="800" fill="#1e293b" textAnchor="middle">
          Bloom
        </text>
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
          THIS PAGE
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
