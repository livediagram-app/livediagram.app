// Feature illustrations — canvas + real-time scenes. Split from
// FeatureArt.tsx; see ./shared for Frame + color constants.
import { BLUE_FILL, BLUE_STROKE, Frame, PINK, SKY } from './shared';

function Cursor({ color, label }: { color: string; label?: string }) {
  return (
    <span className="relative">
      <svg width="13" height="13" viewBox="0 0 16 16" fill={color} stroke="white" strokeWidth="1">
        <path d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z" />
      </svg>
      {label ? (
        <span
          className="absolute -top-2.5 left-3 whitespace-nowrap rounded px-1 py-0.5 text-[8px] font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

/* ───────────────────────── Section: the canvas ───────────────────── */

export function TemplatesArt() {
  const tiles = ['Flowchart', 'Mind map', 'Kanban'];
  return (
    <Frame>
      <div className="flex h-full items-center justify-center gap-2 px-3">
        {tiles.map((name, i) => (
          <div
            key={name}
            className="relative h-16 w-1/3 overflow-hidden rounded border border-slate-200 bg-white p-1"
          >
            <span
              className="fa-hl pointer-events-none absolute inset-0 rounded ring-2 ring-brand-500"
              style={{ animationDelay: `${i * 2}s` }}
            />
            <svg viewBox="0 0 60 32" className="h-8 w-full">
              {i === 0 ? (
                <g fill={BLUE_FILL} stroke={BLUE_STROKE} strokeWidth="1.5">
                  <rect x="22" y="2" width="16" height="8" rx="2" />
                  <rect x="22" y="20" width="16" height="8" rx="2" />
                  <line x1="30" y1="10" x2="30" y2="20" stroke={BLUE_STROKE} />
                </g>
              ) : i === 1 ? (
                <g fill={BLUE_FILL} stroke={BLUE_STROKE} strokeWidth="1.5">
                  <line x1="30" y1="16" x2="12" y2="6" />
                  <line x1="30" y1="16" x2="48" y2="6" />
                  <line x1="30" y1="16" x2="14" y2="26" />
                  <circle cx="30" cy="16" r="5" />
                  <circle cx="11" cy="6" r="3.5" />
                  <circle cx="49" cy="6" r="3.5" />
                  <circle cx="13" cy="26" r="3.5" />
                </g>
              ) : (
                <g fill={BLUE_FILL} stroke={BLUE_STROKE} strokeWidth="1.2">
                  <rect x="4" y="3" width="14" height="26" rx="2" fill="#f1f5f9" stroke="#cbd5e1" />
                  <rect
                    x="23"
                    y="3"
                    width="14"
                    height="26"
                    rx="2"
                    fill="#f1f5f9"
                    stroke="#cbd5e1"
                  />
                  <rect
                    x="42"
                    y="3"
                    width="14"
                    height="26"
                    rx="2"
                    fill="#f1f5f9"
                    stroke="#cbd5e1"
                  />
                  <rect x="6" y="6" width="10" height="5" rx="1.5" />
                  <rect x="25" y="6" width="10" height="5" rx="1.5" />
                  <rect x="25" y="13" width="10" height="5" rx="1.5" />
                </g>
              )}
            </svg>
            <p className="mt-0.5 text-center text-[7px] font-medium text-slate-500">{name}</p>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function ThemesArt() {
  return (
    <Frame>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect className="fa-theme-bg" x="40" y="14" width="140" height="68" rx="8" />
        <g className="fa-theme" strokeWidth="2">
          <rect x="58" y="30" width="46" height="22" rx="6" />
          <rect x="120" y="46" width="46" height="22" rx="6" />
        </g>
        <line
          className="fa-theme"
          x1="104"
          y1="41"
          x2="120"
          y2="57"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        one click
      </span>
    </Frame>
  );
}

export function MarqueeArt() {
  const boxes = [
    { x: 24, y: 30 },
    { x: 86, y: 46 },
    { x: 150, y: 26 },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {boxes.map((b, i) => (
          <g key={i}>
            <rect
              x={b.x}
              y={b.y}
              width="40"
              height="22"
              rx="5"
              fill={BLUE_FILL}
              stroke={BLUE_STROKE}
              strokeWidth="2"
            />
            <rect
              className="fa-pulse"
              x={b.x - 3}
              y={b.y - 3}
              width="46"
              height="28"
              rx="7"
              fill="none"
              stroke={SKY}
              strokeWidth="1.5"
              style={{ animationDelay: '1.2s' }}
            />
          </g>
        ))}
        {/* marquee selection rectangle */}
        <rect
          className="fa-grow"
          x="20"
          y="22"
          width="174"
          height="56"
          rx="2"
          fill="rgba(14,165,233,0.08)"
          stroke={SKY}
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      </svg>
      <span
        className="fa-pop absolute left-1/2 top-1.5 -translate-x-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[8px] font-semibold text-white"
        style={{ animationDelay: '1.4s' }}
      >
        3 selected
      </span>
    </Frame>
  );
}

export function CommentsArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect
          x="26"
          y="34"
          width="58"
          height="30"
          rx="6"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
      </svg>
      {/* comment count badge on the element */}
      <span className="absolute left-[34%] top-5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white shadow">
        <span className="fa-pulse absolute inset-0 rounded-full bg-amber-400" />
        <span className="relative">2</span>
      </span>
      {/* thread popover */}
      <div className="fa-fade absolute right-2 top-3 w-[52%] rounded-md border border-slate-200 bg-white p-1.5 shadow-md">
        <div className="flex items-center gap-1">
          <span
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[6px] font-bold text-white"
            style={{ backgroundColor: PINK }}
          >
            JR
          </span>
          <span className="text-[7px] font-semibold text-slate-600">Jordan</span>
        </div>
        <div className="mt-1 h-1.5 w-full rounded bg-slate-100" />
        <div className="mt-0.5 h-1.5 w-3/4 rounded bg-slate-100" />
      </div>
    </Frame>
  );
}

export function FormatPainterArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* styled source */}
        <rect
          x="26"
          y="35"
          width="54"
          height="26"
          rx="6"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        {/* target adopts the style */}
        <rect className="fa-paint" x="140" y="35" width="54" height="26" rx="6" strokeWidth="2" />
        {/* travelling brush */}
        <g className="fa-brush">
          <circle cx="92" cy="34" r="8" fill="white" stroke="#94a3b8" strokeWidth="1.5" />
          <path d="M88 34 l4 -4 l3 3 l-4 4 z" fill={BLUE_STROKE} />
        </g>
      </svg>
    </Frame>
  );
}

export function TabsArt() {
  const tabs = ['Overview', 'Backend', 'Data'];
  return (
    <Frame>
      <div className="flex h-full flex-col">
        <div className="relative flex items-center gap-1 border-b border-slate-200 px-2 pt-2">
          {/* sliding active indicator */}
          <span
            className="fa-tab absolute bottom-0 left-2 h-[2px] w-[52px] rounded bg-brand-500"
            aria-hidden
          />
          {tabs.map((t) => (
            <span
              key={t}
              className="rounded-t px-1.5 py-1 text-[8px] font-medium text-slate-600"
              style={{ width: 52, display: 'inline-block', textAlign: 'center' }}
            >
              {t}
            </span>
          ))}
          <span className="px-1 text-[10px] text-slate-400">+</span>
        </div>
        <div className="relative flex-1">
          <svg viewBox="0 0 220 56" className="absolute inset-0 h-full w-full">
            <rect
              x="30"
              y="14"
              width="46"
              height="20"
              rx="5"
              fill={BLUE_FILL}
              stroke={BLUE_STROKE}
              strokeWidth="1.8"
            />
            <rect
              x="120"
              y="20"
              width="46"
              height="20"
              rx="5"
              fill={BLUE_FILL}
              stroke={BLUE_STROKE}
              strokeWidth="1.8"
            />
            <line
              className="fa-draw"
              x1="76"
              y1="24"
              x2="120"
              y2="30"
              stroke={BLUE_STROKE}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          {/* cross-tab link chip */}
          <span
            className="fa-fade absolute right-3 top-2 flex items-center gap-0.5 rounded bg-white px-1 py-0.5 text-[7px] font-medium text-brand-600 shadow-sm ring-1 ring-slate-200"
            style={{ animationDelay: '0.6s' }}
          >
            ↗ Data
          </span>
        </div>
      </div>
    </Frame>
  );
}

export function FoldersArt() {
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-1 px-3 text-[8px] text-slate-600">
        <div className="flex items-center gap-1 font-medium">
          <svg
            className="fa-chev"
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            stroke="#64748b"
            strokeWidth="1.5"
          >
            <path d="M2 1 L5 4 L2 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <FolderIcon />
          <span>Product</span>
        </div>
        <div className="fa-reveal ml-4 flex items-center gap-1" style={{ animationDelay: '0s' }}>
          <DiagramIcon />
          <span className="text-slate-500">Architecture</span>
        </div>
        <div className="fa-reveal ml-4 flex items-center gap-1" style={{ animationDelay: '0.15s' }}>
          <DiagramIcon />
          <span className="text-slate-500">Onboarding flow</span>
        </div>
        <div className="ml-0 flex items-center gap-1 text-slate-400">
          <FolderIcon muted />
          <span>Unsorted</span>
        </div>
      </div>
    </Frame>
  );
}

// Tab folders (spec/30): grouping a diagram's TABS along the tab bar,
// distinct from FoldersArt above (filing whole diagrams in the explorer).
export function TabFoldersArt() {
  const members = [
    { name: 'Auth', c: '#8b5cf6' },
    { name: 'API', c: '#f59e0b' },
  ];
  return (
    <Frame>
      <div className="flex h-full items-center justify-center gap-1.5 px-3">
        {/* A folder chip grouping two member tabs. */}
        <span className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1 py-0.5">
          <span className="flex items-center gap-1 px-1 text-[7px] font-semibold text-slate-600">
            <FolderIcon />
            <span>Backend</span>
            <span className="rounded-full bg-slate-200 px-1 text-[6px] font-semibold text-slate-500">
              2
            </span>
          </span>
          {members.map((t) => (
            <span
              key={t.name}
              className="flex items-center gap-1 rounded bg-slate-50 px-1.5 py-1 text-[7px] font-medium text-slate-600"
            >
              <span className="h-2.5 w-1 rounded-full" style={{ backgroundColor: t.c }} />
              {t.name}
            </span>
          ))}
        </span>
        {/* A loose tab outside the folder. */}
        <span className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-[7px] font-medium text-slate-600">
          <span className="h-2.5 w-1 rounded-full" style={{ backgroundColor: SKY }} />
          Notes
        </span>
      </div>
    </Frame>
  );
}

function FolderIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill={muted ? '#cbd5e1' : '#7dd3fc'}
      stroke={muted ? '#94a3b8' : BLUE_STROKE}
      strokeWidth="1"
    >
      <path d="M1.5 4 L6 4 L7.5 5.5 L14.5 5.5 L14.5 13 L1.5 13 Z" strokeLinejoin="round" />
    </svg>
  );
}

function DiagramIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#94a3b8" strokeWidth="1.4">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <line x1="5" y1="6" x2="11" y2="6" />
      <line x1="5" y1="9" x2="9" y2="9" />
    </svg>
  );
}

/* ─────────────────────── Section: real-time ──────────────────────── */

export function PresenceArt() {
  // Presence shows on the tab bar: each tab carries a small stack of the
  // participants currently focused on it (not in the editor header).
  const tabs = [
    { name: 'Overview', people: [{ initials: 'TM', color: SKY, ring: '#22c55e' }] },
    {
      name: 'Backend',
      active: true,
      people: [
        { initials: 'JR', color: PINK, ring: '#22c55e' },
        { initials: 'AL', color: '#8b5cf6', ring: '#f59e0b' },
      ],
    },
    { name: 'Data', people: [] as { initials: string; color: string; ring: string }[] },
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-3 px-3">
        <div className="flex items-end justify-center gap-1.5">
          {tabs.map((t, ti) => (
            <div
              key={t.name}
              className={
                'relative flex flex-col items-center gap-1 rounded-md border px-2 py-1.5 ' +
                (t.active ? 'border-brand-300 bg-white' : 'border-slate-200 bg-slate-50')
              }
            >
              <div className="flex h-[14px] -space-x-1.5">
                {t.people.map((p, i) => (
                  <span
                    key={p.initials}
                    className="fa-pop flex h-[14px] w-[14px] items-center justify-center rounded-full text-[6px] font-bold text-white"
                    style={{
                      backgroundColor: p.color,
                      boxShadow: `0 0 0 1.5px white, 0 0 0 3px ${p.ring}`,
                      animationDelay: `${0.3 + (ti + i) * 0.5}s`,
                    }}
                  >
                    {p.initials}
                  </span>
                ))}
              </div>
              <span className="text-[7px] font-medium text-slate-500">{t.name}</span>
              {t.active ? (
                <span className="absolute -bottom-px left-2 right-2 h-[2px] rounded bg-brand-500" />
              ) : null}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-3 text-[8px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> online
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> away
          </span>
        </div>
      </div>
    </Frame>
  );
}

export function SelectionGlowArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect
          x="78"
          y="33"
          width="64"
          height="32"
          rx="6"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        {/* remote collaborator's coloured glow */}
        <rect
          className="fa-pulse"
          x="73"
          y="28"
          width="74"
          height="42"
          rx="9"
          fill="none"
          stroke={PINK}
          strokeWidth="2.5"
        />
      </svg>
      <span
        className="absolute left-[60%] top-4 rounded px-1 py-0.5 text-[8px] font-semibold text-white shadow"
        style={{ backgroundColor: PINK }}
      >
        JR
      </span>
      <span className="absolute bottom-3 right-6">
        <Cursor color={PINK} />
      </span>
    </Frame>
  );
}

export function RealtimeArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect className="fa-lww" x="79" y="34" width="62" height="30" rx="6" strokeWidth="2" />
      </svg>
      <span className="absolute left-6 top-5">
        <Cursor color={SKY} label="TM" />
      </span>
      <span className="absolute bottom-4 right-5">
        <Cursor color={PINK} label="JR" />
      </span>
      <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        in sync
      </span>
    </Frame>
  );
}

export function ShareLinksArt() {
  const links = [
    { code: '/d/9fk2…', role: 'Edit', cls: 'bg-brand-100 text-brand-700' },
    { code: '/d/qp7x…', role: 'View', cls: 'bg-slate-200 text-slate-600' },
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col gap-1.5 px-3 py-2">
        <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-700">
          <LinkIcon /> Share
        </div>
        {links.map((l, i) => (
          <div
            key={l.role}
            className="fa-pop flex items-center justify-between rounded border border-slate-200 bg-white px-1.5 py-1"
            style={{ animationDelay: `${0.4 + i * 0.7}s` }}
          >
            <span className="font-mono text-[8px] text-slate-500">{l.code}</span>
            <span className={'rounded px-1.5 py-0.5 text-[7px] font-semibold ' + l.cls}>
              {l.role}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function LinkIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke={BLUE_STROKE}
      strokeWidth="1.5"
    >
      <path
        d="M6.5 9.5 L9.5 6.5 M7 4.5 L9 2.5 a3 3 0 0 1 4 4 L11 8.5 M9 11.5 L7 13.5 a3 3 0 0 1 -4 -4 L5 7.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LaserArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* faint reference diagram */}
        <g opacity="0.6">
          <rect
            x="24"
            y="20"
            width="40"
            height="18"
            rx="4"
            fill="#eef2f7"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
          <rect
            x="150"
            y="58"
            width="40"
            height="18"
            rx="4"
            fill="#eef2f7"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
        </g>
        {/* glowing laser trail */}
        <path
          className="fa-laser"
          d="M44 30 C 90 34, 110 70, 170 66"
          fill="none"
          stroke="#f43f5e"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 3px rgba(244,63,94,0.8))' }}
        />
        <circle className="fa-pulse" cx="170" cy="66" r="3.5" fill="#f43f5e" />
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-rose-500 shadow-sm">
        laser
      </span>
    </Frame>
  );
}

export function ActivityArt() {
  const rows = [
    { c: SKY, who: 'You', what: 'added “Ready?”', revert: true },
    { c: PINK, who: 'Jordan', what: 'recoloured 3' },
    { c: '#8b5cf6', who: 'Alex', what: 'grouped 2' },
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col gap-1 px-3 py-2">
        <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Activity</p>
        {rows.map((r, i) => (
          <div
            key={i}
            className="fa-pop flex items-center gap-1.5 rounded px-1 py-0.5 text-[8px]"
            style={{ animationDelay: `${0.3 + i * 0.6}s` }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.c }} />
            <span className="text-slate-600">
              <span className="font-semibold text-slate-700">{r.who}</span> {r.what}
            </span>
            {r.revert ? (
              <span className="fa-pulse ml-auto flex items-center gap-0.5 rounded bg-slate-100 px-1 py-0.5 text-[7px] font-medium text-slate-500">
                <RevertIcon /> revert
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </Frame>
  );
}

function RevertIcon() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M3 8 a5 5 0 1 1 1.5 3.6" strokeLinecap="round" />
      <path d="M3 4 L3 8 L7 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RevokeArt() {
  return (
    <Frame>
      <div className="flex h-full flex-col items-center justify-center gap-2 px-3">
        {/* status badge crossfades Shared ⇄ Private */}
        <div className="relative h-4 w-14 text-center">
          <span className="fa-on absolute inset-0 rounded-full bg-brand-100 text-[8px] font-semibold leading-4 text-brand-700">
            Shared
          </span>
          <span className="fa-off absolute inset-0 rounded-full bg-rose-100 text-[8px] font-semibold leading-4 text-rose-600">
            Private
          </span>
        </div>
        {/* toggle */}
        <span className="relative inline-flex h-4 w-8 items-center rounded-full bg-slate-200">
          <span className="fa-on absolute inset-0 rounded-full bg-brand-500" />
          <span className="fa-knob relative z-10 ml-0.5 h-3 w-3 rounded-full bg-white shadow" />
        </span>
        {/* link row, struck through when revoked */}
        <div className="relative flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5">
          <span className="font-mono text-[8px] text-slate-500">/d/9fk2…</span>
          <span className="fa-off absolute left-1.5 top-1/2 h-[1px] w-[46px] -translate-y-1/2 bg-rose-400" />
        </div>
      </div>
    </Frame>
  );
}

export function TeamsArt() {
  const members = [
    { c: SKY, who: 'You', role: 'Admin', cls: 'bg-brand-100 text-brand-700' },
    { c: PINK, who: 'Jordan', role: 'Member', cls: 'bg-slate-200 text-slate-600' },
    { c: '#8b5cf6', who: 'Alex', role: 'Member', cls: 'bg-slate-200 text-slate-600' },
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col gap-1 px-3 py-2">
        <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-700">
          <TeamIcon /> Design team
          <span className="ml-auto text-[7px] font-medium text-slate-400">3 people</span>
        </div>
        {members.map((m, i) => (
          <div
            key={m.who}
            className="fa-pop flex items-center gap-1.5 rounded px-1 py-0.5 text-[8px]"
            style={{ animationDelay: `${0.3 + i * 0.5}s` }}
          >
            <span
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[6px] font-semibold text-white"
              style={{ backgroundColor: m.c }}
            >
              {m.who[0]}
            </span>
            <span className="font-semibold text-slate-700">{m.who}</span>
            <span className={'ml-auto rounded px-1.5 py-0.5 text-[7px] font-semibold ' + m.cls}>
              {m.role}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function TeamIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke={BLUE_STROKE}
      strokeWidth="1.5"
    >
      <circle cx="5.5" cy="5" r="2.2" />
      <circle cx="11" cy="6" r="1.7" />
      <path d="M1.5 13 a4 4 0 0 1 8 0 M10 13 a3.5 3.5 0 0 1 4.5 -3.3" strokeLinecap="round" />
    </svg>
  );
}

export function ExpiryArt() {
  return (
    <Frame>
      <div className="flex h-full flex-col gap-1.5 px-3 py-2">
        <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-700">
          <ClockIcon /> Link expiry
        </div>
        {/* an active link counting down */}
        <div className="flex items-center justify-between rounded border border-slate-200 bg-white px-1.5 py-1">
          <span className="font-mono text-[8px] text-slate-500">/d/9fk2…</span>
          <span className="fa-pulse rounded bg-brand-100 px-1.5 py-0.5 text-[7px] font-semibold text-brand-700">
            6d left
          </span>
        </div>
        {/* a lapsed link, kept so it can be extended */}
        <div className="flex items-center justify-between rounded border border-slate-200 bg-white px-1.5 py-1">
          <span className="font-mono text-[8px] text-slate-400 line-through">/d/qp7x…</span>
          <span
            className="fa-pop rounded bg-slate-100 px-1.5 py-0.5 text-[7px] font-semibold text-slate-500"
            style={{ animationDelay: '0.7s' }}
          >
            Extend
          </span>
        </div>
      </div>
    </Frame>
  );
}

function ClockIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke={BLUE_STROKE}
      strokeWidth="1.5"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5 L8 8 L10.5 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RefreshArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <g className="fa-dip" fill={BLUE_FILL} stroke={BLUE_STROKE} strokeWidth="2">
          <rect x="36" y="34" width="48" height="24" rx="6" />
          <rect x="132" y="34" width="48" height="24" rx="6" />
          <line x1="84" y1="46" x2="132" y2="46" stroke={BLUE_STROKE} strokeWidth="2" />
        </g>
        {/* reload glyph (translate on the outer group, spin on the inner) */}
        <g transform="translate(110 78)">
          <g className="fa-spin" stroke="#94a3b8" strokeWidth="1.8" fill="none">
            <path d="M-6 0 a6 6 0 1 1 1.8 4.3" strokeLinecap="round" />
            <path d="M-6 -4 L-6 0 L-2 0" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      </svg>
      <span className="absolute bottom-1 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        reload · intact
      </span>
    </Frame>
  );
}
