import { useState } from 'react';
import { useShowMoreList } from '@/hooks/useShowMoreList';
import type { Participant } from '@/lib/identity';
import { initialsOf, randomName } from '@/lib/identity';
import { shufflePinned } from '@/lib/shuffle';
import type { TemplateKind } from '@/lib/templates';
import { TEMPLATES } from '@/lib/templates';
import { THEMES, type ThemeId } from '@/lib/themes';

// First-batch sizes for the shuffled grids — kept equal to the curated
// default set (the non-`extra` entries) so the picker still opens to two
// tidy rows. Shuffling only changes WHICH options fill those slots, not
// how many; "Show more" then reveals the full catalogue.
const TEMPLATE_VISIBLE_COUNT = TEMPLATES.filter((t) => !t.extra).length;
const THEME_VISIBLE_COUNT = THEMES.filter((t) => !t.extra).length;
import { ShowMoreButton } from './ShowMoreButton';
import { TemplatePreview } from './template-preview';
import { ThemeSwatch } from './ThemeSwatch';
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
  // and the empty-state card prompts the next step. Triggered by the X in
  // the header (all modes) or the Cancel button (non-welcome modes only —
  // the welcome screen has no Skip/Cancel, just Create + the header X).
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
  // Rotate which templates + themes greet the user on each open so
  // people keep discovering options beyond the usual first rows, but
  // always pin the sensible default first (Blank diagram, Brand theme).
  // Shuffled once per mount via lazy useState so clicking around the
  // grid never reshuffles it underfoot.
  const [templates] = useState(() => shufflePinned(TEMPLATES, (t) => t.kind === 'blank'));
  const [themes] = useState(() => shufflePinned(THEMES, (t) => t.id === 'brand'));
  // "Show more" opt-ins for the templates + themes grids. Count mode
  // keeps the first batch compact while letting shuffled extras surface
  // up front; the hook auto-expands when the active pick lands in the
  // hidden tail so the user always sees their current selection.
  const templatePicker = useShowMoreList(
    templates,
    (t) => t.kind === templateKind,
    TEMPLATE_VISIBLE_COUNT,
  );
  const themePicker = useShowMoreList(themes, (t) => t.id === themeId, THEME_VISIBLE_COUNT);
  const trimmedName = name.trim();
  const effectiveName = trimmedName || participant.name;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
    >
      <div
        className={`pointer-events-auto flex h-full w-full animate-fly-up-in flex-col bg-white dark:bg-slate-900 sm:h-auto sm:max-h-[90vh] ${isIdentity ? 'sm:w-[26rem]' : 'sm:w-[44rem]'} sm:max-w-[92%] sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-2xl sm:shadow-slate-900/10 dark:sm:border-slate-800 dark:sm:shadow-black/40`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {isWelcome
                ? 'Quick Start'
                : isIdentity
                  ? diagramName && diagramName.trim()
                    ? `Welcome to '${diagramName.trim()}'`
                    : 'Welcome to this diagram'
                  : 'Pick a template'}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {isWelcome
                ? 'Pick a template and a theme to start with.'
                : isIdentity
                  ? nameLocked
                    ? 'This is the name from your account; others will see it on this diagram.'
                    : 'Pick the name people will see while you collaborate on this diagram.'
                  : 'Pick a template and theme to apply to this tab.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Identity row — first-run welcome + join-existing-diagram flows. */}
          {showIdentity ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
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
                  className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
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
                      ? 'mt-0.5 w-full cursor-default bg-transparent text-sm text-slate-500 outline-none dark:text-slate-400'
                      : 'mt-0.5 w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500'
                  }
                />
              </div>
              {nameLocked ? null : (
                <Tooltip title="Shuffle name" description="Pick a different random name.">
                  <button
                    type="button"
                    onClick={() => setName(randomName())}
                    aria-label="Generate a different name"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
                className={`text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${showIdentity ? 'mt-5' : ''}`}
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
                          ? 'flex flex-col items-start gap-1.5 rounded-lg border-2 border-brand-400 bg-brand-50 p-2 text-left dark:border-brand-500 dark:bg-brand-500/15'
                          : 'flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
                      }
                    >
                      {/* Preview tiles are illustrative mini-canvases (light
                          SVG content), so the tile keeps a light backdrop in
                          dark mode to stay legible. */}
                      <div className="flex h-14 w-full items-center justify-center rounded-md bg-slate-50 dark:bg-slate-200">
                        <TemplatePreview kind={t.kind} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {t.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
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
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Select a theme
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {themePicker.visible.map((t) => {
                  const active = themeId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setThemeId(t.id)}
                      // Double-click commits with this theme — same
                      // shortcut the template tiles offer (select + submit
                      // in one gesture), using the currently-picked
                      // template + entered name.
                      onDoubleClick={() => onPick(templateKind, effectiveName, t.id)}
                      aria-pressed={active}
                      className={
                        active
                          ? 'flex flex-col items-center gap-1 rounded-md border-2 border-brand-400 bg-brand-50 p-1.5 text-[10px] font-medium text-brand-800 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-200'
                          : 'flex flex-col items-center gap-1 rounded-md border border-slate-200 bg-white p-1.5 text-[10px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
                      }
                    >
                      <ThemeSwatch theme={t} size="md" />
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

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3 dark:border-slate-800">
          <p className="mr-auto text-[11px] text-slate-500 dark:text-slate-400">
            {isWelcome
              ? 'You can change these later from the Palette.'
              : isIdentity
                ? 'Other participants will see this name on your cursor and comments.'
                : 'Existing content on this tab will be replaced.'}
          </p>
          {/* No Skip button on the welcome / new-diagram screen — Create is
              the only forward action, and the header X still dismisses to a
              blank canvas. Other modes keep their Cancel escape. */}
          {!isWelcome ? (
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          ) : null}
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
