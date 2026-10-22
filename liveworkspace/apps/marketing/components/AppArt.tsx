// A small drawing of what an app makes, in its accent (liveworkspace/docs/marketing-site.md "The
// apps"). Decorative: the card's words carry the meaning.

export function AppArt({ kind, accent }: { kind: 'diagram' | 'board'; accent: string }) {
  return (
    <svg
      viewBox="0 0 240 120"
      aria-hidden
      className="h-auto w-full text-slate-300 dark:text-slate-600"
      fill="none"
    >
      {kind === 'diagram' ? (
        <>
          <path d="M70 40h40M150 40h20v40h-20M110 80H70" stroke="currentColor" strokeWidth="2" />
          <rect x="22" y="24" width="48" height="32" rx="8" fill={accent} />
          <rect x="110" y="24" width="40" height="32" rx="16" stroke={accent} strokeWidth="2.5" />
          <path d="M150 64l20 16-20 16-20-16z" fill={accent} opacity="0.35" />
          <rect x="22" y="64" width="48" height="32" rx="8" stroke="currentColor" strokeWidth="2" />
          <circle cx="198" cy="28" r="6" fill={accent} />
          <path d="M198 34v10l6-3" stroke={accent} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          {[16, 92, 168].map((x, col) => (
            <g key={x}>
              <rect x={x} y="12" width="56" height="8" rx="4" fill="currentColor" />
              {Array.from({ length: 3 - col }, (_, i) => (
                <rect
                  key={i}
                  x={x}
                  y={28 + i * 30}
                  width="56"
                  height="24"
                  rx="6"
                  fill={i === 0 ? accent : 'none'}
                  opacity={i === 0 ? 0.85 - col * 0.25 : 1}
                  stroke={i === 0 ? 'none' : 'currentColor'}
                  strokeWidth="2"
                />
              ))}
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
