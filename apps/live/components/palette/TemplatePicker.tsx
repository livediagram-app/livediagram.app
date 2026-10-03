import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useClickOutside, useEscape } from '@livediagram/ui';
import type { Participant } from '@/lib/identity';
import { shufflePinned } from '@/lib/shuffle';
import type { TemplateCategory, TemplateCollection, TemplateKind } from '@livediagram/templates';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATES,
  POPULAR_TEMPLATE_KINDS,
  templateCategory,
  untitledNameForTemplate,
} from '@livediagram/templates';
import {
  TemplatePickerBrowse,
  type ShelfCategory,
} from '@/components/palette/TemplatePickerBrowse';
import { useModalGuard } from '@/hooks/ui/useModalGuard';
import { TemplatePickerFooter } from './TemplatePickerFooter';
import { useWizardPlacement, type AlwaysSave, type WizardDefaults } from './useWizardPlacement';
import { WizardDefaultFolder } from './WizardDefaultFolder';
import { NewDocumentSettingsStep } from './template-picker-settings';
import {
  DEFAULT_SAVE_LOCATION,
  isOfflineLocation,
  type SaveLocationId,
} from '@/lib/save-locations';
import { TemplatePickerIdentityRow } from './TemplatePickerIdentityRow';
import { type WizardStep } from './template-picker-wizard';
import { TemplatePickerHeader } from './TemplatePickerHeader';

// Whether this render is past hydration, as a store with nothing to subscribe to: prerender and
// hydration read the server snapshot, every later render the client one.
const noSubscription = () => () => {};
const isClient = () => true;
const isServer = () => false;

// What the welcome wizard's Settings step (docs/specs/006-document/offline-mode.md) hands back on Create.
export type NewDocumentSettings = {
  // Where the document is stored (docs/specs/006-document/save-locations.md): the api, or this browser only.
  saveLocation: SaveLocationId;
  documentName?: string;
  // Placement (docs/specs/013-workspace/folders.md "Placement on create"): a team library, and a
  // folder of the chosen space; a null folder is the space's root, chosen on purpose. Both absent
  // when the person never saw the picker: no choice, where a default folder may answer
  // (docs/specs/013-workspace/default-folders.md "Precedence").
  folderId?: string | null;
  teamId?: string | null;
  // "Always save <these> here" (docs/specs/013-workspace/default-folders.md): the default to write
  // before the create, a folder or null (the My documents root).
  alwaysSave?: AlwaysSave;
};

type TemplatePickerProps = {
  // 'welcome' — first-run modal: identity, template, theme, confirm.
  // 'templates' — opened from the empty-state card's "Browse templates"
  // button on an existing tab; just the template grid + Apply. Keeps the
  // current participant name + current tab theme untouched.
  // 'identity' — a participant has joined an existing document and hasn't
  // confirmed their name yet. Identity section only (no templates, no
  // theme grid); confirm becomes "Join".
  mode: 'welcome' | 'templates' | 'identity';
  // The user's current identity. Their name is editable inside the picker
  // in welcome mode and hidden in templates-only mode.
  participant: Participant;
  // Theme currently applied to the active tab — used as the initial /
  // only theme in templates-only mode. A string, not ThemeId, because it
  // can be a custom `custom:<uuid>` id (docs/specs/011-theme/custom-themes.md).
  currentThemeId: string;
  // Name of the document being joined. Used by the 'identity' mode to
  // greet visitors with the actual document name ("Welcome to 'API
  // sketch'") instead of the generic "Welcome to this document".
  documentName?: string;
  // When provided, the visitor is signed in and their display name is
  // dictated by their Clerk account — the input becomes read-only and
  // the shuffle button hides so they can't masquerade under a
  // different identity on someone else's document. Has no effect in
  // 'welcome' / 'templates' modes (no identity row to lock).
  lockedName?: string | null;
  // The welcome wizard's Settings step (docs/specs/006-document/offline-mode.md) collects these alongside the
  // participant name + theme. Other modes pass just the default location (the
  // document already exists, so name/folder/team don't apply).
  onPick: (
    kind: TemplateKind,
    name: string,
    themeId: string,
    settings: NewDocumentSettings,
  ) => void;
  // Personal folders + teams for the Settings step's placement picker (welcome
  // mode). Empty when none / still loading.
  folders?: { id: string; name: string; parentId: string | null }[];
  teams?: { id: string; name: string }[];
  // Per-team folder lists for the Settings step's placement browser.
  teamFolders?: Record<string, { id: string; name: string; parentId: string | null }[]>;
  // Pre-selected placement (the /new URL's folder / team context).
  initialPlacement?: string;
  // The reader's default folders (docs/specs/013-workspace/default-folders.md): the Location step
  // pre-selects the template's default at the My documents root, and offers Always save.
  defaults?: WizardDefaults;
  // The collection the template step opens on (the /new URL's `?browse=`),
  // or null for the category overview.
  initialShelf?: TemplateCollection | null;
  // Inline folder creation from the placement browser (name popover). Creates
  // in the given scope and returns the new folder (null on failure).
  onCreateFolder?: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<{ id: string; name: string; parentId: string | null } | null>;
  // Inline team creation from the placement browser's space overview
  // (signed-in only; the host omits it for guests).
  onCreateTeam?: (name: string) => Promise<{ id: string; name: string } | null>;
  // Dismiss the modal without picking a template or theme. The document
  // gets a fresh blank canvas (no seeded rectangle, no theme override)
  // and the empty-state card prompts the next step. Triggered by Skip
  // (Blank + the Default theme), the Cancel button (non-welcome modes), and the X
  // and Escape when there is no onBackOut.
  onSkip: () => void;
  // The X, and Escape on the first step of the /new wizard: back to the page that opened it,
  // creating nothing (docs/specs/007-editor/new-document-route.md "Escape backs out"). Absent: both close
  // as onSkip.
  onBackOut?: () => void;
  // True while the host is committing the pick (the new-document POST can
  // take a moment). Drives the primary button's spinner + disabled state
  // so the user gets feedback and can't double-submit.
  busy?: boolean;
  // When provided (welcome flow), a bottom-left "Open Existing Document"
  // button navigates away to the Explorer, so this screen can stay focused
  // on creating without rendering an Explorer panel of its own.
  onOpenExisting?: () => void;
};

// The browsable catalogue: hidden templates (the guided tour, docs/specs/007-editor/guided-tour-sample.md) are
// buildable but never listed, so they're filtered out before any grid /
// search / shuffle sees them.
const LISTED_TEMPLATES = TEMPLATES.filter((t) => !t.hidden);

// The "Start a new document" modal, also the welcome screen. In welcome
// mode it's a two-step wizard (template, then location); the in-editor Quick
// Start is a single page where picking a template applies it. There is no
// theme step: a document starts on the default theme (or its tab's), and the
// Theme and canvas controls change it later (docs/specs/007-editor/new-document-route.md).
export function TemplatePicker({
  mode,
  participant,
  currentThemeId,
  documentName,
  lockedName,
  onPick,
  onSkip,
  onBackOut,
  busy = false,
  onOpenExisting,
  folders = [],
  teams = [],
  teamFolders = {},
  initialPlacement,
  defaults,
  initialShelf = null,
  onCreateFolder,
  onCreateTeam,
}: TemplatePickerProps) {
  // Mount-open overlay: silence the canvas shortcut/paste listeners
  // behind it (see lib/modal-guard). Harmless on /new, where no canvas
  // listeners exist.
  useModalGuard(true);
  const isWelcome = mode === 'welcome';
  const isIdentity = mode === 'identity';
  // Only the welcome (new-document) flow is a wizard (template, then where it
  // lives); Quick Start and the identity prompt are single pages.
  const isWizard = isWelcome;
  // Identity / "your name" moved entirely into the Share flow — there's
  // no reason to collect it before the user explicitly shares. The
  // 'identity' mode is still used for visitors landing on a share URL
  // who need to confirm their display name first.
  const showIdentity = isIdentity;
  const showTemplates = !isIdentity;
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
  // Which category the user last opened on the shelf, or null for the
  // default (Popular). Held here, not in the browse, so it survives a peek
  // at the location step. A non-empty search query overrides the shelf and
  // shows flat results.
  // Undefined until the author opens a shelf: until then a `?browse=<collection>` link's
  // collection is the open one (docs/specs/007-editor/new-document-route.md). Read at render, not as a
  // useState seed, because the URL only arrives after hydration.
  const [chosenCategory, setOpenCategory] = useState<ShelfCategory | null | undefined>(undefined);
  const openCategory = chosenCategory === undefined ? initialShelf : chosenCategory;
  // The shelf's inverted flow (desktop only): the open shelf shows every card,
  // the other categories become the carousel. Held here for the same reason.
  const [shelfExpanded, setShelfExpanded] = useState(false);
  // The theme is whatever the caller hands us, unchanged: the /new flow
  // passes 'brand' (Default), a new tab its source tab's theme.
  const themeId = currentThemeId;
  // Save location (docs/specs/006-document/save-locations.md): livediagram (cloud) or Local Browser (Offline
  // Mode, docs/specs/006-document/offline-mode.md). Welcome wizard only; threaded into every onPick so Skip /
  // guided tour / Create all honour it. Stays at the default in non-welcome
  // modes (the chooser never renders there).
  const [saveLocation, setSaveLocation] = useState<SaveLocationId>(DEFAULT_SAVE_LOCATION);
  // Settings step (docs/specs/006-document/offline-mode.md): document name (defaults per template) + placement.
  // `placement` is 'unsorted' | `folder:<id>` | `team:<id>` in one control.
  // The default name tracks the chosen template ("Untitled Mind Map", not a
  // flat "Untitled document"); we keep syncing the field to it until the user
  // types their own, so switching templates updates the suggestion.
  const templateDefaultName = untitledNameForTemplate(templateKind);
  const [documentNameInput, setDocumentNameInput] = useState(() =>
    untitledNameForTemplate('blank'),
  );
  const documentNameEdited = useRef(false);
  useEffect(() => {
    if (!documentNameEdited.current) setDocumentNameInput(untitledNameForTemplate(templateKind));
  }, [templateKind]);
  // Where it is filed (docs/specs/013-workspace/default-folders.md "The New Document wizard"):
  // the reader's pick, the /new context, the template's default folder, else the root.
  const where = useWizardPlacement({ context: initialPlacement, kind: templateKind, defaults });
  const placement = where.selected;
  // The settings the wizard commits with. Document name defaults to the
  // template's default when the field is left blank. Parameterised on the
  // placement so a double-click commit can pass the just-picked value
  // before the pick has applied.
  const settingsFor = (picked?: string): NewDocumentSettings => {
    const name = documentNameInput.trim() || templateDefaultName;
    // Always save belongs to the selection it was ticked for: a double-click elsewhere drops it.
    const sameSelection = picked === undefined || picked === where.selected;
    const alwaysSave = isOfflineLocation(saveLocation) || !sameSelection ? null : where.alwaysSave;
    return {
      saveLocation,
      documentName: name,
      ...(picked === undefined ? where.sent() : where.sent(picked, 'picked')),
      ...(alwaysSave ? { alwaysSave } : {}),
    };
  };
  const settings = () => settingsFor();
  // Welcome mode is a two-step wizard: pick a template, then where the
  // document lives (docs/specs/007-editor/new-document-route.md). Other modes keep the single-page layout.
  const [step, setStep] = useState<WizardStep>('template');
  // Direction of the last step change, so the incoming phase slides in
  // from the side it's travelling toward (forward = from the right, back
  // = from the left). Drives the tip-next / tip-prev slide animation on
  // the keyed step container below.
  const [stepDir, setStepDir] = useState<'forward' | 'backward'>('forward');
  const STEP_ORDER: readonly WizardStep[] = ['template', 'settings'];
  const goToStep = (next: WizardStep) => {
    // The Settings step only exists on the welcome flow (an existing
    // document has no name / placement / offline choice to make).
    if (next === 'settings' && !isWelcome) return;
    setStepDir(STEP_ORDER.indexOf(next) >= STEP_ORDER.indexOf(step) ? 'forward' : 'backward');
    setStep(next);
  };
  // Escape backs out of whatever was just clicked, one screen at a time, and never creates anything
  // (docs/specs/007-editor/new-document-route.md "Escape backs out"): a search first, then the Location
  // step, then the wizard itself (`onBackOut`, the page that opened /new); without one (Quick Start
  // over the canvas, the name prompt) it closes as before.
  useEscape(() => {
    if (templateQuery) {
      setTemplateQuery('');
      return;
    }
    if (isWelcome && step === 'settings') {
      goToStep('template');
      return;
    }
    (onBackOut ?? onSkip)();
  });
  // The in-editor Quick Start is a panel over the canvas, not a blocking
  // modal: the palette, the Explorer and the canvas stay live around it. A
  // press anywhere outside the card means the user has moved on (to a
  // toolbar, or to drawing), so it closes as Cancel would rather than leave
  // what they just opened or added hidden behind it. Never on the welcome
  // or name prompts, which ask for an answer.
  const cardRef = useRef<HTMLDivElement>(null);
  useClickOutside(cardRef, onSkip, mode === 'templates');
  // Rotate which templates greet the user on each open so people keep
  // discovering options beyond the usual first rows, but always pin Blank
  // first. Shuffled once per mount via lazy useState so clicking around
  // the grid never reshuffles it underfoot. (The theme grid does the same
  // internally, see ThemeCategoryBrowser.)
  // Shuffle ONLY after mount. The lazy initializer would run at static
  // prerender AND at hydration with different Math.random results, so the
  // server HTML wouldn't match the client (a hydration error). Render the
  // stable catalogue order while prerendering and hydrating, then the shuffle; a client-side mount
  // (no hydration) shows the shuffle from its first render.
  const hydrated = useSyncExternalStore(noSubscription, isClient, isServer);
  const [shuffled] = useState(() => shufflePinned(LISTED_TEMPLATES, (t) => t.kind === 'blank'));
  const templates = hydrated ? shuffled : LISTED_TEMPLATES;
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
  // The Popular shelf, in its curated order (Blank Canvas first, so Blank
  // needs no card of its own); `categoryTemplates` returns a category's
  // templates with Blank excluded (it keeps the shuffled order so the
  // preview fans rotate on each open).
  const popularTemplates = POPULAR_TEMPLATE_KINDS.flatMap((kind) =>
    TEMPLATES.filter((t) => t.kind === kind),
  );
  const categoryTemplates = (category: TemplateCategory) =>
    templates.filter((t) => t.kind !== 'blank' && templateCategory(t.kind) === category);

  // Section visibility. In wizard mode only the active step's section
  // shows; identity mode shows neither.
  const showTemplateSection = showTemplates && (!isWizard || step === 'template');
  // Skip the wizard entirely: the documented shortcut is Blank template +
  // Default theme (docs/specs/007-editor/new-document-route.md), committed straight away. Placement still honours
  // the URL context (/new?folder=…, ?team=…) the picker was pre-seeded with,
  // so skipping doesn't silently drop the document into personal Unsorted.
  const skipToDefaults = () =>
    onPick('blank', effectiveName, 'brand', {
      saveLocation,
      // A pick or a /new context only: Skip never saw the Location step, so a default folder is
      // the server's to apply.
      ...(where.source === 'picked' || where.source === 'context' ? where.sent() : {}),
    });
  // Picking a template: the welcome wizard moves on to where the document
  // lives; Quick Start applies it straight away.
  const onTemplateCommit = (kind: TemplateKind) => {
    setTemplateKind(kind);
    if (isWizard) goToStep('settings');
    else onPick(kind, effectiveName, themeId, { saveLocation });
  };
  // Double-clicking a destination card on the Settings step selects it AND
  // commits the wizard in one gesture (the template-card pattern). The value
  // is passed explicitly because the pick has not applied in this tick.
  const commitWithPlacement = (p: string) => {
    if (busy) return;
    where.pick(p);
    onPick(templateKind, effectiveName, themeId, settingsFor(p));
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none absolute inset-0 z-[var(--z-canvas-modal)] flex items-center justify-center"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={isIdentity ? 'Confirm your name' : 'Start a new document'}
        className={`pointer-events-auto flex h-full w-full animate-fly-up-in flex-col bg-white dark:bg-slate-900 sm:h-auto sm:max-h-[90vh] ${isIdentity ? 'sm:w-[26rem]' : 'sm:w-[44rem]'} sm:max-w-[92%] sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-2xl sm:shadow-slate-900/10 dark:sm:border-slate-800 dark:sm:shadow-black/40`}
      >
        <TemplatePickerHeader
          isWelcome={isWelcome}
          isIdentity={isIdentity}
          isWizard={isWizard}
          showTemplates={showTemplates}
          documentName={documentName}
          nameLocked={nameLocked}
          step={step}
          onStep={goToStep}
          onClose={onBackOut ?? onSkip}
        />

        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-8">
          {/* Identity row — first-run welcome + join-existing-document
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
                shelfExpanded={shelfExpanded}
                setShelfExpanded={setShelfExpanded}
                popularTemplates={popularTemplates}
                categoryTemplates={categoryTemplates}
                templateKind={templateKind}
                onTemplateCommit={onTemplateCommit}
              />
            ) : null}

            {/* Settings step (docs/specs/006-document/offline-mode.md, docs/specs/006-document/save-locations.md): name, save location, placement. */}
            {isWizard && step === 'settings' ? (
              <NewDocumentSettingsStep
                documentName={documentNameInput}
                onDocumentName={(v) => {
                  documentNameEdited.current = true;
                  setDocumentNameInput(v);
                }}
                placeholder={templateDefaultName}
                placement={placement}
                onPlacement={where.pick}
                onCommitPlacement={commitWithPlacement}
                folders={folders}
                teams={teams}
                teamFolders={teamFolders}
                onCreateFolder={onCreateFolder}
                onCreateTeam={onCreateTeam}
                saveLocation={saveLocation}
                onSaveLocation={setSaveLocation}
                placementFooter={
                  <WizardDefaultFolder
                    shown={where.shownDefault}
                    offer={where.offer}
                    alwaysSave={where.alwaysSave !== null}
                    onAlwaysSave={where.setAlwaysSave}
                    defaults={defaults}
                    onDefaultChanged={where.clearPick}
                    folders={folders}
                    teams={teams}
                    teamFolders={teamFolders}
                    onCreateFolder={onCreateFolder}
                  />
                }
              />
            ) : null}
          </div>
        </div>

        {/* Footer — see TemplatePickerFooter. */}
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
      </div>
    </div>
  );
}

// Two-segment progress rail for the wizard (welcome + templates). Both
// chips jump straight to that step (the template default is always valid,
// so forward jumps are fine too).
