import { useState } from 'react';
import type { Participant } from '@/lib/identity';
import { initialsOf, randomName } from '@/lib/identity';
import type { TemplateKind } from '@/lib/templates';
import { TEMPLATES } from '@/lib/templates';
import { THEMES, type ThemeId } from '@/lib/themes';

type TemplatePickerProps = {
  // 'welcome' — first-run modal: identity, template, theme, confirm.
  // 'templates' — opened from the empty-state card's "Browse templates"
  // button on an existing tab; just the template grid + Apply. Keeps the
  // current participant name + current tab theme untouched.
  mode: 'welcome' | 'templates';
  // The user's current identity. Their name is editable inside the picker
  // in welcome mode and hidden in templates-only mode.
  participant: Participant;
  // Theme currently applied to the active tab — used as the initial /
  // only theme in templates-only mode.
  currentThemeId: ThemeId;
  onPick: (kind: TemplateKind, name: string, themeId: ThemeId) => void;
  // Dismiss the modal without picking a template or theme. The diagram
  // gets a fresh blank canvas (no seeded rectangle, no theme override)
  // and the empty-state card prompts the next step. Triggered by either
  // the Skip button or the X in the header.
  onSkip: () => void;
};

// The "Start a new diagram" modal — now also the welcome screen. Lets the
// user adjust their display name (pre-filled with a generated one), pick a
// template AND a theme, then explicitly confirms with a Create button.
// Multi-step pick-then-confirm replaced the previous one-click flow so
// users can preview their choices before committing.
export function TemplatePicker({
  mode,
  participant,
  currentThemeId,
  onPick,
  onSkip,
}: TemplatePickerProps) {
  const isWelcome = mode === 'welcome';
  const [name, setName] = useState(participant.name);
  const [templateKind, setTemplateKind] = useState<TemplateKind>('blank');
  const [themeId, setThemeId] = useState<ThemeId>(currentThemeId);
  const trimmedName = name.trim();
  const effectiveName = trimmedName || participant.name;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
    >
      <div className="pointer-events-auto flex max-h-[90vh] w-[44rem] max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isWelcome ? 'Create a new Diagram' : 'Pick a template'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {isWelcome
                ? 'Set your name, pick a template, and choose a theme to start with.'
                : 'Scaffold this tab with a starter diagram. Your current theme stays.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Identity row — only in the first-run welcome flow. */}
          {isWelcome ? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div
              role="img"
              aria-label={`Your avatar colour: ${participant.color}`}
              style={{ backgroundColor: participant.color }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            >
              {initialsOf(effectiveName)}
            </div>
            <div className="flex-1">
              <label
                htmlFor="welcome-name"
                className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500"
              >
                Your name
              </label>
              <input
                id="welcome-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={participant.name}
                className="mt-0.5 w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
            <button
              type="button"
              onClick={() => setName(randomName())}
              aria-label="Generate a different name"
              title="Generate a different name"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <RefreshIcon />
            </button>
          </div>

          ) : null}

          {/* Template grid. 4 columns at wide widths so the picker uses the
              modal width instead of stretching cards vertically. */}
          <p
            className={`text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${isWelcome ? 'mt-5' : ''}`}
          >
            Pick a template
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TEMPLATES.map((t) => {
              const active = templateKind === t.kind;
              return (
                <button
                  key={t.kind}
                  type="button"
                  onClick={() => setTemplateKind(t.kind)}
                  aria-pressed={active}
                  className={
                    active
                      ? 'flex flex-col items-start gap-1.5 rounded-lg border-2 border-brand-400 bg-brand-50 p-2 text-left'
                      : 'flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40'
                  }
                >
                  <div className="flex h-14 w-full items-center justify-center rounded-md bg-slate-50">
                    <TemplatePreview kind={t.kind} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900">{t.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
                      {t.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Theme grid — only in the first-run welcome flow; existing
              tabs keep whichever theme they already have. */}
          {isWelcome ? (
            <>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Select a theme
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {THEMES.map((t) => {
              const active = themeId === t.id;
              const dot = t.elementStroke ?? t.patternColor;
              const swatch = t.elementFill ?? '#ffffff';
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  aria-pressed={active}
                  className={
                    active
                      ? 'flex flex-col items-center gap-1 rounded-md border-2 border-brand-400 bg-brand-50 p-1.5 text-[10px] font-medium text-brand-800'
                      : 'flex flex-col items-center gap-1 rounded-md border border-slate-200 bg-white p-1.5 text-[10px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40'
                  }
                >
                  <span
                    aria-hidden
                    style={{ backgroundColor: t.backgroundColor }}
                    className="flex h-8 w-full items-center justify-center rounded-sm border border-slate-200"
                  >
                    <span
                      style={{ backgroundColor: swatch, borderColor: dot }}
                      className="h-3.5 w-3.5 rounded-sm border"
                    />
                  </span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3">
          <p className="mr-auto text-[11px] text-slate-500">
            {isWelcome
              ? 'You can change these later from the Palette.'
              : 'Existing content on this tab will be replaced.'}
          </p>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {isWelcome ? 'Skip' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => onPick(templateKind, effectiveName, themeId)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600"
          >
            <SparkleIcon />
            {isWelcome ? 'Create Diagram' : 'Apply Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 5.5" />
      <path d="M13.5 2.5v3h-3" />
      <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 10.5" />
      <path d="M2.5 13.5v-3h3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3.5 3.5l7 7M3.5 10.5l7-7" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.5l1.4 3.1L12.5 7l-3.1 1.4L8 11.5 6.6 8.4 3.5 7l3.1-1.4z" />
      <path d="M12.5 11.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
    </svg>
  );
}

function TemplatePreview({ kind }: { kind: TemplateKind }) {
  switch (kind) {
    case 'blank':
      return (
        <svg width="60" height="36" viewBox="0 0 60 40" aria-hidden>
          <rect
            x="6"
            y="4"
            width="48"
            height="32"
            rx="3"
            fill="none"
            stroke="rgb(148 163 184)"
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'mindmap':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          <circle
            cx="40"
            cy="25"
            r="9"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1.25"
          />
          <circle cx="14" cy="25" r="5" fill="none" stroke="rgb(14 165 233)" strokeWidth="1.25" />
          <circle cx="66" cy="25" r="5" fill="none" stroke="rgb(14 165 233)" strokeWidth="1.25" />
          <circle cx="40" cy="6" r="5" fill="none" stroke="rgb(14 165 233)" strokeWidth="1.25" />
          <circle cx="40" cy="44" r="5" fill="none" stroke="rgb(14 165 233)" strokeWidth="1.25" />
          <line x1="31" y1="25" x2="19" y2="25" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="49" y1="25" x2="61" y2="25" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="40" y1="16" x2="40" y2="11" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="40" y1="34" x2="40" y2="39" stroke="rgb(100 116 139)" strokeWidth="1" />
        </svg>
      );
    case 'orgchart':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {/* CEO */}
          <rect
            x="32"
            y="2"
            width="16"
            height="7"
            rx="1.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* VP row */}
          {[6, 33, 60].map((x) => (
            <rect
              key={x}
              x={x}
              y="20"
              width="14"
              height="6"
              rx="1.25"
              fill="none"
              stroke="rgb(14 165 233)"
              strokeWidth="0.9"
            />
          ))}
          {/* 3rd level: 2 reports under each VP */}
          {[
            [4, 12],
            [31, 39],
            [58, 66],
          ].map(([l, r], i) => (
            <g key={i}>
              <rect
                x={l}
                y="40"
                width="8"
                height="5"
                rx="1"
                fill="none"
                stroke="rgb(14 165 233)"
                strokeWidth="0.8"
              />
              <rect
                x={r}
                y="40"
                width="8"
                height="5"
                rx="1"
                fill="none"
                stroke="rgb(14 165 233)"
                strokeWidth="0.8"
              />
            </g>
          ))}
          {/* CEO -> VPs */}
          <line x1="40" y1="9" x2="40" y2="15" stroke="rgb(100 116 139)" strokeWidth="0.85" />
          <line x1="13" y1="15" x2="67" y2="15" stroke="rgb(100 116 139)" strokeWidth="0.85" />
          <line x1="13" y1="15" x2="13" y2="20" stroke="rgb(100 116 139)" strokeWidth="0.85" />
          <line x1="40" y1="15" x2="40" y2="20" stroke="rgb(100 116 139)" strokeWidth="0.85" />
          <line x1="67" y1="15" x2="67" y2="20" stroke="rgb(100 116 139)" strokeWidth="0.85" />
          {/* VPs -> reports */}
          {[13, 40, 67].map((vpX, i) => (
            <g key={i}>
              <line
                x1={vpX}
                y1="26"
                x2={[8, 35, 62][i]}
                y2="40"
                stroke="rgb(100 116 139)"
                strokeWidth="0.7"
              />
              <line
                x1={vpX}
                y1="26"
                x2={[16, 43, 70][i]}
                y2="40"
                stroke="rgb(100 116 139)"
                strokeWidth="0.7"
              />
            </g>
          ))}
        </svg>
      );
    case 'flowchart':
      return (
        <svg width="60" height="44" viewBox="0 0 60 50" aria-hidden>
          {/* Start (stadium) */}
          <rect
            x="14"
            y="2"
            width="20"
            height="7"
            rx="3.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Step 1 (square) */}
          <rect
            x="14"
            y="14"
            width="20"
            height="7"
            rx="1"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Decision (diamond) */}
          <polygon
            points="24,25 33,32 24,39 15,32"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* End (stadium) */}
          <rect
            x="14"
            y="42"
            width="20"
            height="6"
            rx="3"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Side branch */}
          <rect
            x="40"
            y="29"
            width="16"
            height="6"
            rx="1"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Arrows (simple lines) */}
          <line x1="24" y1="9" x2="24" y2="14" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="24" y1="21" x2="24" y2="25" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="24" y1="39" x2="24" y2="42" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="33" y1="32" x2="40" y2="32" stroke="rgb(100 116 139)" strokeWidth="1" />
        </svg>
      );
    case 'retrospective':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* Mad / Sad / Glad tinted containers with header bar + 3 stickies. */}
          {[
            { x: 4, fill: 'rgb(254 226 226)', stroke: 'rgb(252 165 165)' },
            { x: 30, fill: 'rgb(219 234 254)', stroke: 'rgb(147 197 253)' },
            { x: 56, fill: 'rgb(220 252 231)', stroke: 'rgb(134 239 172)' },
          ].map((col) => (
            <g key={col.x}>
              <rect
                x={col.x}
                y="3"
                width="20"
                height="44"
                rx="2"
                fill={col.fill}
                stroke={col.stroke}
                strokeWidth="0.75"
              />
              {[12, 22, 32].map((sy) => (
                <rect
                  key={sy}
                  x={col.x + 2}
                  y={sy}
                  width="16"
                  height="7"
                  rx="0.5"
                  fill="rgb(254 243 199)"
                  stroke="rgb(253 224 71)"
                  strokeWidth="0.5"
                />
              ))}
            </g>
          ))}
        </svg>
      );
  }
}
