import type { Participant } from '@/lib/identity';
import type { SaveLocationId } from '@/lib/save-locations';
import type { SkipLocationStep } from '@/lib/skip-location-step';
import type { TemplateKind } from '@livediagram/templates';
import type { AlwaysSave, WizardDefaults } from './useWizardPlacement';

// The TemplatePicker's props and what its welcome wizard hands back on Create, lifted out of the
// picker so the component file holds behaviour, not its contract.

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
  // "Always save new documents in <place> and skip this step" was ticked
  // (docs/specs/013-workspace/default-folders.md "Skipping the Location step"): the preference to
  // save before the create.
  skipLocationStep?: SkipLocationStep;
};

export type TemplatePickerProps = {
  // 'welcome': first-run modal: identity, template, theme, confirm.
  // 'templates': opened from the empty-state card's "Browse templates"
  // button on an existing tab; just the template grid + Apply. Keeps the
  // current participant name + current tab theme untouched.
  // 'identity': a participant has joined an existing document and hasn't
  // confirmed their name yet. Identity section only (no templates, no
  // theme grid); confirm becomes "Join".
  mode: 'welcome' | 'templates' | 'identity';
  // The user's current identity. Their name is editable inside the picker
  // in welcome mode and hidden in templates-only mode.
  participant: Participant;
  // Theme currently applied to the active tab: used as the initial /
  // only theme in templates-only mode. A string, not ThemeId, because it
  // can be a custom `custom:<uuid>` id (docs/specs/011-theme/custom-themes.md).
  currentThemeId: string;
  // Name of the document being joined. Used by the 'identity' mode to
  // greet visitors with the actual document name ("Welcome to 'API
  // sketch'") instead of the generic "Welcome to this document".
  documentName?: string;
  // When provided, the visitor is signed in and their display name is
  // dictated by their Clerk account: the input becomes read-only and
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
  // Where to save without a Location step (docs/specs/013-workspace/default-folders.md "Skipping
  // the Location step"), resolved by the page; null or absent is the two-step wizard.
  skipLocation?: SkipLocationStep | null;
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
