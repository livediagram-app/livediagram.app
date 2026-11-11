// Feature illustrations: embeds on the canvas, split from ./structure.

import { SHADOW, Scene } from '@liveworkspace/marketing-site/components/feature-art/canvas-marks';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';

// Embeds on the canvas: a video, unplayed (nothing loads until someone presses play), beside a
// Figma file and a Google Doc, and a sticky pointing at the moment that matters.
export function EmbedArt() {
  return (
    <Frame canvas>
      <Scene>
        <defs>
          <linearGradient id="fa-d-embed-poster" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1e3a8a" />
            <stop offset="0.55" stopColor="#6d28d9" />
            <stop offset="1" stopColor="#db2777" />
          </linearGradient>
          <clipPath id="fa-d-embed-clip">
            <rect x="20" y="10" width="128" height="76" rx="5" />
          </clipPath>
        </defs>
        {/* The video. */}
        <g className={SHADOW}>
          <rect x="20" y="10" width="128" height="76" rx="5" fill="#0f172a" />
        </g>
        <g clipPath="url(#fa-d-embed-clip)">
          <rect x="20" y="10" width="128" height="64" fill="url(#fa-d-embed-poster)" />
          <circle cx="118" cy="30" r="22" fill="#fff" opacity="0.08" />
          <path d="M20 66 L52 42 L74 58 L96 44 L148 70 V74 H20Z" fill="#0f172a" opacity="0.35" />
          <text x="28" y="22" fontSize="6.4" fontWeight="700" fill="#fff">
            Sprint 14 demo
          </text>
          <text x="28" y="30" fontSize="5.4" fill="#fff" opacity="0.7">
            Loom · 4:12
          </text>
          <rect x="20" y="74" width="128" height="12" fill="#0f172a" />
          <rect x="27" y="79" width="94" height="2" rx="1" fill="#fff" opacity="0.2" />
          <rect x="27" y="79" width="30" height="2" rx="1" fill="#f472b6" />
          <text x="126" y="81.8" fontSize="5" fill="#fff" opacity="0.7">
            1:20
          </text>
        </g>
        <circle
          className="fa-ripple"
          cx="84"
          cy="44"
          r="12"
          fill="none"
          stroke="#fff"
          strokeWidth="1.5"
        />
        <g>
          <circle cx="84" cy="44" r="12" fill="#fff" opacity="0.95" />
          <path d="M80.5 38.5 L90 44 L80.5 49.5Z" fill="#0f172a" />
        </g>
        {/* A Figma file and a Google Doc. */}
        {[
          { y: 12, title: 'Checkout flow', host: 'Figma', color: '#a259ff' },
          { y: 50, title: 'Launch brief', host: 'Google Docs', color: '#4285f4' },
        ].map((e) => (
          <g key={e.title}>
            <g className={SHADOW}>
              <rect
                x="160"
                y={e.y}
                width="72"
                height="34"
                rx="4"
                fill="#fff"
                stroke="#e2e8f0"
                strokeWidth="0.8"
              />
            </g>
            <rect x="160" y={e.y} width="72" height="18" rx="4" fill={e.color} fillOpacity="0.12" />
            <rect
              x="166"
              y={e.y + 5}
              width="22"
              height="3"
              rx="1.5"
              fill={e.color}
              fillOpacity="0.55"
            />
            <rect
              x="166"
              y={e.y + 10}
              width="34"
              height="2.5"
              rx="1.25"
              fill={e.color}
              fillOpacity="0.3"
            />
            <rect x="166" y={e.y + 22} width="6" height="6" rx="1.5" fill={e.color} />
            <text x="175" y={e.y + 26.6} fontSize="5.8" fontWeight="700" fill="#0f172a">
              {e.title}
            </text>
            <text x="175" y={e.y + 31.8} fontSize="4.8" fill="#64748b">
              {e.host}
            </text>
          </g>
        ))}
        {/* The sticky. */}
        <g>
          <g className="[filter:drop-shadow(0_2px_2px_rgb(15_23_42/0.18))]">
            <rect
              x="240"
              y="26"
              width="48"
              height="40"
              rx="1.5"
              fill="#fde68a"
              transform="rotate(3 264 46)"
            />
          </g>
          <text
            x="246"
            y="40"
            fontSize="6.2"
            fontWeight="600"
            fill="#422006"
            transform="rotate(3 264 46)"
          >
            <tspan x="246">Watch from</tspan>
            <tspan x="246" dy="8.5">
              1:20 for the
            </tspan>
            <tspan x="246" dy="8.5">
              pay step
            </tspan>
          </text>
        </g>
      </Scene>
    </Frame>
  );
}
