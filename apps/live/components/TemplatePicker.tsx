import { useState } from 'react';
import type { Participant } from '@/lib/identity';
import { initialsOf } from '@/lib/identity';
import type { TemplateKind } from '@/lib/templates';
import { TEMPLATES } from '@/lib/templates';
import { THEMES, type ThemeId } from '@/lib/themes';

type TemplatePickerProps = {
  // The user's current identity. Their name is editable inside the picker;
  // a colour was assigned at participant creation (random from the curated
  // palette) and is shown but not editable here.
  participant: Participant;
  onPick: (kind: TemplateKind, name: string, themeId: ThemeId) => void;
};

// The "Start a new diagram" modal — now also the welcome screen. Lets the
// user adjust their display name (pre-filled with a generated one), pick a
// template AND a theme, then explicitly confirms with a Create button.
// Multi-step pick-then-confirm replaced the previous one-click flow so
// users can preview their choices before committing.
export function TemplatePicker({ participant, onPick }: TemplatePickerProps) {
  const [name, setName] = useState(participant.name);
  const [templateKind, setTemplateKind] = useState<TemplateKind>('blank');
  const [themeId, setThemeId] = useState<ThemeId>('brand');
  const trimmedName = name.trim();
  const effectiveName = trimmedName || participant.name;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
    >
      <div className="pointer-events-auto flex max-h-[90vh] w-[44rem] max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
        <div className="border-b border-slate-100 px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">Welcome to livediagram</h2>
          <p className="mt-1 text-sm text-slate-600">
            Set your name, pick a template, and choose a theme to start with.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Identity row. */}
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
          </div>

          {/* Template grid. 4 columns at wide widths so the picker uses the
              modal width instead of stretching cards vertically. */}
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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

          {/* Theme grid. Same data the palette's Theme accordion uses. */}
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
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3">
          <p className="mr-auto text-[11px] text-slate-500">
            You can change these later from the Palette.
          </p>
          <button
            type="button"
            onClick={() => onPick(templateKind, effectiveName, themeId)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600"
          >
            Create diagram
          </button>
        </div>
      </div>
    </div>
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
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="32"
            y="4"
            width="16"
            height="9"
            rx="1.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <rect
            x="10"
            y="32"
            width="16"
            height="9"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <rect
            x="32"
            y="32"
            width="16"
            height="9"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <rect
            x="54"
            y="32"
            width="16"
            height="9"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <line x1="40" y1="13" x2="40" y2="22" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="18" y1="22" x2="62" y2="22" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="18" y1="22" x2="18" y2="32" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="40" y1="22" x2="40" y2="32" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="62" y1="22" x2="62" y2="32" stroke="rgb(100 116 139)" strokeWidth="1" />
        </svg>
      );
    case 'retrospective':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {[8, 32, 56].map((x) => (
            <g key={x}>
              <line
                x1={x + 8}
                y1="6"
                x2={x + 8}
                y2="11"
                stroke="rgb(100 116 139)"
                strokeWidth="1"
              />
              <rect
                x={x}
                y="14"
                width="16"
                height="10"
                rx="1"
                fill="rgb(254 243 199)"
                stroke="rgb(253 224 71)"
                strokeWidth="0.75"
              />
              <rect
                x={x}
                y="26"
                width="16"
                height="10"
                rx="1"
                fill="rgb(254 243 199)"
                stroke="rgb(253 224 71)"
                strokeWidth="0.75"
              />
              <rect
                x={x}
                y="38"
                width="16"
                height="8"
                rx="1"
                fill="rgb(254 243 199)"
                stroke="rgb(253 224 71)"
                strokeWidth="0.75"
              />
            </g>
          ))}
        </svg>
      );
  }
}
