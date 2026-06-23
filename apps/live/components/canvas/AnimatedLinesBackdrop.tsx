// Soft animated backdrop for the new-diagram screen: thick, multi-colour
// curved lines that slowly draw and flow along their paths, giving the
// page life behind the wizard card. Pure SVG + CSS (no rAF loop, no JS
// per frame), so it's cheap and GPU-composited. Decorative only:
// pointer-events-none and aria-hidden, and it stands down entirely under
// prefers-reduced-motion.
//
// Each line normalises to pathLength 100 and animates stroke-dashoffset so
// a long dash travels the curve at its own slow pace, reading as lines
// that keep drawing themselves. Colours are a fixed soft palette (not the
// active theme) so the screen looks lively regardless of theme.

const LINES: { d: string; color: string; width: number; dur: number; delay: number }[] = [
  {
    d: 'M-50 160 C 250 60, 520 300, 820 170 S 1320 60, 1500 220',
    color: '#38bdf8',
    width: 10,
    dur: 58,
    delay: 0,
  },
  {
    d: 'M-50 360 C 200 480, 540 240, 800 400 S 1280 520, 1500 360',
    color: '#a78bfa',
    width: 12,
    dur: 70,
    delay: -14,
  },
  {
    d: 'M-50 560 C 260 460, 520 700, 840 560 S 1300 460, 1500 600',
    color: '#34d399',
    width: 9,
    dur: 64,
    delay: -28,
  },
  {
    d: 'M-50 700 C 240 620, 560 820, 860 700 S 1280 640, 1500 760',
    color: '#fbbf24',
    width: 11,
    dur: 80,
    delay: -8,
  },
  {
    d: 'M-50 40 C 300 140, 560 -40, 880 80 S 1320 200, 1500 60',
    color: '#fb7185',
    width: 8,
    dur: 74,
    delay: -40,
  },
];

export function AnimatedLinesBackdrop() {
  return (
    <div
      aria-hidden
      // Hidden below sm: the wizard card fills the viewport on mobile, so
      // the backdrop is never visible there and shouldn't burn animation.
      className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block"
      // Sit behind the picker card (z-50) but above the plain backdrop.
      style={{ zIndex: 0 }}
    >
      <style>{`
        @keyframes lvd-line-flow { to { stroke-dashoffset: -200; } }
        .lvd-line {
          stroke-dasharray: 45 55;
          stroke-dashoffset: 0;
          animation: lvd-line-flow linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .lvd-line { animation: none; }
        }
      `}</style>
      <svg
        className="h-full w-full"
        viewBox="0 0 1450 800"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {LINES.map((l, i) => (
          <path
            key={i}
            className="lvd-line"
            d={l.d}
            stroke={l.color}
            strokeWidth={l.width}
            strokeLinecap="round"
            pathLength={100}
            opacity={0.35}
            style={{ animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s` }}
          />
        ))}
      </svg>
    </div>
  );
}
