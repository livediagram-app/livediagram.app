// 28x20 SVG previews used in the Current Tab → Canvas accordion's
// pattern picker (CommandPalette / TabSection). Each icon depicts
// the pattern at a glance. Pulled out of CommandPalette.tsx to keep
// that file focused on the picker UI rather than the SVG vocabulary.
//
// Visual contract: 28px x 20px, viewBox="0 0 28 20", a rounded
// rect frame stroked at currentColor with opacity 0.5, and the
// pattern motif inside. The matching PatternButton wrapper drives
// active / hover state via colour, so every icon keeps stroke at
// currentColor + fill at currentColor (or named tailwind shades for
// the confetti accent dots).

export function BackgroundGridIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      {Array.from({ length: 4 }).flatMap((_, i) =>
        Array.from({ length: 3 }).map((__, j) => (
          <circle key={`${i}-${j}`} cx={4 + i * 6} cy={4 + j * 6} r="0.8" fill="currentColor" />
        )),
      )}
    </svg>
  );
}

export function BackgroundBlankIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
    </svg>
  );
}

export function BackgroundLinesIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      <line x1="2" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth="0.7" />
      <line x1="2" y1="11" x2="26" y2="11" stroke="currentColor" strokeWidth="0.7" />
      <line x1="2" y1="16" x2="26" y2="16" stroke="currentColor" strokeWidth="0.7" />
    </svg>
  );
}

export function BackgroundGraphIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      {[5, 10, 15].map((y) => (
        <line key={`h${y}`} x1="0" y1={y} x2="28" y2={y} stroke="currentColor" strokeWidth="0.4" />
      ))}
      {[5, 10, 15, 20, 25].map((x) => (
        <line key={`v${x}`} x1={x} y1="0" x2={x} y2="20" stroke="currentColor" strokeWidth="0.4" />
      ))}
    </svg>
  );
}

export function BackgroundCrosshatchIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      <line x1="0" y1="6" x2="22" y2="20" stroke="currentColor" strokeWidth="0.5" />
      <line x1="6" y1="0" x2="28" y2="14" stroke="currentColor" strokeWidth="0.5" />
      <line x1="0" y1="14" x2="14" y2="0" stroke="currentColor" strokeWidth="0.5" />
      <line x1="14" y1="20" x2="28" y2="6" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  );
}

export function BackgroundConfettiIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      <circle cx="5" cy="6" r="1.3" fill="rgb(248 113 113)" />
      <circle cx="13" cy="4" r="1" fill="rgb(96 165 250)" />
      <circle cx="22" cy="8" r="1.3" fill="rgb(250 204 21)" />
      <circle cx="8" cy="14" r="1.3" fill="rgb(167 139 250)" />
      <circle cx="18" cy="13" r="1" fill="rgb(52 211 153)" />
      <circle cx="24" cy="16" r="1.3" fill="rgb(236 72 153)" />
    </svg>
  );
}

export function BackgroundStripesIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {[6, 12, 18, 24].map((x) => (
        <line key={x} x1={x} y1="3" x2={x} y2="17" stroke="currentColor" strokeWidth="0.75" />
      ))}
    </svg>
  );
}

export function BackgroundDiagonalIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {[-6, 0, 6, 12, 18, 24].map((x) => (
        <line key={x} x1={x} y1="20" x2={x + 16} y2="4" stroke="currentColor" strokeWidth="0.75" />
      ))}
    </svg>
  );
}

export function BackgroundWavesIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {[6, 12, 17].map((y) => (
        <path
          key={y}
          d={`M2 ${y} Q 8 ${y - 2.5} 14 ${y} T 26 ${y}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.7"
        />
      ))}
    </svg>
  );
}

export function BackgroundBricksIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {/* Row 1: full cells. */}
      <line x1="2" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth="0.75" />
      <line x1="2" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="0.75" />
      <line x1="10" y1="2" x2="10" y2="6" stroke="currentColor" strokeWidth="0.75" />
      <line x1="18" y1="2" x2="18" y2="6" stroke="currentColor" strokeWidth="0.75" />
      <line x1="6" y1="6" x2="6" y2="14" stroke="currentColor" strokeWidth="0.75" />
      <line x1="14" y1="6" x2="14" y2="14" stroke="currentColor" strokeWidth="0.75" />
      <line x1="22" y1="6" x2="22" y2="14" stroke="currentColor" strokeWidth="0.75" />
      <line x1="10" y1="14" x2="10" y2="18" stroke="currentColor" strokeWidth="0.75" />
      <line x1="18" y1="14" x2="18" y2="18" stroke="currentColor" strokeWidth="0.75" />
    </svg>
  );
}

export function BackgroundIsometricIcon() {
  // Two shallow (~30°) diagonal families forming isometric rhombi.
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {[-2, 12, 26].map((x) => (
        <line
          key={`u${x}`}
          x1={x}
          y1="20"
          x2={x + 22}
          y2="0"
          stroke="currentColor"
          strokeWidth="0.6"
        />
      ))}
      {[-22, -8, 6].map((x) => (
        <line
          key={`d${x}`}
          x1={x}
          y1="0"
          x2={x + 22}
          y2="20"
          stroke="currentColor"
          strokeWidth="0.6"
        />
      ))}
    </svg>
  );
}

export function BackgroundCheckerboardIcon() {
  // Alternating filled squares.
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {Array.from({ length: 6 }).flatMap((_, i) =>
        Array.from({ length: 4 }).map((__, j) =>
          (i + j) % 2 === 0 ? (
            <rect
              key={`${i}-${j}`}
              x={2 + i * 4}
              y={2 + j * 4}
              width="4"
              height="4"
              fill="currentColor"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

export function BackgroundHexagonalIcon() {
  // Small flat-top honeycomb cluster.
  const hex = (cx: number, cy: number, key: string) => {
    const r = 4.2;
    const h = r * 0.866;
    const pts = [
      [cx + r, cy],
      [cx + r / 2, cy + h],
      [cx - r / 2, cy + h],
      [cx - r, cy],
      [cx - r / 2, cy - h],
      [cx + r / 2, cy - h],
    ]
      .map((p) => p.join(','))
      .join(' ');
    return <polygon key={key} points={pts} fill="none" stroke="currentColor" strokeWidth="0.6" />;
  };
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {hex(7, 10, 'a')}
      {hex(13.3, 6.36, 'b')}
      {hex(13.3, 13.64, 'c')}
      {hex(19.6, 10, 'd')}
      {hex(0.7, 6.36, 'e')}
      {hex(0.7, 13.64, 'f')}
      {hex(25.9, 6.36, 'g')}
      {hex(25.9, 13.64, 'h')}
    </svg>
  );
}

export function BackgroundEngineeringIcon() {
  // Fine minor grid with a bolder major line each way (graph paper).
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {[5, 10, 15].map((y) => (
        <line
          key={`mh${y}`}
          x1="0"
          y1={y}
          x2="28"
          y2={y}
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.5"
        />
      ))}
      {[4, 8, 12, 16, 20, 24].map((x) => (
        <line
          key={`mv${x}`}
          x1={x}
          y1="0"
          x2={x}
          y2="20"
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.5"
        />
      ))}
      <line x1="0" y1="10" x2="28" y2="10" stroke="currentColor" strokeWidth="0.9" />
      <line x1="14" y1="0" x2="14" y2="20" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  );
}

// ── Animated pattern previews (spec/09) ──────────────────────────────────
// Still glyphs that depict each animated backdrop's resting frame; the
// "animated" nature is conveyed by the picker tooltip, not the icon.

// Flow: streaming diagonal dashes.
export function BackgroundFlowIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {[-2, 6, 14, 22].map((x) => (
        <line
          key={x}
          x1={x}
          y1="20"
          x2={x + 12}
          y2="0"
          stroke="currentColor"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeDasharray="4 3"
        />
      ))}
    </svg>
  );
}

// Drift: rising motes of varied size.
export function BackgroundDriftIcon() {
  const motes = [
    { cx: 5, cy: 6, r: 1.6 },
    { cx: 11, cy: 13, r: 1 },
    { cx: 15, cy: 5, r: 2.1 },
    { cx: 20, cy: 11, r: 1.3 },
    { cx: 24, cy: 7, r: 1.7 },
    { cx: 9, cy: 16, r: 1.1 },
  ];
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {motes.map((m, i) => (
        <circle key={i} cx={m.cx} cy={m.cy} r={m.r} fill="currentColor" opacity="0.7" />
      ))}
    </svg>
  );
}

// Aurora: soft drifting glows.
export function BackgroundAuroraIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      <circle cx="8" cy="8" r="6" fill="currentColor" opacity="0.28" />
      <circle cx="19" cy="13" r="7" fill="currentColor" opacity="0.22" />
      <circle cx="21" cy="6" r="4" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

// Ripple: concentric rings.
export function BackgroundRippleIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {[2, 5, 8].map((r) => (
        <circle
          key={r}
          cx="14"
          cy="10"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          opacity={1 - r * 0.08}
        />
      ))}
    </svg>
  );
}

// Ribbons: thick curved flowing lines (the new-diagram page backdrop).
export function BackgroundRibbonsIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {[
        { d: 'M0 6 C 6 2, 10 9, 16 6 S 24 3, 28 7', o: 0.8 },
        { d: 'M0 12 C 7 9, 11 15, 17 12 S 24 9, 28 13', o: 0.55 },
        { d: 'M0 17 C 6 14, 12 19, 18 16 S 25 14, 28 17', o: 0.35 },
      ].map((l, i) => (
        <path
          key={i}
          d={l.d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity={l.o}
        />
      ))}
    </svg>
  );
}
