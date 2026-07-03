import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { useEscape } from '@/hooks/ui/useEscape';
import type { Participant } from '@/lib/identity';
import { initialsOf, randomName } from '@/lib/identity';
import { shufflePinned } from '@/lib/shuffle';
import type { TemplateCategory, TemplateKind } from '@livediagram/templates';
import { TEMPLATE_CATEGORIES, TEMPLATES, templateCategory } from '@livediagram/templates';
import { AnimatedHeightBox } from '@/components/primitives/AnimatedHeightBox';
import { BackBar } from '@/components/palette/ThemeCategoryBrowser';
import { CustomThemePicker } from '@/components/palette/CustomThemePicker';
import { CategoryCard, TemplateCard } from '@/components/palette/template-picker-cards';
import { Tooltip } from '@/components/primitives/Tooltip';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useModalGuard } from '@/hooks/ui/useModalGuard';
import { WizardSteps } from './template-picker-wizard';
import {
  ArrowRightIcon,
  FolderOpenIcon,
  RefreshIcon,
  SparkleIcon,
  Spinner,
} from './template-picker-icons';

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
  // only theme in templates-only mode. A string, not ThemeId, because it
  // can be a custom `custom:<uuid>` id (spec/44).
  currentThemeId: string;
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
  onPick: (kind: TemplateKind, name: string, themeId: string) => void;
  // Dismiss the modal without picking a template or theme. The diagram
  // gets a fresh blank canvas (no seeded rectangle, no theme override)
  // and the empty-state card prompts the next step. Triggered by the X in
  // the header (all modes) or the Cancel button (non-welcome modes only:
  // the welcome wizard offers Skip instead, which commits Blank + Basic).
  onSkip: () => void;
  // True while the host is committing the pick (the new-diagram POST can
  // take a moment). Drives the primary button's spinner + disabled state
  // so the user gets feedback and can't double-submit.
  busy?: boolean;
  // When provided (welcome flow), a bottom-left "Open Existing Diagram"
  // button navigates away to the Explorer, so this screen can stay focused
  // on creating without rendering an Explorer panel of its own.
  onOpenExisting?: () => void;
};

// The "Start a new diagram" modal, also the welcome screen. In welcome
// mode it's a two-step wizard (template, then theme); other modes keep a
// single page. Picking is confirmed explicitly (Create / Apply / Join) so
// users can review their choices before committing.
export function TemplatePicker({
  mode,
  participant,
  currentThemeId,
  diagramName,
  lockedName,
  onPick,
  onSkip,
  busy = false,
  onOpenExisting,
}: TemplatePickerProps) {
  // Mount-open overlay: silence the canvas shortcut/paste listeners
  // behind it (see lib/modal-guard). Harmless on /new, where no canvas
  // listeners exist.
  useModalGuard(true);
  useEscape(onSkip);
  const isWelcome = mode === 'welcome';
  const isIdentity = mode === 'identity';
  // Both the welcome (new-diagram) and the in-editor templates flows run as
  // a two-step wizard (template, then theme). Identity mode is the only
  // single-section, non-wizard surface.
  const isWizard = !isIdentity;
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
  // On /new the participant id (and name) resolves asynchronously — a
  // 'pending'/'Guest' placeholder first, then the real identity. We used
  // to remount the whole picker (key={self.id}) to pick that up, which
  // read as a visible flash once the page settled. Instead, follow the
  // participant name here until the user actually edits it, so the card
  // mounts once and never blinks. `nameEdited` gates it so a user-typed
  // name isn't clobbered when the prop changes.
  const nameEdited = useRef(false);
  useEffect(() => {
    if (nameLocked || nameEdited.current) return;
    setName(participant.name);
  }, [participant.name, nameLocked]);
  const [templateKind, setTemplateKind] = useState<TemplateKind>('blank');
  // Free-text filter for the template grid (title / description / kind /
  // category label). Empty = show the whole catalogue. The input updates
  // `templateQuery` instantly (responsive caret), but filtering reads a
  // debounced copy so a fast typist doesn't thrash the grid (and the
  // height-animated container) on every keystroke.
  const [templateQuery, setTemplateQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(templateQuery), 180);
    return () => clearTimeout(id);
  }, [templateQuery]);
  // Which category the user has drilled into on the overview, or null
  // for the top-level overview (Blank quick-pick + a card per category).
  // A non-empty search query overrides this and shows flat results.
  const [openCategory, setOpenCategory] = useState<TemplateCategory | null>(null);
  // Initial theme is whatever the caller hands us: the /new flow passes
  // 'brand' (so Basic is pre-selected for a fresh diagram), while a new
  // tab copying an existing one passes that tab's theme.
  const [themeId, setThemeId] = useState<string>(currentThemeId);
  // Welcome mode is a two-step wizard: pick a template, then a theme
  // (spec/14). Other modes keep the single-page layout. `themeBuilding`
  // tracks whether the theme step's custom-theme builder is open, so the
  // wizard hides its own Back / Create footer while the builder owns the
  // surface (the builder has its own Save / Cancel).
  const [step, setStep] = useState<'template' | 'theme'>('template');
  // Direction of the last step change, so the incoming phase slides in
  // from the side it's travelling toward (forward = from the right, back
  // = from the left). Drives the tip-next / tip-prev slide animation on
  // the keyed step container below.
  const [stepDir, setStepDir] = useState<'forward' | 'backward'>('forward');
  const goToStep = (next: 'template' | 'theme') => {
    setStepDir(next === 'theme' ? 'forward' : 'backward');
    setStep(next);
  };
  const [themeBuilding, setThemeBuilding] = useState(false);
  // Rotate which templates greet the user on each open so people keep
  // discovering options beyond the usual first rows, but always pin Blank
  // first. Shuffled once per mount via lazy useState so clicking around
  // the grid never reshuffles it underfoot. (The theme grid does the same
  // internally, see ThemeCategoryBrowser.)
  // Shuffle ONLY after mount. The lazy initializer would run at static
  // prerender AND at hydration with different Math.random results, so the
  // server HTML wouldn't match the client (a hydration error). Render the
  // stable catalogue order first, then shuffle on mount.
  const [templates, setTemplates] = useState(TEMPLATES);
  useEffect(() => {
    setTemplates(shufflePinned(TEMPLATES, (t) => t.kind === 'blank'));
  }, []);
  const trimmedName = name.trim();
  const effectiveName = trimmedName || participant.name;
  // Keyword filter over the shuffled catalogue. Matches title /
  // description / kind / category label so "design", "uml", "wireframe"
  // etc. all narrow the grid; empty query passes everything through.
  const templateFilter = debouncedQuery.trim().toLowerCase();
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

  // Section visibility. In wizard mode only the active step's section
  // shows; identity mode shows neither.
  const showTemplateSection = showTemplates && (!isWizard || step === 'template');
  const showThemeSection = showThemes && (!isWizard || step === 'theme');
  // Skip the wizard entirely: the documented shortcut is Blank template +
  // Basic theme (spec/14), committed straight away.
  const skipToDefaults = () => onPick('blank', effectiveName, 'brand');
  // Double-clicking a template advances to the theme step (the user still
  // needs to pick a theme) rather than committing the whole wizard.
  const onTemplateCommit = (kind: TemplateKind) => {
    setTemplateKind(kind);
    if (isWizard) goToStep('theme');
    else onPick(kind, effectiveName, themeId);
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none absolute inset-0 z-[var(--z-modal)] flex items-center justify-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isIdentity ? 'Confirm your name' : 'Start a new diagram'}
        className={`pointer-events-auto flex h-full w-full animate-fly-up-in flex-col bg-white dark:bg-slate-900 sm:h-auto sm:max-h-[90vh] ${isIdentity ? 'sm:w-[26rem]' : 'sm:w-[44rem]'} sm:max-w-[92%] sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-2xl sm:shadow-slate-900/10 dark:sm:border-slate-800 dark:sm:shadow-black/40`}
      >
        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 pt-6 pb-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {isWelcome
                  ? 'New Diagram'
                  : isIdentity
                    ? diagramName && diagramName.trim()
                      ? `Welcome to '${diagramName.trim()}'`
                      : 'Welcome to this diagram'
                    : step === 'theme'
                      ? 'Pick a theme'
                      : 'Quick Start'}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                {isWizard
                  ? step === 'template'
                    ? 'Choose a template to start from.'
                    : 'Pick a theme, or build your own.'
                  : nameLocked
                    ? 'This is the name from your account; others will see it on this diagram.'
                    : 'Pick the name people will see while you collaborate on this diagram.'}
              </p>
            </div>
            <div className="-mr-2 -mt-1 flex shrink-0 items-center gap-0.5">
              {showTemplates ? (
                <HelpArticleLink
                  article={step === 'theme' ? 'themes' : 'templates'}
                  title={step === 'theme' ? 'Themes' : 'Templates'}
                  description={
                    step === 'theme'
                      ? 'How themes restyle your whole diagram.'
                      : 'How templates give you a themed starting point.'
                  }
                  className="!h-8 !w-8 !rounded-lg !border-0 !text-sm !text-slate-400 hover:!bg-slate-100 hover:!text-slate-700 dark:!text-slate-400 dark:hover:!bg-slate-800 dark:hover:!text-slate-200"
                />
              ) : null}
              <button
                type="button"
                onClick={onSkip}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
          {/* Step indicator: a modern two-segment progress rail so the
              wizard reads as 1 of 2 at a glance. Both wizard modes. */}
          {isWizard ? <WizardSteps step={step} onStep={goToStep} /> : null}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-8">
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
                  onChange={(e) => {
                    nameEdited.current = true;
                    setName(e.target.value);
                  }}
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
                    onClick={() => {
                      nameEdited.current = true;
                      setName(randomName());
                    }}
                    aria-label="Generate a different name"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <RefreshIcon />
                  </button>
                </Tooltip>
              )}
            </div>
          ) : null}

          {/* Wizard phases slide in / out directionally (forward from the
              right, back from the left); keying on `step` replays the
              animation each switch. Non-wizard surfaces stack both
              sections under a stable key, so nothing animates. */}
          <div
            key={isWizard ? step : 'steps'}
            className={
              isWizard
                ? stepDir === 'forward'
                  ? 'animate-tip-next'
                  : 'animate-tip-prev'
                : undefined
            }
          >
            {/* Template grid. 4 columns at wide widths so the picker uses the
              modal width instead of stretching cards vertically. */}
            {showTemplateSection ? (
              <>
                <div
                  className={`flex items-center justify-between gap-3 ${showIdentity ? 'mt-5' : ''}`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Quick Start
                  </p>
                  <input
                    type="text"
                    value={templateQuery}
                    onChange={(e) => setTemplateQuery(e.target.value)}
                    placeholder="Search templates"
                    aria-label="Search templates"
                    className="w-72 max-w-[70%] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
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
                  viewKey={templateFilter ? 'search' : (openCategory ?? 'overview')}
                  className="mt-2"
                >
                  {templateFilter ? (
                    filteredTemplates.length === 0 ? (
                      <p className="px-1 py-6 text-center text-xs text-slate-400 dark:text-slate-400">
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
                            onCommit={() => onTemplateCommit(t.kind)}
                          />
                        ))}
                      </div>
                    )
                  ) : openCategory ? (
                    <>
                      <BackBar
                        label="All templates"
                        current={
                          TEMPLATE_CATEGORIES.find((c) => c.id === openCategory)?.label ??
                          openCategory
                        }
                        onClick={() => setOpenCategory(null)}
                      />
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {categoryTemplates(openCategory).map((t) => (
                          <TemplateCard
                            key={t.kind}
                            template={t}
                            active={templateKind === t.kind}
                            onSelect={() => setTemplateKind(t.kind)}
                            onCommit={() => onTemplateCommit(t.kind)}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {blankTemplate ? (
                        <TemplateCard
                          template={blankTemplate}
                          active={templateKind === 'blank'}
                          onSelect={() => setTemplateKind('blank')}
                          onCommit={() => onTemplateCommit('blank')}
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

            {/* Theme picker: a two-level browse (Basic quick-pick, a card per
              colour-temperament category, plus a Custom category for the
              owner's saved themes). Reuses the exact picker the right-click
              Tab Appearance dialog renders (spec/42, /44) so the two can't
              drift. Shown as step 2 of the welcome wizard, or stacked under
              the template grid in templates mode. */}
            {showThemeSection ? (
              <CustomThemePicker
                themeId={themeId}
                onSelect={setThemeId}
                onCommit={(id) => onPick(templateKind, effectiveName, id)}
                onBuildingChange={setThemeBuilding}
                browserClassName="mt-1"
              />
            ) : null}
          </div>
        </div>

        {/* Footer. Identity mode keeps a flat Cancel + Join row. Both wizard
            modes (welcome + templates) swap controls per step, and the
            footer hides entirely while the theme step's builder is open
            (the builder carries its own Save / Cancel). */}
        {isIdentity ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            <p className="mr-auto text-[11px] text-slate-500 dark:text-slate-400">
              Other participants will see this name on your cursor and comments.
            </p>
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onPick(templateKind, effectiveName, themeId)}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600"
            >
              <SparkleIcon />
              Join
            </button>
          </div>
        ) : themeBuilding ? null : (
          <div className="flex items-center gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            {/* Far-left escape hatch: the welcome flow jumps to the Explorer
                to open an existing diagram; the in-editor templates flow
                cancels back to the canvas. */}
            {isWelcome ? (
              onOpenExisting ? (
                <button
                  type="button"
                  onClick={onOpenExisting}
                  className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  <FolderOpenIcon />
                  Open Existing Diagram
                </button>
              ) : null
            ) : (
              <button
                type="button"
                onClick={onSkip}
                className="mr-auto inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            )}
            {/* Right cluster: (welcome only) Skip, then the primary Next /
                commit action. Going BACK to the template step is driven by
                the step rail at the top (clicking "1 Template") — a footer
                Back button here read ambiguously against the category
                "All templates / All themes" bar, so it's gone. */}
            {isWelcome && step === 'template' ? (
              /* Skip the wizard: Blank template, Basic theme (spec/14).
                 Only on the first (template) step — once the user has
                 reached the theme step, Back / Create are the actions. */
              <button
                type="button"
                onClick={skipToDefaults}
                disabled={busy}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Skip
              </button>
            ) : null}
            {step === 'template' ? (
              <button
                type="button"
                onClick={() => goToStep('theme')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600"
              >
                Next
                <ArrowRightIcon />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onPick(templateKind, effectiveName, themeId)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? <Spinner /> : <SparkleIcon />}
                {busy ? 'Creating…' : isWelcome ? 'Create' : 'Apply'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Two-segment progress rail for the wizard (welcome + templates). Both
// chips jump straight to that step (the template default is always valid,
// so forward jumps are fine too).
