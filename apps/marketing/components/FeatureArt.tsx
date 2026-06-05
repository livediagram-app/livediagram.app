// Per-card mini illustrations for the landing page feature grids.
//
// Each export is a small, self-contained mock of the real editor surface
// the card describes, built from the same visual vocabulary as the hero
// (dot-grid canvas, brand-blue rounded shapes, pinned arrows, presence
// avatars, the floating palette / explorer / activity panels). Motion is
// pure CSS (classes + keyframes live in globals.css) so it survives the
// static export with no JS and degrades to a settled frame under
// prefers-reduced-motion.
//
// Shared timing classes: fa-pop, fa-draw, fa-pulse, fa-grow, fa-hl,
// fa-theme-*, fa-arrow-*, fa-paint, fa-lww, fa-tab, fa-reveal, fa-chev,
// fa-laser, fa-spin, fa-dip, fa-swap-*, fa-knob, fa-on/off, fa-fade.

import type { ReactNode } from 'react';

const BLUE_FILL = '#dbeafe';
const BLUE_STROKE = '#0284c7';
const BLUE_TEXT = '#0c4a6e';
const PINK = '#ec4899';
const SKY = '#0ea5e9';

// Bordered surface every illustration sits in. `canvas` paints the
// editor's dot-grid; otherwise it's a plain panel (explorer, dialog…).
function Frame({ children, canvas = false }: { children: ReactNode; canvas?: boolean }) {
  return (
    <div
      aria-hidden
      className={
        'relative mb-5 h-24 w-full overflow-hidden rounded-md border border-slate-200 ' +
        (canvas
          ? 'bg-white bg-[radial-gradient(circle_at_center,_#d8dee8_1px,_transparent_1px)] bg-[size:13px_13px]'
          : 'bg-slate-50')
      }
    >
      {children}
    </div>
  );
}

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

/* ─────────────────────── Section: foundations ────────────────────── */

export function MitArt() {
  return (
    <Frame>
      <div className="flex h-full flex-col items-center justify-center gap-1.5">
        <div
          className="fa-pop flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm"
          style={{ animationDelay: '0.3s' }}
        >
          <GitHubIcon />
          <span className="text-[9px] font-semibold text-slate-700">livediagram</span>
          <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[7px] font-semibold text-white">
            MIT
          </span>
        </div>
        <span className="text-[7px] text-slate-400">editor · api · marketing, all public</span>
      </div>
    </Frame>
  );
}

function GitHubIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="#334155">
      <path d="M8 0C3.6 0 0 3.6 0 8c0 3.5 2.3 6.5 5.5 7.6.4.1.5-.2.5-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8.6-.2 1.3-.3 2-.3.7 0 1.4.1 2 .3 1.5-1 2.2-.8 2.2-.8.5 1.1.2 1.9.1 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.3.6.8.6 1.6v2.3c0 .2.1.5.6.4C13.7 14.5 16 11.5 16 8c0-4.4-3.6-8-8-8z" />
    </svg>
  );
}

export function NoServersArt() {
  const nodes = ['marketing', 'live', 'api', 'router'];
  return (
    <Frame>
      <div className="flex h-full flex-col items-center justify-center gap-2 px-3">
        <div className="flex items-center gap-1 text-[8px] font-medium text-slate-400">
          <CloudIcon /> Cloudflare edge
        </div>
        <div className="flex items-center gap-1.5">
          {nodes.map((n, i) => (
            <span
              key={n}
              className="relative rounded border border-slate-200 bg-white px-1.5 py-1 text-[7px] font-medium text-slate-600"
            >
              <span
                className="fa-pulse absolute inset-0 rounded ring-2 ring-brand-400"
                style={{ animationDelay: `${i * 0.5}s` }}
              />
              <span className="relative">{n}</span>
            </span>
          ))}
        </div>
        <span className="text-[7px] text-slate-400">no VMs · no containers</span>
      </div>
    </Frame>
  );
}

function CloudIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="#f59e0b">
      <path d="M4 12 a3 3 0 0 1 0-6 a4 4 0 0 1 7.6-1 A3 3 0 0 1 12 12 Z" />
    </svg>
  );
}

export function NoTrackingArt() {
  return (
    <Frame>
      <div className="flex h-full flex-col items-center justify-center gap-1.5">
        <svg width="56" height="34" viewBox="0 0 56 34">
          {/* eye */}
          <path
            d="M6 17 C 16 4, 40 4, 50 17 C 40 30, 16 30, 6 17 Z"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
          />
          <circle cx="28" cy="17" r="5" fill="none" stroke="#94a3b8" strokeWidth="2" />
          {/* slash drawing across it */}
          <line
            className="fa-draw"
            x1="8"
            y1="29"
            x2="48"
            y2="5"
            stroke="#f43f5e"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <span
          className="fa-fade text-[8px] font-medium text-slate-500"
          style={{ animationDelay: '0.4s' }}
        >
          0 third-party trackers
        </span>
      </div>
    </Frame>
  );
}

/* ─────────────── Section: simple by design (lead-in) ─────────────────
 * These cards mock the real editor surface like the rest of the page, so
 * the lead-in section stays visually consistent with the sections below. */

// Cursor drawn inside an SVG (vs the HTML Cursor helper) so it can be
// placed precisely in a 220x96 illustration. Optional name label.
function SvgCursor({
  x,
  y,
  color,
  label,
  delay,
}: {
  x: number;
  y: number;
  color: string;
  label?: string;
  delay?: string;
}) {
  // Position with the transform attribute on the outer group; animate the
  // scale on an inner group. (A CSS transform animation on the same element
  // overrides the translate attribute and snaps the element to the origin.)
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="fa-pop" style={{ animationDelay: delay }}>
        <path
          d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z"
          fill={color}
          stroke="white"
          strokeWidth="1"
        />
        {label ? (
          <g>
            <rect x="12" y="-10" width="17" height="11" rx="2" fill={color} />
            <text x="20.5" y="-2" textAnchor="middle" fontSize="7" fontWeight="600" fill="white">
              {label}
            </text>
          </g>
        ) : null}
      </g>
    </g>
  );
}

export function EasyStartArt() {
  // A click creates a shape: the cursor taps (ripple) and a shape pops in.
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <g className="fa-pop" style={{ animationDelay: '0.5s' }}>
          <rect
            x="74"
            y="33"
            width="66"
            height="30"
            rx="15"
            fill={BLUE_FILL}
            stroke={BLUE_STROKE}
            strokeWidth="2"
          />
          <text x="107" y="52" textAnchor="middle" fontSize="12" fontWeight="600" fill={BLUE_TEXT}>
            Start
          </text>
        </g>
        <circle
          className="fa-ripple"
          cx="122"
          cy="60"
          r="7"
          fill="none"
          stroke={SKY}
          strokeWidth="1.5"
        />
        <g transform="translate(118 54)" fill={SKY} stroke="white" strokeWidth="1">
          <path d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z" />
        </g>
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        one click
      </span>
    </Frame>
  );
}

export function DepthArt() {
  // A plain-looking shape, selected, revealing a toolbar of deeper tools.
  const tools = [
    <GroupGlyph key="g" />,
    <LockGlyph key="l" />,
    <LinkGlyph key="k" />,
    <CommentGlyph key="c" />,
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect
          x="28"
          y="38"
          width="58"
          height="30"
          rx="6"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        <rect
          className="fa-pulse"
          x="24"
          y="34"
          width="66"
          height="38"
          rx="9"
          fill="none"
          stroke={SKY}
          strokeWidth="1.5"
        />
      </svg>
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-md">
        {tools.map((g, i) => (
          <span
            key={i}
            className="fa-pop flex h-5 w-5 items-center justify-center rounded text-slate-500"
            style={{ animationDelay: `${0.4 + i * 0.25}s` }}
          >
            {g}
          </span>
        ))}
      </div>
    </Frame>
  );
}

function GroupGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <rect x="2" y="2" width="8" height="8" rx="1.5" />
      <rect x="6" y="6" width="8" height="8" rx="1.5" fill="white" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <rect x="3.5" y="7" width="9" height="6" rx="1.5" />
      <path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7" strokeLinecap="round" />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path
        d="M6.5 9.5 L9.5 6.5 M7 4.5 L9 2.5 a3 3 0 0 1 4 4 L11 8.5 M9 11.5 L7 13.5 a3 3 0 0 1 -4 -4 L5 7.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CommentGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M2.5 3 h11 v7 h-6.5 l-3 2.5 v-2.5 h-1.5 z" strokeLinejoin="round" />
    </svg>
  );
}

export function MultiplayerArt() {
  // The shared canvas: a shape with a remote selection glow and several
  // named cursors arriving.
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect
          x="82"
          y="36"
          width="56"
          height="28"
          rx="6"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        <rect
          className="fa-pulse"
          x="78"
          y="32"
          width="64"
          height="36"
          rx="9"
          fill="none"
          stroke={PINK}
          strokeWidth="2"
        />
        <SvgCursor x={34} y={22} color={SKY} label="TM" delay="0.3s" />
        <SvgCursor x={150} y={58} color={PINK} label="JR" delay="0.8s" />
        <SvgCursor x={58} y={66} color="#8b5cf6" label="AL" delay="1.3s" />
      </svg>
    </Frame>
  );
}

export function AnyDeviceArt() {
  // The same diagram on a laptop, tablet, and phone. A highlight ring
  // cycles across the three (like the template tiles).
  return (
    <Frame>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* shared mini diagram, drawn inside each screen via <use>-like repetition */}
        {/* Laptop */}
        <rect
          x="8"
          y="12"
          width="70"
          height="42"
          rx="3"
          fill="#fff"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />
        <path
          d="M2 58 L84 58 L80 62 L6 62 Z"
          fill="#e2e8f0"
          stroke="#cbd5e1"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <g fill={BLUE_FILL} stroke={BLUE_STROKE} strokeWidth="1.2">
          <line x1="40" y1="27" x2="48" y2="41" stroke={BLUE_STROKE} />
          <rect x="22" y="22" width="18" height="10" rx="2" />
          <rect x="48" y="36" width="18" height="10" rx="2" />
        </g>
        <rect
          className="fa-hl"
          x="4"
          y="8"
          width="78"
          height="50"
          rx="5"
          fill="none"
          stroke={SKY}
          strokeWidth="2"
          style={{ animationDelay: '0s' }}
        />
        <text x="43" y="74" textAnchor="middle" fontSize="7" fontWeight="500" fill="#64748b">
          Laptop
        </text>

        {/* Tablet */}
        <rect
          x="92"
          y="12"
          width="46"
          height="56"
          rx="5"
          fill="#fff"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />
        <g fill={BLUE_FILL} stroke={BLUE_STROKE} strokeWidth="1.2">
          <line x1="110" y1="34" x2="121" y2="44" stroke={BLUE_STROKE} />
          <rect x="100" y="24" width="18" height="10" rx="2" />
          <rect x="113" y="44" width="18" height="10" rx="2" />
        </g>
        <rect
          className="fa-hl"
          x="88"
          y="8"
          width="54"
          height="64"
          rx="7"
          fill="none"
          stroke={SKY}
          strokeWidth="2"
          style={{ animationDelay: '2s' }}
        />
        <text x="115" y="80" textAnchor="middle" fontSize="7" fontWeight="500" fill="#64748b">
          Tablet
        </text>

        {/* Phone */}
        <rect
          x="150"
          y="14"
          width="30"
          height="54"
          rx="5"
          fill="#fff"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />
        <rect x="160" y="17" width="10" height="1.6" rx="0.8" fill="#cbd5e1" />
        <g fill={BLUE_FILL} stroke={BLUE_STROKE} strokeWidth="1.2">
          <line x1="163" y1="34" x2="167" y2="42" stroke={BLUE_STROKE} />
          <rect x="155" y="24" width="20" height="9" rx="2" />
          <rect x="156" y="42" width="20" height="9" rx="2" />
        </g>
        <rect
          className="fa-hl"
          x="146"
          y="10"
          width="38"
          height="62"
          rx="7"
          fill="none"
          stroke={SKY}
          strokeWidth="2"
          style={{ animationDelay: '4s' }}
        />
        <text x="165" y="80" textAnchor="middle" fontSize="7" fontWeight="500" fill="#64748b">
          Phone
        </text>
      </svg>
    </Frame>
  );
}

/* ───────────────────────────── Section: tabs ─────────────────────── */

export function UnlimitedTabsArt() {
  const tabs = ['Overview', 'Backend', 'Data', 'Auth', 'API'];
  return (
    <Frame>
      <div className="flex h-full items-center px-2">
        <div className="flex w-full items-end gap-0.5 border-b border-slate-200">
          {tabs.map((t, i) => (
            <span
              key={t}
              className="fa-pop rounded-t border border-b-0 border-slate-200 bg-white px-1.5 py-1 text-[7px] font-medium text-slate-600"
              style={{ animationDelay: `${i * 0.5}s` }}
            >
              {t}
            </span>
          ))}
          <span
            className="fa-pop px-1 text-[11px] font-bold text-brand-500"
            style={{ animationDelay: `${tabs.length * 0.5}s` }}
          >
            +
          </span>
        </div>
      </div>
    </Frame>
  );
}

function MiniDiagram({
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

export function TabCopyArt() {
  return (
    <Frame>
      <div className="flex h-full items-center justify-center gap-2 px-3">
        <MiniDiagram tabs={[{ c: SKY, on: true }, { c: '#94a3b8' }]} label="Diagram A" />
        <svg width="22" height="14" viewBox="0 0 22 14" className="shrink-0 text-slate-400">
          <path
            d="M2 7 H17 M13 3 L17 7 L13 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <MiniDiagram
          tabs={[{ c: '#94a3b8' }, { c: SKY, on: true, popped: true }]}
          label="Diagram B"
        />
      </div>
    </Frame>
  );
}

export function TabLockArt() {
  return (
    <Frame>
      <div className="flex h-full flex-col items-center justify-center gap-2 px-3">
        <div className="flex items-end gap-0.5 border-b border-slate-200">
          <span className="rounded-t border border-b-0 border-slate-200 bg-slate-50 px-1.5 py-1 text-[7px] text-slate-400">
            Overview
          </span>
          <span className="relative flex items-center gap-0.5 rounded-t border border-b-0 border-brand-300 bg-white px-1.5 py-1 text-[7px] font-medium text-slate-700">
            <LockIcon /> Backend
            <span className="fa-pulse absolute -inset-px rounded-t ring-1 ring-brand-300" />
          </span>
          <span className="rounded-t border border-b-0 border-slate-200 bg-slate-50 px-1.5 py-1 text-[7px] text-slate-400">
            Data
          </span>
        </div>
        <span className="text-[7px] text-slate-400">locked · read-only</span>
      </div>
    </Frame>
  );
}

function LockIcon() {
  return (
    <svg width="7" height="7" viewBox="0 0 16 16" fill="none" stroke="#64748b" strokeWidth="1.6">
      <rect x="3.5" y="7" width="9" height="6" rx="1.5" />
      <path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7" strokeLinecap="round" />
    </svg>
  );
}

export function TabReorderArt() {
  const tabs = [
    { name: 'Backend', c: SKY },
    { name: 'Data', c: PINK },
    { name: 'Auth', c: '#8b5cf6' },
    { name: 'API', c: '#f59e0b' },
  ];
  return (
    <Frame>
      <div className="flex h-full items-center justify-center gap-1 px-3">
        {tabs.map((t, i) => (
          <span
            key={t.name}
            className={
              (i === 1 ? 'fa-arrow-move z-10 shadow-md ' : '') +
              'flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-[7px] font-medium text-slate-600'
            }
          >
            <span className="h-2.5 w-1 rounded-full" style={{ backgroundColor: t.c }} />
            {t.name}
          </span>
        ))}
      </div>
    </Frame>
  );
}

/* ────────────────────────── Section: reliability ─────────────────── */

export function AutosaveArt() {
  return (
    <Frame>
      <div className="flex h-full items-center justify-center px-3">
        <div className="relative h-7 w-28">
          {/* saving */}
          <span className="fa-on absolute inset-0 flex items-center justify-center gap-1.5 rounded-full bg-slate-100 text-[9px] font-medium text-slate-500">
            <svg
              className="fa-spin h-3 w-3"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M8 2 a6 6 0 1 0 6 6" strokeLinecap="round" />
            </svg>
            Saving&hellip;
          </span>
          {/* saved */}
          <span className="fa-off absolute inset-0 flex items-center justify-center gap-1.5 rounded-full bg-brand-50 text-[9px] font-medium text-brand-600">
            <svg
              className="h-3 w-3"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m3.5 8 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Saved
          </span>
        </div>
      </div>
    </Frame>
  );
}

export function UndoRedoArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* a shape whose state toggles, as if a change is applied then undone */}
        <rect className="fa-lww" x="86" y="26" width="48" height="26" rx="6" strokeWidth="2" />
      </svg>
      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
        <span className="fa-pulse flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M6 5 H10 a3.5 3.5 0 0 1 0 7 H5" strokeLinecap="round" />
            <path d="M6 2.5 L3.3 5 L6 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 shadow-sm">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M10 5 H6 a3.5 3.5 0 0 0 0 7 H11" strokeLinecap="round" />
            <path d="M10 2.5 L12.7 5 L10 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </Frame>
  );
}

/* ──────────────────── Section: refine / reliability extras ────────── */

export function GroupArt() {
  // Two shapes bound into one group (the dashed group box grows around them).
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect
          x="58"
          y="28"
          width="44"
          height="22"
          rx="5"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        <rect
          x="118"
          y="46"
          width="44"
          height="22"
          rx="5"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        <rect
          className="fa-grow"
          x="50"
          y="22"
          width="120"
          height="52"
          rx="4"
          fill="rgba(14,165,233,0.06)"
          stroke={SKY}
          strokeWidth="1.5"
          strokeDasharray="5 3"
        />
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        grouped
      </span>
    </Frame>
  );
}

export function LockArt() {
  // A shape switched to read-only, with a padlock popping on.
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect
          x="78"
          y="32"
          width="64"
          height="32"
          rx="6"
          fill="#eef2f7"
          stroke="#94a3b8"
          strokeWidth="2"
        />
        <g transform="translate(110 47)">
          <g className="fa-pop" style={{ animationDelay: '0.4s' }}>
            <rect x="-7" y="-1" width="14" height="11" rx="2" fill="#475569" />
            <path d="M-4 -1 V-4 a4 4 0 0 1 8 0 V-1" fill="none" stroke="#475569" strokeWidth="2" />
            <circle cx="0" cy="4.5" r="1.4" fill="#fff" />
          </g>
        </g>
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        locked
      </span>
    </Frame>
  );
}

export function AccountSyncArt() {
  // The same diagram on a laptop and phone, kept in sync via a free account.
  return (
    <Frame>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* laptop */}
        <rect
          x="14"
          y="22"
          width="58"
          height="34"
          rx="3"
          fill="#fff"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />
        <path
          d="M8 60 L78 60 L74 64 L12 64 Z"
          fill="#e2e8f0"
          stroke="#cbd5e1"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <g fill={BLUE_FILL} stroke={BLUE_STROKE} strokeWidth="1.2">
          <line x1="40" y1="34" x2="46" y2="46" stroke={BLUE_STROKE} />
          <rect x="24" y="30" width="16" height="8" rx="2" />
          <rect x="46" y="42" width="16" height="8" rx="2" />
        </g>
        {/* phone */}
        <rect
          x="156"
          y="20"
          width="28"
          height="50"
          rx="5"
          fill="#fff"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />
        <g fill={BLUE_FILL} stroke={BLUE_STROKE} strokeWidth="1.2">
          <line x1="170" y1="34" x2="171" y2="46" stroke={BLUE_STROKE} />
          <rect x="161" y="28" width="18" height="8" rx="2" />
          <rect x="162" y="44" width="18" height="8" rx="2" />
        </g>
        {/* dotted connectors to the sync cloud */}
        <line
          x1="78"
          y1="42"
          x2="96"
          y2="42"
          stroke="#cbd5e1"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <line
          x1="124"
          y1="42"
          x2="154"
          y2="42"
          stroke="#cbd5e1"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        {/* sync cloud with pulsing arrows */}
        <g transform="translate(98 31)">
          <path
            d="M5 20 a5 5 0 0 1 0 -10 a5.5 5.5 0 0 1 10.5 -1.4 A4 4 0 0 1 19 20 Z"
            fill="#e0f2fe"
            stroke={SKY}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <g className="fa-pulse" stroke={SKY} strokeWidth="1.3" fill="none" strokeLinecap="round">
            <path d="M7.5 13 a4 4 0 0 1 8 -0.6" />
            <path d="M15.5 9.5 v3 h-3" />
            <path d="M16.5 15 a4 4 0 0 1 -8 0.6" />
            <path d="M8.5 18.5 v-3 h3" />
          </g>
        </g>
      </svg>
      <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        free account
      </span>
    </Frame>
  );
}

/* ──────────────── Section: search / images / shortcuts / dark ──────────
 * Cards for the newer editor surfaces. Same vocabulary + shared fa-*
 * timing classes as everything above, no bespoke keyframes. */

// Global search: the modal floats over the (blurred) canvas, a query is
// typed, and grouped results stream in with the first one highlighted, like
// the real SearchPanel (diagram / folder / tab / element scopes).
export function SearchArt() {
  const rows = [
    { kind: 'diagram', name: 'Q3 Architecture', active: true, meta: '' },
    { kind: 'tab', name: 'Auth flow', active: false, meta: 'tab' },
    { kind: 'element', name: 'Auth service', active: false, meta: 'on Backend' },
  ];
  return (
    <Frame canvas>
      <div className="fa-fade absolute left-1/2 top-2 w-[84%] -translate-x-1/2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-1.5">
          <svg
            width="11"
            height="11"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <circle cx="7" cy="7" r="4" />
            <path d="M10 10l3.5 3.5" />
          </svg>
          <span className="text-[8px] font-medium text-slate-600">auth</span>
          <kbd className="ml-auto rounded bg-slate-100 px-1 py-0.5 text-[7px] font-medium text-slate-400">
            Esc
          </kbd>
        </div>
        <div className="py-0.5">
          {rows.map((r, i) => (
            <div
              key={r.name}
              className={
                'fa-pop flex items-center gap-1.5 px-2 py-1 text-[8px] ' +
                (r.active ? 'bg-brand-100 font-medium text-brand-800' : 'text-slate-600')
              }
              style={{ animationDelay: `${0.5 + i * 0.3}s` }}
            >
              <SearchGlyph kind={r.kind} />
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              {r.meta ? <span className="text-[7px] text-slate-400">{r.meta}</span> : null}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function SearchGlyph({ kind }: { kind: string }) {
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

// Images on the canvas: a placed image element (a framed photo) sits selected
// on the dot-grid, and the per-owner gallery strip on the right cycles a
// brand highlight to say "reuse one without re-uploading" (spec/19).
export function ImagesArt() {
  const thumbs = [
    { sky: '#e0f2fe', hill: '#7dd3fc' },
    { sky: '#fce7f3', hill: '#f9a8d4' },
    { sky: '#ede9fe', hill: '#c4b5fd' },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* image element placed on the canvas */}
        <rect
          x="18"
          y="20"
          width="98"
          height="58"
          rx="4"
          fill="#fff"
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        <clipPath id="li-img-clip">
          <rect x="20" y="22" width="94" height="54" rx="3" />
        </clipPath>
        <g clipPath="url(#li-img-clip)">
          <rect x="20" y="22" width="94" height="54" fill="#e0f2fe" />
          <circle cx="44" cy="40" r="9" fill="#fcd34d" />
          <path d="M20 76 L52 46 L74 70 L92 52 L114 76 Z" fill="#7dd3fc" />
          <path d="M20 76 L60 58 L114 76 Z" fill="#38bdf8" />
        </g>
        {/* selection ring + corner handles */}
        <rect
          className="fa-pulse"
          x="14"
          y="16"
          width="106"
          height="66"
          rx="6"
          fill="none"
          stroke={SKY}
          strokeWidth="1.5"
        />
        {(
          [
            [18, 20],
            [116, 20],
            [18, 78],
            [116, 78],
          ] as const
        ).map(([cx, cy], i) => (
          <rect
            key={i}
            x={cx - 2.5}
            y={cy - 2.5}
            width="5"
            height="5"
            rx="1"
            fill="#fff"
            stroke={SKY}
            strokeWidth="1.2"
          />
        ))}
        {/* gallery strip: reuse from your uploads */}
        {thumbs.map((t, i) => (
          <g key={i} transform={`translate(150 ${14 + i * 24})`}>
            <rect
              x="0"
              y="0"
              width="52"
              height="20"
              rx="2.5"
              fill="#fff"
              stroke="#cbd5e1"
              strokeWidth="1"
            />
            <rect x="2" y="2" width="48" height="16" rx="1.5" fill={t.sky} />
            <path d="M2 18 L18 9 L30 16 L40 10 L50 18 Z" fill={t.hill} />
            <rect
              className="fa-hl"
              x="-2"
              y="-2"
              width="56"
              height="24"
              rx="4"
              fill="none"
              stroke={SKY}
              strokeWidth="1.8"
              style={{ animationDelay: `${i * 2}s` }}
            />
          </g>
        ))}
      </svg>
      <span className="absolute left-2 top-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        drag · drop · paste
      </span>
    </Frame>
  );
}

// Keyboard shortcuts: the catalogue from ShortcutsDialog (kbd chips per row)
// plus the per-device enable toggle. One row's keys pulse to read as a press.
export function ShortcutsArt() {
  const rows = [
    { label: 'Undo', keys: ['⌘', 'Z'], live: true },
    { label: 'Redo', keys: ['⌘', '⇧', 'Z'], live: false },
    { label: 'Delete selection', keys: ['Del'], live: false },
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-1 px-3">
        <p className="text-[8px] font-semibold text-slate-700">Keyboard shortcuts</p>
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-2 text-[8px] text-slate-600"
          >
            <span className="truncate">{r.label}</span>
            <span className="flex items-center gap-0.5">
              {r.keys.map((k, ki) => (
                <kbd
                  key={ki}
                  className={
                    (r.live ? 'fa-pulse ' : '') +
                    'inline-flex min-w-[13px] items-center justify-center rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[7px] font-medium text-slate-500'
                  }
                >
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-[7px] text-slate-400">On this device</span>
          <span className="relative inline-flex h-3 w-6 items-center rounded-full bg-brand-500">
            <span className="absolute right-0.5 h-2.5 w-2.5 rounded-full bg-white shadow" />
          </span>
        </div>
      </div>
    </Frame>
  );
}

// Light / dark mode: the same mini-editor crossfades from light to dark while
// the sun/moon toggle slides, mirroring the editor's UI theme switch.
export function DarkModeArt() {
  return (
    <Frame>
      <div className="fa-on absolute inset-0 p-2">
        <MiniEditorMock dark={false} />
      </div>
      <div className="fa-off absolute inset-0 p-2">
        <MiniEditorMock dark />
      </div>
      <span className="absolute bottom-1.5 right-2 inline-flex h-4 w-8 items-center rounded-full bg-slate-200 shadow-sm">
        <span className="fa-off absolute inset-0 rounded-full bg-slate-700" />
        <span className="fa-knob relative z-10 ml-0.5 h-3 w-3 rounded-full bg-white shadow" />
      </span>
    </Frame>
  );
}

function MiniEditorMock({ dark }: { dark: boolean }) {
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

/* ──────────────── Section: versatility (shapes / notes / borders /
 * backdrops). Breadth-of-canvas cards, same vocabulary + shared fa-*
 * timing as the rest. */

// The shape library: ten core shapes plus the five device frames, a
// brand-highlight cycling across the palette like the real Shapes /
// Devices accordions.
export function ShapesArt() {
  const glyphs = [
    'square',
    'circle',
    'diamond',
    'hexagon',
    'browser',
    'phone',
    'tablet',
    'cylinder',
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-1.5 px-3">
        <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">
          Shapes · Devices
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {glyphs.map((g, i) => (
            <span
              key={g}
              className="relative flex h-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500"
            >
              <span
                className="fa-hl pointer-events-none absolute inset-0 rounded ring-2 ring-brand-500"
                style={{ animationDelay: `${i * 0.7}s` }}
              />
              <ShapeGlyph kind={g} />
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function ShapeGlyph({ kind }: { kind: string }) {
  const c = {
    width: 15,
    height: 15,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    'aria-hidden': true,
  } as const;
  switch (kind) {
    case 'square':
      return (
        <svg {...c}>
          <rect x="3" y="3" width="10" height="10" rx="2" />
        </svg>
      );
    case 'circle':
      return (
        <svg {...c}>
          <circle cx="8" cy="8" r="5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...c}>
          <polygon points="8,3 13,8 8,13 3,8" strokeLinejoin="round" />
        </svg>
      );
    case 'hexagon':
      return (
        <svg {...c}>
          <polygon points="4,3 11,3 14,8 11,13 4,13 1,8" strokeLinejoin="round" />
        </svg>
      );
    case 'cylinder':
      return (
        <svg {...c}>
          <path d="M3 5 L3 12 A5 1.5 0 0 0 13 12 L13 5" strokeLinejoin="round" />
          <ellipse cx="8" cy="5" rx="5" ry="1.5" />
        </svg>
      );
    case 'browser':
      return (
        <svg {...c}>
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <line x1="2" y1="6" x2="14" y2="6" />
          <circle cx="4" cy="4.5" r="0.5" fill="currentColor" />
          <circle cx="5.8" cy="4.5" r="0.5" fill="currentColor" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...c}>
          <rect x="5" y="2" width="6" height="12" rx="1.5" />
          <line x1="7" y1="3.4" x2="9" y2="3.4" />
        </svg>
      );
    case 'tablet':
      return (
        <svg {...c}>
          <rect x="3.5" y="2.5" width="9" height="11" rx="1.5" />
          <circle cx="8" cy="12" r="0.5" fill="currentColor" />
        </svg>
      );
  }
  return null;
}

// Per-element notes: a note pinned to a shape, its card fading in like the
// real NotePopover.
export function NotesArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect
          x="22"
          y="36"
          width="64"
          height="32"
          rx="6"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
      </svg>
      {/* note badge on the element */}
      <span className="absolute left-[34%] top-6 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white shadow">
        <span className="fa-pulse absolute inset-0 rounded-full bg-amber-400" />
        <span className="relative">
          <NoteIcon />
        </span>
      </span>
      {/* note card */}
      <div className="fa-fade absolute right-2 top-3 w-[52%] rounded-md border border-amber-200 bg-amber-50 p-1.5 shadow-md">
        <div className="flex items-center gap-1 text-[7px] font-semibold text-amber-700">
          <NoteIcon /> Note
        </div>
        <div className="mt-1 h-1.5 w-full rounded bg-amber-200/80" />
        <div className="mt-0.5 h-1.5 w-3/4 rounded bg-amber-200/80" />
      </div>
    </Frame>
  );
}

function NoteIcon() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M3 2.5 H13 V13.5 H3 Z" strokeLinejoin="round" />
      <path d="M5.5 6 H10.5 M5.5 9 H9" strokeLinecap="round" />
    </svg>
  );
}

// Border styling: three shapes showing solid / dashed / dotted strokes with
// increasing corner radius, the brand highlight cycling between them.
export function BorderStyleArt() {
  const variants = [
    { dash: undefined as string | undefined, rx: 4 },
    { dash: '6 4', rx: 14 },
    { dash: '0.5 4', rx: 22 },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {variants.map((v, i) => {
          const x = 18 + i * 68;
          return (
            <g key={i}>
              <rect
                x={x}
                y="32"
                width="52"
                height="32"
                rx={v.rx}
                fill={BLUE_FILL}
                stroke={BLUE_STROKE}
                strokeWidth="2.5"
                strokeDasharray={v.dash}
                strokeLinecap="round"
              />
              <rect
                className="fa-hl"
                x={x - 4}
                y="28"
                width="60"
                height="40"
                rx={v.rx + 4}
                fill="none"
                stroke={SKY}
                strokeWidth="1.5"
                style={{ animationDelay: `${i * 2}s` }}
              />
            </g>
          );
        })}
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        solid · dashed · dotted
      </span>
    </Frame>
  );
}

// Arrows: the three line styles (straight / curved / angled) stacked, with the
// draggable middle handle shown on the curve (control point) and the elbow
// (bend vertex). The two handles pulse to read as "grab and drag me"; straight
// has none (nothing to bend). Mirrors the editor's arrow handle flow (spec/09).
export function ArrowsArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <defs>
          <marker
            id="li-arrowhead"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill={BLUE_STROKE} />
          </marker>
        </defs>
        {/* straight */}
        <line
          x1="24"
          y1="20"
          x2="150"
          y2="20"
          stroke={BLUE_STROKE}
          strokeWidth="2.5"
          strokeLinecap="round"
          markerEnd="url(#li-arrowhead)"
        />
        {/* curved, with a draggable control knob at the apex */}
        <path
          d="M24 50 Q 87 30, 150 50"
          fill="none"
          stroke={BLUE_STROKE}
          strokeWidth="2.5"
          strokeLinecap="round"
          markerEnd="url(#li-arrowhead)"
        />
        <circle
          className="fa-pulse"
          cx="87"
          cy="40"
          r="6"
          fill="none"
          stroke={SKY}
          strokeWidth="2"
        />
        <circle cx="87" cy="40" r="3.5" fill="#fff" stroke={SKY} strokeWidth="1.5" />
        {/* angled, with a draggable elbow knob at the bend */}
        <path
          d="M24 80 L96 80 L96 66 L150 66"
          fill="none"
          stroke={BLUE_STROKE}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd="url(#li-arrowhead)"
        />
        <circle
          className="fa-pulse"
          cx="96"
          cy="80"
          r="6"
          fill="none"
          stroke={SKY}
          strokeWidth="2"
          style={{ animationDelay: '1s' }}
        />
        <circle cx="96" cy="80" r="3.5" fill="#fff" stroke={SKY} strokeWidth="1.5" />
        {/* style labels */}
        <text x="166" y="23" fontSize="8" fontWeight="500" fill="#94a3b8">
          straight
        </text>
        <text x="166" y="53" fontSize="8" fontWeight="500" fill="#94a3b8">
          curved
        </text>
        <text x="166" y="69" fontSize="8" fontWeight="500" fill="#94a3b8">
          angled
        </text>
      </svg>
      <span className="absolute bottom-1.5 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        drag to bend
      </span>
    </Frame>
  );
}

// Pencil (freehand) + shape recognition: a hand-drawn wobbly stroke draws on
// the left (fa-draw), an arrow points right, and the recognised clean shape
// fades in on the right (fa-fade), under a pulsing magic-wand chip. Mirrors the
// pencil ModeBanner's recognise toggle that mints a real primitive (spec/09).
export function PencilArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* hand-drawn, wobbly rectangle outline being sketched */}
        <path
          className="fa-draw"
          d="M22 34 C 40 30, 64 31, 78 33 C 80 44, 79 56, 77 64 C 58 66, 38 65, 23 63 C 21 52, 21 43, 22 34 Z"
          fill="none"
          stroke={BLUE_STROKE}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* transition arrow */}
        <path
          d="M96 49 H120 M115 44 L121 49 L115 54"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* recognised clean shape */}
        <rect
          className="fa-fade"
          x="138"
          y="32"
          width="58"
          height="34"
          rx="6"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2.5"
        />
      </svg>
      {/* magic-wand recognise chip */}
      <span className="fa-pulse absolute right-2 top-2 flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-brand-600 shadow-sm">
        <WandIcon /> recognise
      </span>
      <span className="absolute bottom-1.5 left-2 flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        <PencilGlyph /> freehand
      </span>
    </Frame>
  );
}

function WandIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 16 16"
      fill="none"
      stroke={BLUE_STROKE}
      strokeWidth="1.5"
    >
      <path d="M3 13 L11 5" strokeLinecap="round" />
      <path
        d="M12 2 l0.7 1.8 L14.5 4.5 l-1.8 0.7 L12 7 l-0.7-1.8 L9.5 4.5 l1.8-0.7 Z"
        fill={BLUE_STROKE}
        stroke="none"
      />
    </svg>
  );
}

function PencilGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="#64748b" strokeWidth="1.5">
      <path d="M11 2.5 L13.5 5 L5 13.5 L2.5 13.5 L2.5 11 Z" strokeLinejoin="round" />
    </svg>
  );
}

// Canvas backdrop: four background patterns in a picker, the brand highlight
// cycling to say "swap the canvas backdrop".
export function CanvasBackdropArt() {
  const pats: { key: string; bg: string; size: string }[] = [
    {
      key: 'grid',
      bg: 'linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)',
      size: '9px 9px',
    },
    {
      key: 'lines',
      bg: 'repeating-linear-gradient(0deg, #cbd5e1 0 1px, transparent 1px 9px)',
      size: 'auto',
    },
    {
      key: 'crosshatch',
      bg: 'repeating-linear-gradient(45deg, #cbd5e1 0 1px, transparent 1px 8px), repeating-linear-gradient(-45deg, #cbd5e1 0 1px, transparent 1px 8px)',
      size: 'auto',
    },
    {
      key: 'dots',
      bg: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)',
      size: '9px 9px',
    },
  ];
  return (
    <Frame>
      <div className="flex h-full items-center justify-center gap-2 px-3">
        {pats.map((p, i) => (
          <div
            key={p.key}
            className="relative h-16 w-1/4 overflow-hidden rounded border border-slate-200 bg-white"
          >
            <span
              className="absolute inset-0"
              style={{ backgroundImage: p.bg, backgroundSize: p.size }}
            />
            <span
              className="fa-hl pointer-events-none absolute inset-0 rounded ring-2 ring-brand-500"
              style={{ animationDelay: `${i * 1.5}s` }}
            />
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ──────────────── Section: AI / rotation / layout (newest) ──────────────
 * The latest editor surfaces. Same vocabulary + shared fa-* timing as
 * everything above, plus the one fa-rotate keyframe for the rotate card. */

// Optional AI assistant: the floating panel (Build / Ask / Review / Clean
// tabs + a prompt) sits over the canvas while freshly generated shapes pop in
// on the left, mirroring the editor's AI Assistant panel (spec/25).
export function AiAssistArt() {
  const tabs = ['Build', 'Ask', 'Review', 'Clean'];
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* shapes the assistant just generated, popping in */}
        <g className="fa-pop" style={{ animationDelay: '0.5s' }}>
          <rect
            x="18"
            y="20"
            width="46"
            height="20"
            rx="5"
            fill={BLUE_FILL}
            stroke={BLUE_STROKE}
            strokeWidth="2"
          />
        </g>
        <line
          className="fa-draw"
          x1="41"
          y1="40"
          x2="50"
          y2="56"
          stroke={BLUE_STROKE}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ animationDelay: '1s' }}
        />
        <g className="fa-pop" style={{ animationDelay: '1.2s' }}>
          <rect
            x="32"
            y="56"
            width="46"
            height="20"
            rx="5"
            fill={BLUE_FILL}
            stroke={BLUE_STROKE}
            strokeWidth="2"
          />
        </g>
      </svg>
      {/* floating assistant panel */}
      <div className="fa-fade absolute right-2 top-2.5 w-[54%] rounded-md border border-slate-200 bg-white p-1.5 shadow-md">
        <div className="flex items-center gap-1 border-b border-slate-100 pb-1">
          <SparkleIcon />
          <span className="text-[8px] font-semibold text-slate-700">Assistant</span>
        </div>
        <div className="mt-1 flex gap-0.5">
          {tabs.map((t, i) => (
            <span
              key={t}
              className={
                'rounded px-1 py-0.5 text-[6.5px] font-medium ' +
                (i === 0 ? 'bg-brand-100 text-brand-700' : 'text-slate-400')
              }
            >
              {t}
            </span>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1 py-0.5">
          <span className="min-w-0 flex-1 truncate text-[7px] text-slate-500">
            Draw a login flow…
          </span>
          <span className="fa-pulse flex h-3.5 w-3.5 items-center justify-center rounded bg-brand-500 text-white">
            <SparkleIcon light />
          </span>
        </div>
      </div>
    </Frame>
  );
}

function SparkleIcon({ light = false }: { light?: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 16 16" fill={light ? '#fff' : BLUE_STROKE} aria-hidden>
      <path d="M8 1 l1.4 4.2 L13.6 6.6 l-4.2 1.4 L8 12.2 l-1.4 -4.2 L2.4 6.6 l4.2 -1.4 Z" />
      <path d="M13 9.5 l0.55 1.65 L15.2 11.7 l-1.65 0.55 L13 13.9 l-0.55 -1.65 L10.8 11.7 l1.65 -0.55 Z" />
    </svg>
  );
}

// Shape rotation: a selected shape with a rotate handle on a stem above it,
// rocking to the 15° snap angle and back. Resize handles are hidden while
// rotating, matching the editor (snaps to 15°, Shift for free) (spec/09).
export function RotateArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <g
          className="fa-rotate"
          style={{ transformBox: 'view-box', transformOrigin: '110px 50px' }}
        >
          {/* selection ring */}
          <rect
            x="74"
            y="30"
            width="72"
            height="40"
            rx="2"
            fill="none"
            stroke={SKY}
            strokeWidth="1.5"
          />
          {/* the shape itself */}
          <rect
            x="78"
            y="34"
            width="64"
            height="32"
            rx="6"
            fill={BLUE_FILL}
            stroke={BLUE_STROKE}
            strokeWidth="2"
          />
          {/* stem + rotate handle */}
          <line x1="110" y1="30" x2="110" y2="17" stroke={SKY} strokeWidth="1.5" />
          <circle cx="110" cy="14" r="4" fill="#fff" stroke={SKY} strokeWidth="1.8" />
          <path
            d="M108.4 14 a1.6 1.6 0 1 1 0.5 1.15"
            fill="none"
            stroke={SKY}
            strokeWidth="1"
            strokeLinecap="round"
          />
        </g>
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        snaps to 15°
      </span>
    </Frame>
  );
}

// Minimal panel layout: the editor chrome crossfades between the standard
// floating panels and the compact dock + popover layout, with the toggle —
// pick how you want to work (always on for mobile) (spec/09, spec/20).
export function MinimalPanelArt() {
  return (
    <Frame canvas>
      {/* standard — floating panels docked on the sides */}
      <div className="fa-on absolute inset-0">
        <div className="absolute bottom-7 left-2 top-2 flex w-7 flex-col items-center gap-1 rounded-md border border-slate-200 bg-white py-1.5 shadow-sm">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-3 w-3 rounded bg-slate-200" />
          ))}
        </div>
        <div className="absolute bottom-7 right-2 top-2 w-12 space-y-1 rounded-md border border-slate-200 bg-white p-1.5 shadow-sm">
          <div className="h-1.5 w-full rounded bg-slate-300" />
          <div className="h-1.5 w-3/4 rounded bg-slate-200" />
          <div className="h-1.5 w-full rounded bg-slate-200" />
        </div>
        <span className="absolute bottom-1.5 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[7px] font-medium text-slate-500 shadow-sm">
          standard panels
        </span>
      </div>
      {/* minimal — compact dock + popover */}
      <div className="fa-off absolute inset-0">
        <div className="absolute bottom-7 left-1/2 w-[46%] -translate-x-1/2 space-y-1 rounded-md border border-slate-200 bg-white p-1.5 shadow-md">
          <div className="h-1.5 w-3/4 rounded bg-slate-300" />
          <div className="h-1.5 w-full rounded bg-slate-200" />
        </div>
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          ))}
        </div>
        <span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[7px] font-medium text-slate-500 shadow-sm">
          compact dock
        </span>
      </div>
      {/* toggle (synced with the crossfade above) */}
      <span className="absolute right-2 top-2 inline-flex h-4 w-8 items-center rounded-full bg-slate-200 shadow-sm">
        <span className="fa-off absolute inset-0 rounded-full bg-brand-500" />
        <span className="fa-knob relative z-10 ml-0.5 h-3 w-3 rounded-full bg-white shadow" />
      </span>
    </Frame>
  );
}
