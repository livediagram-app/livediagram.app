// The drawing parts the tabs / reliability / editor-feature illustrations are
// built from: the little diagram a tab card shows, the editor mock the dark-
// mode card renders twice, the search glyph, and a padlock.
//
// Split out of features.tsx for the same reason as canvas-parts.tsx and
// versatility-parts.tsx — these sat between the scenes that use them, so the
// file alternated between two kinds of thing with nothing marking which you
// were reading. Third of the three large feature-art files to get the
// treatment, which makes it the convention rather than a one-off.
//
// Feature-specific on purpose: ./shared holds what every feature-art file uses
// (Frame and the colour constants), and none of these are wanted elsewhere.

import { BLUE_FILL, BLUE_STROKE } from './shared';

export function MiniDiagram({
  tabs,
  label,
}: {
  tabs: { c: string; on?: boolean; popped?: boolean }[];
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-20 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
        <div className="flex gap-0.5 border-b border-slate-100 pb-0.5">
          {tabs.map((t, i) => (
            <span
              key={i}
              className={(t.popped ? 'fa-pop ' : '') + 'h-1.5 w-4 rounded-t'}
              style={{
                backgroundColor: t.c,
                opacity: t.on ? 1 : 0.4,
                ...(t.popped ? { animationDelay: '0.9s' } : {}),
              }}
            />
          ))}
        </div>
        <div className="mt-1 h-6 rounded-sm bg-[radial-gradient(circle_at_center,_#e2e8f0_1px,_transparent_1px)] bg-[size:8px_8px]" />
      </div>
      <span className="text-[7px] text-slate-400">{label}</span>
    </div>
  );
}

export function LockIcon() {
  return (
    <svg width="7" height="7" viewBox="0 0 16 16" fill="none" stroke="#64748b" strokeWidth="1.6">
      <rect x="3.5" y="7" width="9" height="6" rx="1.5" />
      <path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7" strokeLinecap="round" />
    </svg>
  );
}

export function SearchGlyph({ kind }: { kind: string }) {
  const common = {
    width: 9,
    height: 9,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    'aria-hidden': true,
  } as const;
  if (kind === 'diagram')
    return (
      <svg {...common}>
        <rect x="3" y="3" width="10" height="10" rx="1.5" />
      </svg>
    );
  if (kind === 'tab')
    return (
      <svg {...common}>
        <path d="M2.5 6.5h4l1-2h6v9h-11z" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="4" />
    </svg>
  );
}

export function MiniEditorMock({ dark }: { dark: boolean }) {
  const panel = dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white';
  const bar = dark ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50';
  const dot = dark ? 'bg-slate-600' : 'bg-slate-300';
  const shapeFill = dark ? '#0c4a6e' : BLUE_FILL;
  const grid = dark ? '#1e293b' : '#d8dee8';
  return (
    <div className={'flex h-full w-full flex-col overflow-hidden rounded-md border ' + panel}>
      <div className={'flex items-center gap-1 border-b px-1.5 py-1 ' + bar}>
        <span className={'h-1.5 w-1.5 rounded-full ' + dot} />
        <span className={'h-1.5 w-1.5 rounded-full ' + dot} />
        <span className={'ml-auto h-1.5 w-6 rounded ' + dot} />
      </div>
      <div
        className="relative flex-1"
        style={{
          backgroundImage: `radial-gradient(circle at center, ${grid} 1px, transparent 1px)`,
          backgroundSize: '11px 11px',
        }}
      >
        <svg viewBox="0 0 120 38" className="absolute inset-0 h-full w-full">
          <rect
            x="14"
            y="11"
            width="34"
            height="16"
            rx="4"
            fill={shapeFill}
            stroke={BLUE_STROKE}
            strokeWidth="2"
          />
          <rect
            x="72"
            y="13"
            width="34"
            height="16"
            rx="4"
            fill={shapeFill}
            stroke={BLUE_STROKE}
            strokeWidth="2"
          />
          <line
            x1="48"
            y1="19"
            x2="72"
            y2="21"
            stroke={BLUE_STROKE}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
