import { useState } from 'react';
import { CloseIcon } from './CloseIcon';
import { useEscape } from '@/hooks/useEscape';
import type { Participant } from '@/lib/identity';
import { initialsOf, randomName } from '@/lib/identity';
import { shufflePinned } from '@/lib/shuffle';
import type { TemplateCategory, TemplateKind } from '@/lib/templates';
import { TEMPLATE_CATEGORIES, TEMPLATES, templateCategory } from '@/lib/templates';
import {
  THEME_CATEGORIES,
  THEMES,
  type ThemeCategory,
  type ThemeId,
  themeCategory,
} from '@/lib/themes';
import { AnimatedHeightBox } from './AnimatedHeightBox';
import { CategoryCard, TemplateCard } from './template-picker-cards';
import { ThemeCard, ThemeCategoryCard } from './theme-picker-cards';
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
  useEscape(onSkip);
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
  // Free-text filter for the template grid (title / description / kind /
  // category label). Empty = show the whole catalogue.
  const [templateQuery, setTemplateQuery] = useState('');
  // Which category the user has drilled into on the overview, or null
  // for the top-level overview (Blank quick-pick + a card per category).
  // A non-empty search query overrides this and shows flat results.
  const [openCategory, setOpenCategory] = useState<TemplateCategory | null>(null);
  // Initial theme is whatever the caller hands us: the /new flow passes
  // 'brand' (so Basic is pre-selected for a fresh diagram), while a new
  // tab copying an existing one passes that tab's theme.
  const [themeId, setThemeId] = useState<ThemeId>(currentThemeId);
  // Theme browse drill-in, mirroring `openCategory` for templates: null
  // is the overview (Basic quick-pick + a card per theme category). If
  // the pre-selected theme isn't Basic, open its category on mount so the
  // user can see their current theme highlighted rather than buried.
  const [openThemeCategory, setOpenThemeCategory] = useState<ThemeCategory | null>(() =>
    currentThemeId !== 'brand' ? themeCategory(currentThemeId) : null,
  );
  // Rotate which templates + themes greet the user on each open so
  // people keep discovering options beyond the usual first rows, but
  // always pin the sensible default first (Blank diagram, Brand theme).
  // Shuffled once per mount via lazy useState so clicking around the
  // grid never reshuffles it underfoot.
  const [templates] = useState(() => shufflePinned(TEMPLATES, (t) => t.kind === 'blank'));
  const [themes] = useState(() => shufflePinned(THEMES, (t) => t.id === 'brand'));
  const trimmedName = name.trim();
  const effectiveName = trimmedName || participant.name;
  // Keyword filter over the shuffled catalogue. Matches title /
  // description / kind / category label so "design", "uml", "wireframe"
  // etc. all narrow the grid; empty query passes everything through.
  const templateFilter = templateQuery.trim().toLowerCase();
  const filteredTemplates = templateFilter
    ? templates.filter((t) => {
        const catLabel =
          TEMPLATE_CATEGORIES.find((c) => c.id === templateCategory(t.kind))?.label ?? '';
        return [t.title, t.description, t.kind, catLabel].some((field) =>
          field.toLowerCase().includes(templateFilter),
        );
      })
    : templates;
  // Blank is pulled out of the category grouping and shown as a dedicated
  // "start from scratch" card on the overview; `categoryTemplates` returns
  // a category's templates with Blank excluded (it keeps the shuffled
  // order so the preview collages rotate on each open).
  const blankTemplate = TEMPLATES.find((t) => t.kind === 'blank');
  const categoryTemplates = (category: TemplateCategory) =>
    templates.filter((t) => t.kind !== 'blank' && templateCategory(t.kind) === category);
  // Brand is pulled out of the theme grouping and shown as a dedicated
  // quick-pick on the overview, the way Blank is for templates.
  const brandTheme = THEMES.find((t) => t.id === 'brand');
  const themeCategoryThemes = (category: ThemeCategory) =>
    themes.filter((t) => t.id !== 'brand' && themeCategory(t.id) === category);

  // Both browsers ease their height between views so swaps don't snap the
  // modal taller/shorter; the cap is where they switch to scrolling.
  const BODY_MAX_PX = 304; // 19rem

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isIdentity ? 'Confirm your name' : 'Start a new diagram'}
        className={`pointer-events-auto flex h-full w-full animate-fly-up-in flex-col bg-white dark:bg-slate-900 sm:h-auto sm:max-h-[90vh] ${isIdentity ? 'sm:w-[26rem]' : 'sm:w-[44rem]'} sm:max-w-[92%] sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-2xl sm:shadow-slate-900/10 dark:sm:border-slate-800 dark:sm:shadow-black/40`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {isWelcome
                ? 'New Diagram'
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
              <div
                className={`flex items-center justify-between gap-3 ${showIdentity ? 'mt-5' : ''}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pick a template
                </p>
                <input
                  type="text"
                  value={templateQuery}
                  onChange={(e) => setTemplateQuery(e.target.value)}
                  placeholder="Search templates"
                  aria-label="Search templates"
                  className="w-44 max-w-[55%] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
                />
              </div>
              {/* Two-level browse inside a height-capped scroll area:
                  the overview shows a Blank quick-pick + a card per
                  category; clicking a category drills into its templates
                  (with a Back affordance). A non-empty search query
                  overrides both and shows flat results across the whole
                  catalogue. Blank is special-cased out of the category
                  grouping — it's a "start from scratch", not a category
                  template — and lives only on the overview row. */}
              <AnimatedHeightBox
                maxPx={BODY_MAX_PX}
                viewKey={templateFilter ? 'search' : (openCategory ?? 'overview')}
                className="mt-2"
              >
                {templateFilter ? (
                  filteredTemplates.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                      No templates match “{templateQuery.trim()}”.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {filteredTemplates.map((t) => (
                        <TemplateCard
                          key={t.kind}
                          template={t}
                          active={templateKind === t.kind}
                          onSelect={() => setTemplateKind(t.kind)}
                          onCommit={() => onPick(t.kind, effectiveName, themeId)}
                        />
                      ))}
                    </div>
                  )
                ) : openCategory ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setOpenCategory(null)}
                      className="mb-2 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-brand-700 transition hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path
                          d="M7.5 2.5 4 6l3.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      All templates
                    </button>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {categoryTemplates(openCategory).map((t) => (
                        <TemplateCard
                          key={t.kind}
                          template={t}
                          active={templateKind === t.kind}
                          onSelect={() => setTemplateKind(t.kind)}
                          onCommit={() => onPick(t.kind, effectiveName, themeId)}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {blankTemplate ? (
                      <TemplateCard
                        template={blankTemplate}
                        active={templateKind === 'blank'}
                        onSelect={() => setTemplateKind('blank')}
                        onCommit={() => onPick('blank', effectiveName, themeId)}
                      />
                    ) : null}
                    {TEMPLATE_CATEGORIES.map((cat) => {
                      const items = categoryTemplates(cat.id);
                      if (items.length === 0) return null;
                      return (
                        <CategoryCard
                          key={cat.id}
                          label={cat.label}
                          description={cat.description}
                          count={items.length}
                          previews={items.map((t) => t.kind)}
                          selected={
                            templateKind !== 'blank' && templateCategory(templateKind) === cat.id
                          }
                          onOpen={() => setOpenCategory(cat.id)}
                        />
                      );
                    })}
                  </div>
                )}
              </AnimatedHeightBox>
            </>
          ) : null}

          {/* Theme picker — two-level browse mirroring the template grid:
              a Brand quick-pick + a card per colour-temperament category;
              clicking a category drills into its themes (with a Back
              affordance). Only in flows that pick a theme; identity-only
              mode skips it. */}
          {showThemes ? (
            <>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Select a theme
              </p>
              <AnimatedHeightBox
                maxPx={BODY_MAX_PX}
                viewKey={openThemeCategory ?? 'overview'}
                className="mt-2"
              >
                {openThemeCategory ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setOpenThemeCategory(null)}
                      className="mb-2 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-brand-700 transition hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path
                          d="M7.5 2.5 4 6l3.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      All themes
                    </button>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {themeCategoryThemes(openThemeCategory).map((t) => (
                        <ThemeCard
                          key={t.id}
                          theme={t}
                          active={themeId === t.id}
                          onSelect={() => setThemeId(t.id)}
                          onCommit={() => onPick(templateKind, effectiveName, t.id)}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {brandTheme ? (
                      <ThemeCard
                        theme={brandTheme}
                        active={themeId === 'brand'}
                        onSelect={() => setThemeId('brand')}
                        onCommit={() => onPick(templateKind, effectiveName, 'brand')}
                      />
                    ) : null}
                    {THEME_CATEGORIES.map((cat) => {
                      const items = themeCategoryThemes(cat.id);
                      if (items.length === 0) return null;
                      return (
                        <ThemeCategoryCard
                          key={cat.id}
                          label={cat.label}
                          description={cat.description}
                          count={items.length}
                          themes={items}
                          selected={themeId !== 'brand' && themeCategory(themeId) === cat.id}
                          onOpen={() => setOpenThemeCategory(cat.id)}
                        />
                      );
                    })}
                  </div>
                )}
              </AnimatedHeightBox>
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <p className="mr-auto text-[11px] text-slate-500 dark:text-slate-400">
            {isWelcome
              ? 'You can change these later from the Palette.'
              : isIdentity
                ? 'Other participants will see this name on your cursor and comments.'
                : ''}
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
