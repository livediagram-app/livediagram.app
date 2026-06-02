import { useState } from 'react';
import { useShowMoreList } from '@/hooks/useShowMoreList';
import type { Participant } from '@/lib/identity';
import { initialsOf, randomName } from '@/lib/identity';
import type { TemplateKind } from '@/lib/templates';
import { TEMPLATES } from '@/lib/templates';
import { THEMES, type ThemeId } from '@/lib/themes';
import { ShowMoreButton } from './ShowMoreButton';
import { Tooltip } from './Tooltip';

type TemplatePickerProps = {
  // 'welcome' — first-run modal: identity, template, theme, confirm.
  // 'templates' — opened from the empty-state card's "Browse templates"
  // button on an existing tab; just the template grid + Apply. Keeps the
  // current participant name + current tab theme untouched.
  // 'identity' — a participant has joined an existing diagram and hasn't
  // confirmed their name yet. Identity section only (no templates, no
  // theme grid); confirm becomes "Join".
  mode: 'welcome' | 'templates' | 'identity';
  // The user's current identity. Their name is editable inside the picker
  // in welcome mode and hidden in templates-only mode.
  participant: Participant;
  // Theme currently applied to the active tab — used as the initial /
  // only theme in templates-only mode.
  currentThemeId: ThemeId;
  // Name of the diagram being joined. Used by the 'identity' mode to
  // greet visitors with the actual diagram name ("Welcome to 'API
  // sketch'") instead of the generic "Welcome to this diagram".
  diagramName?: string;
  // When provided, the visitor is signed in and their display name is
  // dictated by their Clerk account — the input becomes read-only and
  // the shuffle button hides so they can't masquerade under a
  // different identity on someone else's diagram. Has no effect in
  // 'welcome' / 'templates' modes (no identity row to lock).
  lockedName?: string | null;
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
  diagramName,
  lockedName,
  onPick,
  onSkip,
}: TemplatePickerProps) {
  const isWelcome = mode === 'welcome';
  const isIdentity = mode === 'identity';
  // Identity / "your name" moved entirely into the Share flow — there's
  // no reason to collect it before the user explicitly shares. The
  // 'identity' mode is still used for visitors landing on a share URL
  // who need to confirm their display name first.
  const showIdentity = isIdentity;
  const showTemplates = !isIdentity;
  // Themes are pickable wherever templates are — both the first-run
  // welcome AND the standalone Browse-templates flow. Identity-only
  // mode (visitors joining via a share link) skips them.
  const showThemes = !isIdentity;
  // Locked-name (signed-in visitor) wins over the participant name —
  // we want the input to read the Clerk identity even if the
  // pre-existing participant record was created under a guest alias.
  const [name, setName] = useState(lockedName ?? participant.name);
  const nameLocked = !!lockedName;
  const [templateKind, setTemplateKind] = useState<TemplateKind>('blank');
  const [themeId, setThemeId] = useState<ThemeId>(currentThemeId);
  // "Show more" opt-ins for the templates + themes grids. The hook
  // auto-expands when the active selection is itself an extra so
  // the user always sees their current pick.
  const templatePicker = useShowMoreList(TEMPLATES, (t) => t.kind === templateKind);
  const themePicker = useShowMoreList(THEMES, (t) => t.id === themeId);
  const trimmedName = name.trim();
  const effectiveName = trimmedName || participant.name;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
    >
      <div
        className={`pointer-events-auto flex h-full w-full animate-fly-up-in flex-col bg-white sm:h-auto sm:max-h-[90vh] ${isIdentity ? 'sm:w-[26rem]' : 'sm:w-[44rem]'} sm:max-w-[92%] sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-2xl sm:shadow-slate-900/10`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isWelcome
                ? 'Quick Start'
                : isIdentity
                  ? diagramName && diagramName.trim()
                    ? `Welcome to '${diagramName.trim()}'`
                    : 'Welcome to this diagram'
                  : 'Pick a template'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {isWelcome
                ? 'Pick a template and a theme to start with.'
                : isIdentity
                  ? nameLocked
                    ? 'This is the name from your account — others will see it on this diagram.'
                    : 'Pick the name people will see while you collaborate on this diagram.'
                  : 'Pick a template and theme to apply to this tab.'}
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
          {/* Identity row — first-run welcome + join-existing-diagram flows. */}
          {showIdentity ? (
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
                  readOnly={nameLocked}
                  aria-readonly={nameLocked}
                  // Locked: the value comes from Clerk; greying it out
                  // + removing focus affordance makes it visually
                  // obvious it isn't editable, but the input stays
                  // present so the name is still visible.
                  className={
                    nameLocked
                      ? 'mt-0.5 w-full cursor-default bg-transparent text-sm text-slate-500 outline-none'
                      : 'mt-0.5 w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400'
                  }
                />
              </div>
              {nameLocked ? null : (
                <Tooltip title="Shuffle name" description="Pick a different random name.">
                  <button
                    type="button"
                    onClick={() => setName(randomName())}
                    aria-label="Generate a different name"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <RefreshIcon />
                  </button>
                </Tooltip>
              )}
            </div>
          ) : null}

          {/* Template grid. 4 columns at wide widths so the picker uses the
              modal width instead of stretching cards vertically. */}
          {showTemplates ? (
            <>
              <p
                className={`text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${showIdentity ? 'mt-5' : ''}`}
              >
                Pick a template
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {templatePicker.visible.map((t) => {
                  const active = templateKind === t.kind;
                  return (
                    <button
                      key={t.kind}
                      type="button"
                      onClick={() => setTemplateKind(t.kind)}
                      // Double-click is a "commit shortcut" — same as
                      // clicking the template to select it + then
                      // clicking the primary Create button. Picks up
                      // whichever theme is currently selected and the
                      // entered name; saves a click for users who
                      // know what they want.
                      onDoubleClick={() => onPick(t.kind, effectiveName, themeId)}
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
              {templatePicker.hasMore && !templatePicker.showAll ? (
                <ShowMoreButton label="Show more templates" onClick={templatePicker.reveal} />
              ) : null}
            </>
          ) : null}

          {/* Theme grid — only in the first-run welcome flow; existing
              tabs keep whichever theme they already have. */}
          {showThemes ? (
            <>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Select a theme
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {themePicker.visible.map((t) => {
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
              {themePicker.hasMore && !themePicker.showAll ? (
                <ShowMoreButton label="Show more themes" onClick={themePicker.reveal} />
              ) : null}
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3">
          <p className="mr-auto text-[11px] text-slate-500">
            {isWelcome
              ? 'You can change these later from the Palette.'
              : isIdentity
                ? 'Other participants will see this name on your cursor and comments.'
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
            {isWelcome ? 'Create' : isIdentity ? 'Join' : 'Apply'}
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
    case 'kanban':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* Three columns: To do (slate), In progress (blue), Done (green). */}
          {[
            { x: 4, fill: 'rgb(241 245 249)', stroke: 'rgb(203 213 225)' },
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
              {[13, 23, 33].map((sy) => (
                <rect
                  key={sy}
                  x={col.x + 2}
                  y={sy}
                  width="16"
                  height="7"
                  rx="1"
                  fill="white"
                  stroke="rgb(148 163 184)"
                  strokeWidth="0.5"
                />
              ))}
            </g>
          ))}
        </svg>
      );
    case 'swot':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {[
            { x: 4, y: 3, fill: 'rgb(220 252 231)', stroke: 'rgb(134 239 172)' },
            { x: 42, y: 3, fill: 'rgb(254 226 226)', stroke: 'rgb(252 165 165)' },
            { x: 4, y: 25, fill: 'rgb(219 234 254)', stroke: 'rgb(147 197 253)' },
            { x: 42, y: 25, fill: 'rgb(254 243 199)', stroke: 'rgb(252 211 77)' },
          ].map((q, i) => (
            <rect
              key={i}
              x={q.x}
              y={q.y}
              width="34"
              height="22"
              rx="2"
              fill={q.fill}
              stroke={q.stroke}
              strokeWidth="0.75"
            />
          ))}
        </svg>
      );
    case 'timeline':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          <line x1="6" y1="25" x2="74" y2="25" stroke="rgb(100 116 139)" strokeWidth="1.5" />
          {[14, 28, 42, 56, 70].map((mx, i) => (
            <g key={mx}>
              <circle
                cx={mx}
                cy="25"
                r="3"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="1"
              />
              <rect
                x={mx - 6}
                y={i % 2 === 0 ? 9 : 36}
                width="12"
                height="6"
                rx="0.5"
                fill="white"
                stroke="rgb(148 163 184)"
                strokeWidth="0.5"
              />
              <line
                x1={mx}
                y1={i % 2 === 0 ? 15 : 31}
                x2={mx}
                y2={i % 2 === 0 ? 22 : 36}
                stroke="rgb(148 163 184)"
                strokeWidth="0.5"
              />
            </g>
          ))}
        </svg>
      );
    case 'venn':
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          {/* Three semi-transparent outlined circles arranged in a triangle. */}
          <circle
            cx="35"
            cy="18"
            r="14"
            fill="rgb(186 230 253)"
            fillOpacity="0.45"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <circle
            cx="24"
            cy="32"
            r="14"
            fill="rgb(254 226 226)"
            fillOpacity="0.45"
            stroke="rgb(248 113 113)"
            strokeWidth="1"
          />
          <circle
            cx="46"
            cy="32"
            r="14"
            fill="rgb(220 252 231)"
            fillOpacity="0.45"
            stroke="rgb(74 222 128)"
            strokeWidth="1"
          />
        </svg>
      );
    case 'journey':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          {/* Four stage boxes in a row with arrows between, sticky-note row below. */}
          {[6, 24, 42, 60].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="6"
                width="12"
                height="9"
                rx="1"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="0.75"
              />
              <rect
                x={x}
                y="28"
                width="12"
                height="10"
                rx="1"
                fill="rgb(254 243 199)"
                stroke="rgb(252 211 77)"
                strokeWidth="0.75"
              />
            </g>
          ))}
          {[18, 36, 54].map((mx) => (
            <line
              key={mx}
              x1={mx}
              y1="10"
              x2={mx + 6}
              y2="10"
              stroke="rgb(100 116 139)"
              strokeWidth="1"
              markerEnd=""
            />
          ))}
        </svg>
      );
    case 'fishbone':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          {/* Horizontal spine with effect box at the right. */}
          <line x1="6" y1="25" x2="62" y2="25" stroke="rgb(100 116 139)" strokeWidth="1.25" />
          <rect
            x="62"
            y="20"
            width="14"
            height="10"
            rx="1"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.75"
          />
          {/* Two upper and two lower diagonal branches. */}
          {[
            { x1: 16, y1: 6, x2: 28, y2: 25 },
            { x1: 36, y1: 6, x2: 48, y2: 25 },
            { x1: 16, y1: 44, x2: 28, y2: 25 },
            { x1: 36, y1: 44, x2: 48, y2: 25 },
          ].map((b, i) => (
            <line
              key={i}
              x1={b.x1}
              y1={b.y1}
              x2={b.x2}
              y2={b.y2}
              stroke="rgb(100 116 139)"
              strokeWidth="0.75"
            />
          ))}
          {/* Small category labels at the ends of each branch. */}
          {[
            { x: 8, y: 4 },
            { x: 30, y: 4 },
            { x: 8, y: 42 },
            { x: 30, y: 42 },
          ].map((c, i) => (
            <rect
              key={i}
              x={c.x}
              y={c.y}
              width="12"
              height="5"
              rx="0.5"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.5"
            />
          ))}
        </svg>
      );
    case 'pyramid':
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          {/* Four tiers stacked; each row narrower than the one below to read as a pyramid. */}
          {[
            { x: 28, y: 6, w: 14, h: 9 },
            { x: 22, y: 16, w: 26, h: 9 },
            { x: 16, y: 26, w: 38, h: 9 },
            { x: 10, y: 36, w: 50, h: 9 },
          ].map((t, i) => (
            <rect
              key={i}
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              rx="1"
              fill={i === 0 ? 'rgb(186 230 253)' : 'rgb(241 245 249)'}
              stroke="rgb(148 163 184)"
              strokeWidth="0.75"
            />
          ))}
        </svg>
      );
    case 'mobile-wireframe':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* Three phone silhouettes with stacked content rows. */}
          {[6, 30, 54].map((px) => (
            <g key={px}>
              <rect
                x={px}
                y="3"
                width="20"
                height="44"
                rx="2.5"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.85"
              />
              {/* Notch / status strip */}
              <rect x={px + 2} y="5.5" width="16" height="1.5" rx="0.4" fill="rgb(186 230 253)" />
              {/* Header strip */}
              <rect
                x={px + 2}
                y="9"
                width="16"
                height="3"
                rx="0.5"
                fill="rgb(219 234 254)"
                stroke="rgb(147 197 253)"
                strokeWidth="0.4"
              />
              {/* Three content cards */}
              {[15, 22, 29].map((cy) => (
                <rect
                  key={cy}
                  x={px + 2}
                  y={cy}
                  width="16"
                  height="5"
                  rx="0.5"
                  fill="white"
                  stroke="rgb(148 163 184)"
                  strokeWidth="0.4"
                />
              ))}
              {/* Bottom tab bar */}
              <rect
                x={px + 2}
                y="40"
                width="16"
                height="4.5"
                rx="0.5"
                fill="rgb(241 245 249)"
                stroke="rgb(203 213 225)"
                strokeWidth="0.4"
              />
            </g>
          ))}
        </svg>
      );
    case 'laptop-wireframe':
      return (
        <svg width="80" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* Laptop body trapezoid + screen with header / sidebar / content / cards. */}
          <polygon
            points="4,38 76,38 72,42 8,42"
            fill="rgb(226 232 240)"
            stroke="rgb(100 116 139)"
            strokeWidth="0.6"
          />
          <rect
            x="8"
            y="6"
            width="64"
            height="32"
            rx="1.5"
            fill="white"
            stroke="rgb(100 116 139)"
            strokeWidth="0.85"
          />
          {/* Header strip */}
          <rect
            x="10"
            y="8"
            width="60"
            height="4"
            rx="0.4"
            fill="rgb(219 234 254)"
            stroke="rgb(147 197 253)"
            strokeWidth="0.4"
          />
          <circle cx="67" cy="10" r="1.4" fill="rgb(186 230 253)" />
          {/* Sidebar */}
          <rect
            x="10"
            y="13"
            width="14"
            height="23"
            rx="0.4"
            fill="rgb(241 245 249)"
            stroke="rgb(203 213 225)"
            strokeWidth="0.4"
          />
          {[15, 19, 23, 27, 31].map((sy) => (
            <rect
              key={sy}
              x="11.5"
              y={sy}
              width="11"
              height="2.4"
              rx="0.3"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.3"
            />
          ))}
          {/* Three stat cards */}
          {[25, 39, 53].map((cx) => (
            <rect
              key={cx}
              x={cx}
              y="15"
              width="13"
              height="8"
              rx="0.4"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.4"
            />
          ))}
          {/* Wider content row */}
          <rect
            x="25"
            y="25"
            width="45"
            height="10"
            rx="0.4"
            fill="white"
            stroke="rgb(148 163 184)"
            strokeWidth="0.4"
          />
        </svg>
      );
    case 'slide-deck':
      return (
        <svg width="80" height="46" viewBox="0 0 80 50" aria-hidden>
          {/* 2x2 grid of plain rectangle slides, each with a title
              band + content bullets, joined by reading-order arrows. */}
          {[
            { x: 4, y: 3 },
            { x: 42, y: 3 },
            { x: 4, y: 26 },
            { x: 42, y: 26 },
          ].map((s, i) => (
            <g key={i}>
              <rect
                x={s.x}
                y={s.y}
                width="34"
                height="20"
                rx="1.25"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.75"
              />
              {/* Heading stadium */}
              <rect
                x={s.x + 2.5}
                y={s.y + 2}
                width="29"
                height="4"
                rx="2"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="0.4"
              />
              {/* Slide-specific content */}
              {i === 0 ? (
                <>
                  <rect
                    x={s.x + 4}
                    y={s.y + 9}
                    width="22"
                    height="2.5"
                    rx="0.3"
                    fill="rgb(226 232 240)"
                  />
                  <rect
                    x={s.x + 4}
                    y={s.y + 16}
                    width="14"
                    height="2.5"
                    rx="1.2"
                    fill="rgb(186 230 253)"
                  />
                </>
              ) : i === 1 ? (
                [9, 12.5, 16].map((ry) => (
                  <g key={ry}>
                    <rect
                      x={s.x + 3}
                      y={s.y + ry}
                      width="3"
                      height="2.4"
                      rx="0.3"
                      fill="rgb(241 245 249)"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.3"
                    />
                    <rect
                      x={s.x + 7}
                      y={s.y + ry}
                      width="24"
                      height="2.4"
                      rx="0.3"
                      fill="white"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.3"
                    />
                  </g>
                ))
              ) : i === 2 ? (
                [4, 14, 24].map((rx) => (
                  <g key={rx}>
                    <rect
                      x={s.x + rx}
                      y={s.y + 9}
                      width="8"
                      height="9"
                      rx="0.5"
                      fill="white"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.3"
                    />
                    <circle cx={s.x + rx + 4} cy={s.y + 12} r="1.4" fill="rgb(186 230 253)" />
                  </g>
                ))
              ) : (
                [9, 12.5, 16].map((ry) => (
                  <g key={ry}>
                    <circle
                      cx={s.x + 4.5}
                      cy={s.y + ry + 1.2}
                      r="1"
                      fill="rgb(220 252 231)"
                      stroke="rgb(74 222 128)"
                      strokeWidth="0.3"
                    />
                    <rect
                      x={s.x + 7}
                      y={s.y + ry}
                      width="24"
                      height="2.4"
                      rx="1.2"
                      fill="white"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.3"
                    />
                  </g>
                ))
              )}
            </g>
          ))}
          {/* Connecting arrows showing the reading order 1 → 2 → 4 → 3. */}
          <line x1="38" y1="13" x2="42" y2="13" stroke="rgb(100 116 139)" strokeWidth="0.7" />
          <polygon points="42,13 40.5,12 40.5,14" fill="rgb(100 116 139)" />
          <line x1="59" y1="23" x2="59" y2="26" stroke="rgb(100 116 139)" strokeWidth="0.7" />
          <polygon points="59,26 58,24.5 60,24.5" fill="rgb(100 116 139)" />
          <line x1="42" y1="36" x2="38" y2="36" stroke="rgb(100 116 139)" strokeWidth="0.7" />
          <polygon points="38,36 39.5,35 39.5,37" fill="rgb(100 116 139)" />
        </svg>
      );
    case 'flywheel':
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          {/* Hub + four orbiting sector circles with curved arrows hinting at clockwise motion. */}
          <circle
            cx="35"
            cy="25"
            r="7"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {[
            { cx: 35, cy: 7 },
            { cx: 53, cy: 25 },
            { cx: 35, cy: 43 },
            { cx: 17, cy: 25 },
          ].map((s, i) => (
            <circle
              key={i}
              cx={s.cx}
              cy={s.cy}
              r="5"
              fill="white"
              stroke="rgb(14 165 233)"
              strokeWidth="0.9"
            />
          ))}
          {/* Clockwise arrows (curved using quad paths). */}
          <path
            d="M 41 9 Q 50 12 51 19"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.85"
            strokeLinecap="round"
          />
          <path
            d="M 51 31 Q 50 38 41 41"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.85"
            strokeLinecap="round"
          />
          <path
            d="M 29 41 Q 20 38 19 31"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.85"
            strokeLinecap="round"
          />
          <path
            d="M 19 19 Q 20 12 29 9"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.85"
            strokeLinecap="round"
          />
          {/* Arrowheads on the trailing end of each curve. */}
          <polygon points="51,19 49,17 53,17" fill="rgb(100 116 139)" />
          <polygon points="41,41 39,39 39,43" fill="rgb(100 116 139)" />
          <polygon points="19,31 21,33 17,33" fill="rgb(100 116 139)" />
          <polygon points="29,9 31,11 31,7" fill="rgb(100 116 139)" />
        </svg>
      );
    case 'logo-design':
      // Four mini lockups in a 2x2 grid: top-left icon-left, top-right
      // icon-left-with-tagline, bottom-left icon-above, bottom-right
      // icon-above-with-tagline. Matches the canvas layout the builder
      // produces so the preview previews what users get.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {/* Top-left: icon left, brand only. */}
          <circle
            cx="9"
            cy="11"
            r="4"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect x="16" y="9" width="18" height="4" rx="0.8" fill="rgb(15 23 42)" />
          {/* Top-right: icon left + tagline. */}
          <circle
            cx="48"
            cy="11"
            r="4"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect x="55" y="7" width="18" height="4" rx="0.8" fill="rgb(15 23 42)" />
          <rect x="55" y="12.5" width="14" height="2.5" rx="0.5" fill="rgb(148 163 184)" />
          {/* Bottom-left: icon above, brand only. */}
          <circle
            cx="14"
            cy="32"
            r="4"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect x="5" y="39" width="18" height="4" rx="0.8" fill="rgb(15 23 42)" />
          {/* Bottom-right: icon above + tagline. */}
          <circle
            cx="53"
            cy="30"
            r="4"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect x="44" y="37" width="18" height="4" rx="0.8" fill="rgb(15 23 42)" />
          <rect x="46" y="43" width="14" height="2.5" rx="0.5" fill="rgb(148 163 184)" />
        </svg>
      );
  }
}
