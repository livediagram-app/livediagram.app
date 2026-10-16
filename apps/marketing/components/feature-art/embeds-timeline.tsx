// Feature illustrations: embeds on the canvas and the Timeline feed, split from ./structure.

import { HAIRLINE, PANEL, SHADOW, Scene, TEXT_BODY, TEXT_MUTED, TEXT_STRONG } from './canvas-marks';
import { Frame } from './shared';

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

// The Explorer's Timeline (docs/specs/013-workspace/timeline.md): a day of activity on a spine,
// each event with who did it and what, colour saying what happened; the newest is marked New.
export function TimelineFeedArt() {
  const rows = [
    {
      who: 'AK',
      color: '#8b5cf6',
      kind: '#16a34a',
      verb: 'commented on',
      doc: 'Roadmap',
      time: 'now',
      fresh: true,
    },
    {
      who: 'SM',
      color: '#0ea5e9',
      kind: '#f59e0b',
      verb: 'assigned you',
      doc: 'Billing v2',
      time: '11:02',
    },
    {
      who: 'JR',
      color: '#ec4899',
      kind: '#0ea5e9',
      verb: 'edited',
      doc: 'Onboarding',
      time: '09:24',
    },
  ];
  return (
    <Frame>
      <Scene>
        <g className={SHADOW}>
          <rect className={PANEL} x="24" y="7" width="252" height="82" rx="6" strokeWidth="0.8" />
        </g>
        <text className={TEXT_STRONG} x="34" y="20" fontSize="7" fontWeight="700">
          Today
        </text>
        <rect className="fill-brand-500" x="58" y="13.6" width="28" height="9" rx="4.5" />
        <text x="72" y="19.8" fontSize="5.4" fontWeight="700" fill="#fff" textAnchor="middle">
          3 new
        </text>
        <path className={HAIRLINE} d="M43 29 V83" strokeWidth="1" />
        {rows.map((r, i) => {
          const y = 34 + i * 18;
          return (
            <g
              key={r.doc}
              className={r.fresh ? 'fa-d-land' : undefined}
              style={r.fresh ? { animationDelay: '0.1s' } : undefined}
            >
              <circle
                cx="43"
                cy={y + 5}
                r="3"
                fill={r.kind}
                className="stroke-white dark:stroke-slate-900"
                strokeWidth="1.2"
              />
              <rect
                className={
                  r.fresh
                    ? 'fill-brand-50 stroke-brand-200 dark:fill-brand-500/10 dark:stroke-brand-500/40'
                    : 'fill-slate-50 stroke-slate-100 dark:fill-slate-800/60 dark:stroke-slate-800'
                }
                x="52"
                y={y - 2.5}
                width="214"
                height="15"
                rx="3.5"
                strokeWidth="0.7"
              />
              <circle cx="61" cy={y + 5} r="5.2" fill={r.color} />
              <text
                x="61"
                y={y + 6.8}
                fontSize="4.4"
                fontWeight="700"
                fill="#fff"
                textAnchor="middle"
              >
                {r.who}
              </text>
              <text className={TEXT_BODY} x="71" y={y + 7.2} fontSize="6.4">
                {r.verb}{' '}
                <tspan className={TEXT_STRONG} fontWeight="600">
                  {r.doc}
                </tspan>
              </text>
              {r.fresh ? (
                <g>
                  <rect
                    className="fill-brand-500"
                    x="240"
                    y={y + 0.5}
                    width="20"
                    height="9"
                    rx="4.5"
                  />
                  <text
                    x="250"
                    y={y + 6.6}
                    fontSize="5.2"
                    fontWeight="700"
                    fill="#fff"
                    textAnchor="middle"
                  >
                    New
                  </text>
                </g>
              ) : (
                <text className={TEXT_MUTED} x="260" y={y + 7} fontSize="5.6" textAnchor="end">
                  {r.time}
                </text>
              )}
            </g>
          );
        })}
      </Scene>
    </Frame>
  );
}
