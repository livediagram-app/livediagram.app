// Feature illustrations — tabs, reliability, and editor-feature scenes.
// Split from FeatureArt.tsx; see ./shared for Frame + color constants.
import { BLUE_FILL, BLUE_STROKE, Frame, PINK, SKY } from './shared';

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

// Live session tools: a facilitator timer counting down plus dot-votes
// landing on a card, synced to everyone in the room (spec/39).
export function SessionToolsArt() {
  return (
    <Frame canvas>
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <div className="fa-pulse flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          <span className="text-[9px] font-semibold tabular-nums text-slate-700">2:30</span>
        </div>
        <div className="rounded-[3px] border border-sky-600/40 bg-sky-50 px-3 py-1.5">
          <span className="text-[8px] font-medium text-sky-900">Ship the redesign</span>
          <div className="mt-1 flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="fa-pop h-2 w-2 rounded-full bg-brand-500"
                style={{ animationDelay: `${i * 0.35}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}
