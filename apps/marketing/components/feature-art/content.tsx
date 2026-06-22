// Feature illustrations: the richer-content scenes (tables, icons, rich text,
// link cards, technology icons, and ready-made components). Split from
// versatility.tsx, which keeps the core drawing-primitive scenes; see ./shared
// for Frame + colour constants.
import { Frame, PINK } from './shared';

// Editable table element: a coloured header row over body cells, with one
// cell ringed as if mid-edit (the real table opens a cell on double-click)
// and the header tinted to show the per-table header colours.
export function TablesArt() {
  const headers = ['Item', 'Owner', 'Status'];
  const rows = [
    ['API', 'Sam', 'Done'],
    ['UI', 'Lee', 'WIP'],
  ];
  return (
    <Frame canvas>
      <div className="flex h-full items-center justify-center">
        <div className="overflow-hidden rounded-[3px] border border-slate-300 bg-white shadow-sm">
          <div className="flex">
            {headers.map((h) => (
              <div
                key={h}
                className="w-[50px] border-r border-sky-600/40 bg-sky-500 px-2 py-1 text-[7px] font-semibold text-white last:border-r-0"
              >
                {h}
              </div>
            ))}
          </div>
          {rows.map((row, ri) => (
            <div key={ri} className="flex border-t border-slate-200">
              {row.map((cell, ci) => (
                <div
                  key={ci}
                  className="relative w-[50px] border-r border-slate-200 px-2 py-1 text-[7px] text-slate-600 last:border-r-0"
                >
                  {cell}
                  {ri === 1 && ci === 1 && (
                    <span className="fa-hl pointer-events-none absolute inset-0 rounded-[2px] ring-2 ring-brand-500" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// The icon library: a curated set of single-colour glyphs, a brand
// highlight cycling across them like the real Icons picker.
export function IconsArt() {
  const icons = ['server', 'database', 'cloud', 'user', 'gear', 'lock', 'bolt', 'globe'];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-1.5 px-3">
        <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">Icons</p>
        <div className="grid grid-cols-4 gap-1.5">
          {icons.map((g, i) => (
            <span
              key={g}
              className="relative flex h-7 items-center justify-center rounded border border-slate-200 bg-white text-brand-600"
            >
              <span
                className="fa-hl pointer-events-none absolute inset-0 rounded ring-2 ring-brand-500"
                style={{ animationDelay: `${i * 0.7}s` }}
              />
              <IconGlyph kind={g} />
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function IconGlyph({ kind }: { kind: string }) {
  const c = {
    width: 15,
    height: 15,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.3,
    'aria-hidden': true,
  } as const;
  switch (kind) {
    case 'server':
      return (
        <svg {...c}>
          <rect x="2.5" y="2.5" width="11" height="4.5" rx="1" />
          <rect x="2.5" y="9" width="11" height="4.5" rx="1" />
          <line x1="4.5" y1="4.7" x2="4.5" y2="4.8" strokeLinecap="round" strokeWidth="1.6" />
          <line x1="4.5" y1="11.2" x2="4.5" y2="11.3" strokeLinecap="round" strokeWidth="1.6" />
        </svg>
      );
    case 'database':
      return (
        <svg {...c}>
          <ellipse cx="8" cy="4" rx="5" ry="1.8" />
          <path d="M3 4 v8 a5 1.8 0 0 0 10 0 V4" strokeLinejoin="round" />
          <path d="M3 8 a5 1.8 0 0 0 10 0" />
        </svg>
      );
    case 'cloud':
      return (
        <svg {...c}>
          <path
            d="M5 12 a3 3 0 0 1 0.3 -6 a3.5 3.5 0 0 1 6.6 1 a2.5 2.5 0 0 1 -0.4 5 Z"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'user':
      return (
        <svg {...c}>
          <circle cx="8" cy="5.5" r="2.5" />
          <path d="M3.5 13 a4.5 4.5 0 0 1 9 0" strokeLinecap="round" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...c}>
          <circle cx="8" cy="8" r="2.2" />
          <path
            d="M8 2 v1.6 M8 12.4 V14 M2 8 h1.6 M12.4 8 H14 M3.8 3.8 l1.1 1.1 M11.1 11.1 l1.1 1.1 M12.2 3.8 l-1.1 1.1 M4.9 11.1 l-1.1 1.1"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'lock':
      return (
        <svg {...c}>
          <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
          <path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 v2" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...c}>
          <polygon points="9,2 4,9 7.5,9 7,14 12,7 8.5,7" strokeLinejoin="round" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...c}>
          <circle cx="8" cy="8" r="5.5" />
          <ellipse cx="8" cy="8" rx="2.4" ry="5.5" />
          <line x1="2.5" y1="8" x2="13.5" y2="8" />
        </svg>
      );
  }
  return null;
}

// Rich text in labels: inline bold / italic / colour runs plus the
// miniature B / I / U toolbar from the edit-text controls.
export function RichTextArt() {
  const tools = [
    { k: 'B', weight: 700, italic: false, underline: false },
    { k: 'I', weight: 500, italic: true, underline: false },
    { k: 'U', weight: 500, italic: false, underline: true },
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-2 px-3">
        <div className="flex w-max items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1 py-0.5 shadow-sm">
          {tools.map((t, i) => (
            <span
              key={t.k}
              className="relative flex h-4 w-4 items-center justify-center rounded text-[9px] text-slate-700"
              style={{
                fontWeight: t.weight,
                fontStyle: t.italic ? 'italic' : 'normal',
                textDecoration: t.underline ? 'underline' : 'none',
              }}
            >
              {t.k}
              {i === 0 && (
                <span className="fa-hl pointer-events-none absolute inset-0 rounded ring-2 ring-brand-500" />
              )}
            </span>
          ))}
        </div>
        <p className="text-[10px] leading-relaxed text-slate-700">
          A <span className="font-bold text-slate-900">bold</span> claim, an{' '}
          <span className="italic">italic</span> aside, and a{' '}
          <span className="font-semibold" style={{ color: PINK }}>
            splash
          </span>{' '}
          of colour.
        </p>
      </div>
    </Frame>
  );
}

// Link card: paste a URL and it unfurls into a bookmark with a preview
// image, favicon, title and host.
export function LinkCardArt() {
  return (
    <Frame canvas>
      <div className="flex h-full items-center justify-center">
        <div className="fa-pop w-[122px] overflow-hidden rounded-[4px] border border-slate-300 bg-white shadow-sm">
          <div className="h-8 bg-gradient-to-br from-sky-200 to-brand-300" />
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            <span className="h-4 w-4 shrink-0 rounded-[2px] bg-brand-500" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[8px] font-semibold text-slate-800">
                Design review
              </span>
              <span className="truncate text-[7px] text-slate-400">livediagram.app</span>
            </span>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// Technology icons: full-colour cloud + brand tiles (AWS, Azure,
// Cloudflare, Firebase, plus a vendor-neutral set) for architecture
// diagrams, a brand highlight cycling across them like the real
// Technology picker.
export function TechIconsArt() {
  const tiles = [
    { label: 'AWS', bg: '#ff9900' },
    { label: 'Azure', bg: '#0078d4' },
    { label: 'CF', bg: '#f38020' },
    { label: 'Fire', bg: '#ffa000' },
    { label: 'K8s', bg: '#326ce5' },
    { label: 'Docker', bg: '#2496ed' },
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-1.5 px-3">
        <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">
          Technology
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {tiles.map((t, i) => (
            <span
              key={t.label}
              className="relative flex h-7 items-center justify-center rounded text-[8px] font-bold text-white shadow-sm"
              style={{ backgroundColor: t.bg }}
            >
              {t.label}
              <span
                className="fa-hl pointer-events-none absolute inset-0 rounded ring-2 ring-brand-500"
                style={{ animationDelay: `${i * 0.6}s` }}
              />
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// Ready-made components (spec/09): drop-in composites (Banner, Stat row, Hero,
// Header, Callout, Process) assembled from primitives, themed and fully
// editable. Shown as a Banner over a Stat row, dropping in.
export function ComponentsArt() {
  const stats = [
    { n: '128', cap: 'Users' },
    { n: '94%', cap: 'Uptime' },
    { n: '12', cap: 'Teams' },
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-2 px-3">
        {/* Banner — accent bar with title + subtitle */}
        <div className="fa-pop rounded-md bg-brand-500 px-2 py-1.5 text-white">
          <p className="text-[9px] font-semibold leading-tight">Launch plan</p>
          <p className="text-[7px] leading-tight text-brand-50">Q3 rollout overview</p>
        </div>
        {/* Stat row — three KPI cards */}
        <div className="flex gap-1.5">
          {stats.map((s, i) => (
            <div
              key={s.cap}
              className="fa-pop flex flex-1 flex-col items-center rounded-md border border-slate-200 bg-white py-1"
              style={{ animationDelay: `${0.4 + i * 0.3}s` }}
            >
              <span className="text-[11px] font-bold leading-none text-brand-600">{s.n}</span>
              <span className="mt-0.5 text-[6px] font-medium uppercase tracking-wide text-slate-400">
                {s.cap}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}
