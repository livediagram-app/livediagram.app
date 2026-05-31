// Animated mini-editor shown in the hero. Mirrors the real editor's visual
// vocabulary (editor chrome, dot-grid canvas, brand-coloured shapes, pinned
// arrows, presence avatars). One 16s timeline (see globals.css, the hero-*
// keyframes): build a flowchart, recolour it, rename a box, drop a comment, a
// teammate's cursor visits, then the canvas clears and rebuilds. The chrome
// stays put; only the canvas content animates and clears.

const BLUE_TEXT = '#0c4a6e';

export function HeroIllustration() {
  return (
    <div
      aria-hidden
      className="mx-auto mt-16 max-w-4xl rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-brand-500/10"
    >
      <div className="overflow-hidden rounded-lg border border-slate-100">
        {/* Editor header strip (static chrome) */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-2">
          <span className="text-sm font-semibold text-slate-900">
            live<span className="text-brand-600">[diagram]</span>
          </span>
          <div className="text-xs text-slate-400">Quarterly planning</div>
          <div className="flex items-center gap-1.5">
            <span
              style={{
                backgroundColor: '#0ea5e9',
                boxShadow: '0 0 0 2px white, 0 0 0 4px #22c55e',
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            >
              TM
            </span>
            <span
              style={{
                backgroundColor: '#ec4899',
                boxShadow: '0 0 0 2px white, 0 0 0 4px #22c55e',
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            >
              JR
            </span>
          </div>
        </div>

        {/* Canvas surface */}
        <div className="relative h-[280px] bg-[radial-gradient(circle_at_center,_#cbd5e1_1.2px,_transparent_1.2px)] bg-[size:24px_24px]">
          {/* Floating palette mockup (static chrome) */}
          <div className="absolute right-3 top-3 flex w-44 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-md">
            <p className="px-1 text-[8px] font-semibold uppercase tracking-wider text-slate-500">
              Palette
            </p>
            <div className="flex flex-wrap gap-0.5">
              {['rect', 'circle', 'diamond', 'cyl', 'para', 'hex', 'doc', 'pill'].map((s) => (
                <span
                  key={s}
                  className="flex h-6 w-6 items-center justify-center rounded text-slate-500"
                >
                  <Shape kind={s} />
                </span>
              ))}
            </div>
          </div>

          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 600 280"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* All shapes inherit fill/stroke from this group, so the theme
                recolour animation repaints the whole diagram at once. */}
            <g
              className="hero-theme"
              fill="#dbeafe"
              stroke="#0284c7"
              strokeWidth="2"
              strokeLinejoin="round"
            >
              <g className="hero-pop1">
                <rect x="80" y="34" width="120" height="44" rx="22" />
                <text
                  x="140"
                  y="62"
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontWeight="600"
                  fontSize="14"
                  fill={BLUE_TEXT}
                  stroke="none"
                >
                  Start
                </text>
              </g>

              <g className="hero-pop2">
                <rect x="80" y="118" width="120" height="52" rx="8" />
                <text
                  className="hero-text-out"
                  x="140"
                  y="150"
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontWeight="600"
                  fontSize="14"
                  fill={BLUE_TEXT}
                  stroke="none"
                >
                  Plan
                </text>
                <text
                  className="hero-text-in"
                  x="140"
                  y="150"
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontWeight="600"
                  fontSize="14"
                  fill={BLUE_TEXT}
                  stroke="none"
                >
                  Build
                </text>
              </g>

              <g className="hero-pop3">
                <polygon points="290,108 360,140 290,172 220,140" />
                <text
                  x="290"
                  y="145"
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontWeight="600"
                  fontSize="13"
                  fill={BLUE_TEXT}
                  stroke="none"
                >
                  Ready?
                </text>
              </g>

              <g className="hero-pop4">
                <rect x="400" y="118" width="120" height="52" rx="8" />
                <text
                  x="460"
                  y="150"
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontWeight="600"
                  fontSize="14"
                  fill={BLUE_TEXT}
                  stroke="none"
                >
                  Ship
                </text>
              </g>

              <g className="hero-pop5">
                <rect x="400" y="206" width="120" height="44" rx="22" />
                <text
                  x="460"
                  y="234"
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontWeight="600"
                  fontSize="14"
                  fill={BLUE_TEXT}
                  stroke="none"
                >
                  Done
                </text>
              </g>
            </g>

            {/* Arrows (each a path that traces the line then its barbs, so the
                head draws in last with the stroke). */}
            <g style={{ color: '#0284c7' }} fill="none">
              <path
                className="hero-line1"
                d="M140 78 L140 118 M134 111 L140 118 L146 111"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className="hero-line2"
                d="M200 140 L220 140 M214 134 L220 140 L214 146"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className="hero-line3"
                d="M360 140 L400 140 M394 134 L400 140 L394 146"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className="hero-line4"
                d="M460 170 L460 206 M454 199 L460 206 L466 199"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* A comment thread pops onto the Ship box */}
            <g transform="translate(508 102)">
              <g className="hero-comment">
                <circle cx="0" cy="0" r="9" fill="#f59e0b" stroke="none" />
                <text x="0" y="3.5" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">
                  1
                </text>
                <g transform="translate(12 -8)">
                  <rect
                    width="96"
                    height="46"
                    rx="6"
                    fill="white"
                    stroke="#e2e8f0"
                    strokeWidth="1"
                  />
                  <circle cx="13" cy="14" r="5" fill="#ec4899" />
                  <rect x="23" y="10" width="58" height="6" rx="3" fill="#e2e8f0" />
                  <rect x="13" y="26" width="70" height="5" rx="2.5" fill="#f1f5f9" />
                  <rect x="13" y="35" width="50" height="5" rx="2.5" fill="#f1f5f9" />
                </g>
              </g>
            </g>
          </svg>

          {/* Remote collaborator's cursor sweeping the canvas */}
          <span className="hero-cursor pointer-events-none absolute" aria-hidden>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="#ec4899"
              stroke="white"
              strokeWidth="1"
            >
              <path d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z" />
            </svg>
            <span
              className="absolute -top-3 left-3 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: '#ec4899' }}
            >
              JR
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Shape({ kind }: { kind: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    'aria-hidden': true,
  } as const;
  switch (kind) {
    case 'rect':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="10" height="10" rx="2" />
        </svg>
      );
    case 'circle':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...common}>
          <polygon points="8,3 13,8 8,13 3,8" strokeLinejoin="round" />
        </svg>
      );
    case 'cyl':
      return (
        <svg {...common}>
          <path d="M3 5 L3 12 A5 1.5 0 0 0 13 12 L13 5" strokeLinejoin="round" />
          <ellipse cx="8" cy="5" rx="5" ry="1.5" />
        </svg>
      );
    case 'para':
      return (
        <svg {...common}>
          <polygon points="4,3 13,3 12,13 3,13" strokeLinejoin="round" />
        </svg>
      );
    case 'hex':
      return (
        <svg {...common}>
          <polygon points="4,3 11,3 14,8 11,13 4,13 1,8" strokeLinejoin="round" />
        </svg>
      );
    case 'doc':
      return (
        <svg {...common}>
          <path
            d="M3 3 L13 3 L13 12 C11 13.4 9.5 11.5 8 12.6 C6.5 13.7 5 11.5 3 12.6 Z"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'pill':
      return (
        <svg {...common}>
          <rect x="2" y="5" width="12" height="6" rx="3" />
        </svg>
      );
  }
  return null;
}
