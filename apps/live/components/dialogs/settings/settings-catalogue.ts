import type { HelpArticleKey } from '@/lib/help-articles';
import {
  AUTO_ADVANCE_CHOICES,
  readPresentationConfig,
  SLIDE_SPEEDS,
  SLIDE_TRANSITIONS,
  SLIDE_ZOOMS,
  withPresentationConfig,
  type PresentationConfig,
} from '@/lib/presentation-config';
import type { SettingsCategoryId, SettingsIconId } from './settings-icons';
import { titleCase, type TelemetryCategory } from '@livediagram/api-schema';
import {
  autoRebindArrowsEnabled,
  showProfilePictureEnabled,
  panelEnabled,
  type MapSize,
  type PanelSwitch,
  type UserPreferences,
} from '@/lib/user-preferences';
import { isPowerUserMode, setPowerUserMode } from '@/lib/power-user-mode';
import { ILLUSTRATE_TOUR_KINDS, illustrateTourOwed } from '@/lib/illustrate-tour';
import { PLAN_TOUR_TRACKS, planTourOwed } from '@/lib/plan-tour';
import {
  ELEMENT_TOUR_KINDS,
  elementTourSeen,
  markElementTourSeen,
  offerElementTourAgain,
  type ElementTourKind,
} from '@/lib/element-tours';
import {
  readElementIndicatorStyle,
  withElementIndicatorStyle,
  type ElementIndicatorStyle,
} from '@/lib/element-indicator-style';
import {
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_STEP,
  resolveUiScale,
  resolveUiScalePart,
  uiScaleMax,
  uiScalePartPatch,
  uiScalePatch,
  withUiScalePatch,
  type UiScalePart,
} from '@/lib/ui-scale';
import { setUiScalePreview } from '@/lib/ui-scale-preview';
import {
  readWhiteboardDockPosition,
  withWhiteboardDockPosition,
  type WhiteboardDockPosition,
} from '@/lib/whiteboard-dock-prefs';
import {
  readContentsPlacement,
  withContentsPlacement,
  type ContentsPlacement,
} from '@/lib/contents-placement';
import type { SettingsIllustrationId } from './settings-illustrations';
import {
  LOGO_GUIDE_PARTS,
  readLogoGuideParts,
  readLogoGuideStrength,
  withLogoGuidePart,
  type LogoGuidePart,
  type LogoGuideStrength,
} from '@/lib/logo-guide-prefs';
import type { PlacementDefaultKey } from '@livediagram/api-schema';
import { DEFAULT_KEY_ENTRIES } from '@/lib/placement-defaults/default-key-entries';
import {
  CLOUD_SYNC_PROVIDERS,
  CLOUD_SYNC_SECTION,
  type CloudSyncProviderId,
} from '@/lib/cloud-sync/providers';

// One logo guide's switch (docs/specs/007-editor/logo-pages.md "Construction guides"): a tile in
// Settings > Editor > Illustrate's Guides Shown grid, as in a logo page's Guides popover. The token
// is written out per guide so the telemetry dashboard reads it.
function logoGuidePart(
  part: LogoGuidePart,
  event: SettingsToggleOptionSpec['event'],
): SettingsToggleOptionSpec {
  return {
    key: `logoGuide-${part}`,
    label: LOGO_GUIDE_PARTS.find((p) => p.id === part)!.label,
    read: (p) => readLogoGuideParts(p).has(part),
    write: (p, v) => withLogoGuidePart(p, part, v),
    event,
  };
}

// One email notification switch (docs/specs/014-identity/profile-and-email-notifications.md): only
// where the deployment sends email AND the reader is signed in, since a guest has no address.
type EmailKey =
  | 'notifyDocumentJoin'
  | 'notifyInviteResponse'
  | 'notifyComments'
  | 'notifyActionAssigned'
  | 'notifyMentions'
  | 'notifyFormResponses'
  | 'notifyTips'
  | 'notifyMilestones';

function emailSwitch(
  key: EmailKey,
  copy: Pick<SettingsToggleRowSpec, 'label' | 'description' | 'keywords' | 'event'>,
): SettingsToggleRowSpec {
  return {
    kind: 'toggle',
    key,
    section: 'Email',
    ...copy,
    available: (ctx) => ctx.emailEnabled && ctx.signedIn,
    read: (p) => p[key] !== false,
    write: (p, v) => ({ ...p, [key]: v }),
  };
}

// The Settings dialog as DATA: the categories, and per category the rows
// (docs/specs/007-editor/user-preferences.md). The dialog used to spell every row out as JSX inside one
// accordion, which is why adding a setting meant adding another 20-line block
// to a file that only ever grew: the thing the reader was then asked to
// navigate.
//
// A row declares how to READ and WRITE itself rather than closing over the
// dialog's state, so the list and the panes stay dumb: they render whatever
// the catalogue says and hand back a new UserPreferences. That keeps the
// preference plumbing (docs/specs/007-editor/user-preferences.md's readUserPreferences / writeUserPreferences
// round-trip) in exactly one place per setting.
//
// EVERY preference has a row here, and for most this is now the ONLY control:
// the Palette / Layers / AI / Map gear popovers that used to carry
// them are gone (docs/specs/007-editor/user-preferences.md). One setting, one place. The panels kept their
// reset-position button, which was the only non-preference thing those
// popovers held, and the Slide Deck popover stays because its contents are
// deck state rather than user preferences.
//
// This is a flat catalogue, so it stays one file however long it gets.

// What a row needs to know about the deployment / session to decide whether
// it applies at all. Email rows need BOTH: Resend configured (docs/specs/014-identity/transactional-email.md), or
// nothing can send, AND a signed-in account, or there is no address to send
// to. A guest flipping them would be writing preferences that can never
// apply, so they are absent rather than dead.
// Power-user-only rows (docs/specs/007-editor/power-user-mode.md) need the mode on; absent otherwise.
// `preferences` (the live values) lets a nested row follow its parent switch
// for the same reason: a setting for a panel that is off has nothing to act on.
// `authEnabled` is whether this deployment offers sign-in at all
// (`clerkEnabled`): API tokens are Clerk-only, so on a no-auth self-host they
// are absent end to end rather than a sign-in prompt with nowhere to go
// (docs/specs/015-api/public-api-and-tokens.md#37-self-hosting).
type SettingsRowContext = {
  emailEnabled: boolean;
  signedIn: boolean;
  authEnabled?: boolean;
  powerUserMode?: boolean;
  preferences?: UserPreferences;
  // Cloud Sync providers the deployment offers (docs/specs/022-drive-mirror/drive-mirror.md).
  cloudProviders?: readonly CloudSyncProviderId[];
  // The editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table).
  workbench?: boolean;
};

type RowBase = {
  // Stable id. Doubles as the React key and the footnote's element id.
  key: string;
  label: string;
  // The long-form explanation. Rendered as a footnote BELOW the row, iOS
  // style, so the row itself stays one scannable line.
  description: string;
  helpArticle?: HelpArticleKey;
  // Absent = always shown.
  available?: (ctx: SettingsRowContext) => boolean;
  // Where this setting's day-to-day control also lives, when it has one.
  // Rendered as a quiet "also in …" note so Settings listing everything
  // doesn't imply the panel gear has gone away.
  alsoIn?: string;
  // A small before/after drawing, for a setting whose effect is a LAYOUT
  // rather than a behaviour, see settings-illustrations.tsx.
  illustration?: SettingsIllustrationId;
  // Space-separated, lowercase search synonyms: the words a reader types
  // when they do not know the label ("dark mode" for Theme, "transparency"
  // for opacity, "hotkey" for shortcuts), plus adjacent spellings. Same idea
  // as the help registry's keywords, and searched alongside the label and
  // description: a test fails if a row that needs them has none.
  keywords?: string;
  // Sub-heading this row sits under, within its category. A category holding
  // several unrelated clusters (Editor's Power User rows) reads as one long undifferentiated list without them. Rows
  // sharing a section must be ADJACENT; the pane groups consecutive runs, so
  // a section cannot be split and silently re-headed further down.
  section?: string;
  // The key of a row in the same category this one belongs to: it renders
  // directly beneath that row, indented, in a group named after it
  // (docs/specs/007-editor/power-user-mode.md#in-settings).
  parent?: string;
  // A setting with no effect on a phone-sized viewport, holding the note that
  // says so there. The row stays visible (so Settings reads the same on every
  // device) but greyed and inert on a phone, and the stored value is left
  // alone for the desktop. Without it the control flips freely and appears
  // to do nothing, which reads as a bug.
  desktopOnly?: string;
};

export type SettingsToggleRowSpec = RowBase & {
  kind: 'toggle';
  read: (prefs: UserPreferences) => boolean;
  write: (prefs: UserPreferences, next: boolean) => UserPreferences;
  // Telemetry for the flip. The tokens are the EXISTING ones, unchanged and
  // still meaning what they always did, so the dashboard's history stays
  // continuous across this rework.
  event: { category: TelemetryCategory; on: string; off: string };
};

// One switch inside a toggle group: its own preference and telemetry, like a toggle row, drawn as a
// tile in the group's grid under the group's heading and description.
export type SettingsToggleOptionSpec = {
  key: string;
  label: string;
  // Linked from the group's description by this switch's label.
  helpArticle?: HelpArticleKey;
  read: (prefs: UserPreferences) => boolean;
  write: (prefs: UserPreferences, next: boolean) => UserPreferences;
  event: { category: TelemetryCategory; on: string; off: string };
};

// Several related switches as one control (the guided tours): one heading and one description over a
// grid of switch tiles, where separate rows would repeat the same paragraph each time.
export type SettingsToggleGroupRowSpec = RowBase & {
  kind: 'toggleGroup';
  toggles: SettingsToggleOptionSpec[];
};

export type SettingsChoiceRowSpec = RowBase & {
  kind: 'choice';
  options: { id: string; label: string }[];
  read: (prefs: UserPreferences) => string;
  write: (prefs: UserPreferences, next: string) => UserPreferences;
  // Choices fire one 'Changed' event naming the setting, not the value ,
  // matching what the Map popover already emits.
  event: { category: TelemetryCategory; changed: string };
};

export type SettingsSliderRowSpec = RowBase & {
  kind: 'slider';
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  read: (prefs: UserPreferences) => number;
  write: (prefs: UserPreferences, next: number) => UserPreferences;
  // Shows the value live while the thumb is dragged, before the release
  // commits it; called with null once the drag ends. Absent = no live effect.
  preview?: (value: number | null) => void;
  event: { category: TelemetryCategory; changed: string };
};

// Appearance is the one row that is NOT a UserPreference: it is device-local
// (`livediagram:v2:ui-mode`), because a pre-hydration script has to apply it
// before first paint to avoid a theme flash (docs/specs/007-editor/live-app.md). It therefore carries
// no read/write here and is rendered against its own store.
export type SettingsAppearanceRowSpec = RowBase & { kind: 'appearance' };

// API tokens (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category):
// the whole manager, create, one-time reveal, list and revoke. Not a
// preference at all: it reads account state from the api, so like the
// appearance row it carries no read/write pair.
export type SettingsTokensRowSpec = RowBase & { kind: 'tokens' };

// A way into another category of this same dialog, opened in place: the
// setting lives there, and this is where a reader might look for it first.
export type SettingsLinkRowSpec = RowBase & {
  kind: 'link';
  target: SettingsCategoryId;
  // The link's own words, which name the destination ("Manage API Tokens").
  cta: string;
};

// A card with no control: it stands in for settings the reader cannot use
// yet and says why. A section whose rows all vanish would otherwise take the
// section heading with it, so the reader never learns the settings exist ,
// which is the opposite of what a "find everything here" panel is for.
// `signIn` marks a note whose reason is "you need an account", which then
// ends with the Sign In link (docs/specs/007-editor/user-preferences.md).
export type SettingsNoteRowSpec = RowBase & { kind: 'note'; note: string; signIn?: boolean };

// Keyboard shortcuts, like appearance, are a PER-DEVICE localStorage toggle
// rather than a synced preference (docs/specs/007-editor/live-app.md): whether you want Cmd-Z bound
// depends on the keyboard in front of you, not on the account. So it too
// carries no read/write pair and is rendered against its own store.
export type SettingsShortcutsRowSpec = RowBase & { kind: 'shortcuts' };

// The shortcut catalogue itself (shortcut-sections.ts), rendered as the
// collapsible reference list that used to be its own Keyboard Shortcuts
// window. Read-only, so no read/write pair either.
export type SettingsShortcutListRowSpec = RowBase & { kind: 'shortcutList' };

// Account identity, read from Clerk, and account deletion. Neither is a
// preference: they moved here from /explorer/profile (docs/specs/014-identity/profile-and-email-notifications.md) when that page
// was retired, because everything else it held was already in this dialog.
export type SettingsIdentityRowSpec = RowBase & { kind: 'identity' };
export type SettingsDeleteAccountRowSpec = RowBase & { kind: 'deleteAccount' };

// The Trash (docs/specs/013-workspace/trash.md): not a preference, a way in.
// Here for everyone, guests and self-hosts without accounts included, because
// Settings is the one menu every deployment has.
export type SettingsTrashRowSpec = RowBase & { kind: 'trash' };

// What power user mode's preset set, as a live readout: each line's value is
// its own row's, changed in that row (docs/specs/007-editor/power-user-mode.md#in-settings).
export type SettingsPresetSummaryRowSpec = RowBase & { kind: 'presetSummary' };

// One Cloud Sync provider (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"): its
// connection, status and actions. Not a preference: it reads the provider's
// own state, so it carries no read/write pair.
export type SettingsCloudSyncRowSpec = RowBase & {
  kind: 'cloudSync';
  provider: CloudSyncProviderId;
};

// One default folder entry (docs/specs/013-workspace/default-folders.md "Settings"): where new
// documents of that key go, with Change and Clear. Not a preference: it reads and writes
// `/api/placement-defaults` through the page's store, so it carries no read/write pair.
export type SettingsPlacementDefaultRowSpec = RowBase & {
  kind: 'placementDefault';
  placementKey: PlacementDefaultKey;
};

export type SettingsRowSpec =
  | SettingsToggleRowSpec
  | SettingsToggleGroupRowSpec
  | SettingsChoiceRowSpec
  | SettingsSliderRowSpec
  | SettingsAppearanceRowSpec
  | SettingsTokensRowSpec
  | SettingsLinkRowSpec
  | SettingsNoteRowSpec
  | SettingsShortcutsRowSpec
  | SettingsShortcutListRowSpec
  | SettingsIdentityRowSpec
  | SettingsDeleteAccountRowSpec
  | SettingsTrashRowSpec
  | SettingsPresetSummaryRowSpec
  | SettingsCloudSyncRowSpec
  | SettingsPlacementDefaultRowSpec;

export type SettingsCategorySpec = {
  id: SettingsCategoryId;
  label: string;
  // The top-level category this is a sub-category of (Panels holds one per
  // panel, Editor one per mode with settings of its own, Account its
  // Notifications and API Tokens). The list nests it, untiled and indented, beneath its
  // parent; it is still its own pane. A parent's sub-categories follow it
  // directly, like a section's rows.
  parent?: SettingsIconId;
  // Only rendered when the api worker advertises AI capability (docs/specs/007-editor/ai-assistance.md).
  requiresAi?: boolean;
  // A line under a section's heading, for what every row in it shares (Documents' Default Folders,
  // the Tours' "offer again"), said once rather than under each row.
  sectionNotes?: Record<string, { note: string; helpArticle?: HelpArticleKey }>;
  // Sections drawn as a closed accordion, for rows people rarely look for (the Tours' Element Tours): the heading
  // opens them, and Settings opened on one of their rows opens them itself.
  collapsedSections?: readonly string[];
  rows: SettingsRowSpec[];
};

// A phone never draws the minimap (docs/specs/008-canvas/minimap.md), so all
// three of its rows are inert there and share this note.
// What every UI scale slider shares (docs/specs/007-editor/ui-scale.md).
const UI_SCALE_SLIDER = {
  kind: 'slider',
  desktopOnly:
    'UI Scale is desktop only, so a phone always uses 100%. Your choice still applies on a larger screen.',
  min: UI_SCALE_MIN,
  max: UI_SCALE_MAX,
  step: UI_SCALE_STEP,
  format: (v: number) => `${Math.round(v * 100)}%`,
} as const;

// One part's slider, nested under UI Scale: it reads the part's own value or,
// without one, the master's, and writes only its own.
function uiScalePartRow(
  part: UiScalePart,
  copy: { label: string; keywords: string; description: string; changed: string },
): SettingsSliderRowSpec {
  return {
    ...UI_SCALE_SLIDER,
    max: uiScaleMax(part),
    key: `uiScale-${part}`,
    parent: 'uiScale',
    label: copy.label,
    keywords: copy.keywords,
    description: copy.description,
    read: (p) => resolveUiScalePart(p, part),
    write: (p, v) => withUiScalePatch(p, uiScalePartPatch(part, v)),
    preview: (v) => setUiScalePreview(v === null ? null : uiScalePartPatch(part, v)),
    event: { category: 'UI', changed: copy.changed },
  };
}

const MINIMAP_DESKTOP_ONLY =
  'The Map is desktop only, so this has no effect on a phone. Your choice still applies on a larger screen.';

// The panel switches (docs/specs/007-editor/user-preferences.md), each on
// unless stored `false`. One row per Panels sub-category, first in its pane,
// with that panel's other rows nested beneath it (`parent`), so they are
// offered only while it is on (see `visibleCategories`).
function panelSwitch(
  key: PanelSwitch,
  row: Pick<SettingsToggleRowSpec, 'label' | 'keywords' | 'description' | 'event'>,
): SettingsToggleRowSpec {
  return {
    kind: 'toggle',
    key,
    ...row,
    read: (p) => panelEnabled(p, key),
    write: (p, v) => ({ ...p, [key]: v }),
  };
}

// A tour's switch (docs/specs/007-editor/user-preferences.md "Tours"). INVERTED against its stored
// preference: the switch asks "offer me this tour?", the preference records "already seen". The
// telemetry tokens still track the PREFERENCE, not the switch, so each dashboard series keeps
// meaning what it always has: switching ON sets `<tour>Seen` false, which is '<Tour>SeenOff'.
function tourSwitch(
  key: TourSeenKey,
  row: Pick<SettingsToggleRowSpec, 'label' | 'description' | 'helpArticle' | 'keywords' | 'event'>,
  section = 'Offer Again',
): SettingsToggleRowSpec {
  return {
    kind: 'toggle',
    key,
    section,
    ...row,
    read: (p) => p[key] !== true,
    write: (p, v) => ({ ...p, [key]: !v }),
  };
}

// A tour of several tracks (lib/tour-tracks.ts): on while any track is still owed. Off answers every track; on
// forgets those answered, so each offers itself again. Its telemetry tokens are its seen flag's, as above.
// One element tour's switch (docs/specs/007-editor/element-tours.md "Settings"), nested under Element Tours: on while
// its kind is still offered; on forgets its answer, off answers it.
function elementTourSwitch(
  kind: ElementTourKind,
  row: Pick<SettingsToggleRowSpec, 'label' | 'description' | 'helpArticle' | 'keywords' | 'event'>,
): SettingsToggleRowSpec {
  return {
    kind: 'toggle',
    key: `elementTour-${kind}`,
    section: ELEMENT_TOURS_SECTION,
    parent: 'elementToursSeen',
    ...row,
    read: (p) => !elementTourSeen(p, kind),
    write: (p, v) => (v ? offerElementTourAgain(p, kind) : markElementTourSeen(p, kind)),
  };
}

const ELEMENT_TOURS_SECTION = 'Element Tours';

function tourTracksSwitch(
  key: 'planTourSeen' | 'illustrateTourSeen' | 'elementToursSeen',
  tracksKey: 'planTourTracks' | 'illustrateTourKinds' | 'elementTourKinds',
  tracks: readonly string[],
  owed: (p: UserPreferences) => boolean,
  row: Pick<SettingsToggleRowSpec, 'label' | 'description' | 'helpArticle' | 'keywords' | 'event'>,
  section?: string,
): SettingsToggleRowSpec {
  return {
    ...tourSwitch(key, row, section),
    read: owed,
    write: (p, v) => {
      if (!v) return { ...p, [key]: true, [tracksKey]: [...tracks] };
      const { [tracksKey]: _answered, ...rest } = p;
      return { ...rest, [key]: false };
    },
  };
}

type TourSeenKey =
  | 'tourSeen'
  | 'planTourSeen'
  | 'facilitateTourSeen'
  | 'drawTourSeen'
  | 'formTourSeen'
  | 'avatarTourSeen'
  | 'illustrateTourSeen'
  | 'elementToursSeen';

// A presenter setting's row (docs/specs/012-collaboration/presentation-mode.md "Settings"): read and written through
// lib/presentation-config, which keeps the whole config in one preference. The telemetry token is the one the
// cog's change already sends, `Presentation-<field>`.
type PresentingKey = Exclude<keyof PresentationConfig, 'autoAdvanceSeconds'>;
function presentingToggle(
  field: { [K in PresentingKey]: PresentationConfig[K] extends boolean ? K : never }[PresentingKey],
  row: Pick<SettingsToggleRowSpec, 'section' | 'label' | 'description' | 'keywords' | 'alsoIn'>,
): SettingsToggleRowSpec {
  return {
    kind: 'toggle',
    key: `presentation-${field}`,
    helpArticle: 'slideDeck',
    ...row,
    read: (p) => readPresentationConfig(p)[field],
    write: (p, v) => withPresentationConfig(p, { [field]: v }),
    event: { category: 'UI', on: `Presentation-${field}On`, off: `Presentation-${field}Off` },
  };
}
function presentingChoice(
  field: 'transition' | 'speed' | 'zoom',
  row: Pick<SettingsChoiceRowSpec, 'section' | 'label' | 'description' | 'keywords' | 'options'>,
): SettingsChoiceRowSpec {
  return {
    kind: 'choice',
    key: `presentation-${field}`,
    helpArticle: 'slideDeck',
    ...row,
    read: (p) => readPresentationConfig(p)[field],
    write: (p, v) => withPresentationConfig(p, { [field]: v }),
    event: { category: 'UI', changed: `Presentation-${field}` },
  };
}

export const SETTINGS_CATEGORIES: SettingsCategorySpec[] = [
  {
    id: 'editor',
    label: 'Editor',
    rows: [
      {
        kind: 'toggle',
        key: 'alignmentGuides',
        keywords: 'snap lines smart guides align',
        section: 'Canvas',
        illustration: 'alignmentGuides',
        label: 'Alignment Guides',
        description:
          'Snap lines while you move or resize, so elements line up with their neighbours.',
        helpArticle: 'alignmentGuides',
        read: (p) => p.alignmentGuides !== false,
        write: (p, v) => ({ ...p, alignmentGuides: v }),
        event: { category: 'UI', on: 'AlignmentGuidesOn', off: 'AlignmentGuidesOff' },
      },
      {
        kind: 'toggle',
        key: 'autoRebindArrows',
        keywords: 'connector reattach sticky arrows connections',
        section: 'Canvas',
        label: 'Auto-Attach Arrows',
        description:
          'After a move, an arrow that cuts through its shape reattaches to the side facing its other end.',
        helpArticle: 'autoAttachArrows',
        // On by default (docs/specs/007-editor/user-preferences.md); the editor gates the rebind on this
        // same helper, so the switch and the behaviour cannot disagree.
        read: autoRebindArrowsEnabled,
        write: (p, v) => ({ ...p, autoRebindArrows: v }),
        event: { category: 'UI', on: 'AutoRebindOn', off: 'AutoRebindOff' },
      },
      {
        // docs/specs/008-canvas/element-indicators.md: how an element shows its link, note,
        // action and comments.
        kind: 'choice',
        key: 'elementIndicatorStyle',
        keywords:
          'badges icons note action comment link markers indicators top corner footer metadata chip hide off',
        section: 'Canvas',
        label: 'Element Indicators',
        description:
          'How an element shows it has a link, note, action or comments: quiet icons at its top, a labelled footer, or nothing.',
        options: [
          { id: 'top', label: 'Top' },
          { id: 'footer', label: 'Footer' },
          { id: 'off', label: 'Off' },
        ],
        read: readElementIndicatorStyle,
        write: (p, v) => withElementIndicatorStyle(p, v as ElementIndicatorStyle),
        event: { category: 'UI', changed: 'ElementIndicators' },
      },
      {
        kind: 'toggle',
        key: 'quickAddOnHover',
        keywords: 'plus menu hover add shortcut',
        section: 'Mouse',
        label: 'Quick-Add on Hover',
        description:
          "Opens the selected element's “+” menu as soon as you hover it, instead of on click.",
        helpArticle: 'quickAddOnHover',
        read: (p) => p.quickAddOnHover === true,
        write: (p, v) => ({ ...p, quickAddOnHover: v }),
        event: { category: 'UI', on: 'QuickAddHoverOn', off: 'QuickAddHoverOff' },
      },
      {
        kind: 'toggle',
        key: 'middleMousePan',
        keywords: 'scroll wheel drag pan navigate mouse',
        section: 'Mouse',
        label: 'Middle-Mouse Pan',
        description:
          'Hold the middle button and drag to pan, whatever tool is active. Off leaves the button to your browser.',
        read: (p) => p.middleMousePan !== false,
        write: (p, v) => ({ ...p, middleMousePan: v }),
        event: { category: 'UI', on: 'MiddleMousePanOn', off: 'MiddleMousePanOff' },
      },
      {
        // A preset, not a flag (docs/specs/007-editor/power-user-mode.md): switching on writes the
        // recommended values once; switching off restores the untouched ones.
        kind: 'toggle',
        key: 'powerUserMode',
        keywords: 'power user expert advanced pro minimal chrome fewer labels declutter',
        section: 'Power User',
        label: 'Power User Mode',
        description:
          'Applies recommended settings for experienced users and hides the tours. Switching it off puts back whatever you did not change since.',
        helpArticle: 'powerUserMode',
        read: isPowerUserMode,
        write: (p, v) => setPowerUserMode(p, v).prefs,
        event: { category: 'UI', on: 'PowerUserModeOn', off: 'PowerUserModeOff' },
      },
      {
        kind: 'toggle',
        key: 'minimalChrome',
        keywords: 'minimal chrome hide labels captions titles hints icons only declutter',
        section: 'Power User',
        label: 'Minimal Chrome',
        description:
          'Hides captions, panel titles and hints. Every control stays, and shows its name on hover.',
        helpArticle: 'powerUserMode',
        parent: 'powerUserMode',
        available: (ctx) => ctx.powerUserMode === true,
        read: (p) => p.minimalChrome !== false,
        write: (p, v) => ({ ...p, minimalChrome: v }),
        event: { category: 'UI', on: 'MinimalChromeOn', off: 'MinimalChromeOff' },
      },
      {
        kind: 'presetSummary',
        key: 'powerUserPreset',
        keywords: 'power user preset recommended defaults restore',
        section: 'Power User',
        label: 'Set By Power User Mode',
        description: 'Change any of them in its own row.',
        parent: 'powerUserMode',
        available: (ctx) => ctx.powerUserMode === true,
      },
    ],
  },
  {
    // Settings that apply only in Draw mode (docs/specs/007-editor/user-preferences.md):
    // a setting that acts in both modes stays on Editor itself. Named Draw, as the mode
    // switch names it (docs/specs/007-editor/editor-modes.md "Naming in the interface").
    // There is no Diagram sibling while no setting applies only to Diagram mode.
    id: 'draw',
    label: 'Draw',
    parent: 'editor',
    rows: [
      {
        // docs/specs/023-draw-mode/draw-mode.md "Where the dock sits": only Draw mode has a dock,
        // so only Draw mode moves with this.
        kind: 'choice',
        key: 'whiteboardDockPosition',
        keywords:
          'draw mode drawing mode whiteboard dock toolbar tools pens top bottom position tablet ipad drawing',
        label: 'Dock Position',
        description:
          'Where the dock of pens, shapes and tools sits. Bottom is closer to hand on a tablet.',
        helpArticle: 'drawMode',
        options: [
          { id: 'top', label: 'Top' },
          { id: 'bottom', label: 'Bottom' },
        ],
        read: readWhiteboardDockPosition,
        write: (p, v) => withWhiteboardDockPosition(p, v as WhiteboardDockPosition),
        event: { category: 'UI', changed: 'WhiteboardDockPosition' },
      },
    ],
  },
  {
    // Illustrate mode's own settings (docs/specs/007-editor/logo-pages.md "Construction guides"):
    // the master switch, then how strong and which guides, nested under it.
    id: 'illustrate',
    label: 'Illustrate',
    parent: 'editor',
    rows: [
      {
        // docs/specs/007-editor/illustrate-pages.md "Contents": the sidebar's minimise and the
        // popover's dock button write the same choice.
        kind: 'choice',
        key: 'contentsPlacement',
        keywords:
          'contents pages page list sidebar side bar left panel filmstrip slides navigator thumbnails minimise minimize maximise maximize dock button',
        section: 'Pages',
        label: 'Contents',
        description:
          'Where the list of pages sits on a computer: docked down the left, or tucked into its button. A phone always has the button.',
        options: [
          { id: 'sidebar', label: 'Sidebar' },
          { id: 'button', label: 'Button' },
        ],
        read: readContentsPlacement,
        write: (p, v) => withContentsPlacement(p, v as ContentsPlacement),
        event: { category: 'UI', changed: 'ContentsPlacement' },
      },
      {
        kind: 'toggle',
        key: 'logoGuides',
        keywords: 'logo guides construction grid keylines safe area centre lines snap artboard',
        section: 'Logo Pages',
        label: 'Logo Guides',
        description:
          'Draws centre lines, keylines, the safe area and a grid over a logo page; the keylines snap. A page you set on its own keeps its choice.',
        helpArticle: 'logoPages',
        alsoIn: "a logo page's Guides button",
        read: (p) => p.logoGuides !== false,
        write: (p, v) => ({ ...p, logoGuides: v }),
        event: { category: 'UI', on: 'LogoGuidesOn', off: 'LogoGuidesOff' },
      },
      {
        kind: 'choice',
        key: 'logoGuideStrength',
        keywords: 'logo guides strength opacity faint strong contrast',
        section: 'Logo Pages',
        parent: 'logoGuides',
        label: 'Logo Guide Strength',
        description: 'How strongly the guides show over the artwork.',
        options: [
          { id: 'faint', label: 'Faint' },
          { id: 'medium', label: 'Medium' },
          { id: 'strong', label: 'Strong' },
        ],
        read: readLogoGuideStrength,
        write: (p, v) => ({ ...p, logoGuideStrength: v as LogoGuideStrength }),
        event: { category: 'UI', changed: 'LogoGuideStrength' },
      },
      {
        // One switch per guide (docs/specs/007-editor/logo-pages.md "Construction guides") as one
        // grid; each event written out, so the telemetry dashboard reads its tokens.
        kind: 'toggleGroup',
        key: 'logoGuideParts',
        keywords:
          'logo guides centre lines diagonals safe area circles square grid construction keylines',
        section: 'Logo Pages',
        parent: 'logoGuides',
        label: 'Guides Shown',
        description: 'Which guides draw while they are on.',
        toggles: [
          logoGuidePart('centre', {
            category: 'UI',
            on: 'LogoGuideCentreLinesOn',
            off: 'LogoGuideCentreLinesOff',
          }),
          logoGuidePart('diagonals', {
            category: 'UI',
            on: 'LogoGuideDiagonalsOn',
            off: 'LogoGuideDiagonalsOff',
          }),
          logoGuidePart('safe', {
            category: 'UI',
            on: 'LogoGuideSafeAreaOn',
            off: 'LogoGuideSafeAreaOff',
          }),
          logoGuidePart('circles', {
            category: 'UI',
            on: 'LogoGuideCirclesOn',
            off: 'LogoGuideCirclesOff',
          }),
          logoGuidePart('square', {
            category: 'UI',
            on: 'LogoGuideSquareOn',
            off: 'LogoGuideSquareOff',
          }),
          logoGuidePart('grid', { category: 'UI', on: 'LogoGuideGridOn', off: 'LogoGuideGridOff' }),
        ],
      },
    ],
  },
  {
    // The presenter settings (docs/specs/012-collaboration/presentation-mode.md "Settings"): how slides change, how
    // the deck plays and what shows while presenting. They follow the account; the cog in a running presentation
    // keeps only Transition, Speed and the two clocks, the things changed in front of the room.
    id: 'presenting',
    label: 'Presenting',
    parent: 'editor',
    rows: [
      presentingChoice('transition', {
        section: 'Slides',
        label: 'Transition',
        description: 'How one slide gives way to the next.',
        keywords: 'slide transition animation fade cut move present presentation',
        options: SLIDE_TRANSITIONS.map((t) => ({ id: t.id, label: t.label })),
      }),
      presentingChoice('speed', {
        section: 'Slides',
        label: 'Speed',
        description: 'How long a transition takes.',
        keywords: 'transition speed quick slow duration present presentation',
        options: SLIDE_SPEEDS.map((t) => ({ id: t.id, label: t.label })),
      }),
      presentingChoice('zoom', {
        section: 'Slides',
        label: 'Slide Size',
        description:
          'Fill Screen blows a small slide up to fill the screen; Actual Size never zooms past 100%.',
        keywords: 'zoom fill screen actual size scale present presentation',
        options: SLIDE_ZOOMS.map((t) => ({ id: t.id, label: t.label })),
      }),
      {
        kind: 'choice',
        key: 'presentationAutoAdvance',
        section: 'Playback',
        label: 'Auto-Advance',
        description:
          'Move to the next slide on its own after this long; Off moves only when you say.',
        keywords: 'auto advance timer kiosk loop slideshow seconds present presentation',
        helpArticle: 'slideDeck',
        options: AUTO_ADVANCE_CHOICES.map((c) => ({ id: String(c.seconds), label: c.label })),
        read: (p) => String(readPresentationConfig(p).autoAdvanceSeconds),
        write: (p, v) => withPresentationConfig(p, { autoAdvanceSeconds: Number(v) }),
        event: { category: 'UI', changed: 'Presentation-autoAdvanceSeconds' },
      },
      presentingToggle('advanceOnClick', {
        section: 'Playback',
        label: 'Click to Advance',
        description: "Off if you'd rather only the keys and buttons move the deck.",
        keywords: 'click advance next mouse present presentation',
      }),
      presentingToggle('loop', {
        section: 'Playback',
        label: 'Loop the Deck',
        description: 'After the last slide, start again rather than ending.',
        keywords: 'loop repeat kiosk restart present presentation',
      }),
      presentingToggle('showPosition', {
        section: 'While Presenting',
        label: 'Show Position',
        description: "The 7 / 23 counter and the slide's name.",
        keywords: 'position counter slide number name hud present presentation',
      }),
      presentingToggle('keepControls', {
        section: 'While Presenting',
        label: 'Keep Controls Visible',
        description: 'Stop the controls fading out when the pointer rests.',
        keywords: 'controls hud fade visible present presentation',
      }),
      presentingToggle('hidePointer', {
        section: 'While Presenting',
        label: 'Hide the Pointer',
        description: 'A still cursor left on a projector is a distraction.',
        keywords: 'cursor pointer mouse hide projector present presentation',
      }),
      presentingToggle('showElapsed', {
        section: 'While Presenting',
        label: 'Show Elapsed Time',
        description: 'A clock counting from the moment you started.',
        keywords: 'clock timer elapsed time pacing present presentation',
        alsoIn: "a presentation's cog",
      }),
      presentingToggle('showBudget', {
        section: 'While Presenting',
        label: 'Show Slide Budget',
        description: 'Time on this slide against the minutes it was given.',
        keywords: 'budget minutes pacing timer slide time present presentation',
        alsoIn: "a presentation's cog",
      }),
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    rows: [
      {
        kind: 'appearance',
        key: 'appearance',
        keywords: 'dark mode light theme colour color night scheme',
        label: 'Theme',
        description:
          'Light or dark editor chrome, or System to follow your device. Saved on this device only.',
        alsoIn: 'the editor’s footer bar',
        illustration: 'appearance',
      },
      {
        // docs/specs/007-editor/live-app.md "Named on a wide desktop": the names beside the bottom
        // buttons' icons, the footer bar's and the bottom-right cluster's. A phone never names them,
        // so the row is inert there.
        kind: 'toggle',
        key: 'dockButtonNames',
        keywords:
          'button labels names text captions bottom bar corner buttons zoom layers style tidy up icons only',
        section: 'Interface',
        label: 'Button Labels',
        description:
          'Names the buttons along the bottom (Search, Settings, the theme, Layers, Style) beside their icons.',
        desktopOnly:
          'Phones always show these buttons as icons. Your choice still applies on a larger screen.',
        read: (p) => p.dockButtonNames !== false,
        write: (p, v) => ({ ...p, dockButtonNames: v }),
        event: { category: 'UI', on: 'DockButtonNamesOn', off: 'DockButtonNamesOff' },
      },
      // UI scale (docs/specs/007-editor/ui-scale.md): the working chrome only,
      // never the canvas, dialogs or menus. The master sets every part; each
      // part's row beneath it overrides that part alone.
      {
        ...UI_SCALE_SLIDER,
        key: 'uiScale',
        keywords:
          'zoom size bigger smaller larger text font scale magnify chrome interface ui accessibility',
        section: 'Interface',
        label: 'UI Scale',
        description:
          'Sizes the panels, the toolbar and the corner buttons. The canvas, dialogs and menus stay as they are.',
        read: (p: UserPreferences) => resolveUiScale(p),
        write: (p: UserPreferences, v: number) => withUiScalePatch(p, uiScalePatch(v)),
        preview: (v) => setUiScalePreview(v === null ? null : uiScalePatch(v)),
        event: { category: 'UI', changed: 'UiScale' },
      },
      uiScalePartRow('panels', {
        label: 'Panel Scale',
        keywords: 'panels explorer palette layers popover size bigger smaller zoom panel scale',
        description: 'Every panel, docked or opened from a button.',
        changed: 'UiScalePanels',
      }),
      uiScalePartRow('toolbar', {
        label: 'Toolbar Scale',
        keywords: 'toolbar strip top bar menu button size bigger smaller zoom toolbar scale',
        description: 'The toolbar strip and its menu button.',
        changed: 'UiScaleToolbar',
      }),
      uiScalePartRow('cornerButtons', {
        label: 'Corner Buttons Scale',
        keywords: 'undo redo zoom controls layers theme corner buttons size bigger smaller scale',
        description: 'Undo and Redo, Layers, Style and zoom.',
        changed: 'UiScaleCornerButtons',
      }),
    ],
  },
  {
    // The shortcuts master switch first, then every binding it gates. This
    // replaced the Keyboard Shortcuts window and its tab-bar button: the
    // list and the switch that turns it off belong on one screen. No key
    // opens it: reach it through Settings.
    id: 'keyboard',
    label: 'Keyboard',
    rows: [
      {
        kind: 'shortcuts',
        key: 'shortcutsEnabled',
        keywords: 'hotkeys keybindings keys accelerators cmd ctrl',
        label: 'Keyboard Shortcuts',
        description:
          'Turn off if you dictate into this browser or something else needs the keys. Saved on this device only.',
        helpArticle: 'keyboardShortcuts',
      },
      {
        kind: 'shortcutList',
        key: 'shortcutList',
        keywords: 'hotkeys keybindings list reference cheat sheet keys cmd ctrl',
        label: 'All Shortcuts',
        description: '⌘ is Cmd on a Mac and Ctrl on Windows and Linux.',
      },
    ],
  },
  {
    id: 'panels',
    label: 'Panels',
    rows: [
      {
        kind: 'slider',
        key: 'panelOpacity',
        keywords: 'transparency translucent fade see through alpha',
        label: 'Panel Opacity',
        description:
          'Lets the canvas show through panels and the toolbar. A panel turns solid while you use it.',
        helpArticle: 'panelOpacity',
        min: 0.3,
        max: 1,
        step: 0.05,
        format: (v) => `${Math.round(v * 100)}%`,
        read: (p) => p.panelOpacity ?? 1,
        write: (p, v) => ({ ...p, panelOpacity: v }),
        event: { category: 'UI', changed: 'PanelOpacity' },
      },
    ],
  },
  {
    id: 'layers',
    label: 'Layers',
    parent: 'panels',
    rows: [
      panelSwitch('layersPanelEnabled', {
        label: 'Enable Layers Panel',
        keywords: 'layers panel enable hide show turn off remove move to layer',
        description:
          'The panel, its corner button and “Move to layer”. Off, layers still keep their order, visibility and lock.',
        event: { category: 'UI', on: 'LayersPanelOn', off: 'LayersPanelOff' },
      }),
      {
        kind: 'toggle',
        key: 'layersShowPreview',
        parent: 'layersPanelEnabled',
        keywords: 'thumbnail preview layer picture',
        illustration: 'layerThumbnails',
        label: 'Layer Thumbnails',
        description: 'A small preview of what each layer holds.',
        read: (p) => p.layersShowPreview !== false,
        write: (p, v) => ({ ...p, layersShowPreview: v }),
        event: { category: 'UI', on: 'LayerPreviewOn', off: 'LayerPreviewOff' },
      },
      {
        kind: 'toggle',
        key: 'layersShowCount',
        parent: 'layersPanelEnabled',
        keywords: 'number badge count layer element counts',
        label: 'Layer Element Counts',
        description: 'How many elements each layer holds, beside its name.',
        read: (p) => p.layersShowCount !== false,
        write: (p, v) => ({ ...p, layersShowCount: v }),
        event: { category: 'UI', on: 'LayerCountOn', off: 'LayerCountOff' },
      },
      {
        kind: 'toggle',
        key: 'layerHoverPreview',
        parent: 'layersPanelEnabled',
        keywords: 'highlight hover layer preview solo',
        label: 'Preview Layer on Hover',
        description: 'Shows only that layer on the canvas while you rest on its row.',
        read: (p) => p.layerHoverPreview !== false,
        write: (p, v) => ({ ...p, layerHoverPreview: v }),
        event: { category: 'UI', on: 'LayerHoverPreviewOn', off: 'LayerHoverPreviewOff' },
      },
    ],
  },
  {
    id: 'map',
    label: 'Map',
    parent: 'panels',
    rows: [
      {
        // The Map's switch, written out rather than a panelSwitch: it keeps its
        // older key and telemetry tokens so stored choices and the dashboard
        // carry over the rename from "Show Map".
        kind: 'toggle',
        key: 'showMinimap',
        keywords: 'minimap overview thumbnail navigator birds eye hide show turn off enable',
        illustration: 'showMinimap',
        label: 'Enable Map',
        desktopOnly: MINIMAP_DESKTOP_ONLY,
        description:
          'An overview of the whole canvas in the bottom-left corner, once a tab has a few elements. Drag it to move around.',
        read: (p) => p.showMinimap !== false,
        write: (p, v) => ({ ...p, showMinimap: v }),
        event: { category: 'UI', on: 'MinimapOn', off: 'MinimapOff' },
      },
      {
        kind: 'toggle',
        key: 'mapDimOutside',
        parent: 'showMinimap',
        keywords: 'shade minimap viewport dim',
        illustration: 'mapDimOutside',
        label: 'Dim Outside the View',
        desktopOnly: MINIMAP_DESKTOP_ONLY,
        description: 'Shades what is off screen, so the part you are looking at stands out.',
        read: (p) => p.mapDimOutside !== false,
        write: (p, v) => ({ ...p, mapDimOutside: v }),
        event: { category: 'UI', on: 'MapDimOn', off: 'MapDimOff' },
      },
      {
        kind: 'choice',
        key: 'mapSize',
        parent: 'showMinimap',
        keywords: 'minimap height short medium tall',
        label: 'Map Size',
        desktopOnly: MINIMAP_DESKTOP_ONLY,
        description: 'How much of the corner the Map takes up.',
        options: [
          { id: 'short', label: 'Short' },
          { id: 'medium', label: 'Medium' },
          { id: 'tall', label: 'Tall' },
        ],
        read: (p) => p.mapSize ?? 'medium',
        write: (p, v) => ({ ...p, mapSize: v as MapSize }),
        event: { category: 'UI', changed: 'MapSize' },
      },
    ],
  },
  {
    id: 'collaborate',
    label: 'Collaborate',
    parent: 'panels',
    rows: [
      panelSwitch('collaboratePanelEnabled', {
        label: 'Enable Collaborate Panel',
        keywords: 'collaborate comments threads actions tasks panel enable hide show turn off',
        description:
          "Lists the tab's comments and actions, behind a corner button that shows once there are some. Off, they still work on the elements.",
        event: { category: 'UI', on: 'CollaboratePanelOn', off: 'CollaboratePanelOff' },
      }),
    ],
  },
  {
    id: 'quickStyle',
    label: 'Quick Style',
    parent: 'panels',
    rows: [
      panelSwitch('quickStylePanelEnabled', {
        label: 'Enable Quick Style Panel',
        keywords:
          'quick style colour color stroke fill width panel selection enable hide show turn off',
        description:
          "The most-used colours, widths and alignments beside a selected shape or arrow. Off, they are all in the element's menu.",
        event: { category: 'UI', on: 'QuickStylePanelOn', off: 'QuickStylePanelOff' },
      }),
    ],
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    rows: [
      {
        kind: 'toggle',
        key: 'reduceMotion',
        keywords: 'animation transitions accessibility motion sickness vestibular',
        label: 'Reduce Motion',
        description:
          "Turns off the editor's animations and transitions on every device you use. Your device's own setting is always respected too.",
        read: (p) => p.reduceMotion === true,
        write: (p, v) => ({ ...p, reduceMotion: v }),
        event: { category: 'UI', on: 'ReduceMotionOn', off: 'ReduceMotionOff' },
      },
      {
        kind: 'link',
        key: 'uiScaleLink',
        keywords: 'zoom size bigger larger text font scale magnify low vision',
        label: 'UI Scale',
        cta: 'Open Appearance',
        target: 'appearance',
        description: 'Make the panels, toolbar and corner buttons bigger, in Appearance.',
      },
    ],
  },
  {
    // The guided tours (docs/specs/007-editor/user-preferences.md "Tours"), one switch each. A tour
    // offers itself once, in its own mode, and its switch turns itself off once taken or dismissed.
    id: 'tours',
    label: 'Tours',
    collapsedSections: [ELEMENT_TOURS_SECTION],
    sectionNotes: {
      [ELEMENT_TOURS_SECTION]: {
        note: 'The first time you select a complex element, a small Tour toolbar beside it offers to show how it works. Switch one back on to be offered it again.',
      },
      'Offer Again': {
        note: 'Each tour offers itself once. Switch one back on and close Settings to take it again: it starts straight away if you are in its mode, or the next time you are.',
      },
    },
    rows: [
      tourSwitch('tourSeen', {
        // The Diagram tour (docs/specs/007-editor/editor-tour.md; the welcome tour until October 2026).
        label: 'Diagram Tour',
        event: { category: 'UI', on: 'TourSeenOff', off: 'TourSeenOn' },
        keywords:
          'tour walkthrough onboarding tutorial intro welcome getting started diagram shapes arrows palette replay',
        description: 'On a Diagram tab: the palette, selecting, the element menu and tabs.',
        helpArticle: 'diagramTour',
      }),
      tourTracksSwitch('planTourSeen', 'planTourTracks', PLAN_TOUR_TRACKS, planTourOwed, {
        label: 'Plan Tour',
        event: { category: 'UI', on: 'PlanTourSeenOff', off: 'PlanTourSeenOn' },
        keywords:
          'tour walkthrough onboarding tutorial plan board kanban cards sheet spreadsheet replay',
        description: 'The first time you work on a board, and on a sheet, in Plan.',
        helpArticle: 'planTour',
      }),
      tourSwitch('facilitateTourSeen', {
        label: 'Facilitate Tour',
        event: { category: 'UI', on: 'FacilitateTourSeenOff', off: 'FacilitateTourSeenOn' },
        keywords: 'tour walkthrough onboarding tutorial facilitate session retro workshop replay',
        description: 'The first time you work in Facilitate.',
        helpArticle: 'facilitateTour',
      }),
      tourSwitch('drawTourSeen', {
        label: 'Draw Tour',
        event: { category: 'UI', on: 'DrawTourSeenOff', off: 'DrawTourSeenOn' },
        keywords: 'tour walkthrough onboarding tutorial draw whiteboard pen sketch replay',
        description: 'The first time you work in Draw.',
        helpArticle: 'drawTour',
      }),
      tourSwitch('formTourSeen', {
        label: 'Forms Tour',
        event: { category: 'UI', on: 'FormTourSeenOff', off: 'FormTourSeenOn' },
        keywords: 'tour walkthrough onboarding tutorial form survey questions responses replay',
        description: 'The first time you open a Form tab.',
        helpArticle: 'planForms',
      }),
      tourSwitch('avatarTourSeen', {
        label: 'Avatar Tour',
        event: { category: 'UI', on: 'AvatarTourSeenOff', off: 'AvatarTourSeenOn' },
        keywords:
          'tour walkthrough onboarding tutorial avatar character walk speech message push replay',
        description: 'The first time you walk as an avatar.',
        helpArticle: 'avatarTour',
      }),
      tourTracksSwitch(
        'illustrateTourSeen',
        'illustrateTourKinds',
        ILLUSTRATE_TOUR_KINDS,
        illustrateTourOwed,
        {
          label: 'Illustrate Tour',
          event: { category: 'UI', on: 'IllustrateTourSeenOff', off: 'IllustrateTourSeenOn' },
          keywords:
            'tour walkthrough onboarding tutorial illustrate pages slides infographic article logo present replay',
          description:
            'The first time you work on each kind of page: slides, infographics, articles and logos.',
          helpArticle: 'illustrateTour',
        },
      ),
      // Element tours (docs/specs/007-editor/element-tours.md "Settings"): their own closed section, one switch for
      // them all over one per toured kind.
      tourTracksSwitch(
        'elementToursSeen',
        'elementTourKinds',
        ELEMENT_TOUR_KINDS,
        (p) => ELEMENT_TOUR_KINDS.some((k) => !elementTourSeen(p, k)),
        {
          label: 'Element Tours',
          event: { category: 'UI', on: 'ElementToursSeenOff', off: 'ElementToursSeenOn' },
          keywords: 'tour walkthrough tutorial element sankey how to use learn replay',
          description: 'Every element tour at once.',
        },
        ELEMENT_TOURS_SECTION,
      ),
      elementTourSwitch('sankey', {
        label: 'Sankey Diagram Tour',
        event: { category: 'UI', on: 'SankeyTourSeenOff', off: 'SankeyTourSeenOn' },
        keywords: 'tour walkthrough tutorial sankey flows bands nodes leftover replay',
        description: 'The first time you select a Sankey diagram.',
        helpArticle: 'sankeyDiagram',
      }),
      elementTourSwitch('layer-stack', {
        label: 'Layer Stack Tour',
        event: { category: 'UI', on: 'LayerStackTourSeenOff', off: 'LayerStackTourSeenOn' },
        keywords: 'tour walkthrough tutorial layer stack layers bands concept rows replay',
        description: 'The first time you select a layer stack.',
        helpArticle: 'conceptGraphics',
      }),
      elementTourSwitch('pyramid', {
        label: 'Pyramid Tour',
        event: { category: 'UI', on: 'PyramidTourSeenOff', off: 'PyramidTourSeenOn' },
        keywords: 'tour walkthrough tutorial pyramid tiers triangle inverted concept rows replay',
        description: 'The first time you select a pyramid.',
        helpArticle: 'conceptGraphics',
      }),
      elementTourSwitch('funnel', {
        label: 'Funnel Tour',
        event: { category: 'UI', on: 'FunnelTourSeenOff', off: 'FunnelTourSeenOn' },
        keywords:
          'tour walkthrough tutorial funnel conversion stages bands values concept rows replay',
        description: 'The first time you select a funnel.',
        helpArticle: 'conceptGraphics',
      }),
      elementTourSwitch('cycle', {
        label: 'Cycle Tour',
        event: { category: 'UI', on: 'CycleTourSeenOff', off: 'CycleTourSeenOn' },
        keywords:
          'tour walkthrough tutorial cycle loop ring flywheel pdca steps clockwise flow concept replay',
        description: 'The first time you select a cycle.',
        helpArticle: 'conceptGraphics',
      }),
      elementTourSwitch('hub', {
        label: 'Hub and Spoke Tour',
        event: { category: 'UI', on: 'HubTourSeenOff', off: 'HubTourSeenOn' },
        keywords: 'tour walkthrough tutorial hub spoke satellites ecosystem centre concept replay',
        description: 'The first time you select a hub and spoke.',
        helpArticle: 'conceptGraphics',
      }),
      elementTourSwitch('onion', {
        label: 'Onion Tour',
        event: { category: 'UI', on: 'OnionTourSeenOff', off: 'OnionTourSeenOn' },
        keywords:
          'tour walkthrough tutorial onion rings concentric core layers architecture concept replay',
        description: 'The first time you select an onion.',
        helpArticle: 'conceptGraphics',
      }),
      elementTourSwitch('chevrons', {
        label: 'Chevrons Tour',
        event: { category: 'UI', on: 'ChevronsTourSeenOff', off: 'ChevronsTourSeenOn' },
        keywords:
          'tour walkthrough tutorial chevrons chevron process stages pipeline value chain stage bar concept replay',
        description: 'The first time you select a chevron process.',
        helpArticle: 'conceptGraphics',
      }),
      elementTourSwitch('mind-node', {
        label: 'Mind Map Tour',
        event: { category: 'UI', on: 'MindMapTourSeenOff', off: 'MindMapTourSeenOn' },
        keywords:
          'tour walkthrough tutorial mind map node tab enter child sibling branch tidy outline replay',
        description: 'The first time you select a mind map node.',
        helpArticle: 'mindMaps',
      }),
      elementTourSwitch('flowchart', {
        label: 'Flowchart Tour',
        event: { category: 'UI', on: 'FlowchartTourSeenOff', off: 'FlowchartTourSeenOn' },
        keywords:
          'tour walkthrough tutorial flowchart step tab enter branch decision step type lane swimlane direction replay',
        description: 'The first time you select a flowchart step.',
        helpArticle: 'flowcharts',
      }),
      elementTourSwitch('org-chart', {
        label: 'Org Chart Tour',
        event: { category: 'UI', on: 'OrgChartTourSeenOff', off: 'OrgChartTourSeenOn' },
        keywords:
          'tour walkthrough tutorial org chart organisation organization person role initials report peer team replay',
        description: 'The first time you select a person in an org chart.',
        helpArticle: 'orgCharts',
      }),
      elementTourSwitch('sequence', {
        label: 'Sequence Tour',
        event: { category: 'UI', on: 'SequenceTourSeenOff', off: 'SequenceTourSeenOn' },
        keywords:
          'tour walkthrough tutorial sequence diagram participants messages call reply async lifeline numbered uml replay',
        description: 'The first time you select a sequence diagram.',
        helpArticle: 'sequenceDiagram',
      }),
      elementTourSwitch('chart', {
        label: 'Chart Tour',
        event: { category: 'UI', on: 'ChartTourSeenOff', off: 'ChartTourSeenOn' },
        keywords: 'chart pie bar column line area scatter doughnut data graph tour',
        description: 'The first time you select a chart.',
        helpArticle: 'dataElements',
      }),
      elementTourSwitch('stack', {
        label: 'Stack Tour',
        event: { category: 'UI', on: 'StackTourSeenOff', off: 'StackTourSeenOn' },
        keywords: 'stack row column grid layout container reflow tour',
        description: 'The first time you select a stack.',
        helpArticle: 'stacks',
      }),
      elementTourSwitch('entity', {
        label: 'Entity Tour',
        event: { category: 'UI', on: 'EntityTourSeenOff', off: 'EntityTourSeenOn' },
        keywords: 'entity uml class er table fields record tour',
        description: 'The first time you select an entity.',
        helpArticle: 'entities',
      }),
      elementTourSwitch('tab-window', {
        label: 'Tab Window Tour',
        event: { category: 'UI', on: 'TabWindowTourSeenOff', off: 'TabWindowTourSeenOn' },
        keywords: 'tab window live slide embed another tab tour',
        description: 'The first time you select a tab window.',
        helpArticle: 'tabWindows',
      }),
      elementTourSwitch('lane', {
        label: 'Lane Tour',
        event: { category: 'UI', on: 'LaneTourSeenOff', off: 'LaneTourSeenOn' },
        keywords: 'lane swimlane band gutter seam column tour',
        description: 'The first time you select a lane.',
        helpArticle: 'lanes',
      }),
      elementTourSwitch('boundary', {
        label: 'Boundary Tour',
        event: { category: 'UI', on: 'BoundaryTourSeenOff', off: 'BoundaryTourSeenOn' },
        keywords: 'boundary zone region vpc cluster c4 container tour',
        description: 'The first time you select a boundary.',
        helpArticle: 'boundaries',
      }),
      elementTourSwitch('diagram-key', {
        label: 'Diagram Key Tour',
        event: { category: 'UI', on: 'DiagramKeyTourSeenOff', off: 'DiagramKeyTourSeenOn' },
        keywords: 'diagram key legend line styles tag colours meanings tour',
        description: 'The first time you select a diagram key.',
        helpArticle: 'diagramKeys',
      }),
      elementTourSwitch('portal', {
        label: 'Portal Tour',
        event: { category: 'UI', on: 'PortalTourSeenOff', off: 'PortalTourSeenOn' },
        keywords: 'portal link travel teleport avatar shortcut tour',
        description: 'The first time you select a portal.',
        helpArticle: 'portals',
      }),
    ],
  },
  {
    id: 'ai',
    label: 'AI Tools',
    requiresAi: true,
    rows: [
      {
        kind: 'toggle',
        key: 'aiAssistanceEnabled',
        keywords: 'assistant chat ask clean llm',
        section: 'Assistant',
        label: 'AI Assistant',
        description:
          'An AI panel to Ask about the active tab, or Clean up its labels, sizes and styles. Off by default.',
        helpArticle: 'aiTools',
        read: (p) => p.aiAssistanceEnabled === true,
        write: (p, v) => ({ ...p, aiAssistanceEnabled: v }),
        event: { category: 'AI', on: 'AiOn', off: 'AiOff' },
      },
      {
        kind: 'toggle',
        key: 'aiSuggestedPrompts',
        keywords: 'starter questions prompts suggestions ai',
        section: 'Assistant',
        parent: 'aiAssistanceEnabled',
        label: 'Suggested Prompts',
        description: 'One-click starter prompts under the panel’s mode buttons.',
        read: (p) => p.aiSuggestedPrompts !== false,
        write: (p, v) => ({ ...p, aiSuggestedPrompts: v }),
        event: { category: 'AI', on: 'AiSuggestedPromptsOn', off: 'AiSuggestedPromptsOff' },
      },
      {
        kind: 'link',
        key: 'apiTokensLink',
        keywords: 'api token key mcp integration script developer access',
        section: 'API Access',
        label: 'API Tokens',
        cta: 'Manage API Tokens',
        target: 'tokens',
        description: 'Let your scripts, and AI tools connected over MCP, use livediagram as you.',
        available: (ctx) => ctx.authEnabled === true,
      },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    sectionNotes: {
      'Default Folders': {
        note: 'Where each kind of new document is saved when you create it without choosing a place.',
        helpArticle: 'defaultFolders',
      },
    },
    rows: [
      // One row per default folder entry, in list order: guests have defaults too.
      ...DEFAULT_KEY_ENTRIES.map((entry): SettingsPlacementDefaultRowSpec => ({
        kind: 'placementDefault',
        key: `placementDefault-${entry.key}`,
        placementKey: entry.key,
        section: 'Default Folders',
        // Settings labels are title case ("Kanban Boards"); the entries' own labels are sentence case.
        label: titleCase(entry.label),
        keywords:
          'default folder where new documents go save location place file automatically always save placement',
        description: `Where new ${entry.noun} go when you create one without choosing a place.`,
      })),
    ],
  },
  {
    id: 'account',
    label: 'Account',
    rows: [
      {
        kind: 'identity',
        key: 'identity',
        section: 'You',
        label: 'Guest',
        keywords:
          'account profile identity name email signed in sign in avatar picture photo google joined',
        description:
          'Your name, email and picture come from your account. Signed out, your documents belong to this browser.',
        helpArticle: 'guestVsAccount',
      },
      {
        kind: 'toggle',
        key: 'showProfilePicture',
        keywords: 'profile picture photo avatar google show hide privacy collaborators',
        section: 'You',
        label: 'Show My Profile Picture',
        description:
          'To signed-in collaborators, on presence, cursors and comments. Others always see your initials.',
        available: (ctx) => ctx.signedIn,
        read: (p) => showProfilePictureEnabled(p),
        write: (p, v) => ({ ...p, showProfilePicture: v }),
        event: { category: 'UI', on: 'ShowProfilePictureOn', off: 'ShowProfilePictureOff' },
      },
      {
        kind: 'trash',
        key: 'trash',
        section: 'Your Data',
        label: 'Trash',
        keywords:
          'trash bin recycle deleted undo undelete restore recover get back document diagram permanently empty',
        description: 'Deleted documents wait here for 30 days, ready to restore.',
        helpArticle: 'trash',
      },
      // One row per provider, from the Cloud Sync catalogue.
      ...CLOUD_SYNC_PROVIDERS.map((p): SettingsCloudSyncRowSpec => ({
        kind: 'cloudSync',
        key: `cloudSync-${p.id}`,
        provider: p.id,
        section: CLOUD_SYNC_SECTION,
        label: p.label,
        keywords: p.keywords,
        description: p.description,
        helpArticle: p.helpArticle,
        available: (ctx) => ctx.cloudProviders?.includes(p.id) ?? false,
      })),
      {
        kind: 'deleteAccount',
        key: 'deleteAccount',
        section: 'Danger Zone',
        label: 'Delete Account',
        keywords: 'delete account remove wipe erase close cancel data gdpr',
        description:
          'Removes your documents, folders, and the account itself, everywhere. There is no undo.',
      },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    parent: 'account',
    rows: [
      {
        kind: 'toggle',
        key: 'notificationsEnabled',
        keywords: 'toast popup confirmation message alert',
        section: 'In the Editor',
        label: 'In-Editor Notifications',
        description:
          'A brief note when something happens off screen, like moving a document to a folder. Errors always show.',
        read: (p) => p.notificationsEnabled !== false,
        write: (p, v) => ({ ...p, notificationsEnabled: v }),
        event: { category: 'UI', on: 'NotificationsOn', off: 'NotificationsOff' },
      },
      // A guest gets the stand-in row instead of six switches that could
      // never apply: the same shape the API tokens row uses, so "you need
      // an account for this" looks the same wherever it appears.
      {
        kind: 'note',
        key: 'emailSignIn',
        keywords: 'email notifications sign in account',
        section: 'Email',
        label: 'Email Notifications',
        note: 'Sign in to choose which emails you get.',
        signIn: true,
        description:
          'We can email you when someone joins one of your documents, comments on it, assigns you an action, and for a few other moments. Which ones is an account setting.',
        available: (ctx) => ctx.emailEnabled && !ctx.signedIn,
      },
      emailSwitch('notifyDocumentJoin', {
        event: { category: 'UI', on: 'NotifyDocumentJoinOn', off: 'NotifyDocumentJoinOff' },
        keywords: 'email join collaborator opened',
        label: 'Someone Joins My Document',
        description: 'A new person opens one of your shared documents.',
      }),
      emailSwitch('notifyComments', {
        event: { category: 'UI', on: 'NotifyCommentsOn', off: 'NotifyCommentsOff' },
        keywords: 'email comment reply feedback',
        label: 'Someone Comments on My Document',
        description: 'Someone leaves a comment on a document you own.',
      }),
      emailSwitch('notifyMentions', {
        event: { category: 'UI', on: 'NotifyMentionsOn', off: 'NotifyMentionsOff' },
        keywords: 'email mention tag at comment',
        label: 'Someone Mentions Me in a Comment',
        description: 'A teammate @mentions you in a comment.',
      }),
      emailSwitch('notifyFormResponses', {
        event: { category: 'UI', on: 'NotifyFormResponsesOn', off: 'NotifyFormResponsesOff' },
        keywords: 'email form response survey submission answer',
        label: 'Someone Fills In My Form',
        description:
          'Someone responds to a form in a document you own (at most one email every 15 minutes per form).',
      }),
      emailSwitch('notifyActionAssigned', {
        event: { category: 'UI', on: 'NotifyActionAssignedOn', off: 'NotifyActionAssignedOff' },
        keywords: 'email action assigned task todo',
        label: 'Someone Assigns Me an Action',
        description: 'A teammate assigns you an action on an element.',
      }),
      emailSwitch('notifyInviteResponse', {
        event: { category: 'UI', on: 'NotifyInviteResponseOn', off: 'NotifyInviteResponseOff' },
        keywords: 'email invite team accepted declined',
        label: 'Someone Responds to a Team Invite',
        description: 'Someone you invited accepts or declines, for teams you are an admin of.',
      }),
      emailSwitch('notifyTips', {
        event: { category: 'UI', on: 'NotifyTipsOn', off: 'NotifyTipsOff' },
        keywords: 'email tips onboarding nudge newsletter',
        label: 'Tips and Check-Ins',
        description: 'Occasional getting-started tips, and a nudge if you have been away a while.',
      }),
      emailSwitch('notifyMilestones', {
        event: { category: 'UI', on: 'NotifyMilestonesOn', off: 'NotifyMilestonesOff' },
        keywords: 'email milestone achievement celebrate',
        label: 'Milestones',
        description: 'A note when you hit one, like sharing your first document.',
      }),
    ],
  },
  {
    id: 'tokens',
    label: 'API Tokens',
    parent: 'account',
    rows: [
      {
        kind: 'tokens',
        key: 'apiTokens',
        keywords: 'api token key mcp integration script developer access create revoke secret',
        label: 'API Tokens',
        description:
          'Let your scripts, and AI tools connected over MCP, use livediagram as you. Treat each like a password: it lasts six months, and you can revoke it any time.',
        helpArticle: 'apiTokens',
        available: (ctx) => ctx.authEnabled === true,
      },
    ],
  },
  {
    id: 'privacy',
    label: 'Privacy',
    rows: [
      {
        kind: 'toggle',
        key: 'telemetryEnabled',
        keywords: 'analytics tracking usage data privacy anonymous',
        label: 'Send Anonymous Usage Events',
        description:
          'Small first-party events, listed publicly on /telemetry, that show which features help. Never your content, no third-party trackers.',
        helpArticle: 'whatWeCollect',
        read: (p) => p.telemetryEnabled !== false,
        write: (p, v) => ({ ...p, telemetryEnabled: v }),
        event: { category: 'UI', on: 'TelemetryOn', off: 'TelemetryOff' },
      },
    ],
  },
];

// A section's target id: "Cloud Sync" → "cloud-sync". Settings can open on one
// (docs/specs/007-editor/user-preferences.md).
export function settingsSectionId(section: string): string {
  return section.trim().toLowerCase().replace(/\s+/g, '-');
}

// The categories actually offered right now, with each one's rows filtered to
// those that apply. AI only appears when the api worker advertises the
// capability, so a self-hosted deploy without it never shows an empty group ,
// and a category left with no applicable rows drops out entirely rather than
// becoming a row that pushes a blank pane.
export function visibleCategories(
  aiCapable: boolean,
  ctx: SettingsRowContext,
): SettingsCategorySpec[] {
  return SETTINGS_CATEGORIES.filter((c) => !c.requiresAi || aiCapable)
    .filter((c) => !ctx.workbench || !hiddenInWorkbench(c))
    .map((c) => ({
      ...c,
      rows: c.rows.filter(
        (r) =>
          (!r.available || r.available(ctx)) &&
          parentSwitchOn(c, r, ctx.preferences) &&
          // The workbench sets the frame's scheme (WB15), so the frame offers no choice of its own.
          !(ctx.workbench && r.kind === 'appearance'),
      ),
    }))
    .filter((c) => c.rows.length > 0);
}

// What a workbench's Settings leave out (docs/specs/013-workspace/blueprints/workbench-embeds.md,
// Surface table): the account and everything beyond the one document. A category nested under one
// goes with it, so nothing is left without its parent.
const WORKBENCH_HIDDEN_CATEGORIES = new Set(['ai', 'documents', 'account', 'tokens']);

function hiddenInWorkbench(category: SettingsCategorySpec): boolean {
  return (
    WORKBENCH_HIDDEN_CATEGORIES.has(category.id) ||
    (category.parent !== undefined && WORKBENCH_HIDDEN_CATEGORIES.has(category.parent))
  );
}

// A row nested under a switch (`parent`) is offered only while that switch is
// on, when the live preferences are known. One rule for every nested row, so
// a new panel's rows follow its Enable switch with no extra wiring.
function parentSwitchOn(
  category: SettingsCategorySpec,
  row: SettingsRowSpec,
  preferences: UserPreferences | undefined,
): boolean {
  if (!row.parent || !preferences) return true;
  const parent = category.rows.find((r) => r.key === row.parent);
  return parent?.kind !== 'toggle' || parent.read(preferences);
}

// A category's name as a path from the top level: "Panels › Layers" for a
// sub-category, just the label otherwise. Where the name is shown away from
// the list that nests it (the canvas search's "in …").
export function settingsCategoryPath(category: SettingsCategorySpec): string {
  const parent = category.parent && SETTINGS_CATEGORIES.find((c) => c.id === category.parent);
  return parent ? `${parent.label} › ${category.label}` : category.label;
}

// A choice row's telemetry type carries the option picked, as a toggle's
// carries its new state (docs/specs/017-telemetry/telemetry.md): 'ElementIndicators' + 'top' →
// 'ElementIndicatorsTop', so the dashboard shows which way people moved, not
// just that they touched the setting. Option ids are catalogue constants,
// never user content.
export function choiceTelemetryType(changed: string, optionId: string): string {
  return `${changed}${optionId.charAt(0).toUpperCase()}${optionId.slice(1)}`;
}
