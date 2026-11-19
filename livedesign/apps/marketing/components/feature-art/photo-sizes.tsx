// The Photo editing section's Make Sizes card (docs/specs/031-photo/photo-pages.md "Make Sizes"): the dialog's format
// tiles, each the photo in that shape, three of them ticked, and Make 3 Sizes. Built on page-kit like ./photo, so it
// reads in light and in dark; the ticks land through the fa-e-* loops in app/feature-art/pages.css and settle under
// reduced motion.

import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import {
  at,
  INK,
  INK_SOFT,
  Panel,
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';

// The formats as the dialog names them, each drawn at its own aspect inside a 34-high tile.
const FORMATS = [
  { name: 'Instagram Post', w: 27, ticked: true },
  { name: 'Instagram Story', w: 19, ticked: true },
  { name: 'X Post', w: 50, ticked: true },
  { name: 'YouTube Thumbnail', w: 50, ticked: false },
] as const;

/** The photo in miniature, filling the box it is given and cropped about its centre. */
function Photo({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="1.2" fill="#bae6fd" />
      <circle cx={x + w * 0.66} cy={y + h * 0.34} r={Math.min(w, h) * 0.14} fill="#fde047" />
      <path
        d={`M${x} ${y + h * 0.72} Q${x + w * 0.35} ${y + h * 0.5} ${x + w * 0.62} ${y + h * 0.66} T${x + w} ${y + h * 0.62} V${y + h} H${x} Z`}
        fill="#4ade80"
      />
      <path
        d={`M${x} ${y + h * 0.9} Q${x + w * 0.5} ${y + h * 0.78} ${x + w} ${y + h * 0.86} V${y + h} H${x} Z`}
        fill="#15803d"
      />
    </g>
  );
}

/** Make Sizes: one photo page, ticked into every social format it needs. */
export function MakeSizesArt() {
  const tiles = FORMATS.map((f, i) => ({ ...f, x: 32 + i * 58 }));
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Panel x={20} y={4} w={260} h={88} title="Make Sizes" />
        {tiles.map((t, i) => {
          const px = t.x + (50 - t.w) / 2;
          return (
            <g key={t.name}>
              <rect
                className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
                x={t.x}
                y="19"
                width="50"
                height="48"
                rx="3"
                fill="#ffffff"
                stroke="#e2e8f0"
                strokeWidth="0.7"
              />
              {/* The ticked state under the picture: the brand wash and edge the dialog's tile takes. */}
              {t.ticked ? (
                <g className="fa-e-pop" style={at(0.4 + i * 0.35)}>
                  <rect
                    className="fill-brand-50 stroke-brand-500 dark:fill-brand-500/15"
                    x={t.x}
                    y="19"
                    width="50"
                    height="48"
                    rx="3"
                    fill="#fff1f2"
                    stroke="#f43f5e"
                    strokeWidth="0.9"
                  />
                </g>
              ) : null}
              <Photo x={px} y={t.w > 30 ? 30 : 26} w={t.w} h={t.w > 30 ? 28 : 34} />
              <text
                x={t.x + 25}
                y="74"
                textAnchor="middle"
                fontSize="4.4"
                fontWeight="600"
                className={INK}
                fill="#1e293b"
              >
                {t.name}
              </text>
              {/* The tick in the corner: a filled disc when on, an empty ring when off. */}
              <circle
                className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600"
                cx={t.x + 44}
                cy="25"
                r="3.4"
                fill="#ffffff"
                stroke="#cbd5e1"
                strokeWidth="0.6"
              />
              {t.ticked ? (
                <g className="fa-e-pop" style={at(0.4 + i * 0.35)}>
                  <circle
                    className="fill-brand-700 dark:fill-brand-600"
                    cx={t.x + 44}
                    cy="25"
                    r="3.6"
                    fill="#be123c"
                  />
                  <path
                    d={`M${t.x + 42.4} 25l1.2 1.2 2.2-2.4`}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                  />
                </g>
              ) : null}
            </g>
          );
        })}
        <text x="32" y="85.5" fontSize="4.6" className={INK_SOFT} fill="#64748b">
          Room for 6 more photo pages in this tab.
        </text>
        <g className="fa-e-in" style={at(1.6)}>
          <rect
            className="fill-brand-700 dark:fill-brand-600"
            x="222"
            y="78"
            width="48"
            height="10"
            rx="2.5"
            fill="#be123c"
          />
          <text x="246" y="84.8" textAnchor="middle" fontSize="5" fontWeight="700" fill="#ffffff">
            Make 3 Sizes
          </text>
        </g>
      </svg>
    </Frame>
  );
}
