// Feature illustrations for Pages mode's pages beyond layouts (docs/specs/007-editor/pages-mode.md):
// the Contents sidebar.

import {
  PANEL,
  SHADOW,
  Scene,
  TEXT_BODY,
  TEXT_MUTED,
  TEXT_STRONG,
} from '@liveworkspace/marketing-site/components/feature-art/canvas-marks';
import { Frame, SKY, VIOLET } from '@liveworkspace/marketing-site/components/feature-art/shared';

/** A page as the canvas shows it: a white sheet with a soft shadow. */
function Sheet({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g className={SHADOW}>
      <rect className="fill-white dark:fill-slate-800" x={x} y={y} width={w} height={h} rx="1.5" />
    </g>
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
        {/* The next page along, Checkout: its order lines, the total and the pay button. */}
        <g transform="translate(196 8)">
          <Sheet x={0} y={0} w={64} h={82} />
          <text className={TEXT_STRONG} x="7" y="13" fontSize="6.4" fontWeight="800">
            Checkout
          </text>
          {[0, 1, 2].map((r) => (
            <g key={r}>
              <rect
                className="fill-slate-100 stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-600"
                x="7"
                y={20 + r * 11}
                width="8"
                height="8"
                rx="1"
                strokeWidth="0.5"
              />
              <rect
                className="fill-slate-200 dark:fill-slate-600"
                x="18"
                y={21.5 + r * 11}
                width={[24, 18, 21][r]}
                height="2"
                rx="1"
              />
              <rect
                className="fill-slate-200 dark:fill-slate-600"
                x="49"
                y={21.5 + r * 11}
                width="8"
                height="2"
                rx="1"
              />
            </g>
          ))}
          <path
            className="stroke-slate-200 dark:stroke-slate-600"
            d="M7 54.5H57"
            strokeWidth="0.6"
          />
          <rect
            className="fill-slate-300 dark:fill-slate-500"
            x="7"
            y="58"
            width="16"
            height="2.4"
            rx="1.2"
          />
          <rect
            className="fill-slate-300 dark:fill-slate-500"
            x="45"
            y="58"
            width="12"
            height="2.4"
            rx="1.2"
          />
          <rect x="7" y="64" width="50" height="7" rx="3.5" fill={SKY} />
          <text className={TEXT_MUTED} x="32" y="77" fontSize="4.6" textAnchor="middle">
            4
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
