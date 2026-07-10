import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { useEscape } from '@/hooks/ui/useEscape';
import type { Participant } from '@/lib/identity';
import { shufflePinned } from '@/lib/shuffle';
import type { TemplateCategory, TemplateKind } from '@livediagram/templates';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATES,
  templateCategory,
  untitledNameForTemplate,
} from '@livediagram/templates';
import { CustomThemePicker } from '@/components/palette/CustomThemePicker';
import { TemplatePickerBrowse } from '@/components/palette/TemplatePickerBrowse';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useModalGuard } from '@/hooks/ui/useModalGuard';
import { TemplatePickerFooter } from './TemplatePickerFooter';
import { NewDiagramSettingsStep } from './template-picker-settings';
import { TemplatePickerIdentityRow } from './TemplatePickerIdentityRow';
import { WizardSteps } from './template-picker-wizard';

// What the welcome wizard's Settings step (spec/76) hands back on Create.
export type NewDiagramSettings = {
  offline: boolean;
  diagramName?: string;
  // Personal folder placement, or a team library. At most one is set.
  folderId?: string | null;
  teamId?: string | null;
};

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
  // The welcome wizard's Settings step (spec/76) collects these alongside the
  // participant name + theme. Other modes pass just `{ offline: false }` (the
  // diagram already exists, so name/folder/team don't apply).
  onPick: (kind: TemplateKind, name: string, themeId: string, settings: NewDiagramSettings) => void;
  // Personal folders + teams for the Settings step's placement picker (welcome
  // mode). Empty when none / still loading.
  folders?: { id: string; name: string; parentId: string | null }[];
  teams?: { id: string; name: string }[];
  // Per-team folder lists for the Settings step's placement browser.
  teamFolders?: Record<string, { id: string; name: string; parentId: string | null }[]>;
  // Pre-selected placement (the /new URL's folder / team context).
  initialPlacement?: string;
  // Inline folder creation from the placement browser (name popover). Creates
  // in the given scope and returns the new folder (null on failure).
  onCreateFolder?: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<{ id: string; name: string; parentId: string | null } | null>;
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

// The browsable catalogue: hidden templates (the guided tour, spec/69) are
// buildable but never listed, so they're filtered out before any grid /
// search / shuffle sees them.
const LISTED_TEMPLATES = TEMPLATES.filter((t) => !t.hidden);

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
  folders = [],
  teams = [],
  teamFolders = {},
  initialPlacement,
  onCreateFolder,
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
  // Offline Mode (spec/76): "Save offline — this browser only". Welcome wizard
  // only; threaded into every onPick so Skip / guided tour / Create all honour
  // it. False in non-welcome modes (the toggle never renders there).
  const [offline, setOffline] = useState(false);
  // Settings step (spec/76): diagram name (defaults per template) + placement.
  // `placement` is 'unsorted' | `folder:<id>` | `team:<id>` in one control.
  // The default name tracks the chosen template ("Untitled Mind Map", not a
  // flat "Untitled diagram"); we keep syncing the field to it until the user
  // types their own, so switching templates updates the suggestion.
  const templateDefaultName = untitledNameForTemplate(templateKind);
  const [diagramNameInput, setDiagramNameInput] = useState(() => untitledNameForTemplate('blank'));
  const diagramNameEdited = useRef(false);
  useEffect(() => {
    if (!diagramNameEdited.current) setDiagramNameInput(untitledNameForTemplate(templateKind));
  }, [templateKind]);
  const [placement, setPlacement] = useState(initialPlacement ?? 'unsorted');
  // The settings the wizard commits with. Diagram name defaults to the
  // template's default when the field is left blank.
  const settings = (): NewDiagramSettings => {
    const name = diagramNameInput.trim() || templateDefaultName;
    if (placement.startsWith('folder:')) {
      return { offline, diagramName: name, folderId: placement.slice(7), teamId: null };
    }
    if (placement.startsWith('team:')) {
      // `team:<teamId>` (library root) or `team:<teamId>:folder:<folderId>`.
      const rest = placement.slice(5);
      const sep = rest.indexOf(':folder:');
      if (sep >= 0) {
        return {
          offline,
          diagramName: name,
          folderId: rest.slice(sep + ':folder:'.length),
          teamId: rest.slice(0, sep),
        };
      }
      return { offline, diagramName: name, folderId: null, teamId: rest };
    }
    return { offline, diagramName: name, folderId: null, teamId: null };
  };
  // Welcome mode is a two-step wizard: pick a template, then a theme
  // (spec/14). Other modes keep the single-page layout. `themeBuilding`
  // tracks whether the theme step's custom-theme builder is open, so the
  // wizard hides its own Back / Create footer while the builder owns the
  // surface (the builder has its own Save / Cancel).
  const [step, setStep] = useState<'template' | 'theme' | 'settings'>('template');
  // Direction of the last step change, so the incoming phase slides in
  // from the side it's travelling toward (forward = from the right, back
  // = from the left). Drives the tip-next / tip-prev slide animation on
  // the keyed step container below.
  const [stepDir, setStepDir] = useState<'forward' | 'backward'>('forward');
  const STEP_ORDER = ['template', 'theme', 'settings'] as const;
  const goToStep = (next: 'template' | 'theme' | 'settings') => {
    setStepDir(STEP_ORDER.indexOf(next) >= STEP_ORDER.indexOf(step) ? 'forward' : 'backward');
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
  const [templates, setTemplates] = useState(LISTED_TEMPLATES);
  useEffect(() => {
    setTemplates(shufflePinned(LISTED_TEMPLATES, (t) => t.kind === 'blank'));
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
  const skipToDefaults = () => onPick('blank', effectiveName, 'brand', { offline });
  // Double-clicking a template advances to the theme step (the user still
  // needs to pick a theme) rather than committing the whole wizard.
  const onTemplateCommit = (kind: TemplateKind) => {
    setTemplateKind(kind);
    if (isWizard) goToStep('theme');
    else onPick(kind, effectiveName, themeId, { offline });
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
                    : step === 'theme'
                      ? 'Pick a theme, or build your own.'
                      : 'Name your diagram and choose where it lives.'
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
          {/* Identity row — first-run welcome + join-existing-diagram
              flows. See TemplatePickerIdentityRow. */}
          {showIdentity ? (
            <TemplatePickerIdentityRow
              participant={participant}
              name={name}
              effectiveName={effectiveName}
              nameLocked={nameLocked}
              onChangeName={(next) => {
                nameEdited.current = true;
                setName(next);
              }}
            />
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
            {/* Template search + two-level browse — see TemplatePickerBrowse
              (render-only; the query / category / shuffle state lives here
              so it survives wizard step switches). */}
            {showTemplateSection ? (
              <TemplatePickerBrowse
                showIdentity={showIdentity}
                templateQuery={templateQuery}
                setTemplateQuery={setTemplateQuery}
                templateFilter={templateFilter}
                filteredTemplates={filteredTemplates}
                openCategory={openCategory}
                setOpenCategory={setOpenCategory}
                blankTemplate={blankTemplate}
                categoryTemplates={categoryTemplates}
                templateKind={templateKind}
                onTemplateCommit={onTemplateCommit}
              />
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
                // Single-click a theme (spec/76): in the welcome wizard,
                // selecting a theme advances straight to the Settings step; in
                // the in-editor templates flow (no Settings step) it just sets
                // the theme, leaving Apply to commit.
                onSelect={(id) => {
                  setThemeId(id);
                  if (isWelcome) goToStep('settings');
                }}
                onCommit={(id) => {
                  setThemeId(id);
                  if (isWelcome) goToStep('settings');
                  else onPick(templateKind, effectiveName, id, { offline });
                }}
                onBuildingChange={setThemeBuilding}
                browserClassName="mt-1"
              />
            ) : null}
            {/* Settings step (spec/76): name, placement, offline. */}
            {isWizard && step === 'settings' ? (
              <NewDiagramSettingsStep
                diagramName={diagramNameInput}
                onDiagramName={(v) => {
                  diagramNameEdited.current = true;
                  setDiagramNameInput(v);
                }}
                placeholder={templateDefaultName}
                placement={placement}
                onPlacement={setPlacement}
                folders={folders}
                teams={teams}
                teamFolders={teamFolders}
                onCreateFolder={onCreateFolder}
                offline={offline}
                onOffline={setOffline}
              />
            ) : null}
          </div>
        </div>

        {/* Footer — see TemplatePickerFooter. Hidden entirely while the
            theme step's builder is open (it carries its own Save / Cancel). */}
        {!isIdentity && themeBuilding ? null : (
          <TemplatePickerFooter
            isIdentity={isIdentity}
            isWelcome={isWelcome}
            step={step}
            busy={busy}
            onSkip={onSkip}
            onOpenExisting={onOpenExisting}
            skipToDefaults={skipToDefaults}
            goToStep={goToStep}
            onCommit={() => onPick(templateKind, effectiveName, themeId, settings())}
          />
        )}
      </div>
    </div>
  );
}

// Two-segment progress rail for the wizard (welcome + templates). Both
// chips jump straight to that step (the template default is always valid,
// so forward jumps are fine too).
