import type { HelpArticleKey } from '@/lib/help-articles';
import type { SettingsCategoryId, SettingsIconId } from './settings-icons';
import type { TelemetryCategory } from '@liveplanner/api-schema';
import { panelEnabled, type PanelSwitch, type UserPreferences } from '@/lib/user-preferences';
import { isPowerUserMode, setPowerUserMode } from '@/lib/power-user-mode';
import { PLAN_TOUR_TRACKS, planTrackSeen, type PlanTourTrack } from '@/lib/plan-tour';
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
} from '@liveworkspace/workbench/lib/ui-scale';
import { setUiScalePreview } from '@liveworkspace/workbench/lib/ui-scale-preview';
import type { SettingsIllustrationId } from './settings-illustrations';

// One email notification switch (docs/specs/014-identity/profile-and-email-notifications.md): only
// where the deployment sends email AND the reader is signed in, since a guest has no address.
type EmailKey =
  | 'notifyProjectJoin'
  | 'notifyInviteResponse'
  | 'notifyComments'
  | 'notifyMentions'
  | 'notifyActionAssigned'
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
// Every preference a Plan tab acts on has a row here, and for most this is the
// ONLY control (docs/specs/007-editor/user-preferences.md). One setting, one place.
//
// This is a flat catalogue, so it stays one file however long it gets.

// What a row needs to know about the deployment / session to decide whether
// it applies at all. Email rows need BOTH: the api's EMAIL binding (docs/specs/014-identity/transactional-email.md), or
// nothing can send, AND a signed-in account, or there is no address to send
// to. A guest flipping them would be writing preferences that can never
// apply, so they are absent rather than dead.
// Power-user-only rows (docs/specs/007-editor/power-user-mode.md) need the mode on; absent otherwise.
// `preferences` (the live values) lets a nested row follow its parent switch
// for the same reason: a setting for a panel that is off has nothing to act on.
type SettingsRowContext = {
  emailEnabled: boolean;
  signedIn: boolean;
  powerUserMode?: boolean;
  preferences?: UserPreferences;
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

export type SettingsChoiceRowSpec = RowBase & {
  kind: 'choice';
  options: { id: string; label: string }[];
  read: (prefs: UserPreferences) => string;
  write: (prefs: UserPreferences, next: string) => UserPreferences;
  // Choices fire one 'Changed' event naming the setting (see choiceTelemetryType).
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
// (`liveplanner:v2:ui-mode`), because a pre-hydration script has to apply it
// before first paint to avoid a theme flash (docs/specs/007-editor/editor-app.md). It therefore carries
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
// rather than a synced preference (docs/specs/007-editor/editor-app.md): whether you want Cmd-Z bound
// depends on the keyboard in front of you, not on the account. So it too
// carries no read/write pair and is rendered against its own store.
export type SettingsShortcutsRowSpec = RowBase & { kind: 'shortcuts' };

// The shortcut catalogue itself (shortcut-sections.ts), rendered as the
// collapsible reference list that used to be its own Keyboard Shortcuts
// window. Read-only, so no read/write pair either.
export type SettingsShortcutListRowSpec = RowBase & { kind: 'shortcutList' };

// Account identity, read from the account, and account deletion. Neither is a
// preference: they moved here from /explorer/profile (docs/specs/014-identity/profile-and-email-notifications.md) when that page
// was retired, because everything else it held was already in this dialog.
export type SettingsIdentityRowSpec = RowBase & { kind: 'identity' };
export type SettingsDeleteAccountRowSpec = RowBase & { kind: 'deleteAccount' };

// The Trash (docs/specs/013-workspace/trash.md): not a preference, a way in.
// Here for everyone, guests and deployments without accounts included, because
// Settings is the one menu every deployment has.
export type SettingsTrashRowSpec = RowBase & { kind: 'trash' };

// Default Folders (docs/specs/013-workspace/default-folders.md "Settings"): where new plans go when made without
// a place. Not a preference: the shared Explorer reads and writes them on the index.
export type SettingsDefaultFoldersRowSpec = RowBase & { kind: 'defaultFolders' };

// What power user mode's preset set, as a live readout: each line's value is
// its own row's, changed in that row (docs/specs/007-editor/power-user-mode.md#in-settings).
export type SettingsPresetSummaryRowSpec = RowBase & { kind: 'presetSummary' };

export type SettingsRowSpec =
  | SettingsToggleRowSpec
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
  | SettingsDefaultFoldersRowSpec
  | SettingsPresetSummaryRowSpec;

export type SettingsCategorySpec = {
  id: SettingsCategoryId;
  label: string;
  // The top-level category this is a sub-category of (Panels holds one per
  // panel, Account its Notifications and API Tokens). The list nests it, untiled and indented, beneath its
  // parent; it is still its own pane. A parent's sub-categories follow it
  // directly, like a section's rows.
  parent?: SettingsIconId;
  // A line under a section's heading, for what every row in it shares (Projects' Default Folders,
  // the Tours' "offer again"), said once rather than under each row.
  sectionNotes?: Record<string, { note: string; helpArticle?: HelpArticleKey }>;
  rows: SettingsRowSpec[];
};

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
// forgets those answered. Its telemetry tokens are its seen flag's, as above.
// One track of a tour of several (lib/tour-tracks.ts), as its own row nested under the tour's switch over every track
// (Plan Tours): the Plan tour's Boards and Sheets
// (docs/specs/007-editor/user-preferences.md "Tours"). On while the track is owed; off answers it, on forgets its
// answer. Each track is named for itself ("Slides Tour"), never the mode. The tour's single seen flag (set by Power
// user mode) is folded into the answered list first, so turning one track back on leaves the others as they were.
function tourTrackSwitch(
  key: 'planTourSeen',
  tracksKey: 'planTourTracks',
  tracks: readonly PlanTourTrack[],
  seen: (p: UserPreferences, track: PlanTourTrack) => boolean,
  track: PlanTourTrack,
  row: Pick<SettingsToggleRowSpec, 'label' | 'description' | 'helpArticle' | 'keywords' | 'event'>,
): SettingsToggleRowSpec {
  return {
    kind: 'toggle',
    key: `${key}-${track}`,
    section: 'Offer Again',
    parent: key,
    ...row,
    read: (p) => !seen(p, track),
    write: (p, v) => {
      const answered = tracks.filter((t) => seen(p, t) && (v ? t !== track : true));
      return {
        ...p,
        [key]: false,
        [tracksKey]: v ? answered : [...new Set([...answered, track])],
      };
    },
  };
}

function tourTracksSwitch(
  key: 'planTourSeen',
  tracksKey: 'planTourTracks',
  tracks: readonly PlanTourTrack[],
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

type TourSeenKey = 'planTourSeen' | 'formTourSeen';

export const SETTINGS_CATEGORIES: SettingsCategorySpec[] = [
  {
    id: 'editor',
    label: 'Editor',
    rows: [
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
        // docs/specs/007-editor/editor-app.md "Named on a wide desktop": the names beside the bottom
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
    // The guided tours (docs/specs/007-editor/user-preferences.md "Tours"), one switch each, a tour of several
    // tracks one per track ("Boards Tour", "Slides Tour"). A tour starts from the footer's Start Tour button
    // (docs/specs/007-editor/editor-tour.md "Where it appears"), and its switch turns itself off once taken.
    id: 'tours',
    label: 'Tours',
    sectionNotes: {
      'Offer Again': {
        note: 'Start a tour from the Start Tour button in the bottom bar, left of Settings: it offers the tour for what you are working on. A switch is on until you have taken its tour; switch one back on and close Settings to take it again now.',
      },
    },
    rows: [
      // The Plan tour: one switch over both tracks, then each track's own row beneath it (docs/specs/026-plan/plan-tour.md).
      tourTracksSwitch(
        'planTourSeen',
        'planTourTracks',
        PLAN_TOUR_TRACKS,
        (p) => PLAN_TOUR_TRACKS.some((t) => !planTrackSeen(p, t)),
        {
          label: 'Plan Tours',
          event: { category: 'UI', on: 'PlanTourSeenOff', off: 'PlanTourSeenOn' },
          keywords:
            'tour walkthrough onboarding tutorial plan board kanban sheet spreadsheet all replay',
          description: 'Every Plan tour at once: boards, sheets and dashboards.',
          helpArticle: 'planTour',
        },
      ),
      tourTrackSwitch('planTourSeen', 'planTourTracks', PLAN_TOUR_TRACKS, planTrackSeen, 'boards', {
        label: 'Boards Tour',
        event: { category: 'UI', on: 'BoardsTourSeenOff', off: 'BoardsTourSeenOn' },
        keywords: 'tour walkthrough onboarding tutorial plan board kanban cards columns replay',
        description: 'On a board in Plan: cards, columns, the card panel and card types.',
        helpArticle: 'planTour',
      }),
      tourTrackSwitch('planTourSeen', 'planTourTracks', PLAN_TOUR_TRACKS, planTrackSeen, 'sheets', {
        label: 'Sheets Tour',
        event: { category: 'UI', on: 'SheetsTourSeenOff', off: 'SheetsTourSeenOn' },
        keywords:
          'tour walkthrough onboarding tutorial plan sheet spreadsheet cells formulas replay',
        description: 'On a sheet in Plan: cells, formulas, the toolbar and its settings.',
        helpArticle: 'planTour',
      }),
      tourTrackSwitch(
        'planTourSeen',
        'planTourTracks',
        PLAN_TOUR_TRACKS,
        planTrackSeen,
        'dashboards',
        {
          label: 'Dashboards Tour',
          event: { category: 'UI', on: 'DashboardsTourSeenOff', off: 'DashboardsTourSeenOn' },
          keywords: 'tour walkthrough onboarding tutorial plan dashboard slots rows replay',
          description: 'On a dashboard in Plan: rows of slots, filling them, and its settings.',
          helpArticle: 'planDashboards',
        },
      ),
      tourSwitch('formTourSeen', {
        label: 'Forms Tour',
        event: { category: 'UI', on: 'FormTourSeenOff', off: 'FormTourSeenOn' },
        keywords: 'tour walkthrough onboarding tutorial form survey questions responses replay',
        description: 'On a Form tab.',
        helpArticle: 'planForms',
      }),
    ],
  },
  {
    id: 'projects',
    label: 'Plans',
    rows: [
      {
        // Home's banner (docs/specs/013-workspace/explorer-home.md "Hiding the banner"): its own close writes `false`,
        // and this switch brings it back. The shared Explorer draws it (@liveworkspace/explorer's HomeHero).
        kind: 'toggle',
        key: 'homeBanner',
        section: 'Explorer',
        keywords: 'home banner hero greeting welcome header top search explorer hide show close',
        label: 'Show Home Banner',
        description:
          "The greeting, status pills and large search at the top of Explorer Home. When it's hidden, Home's search sits in the header, as on every other Explorer page.",
        read: (p) => p.homeBanner !== false,
        write: (p, v) => ({ ...p, homeBanner: v }),
        event: { category: 'UI', on: 'HomeBannerOn', off: 'HomeBannerOff' },
      },
      {
        kind: 'defaultFolders',
        key: 'defaultFolders',
        section: 'Default Folders',
        label: 'Where New Plans Go',
        keywords:
          'default folder where new projects go save location place file automatically always save placement plans kanban retrospective template',
        description:
          'New plans you make without choosing a place are saved in these folders. Kanban and Retrospective plans can have their own.',
      },
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
        keywords: 'account profile identity name email signed in sign in avatar joined',
        description:
          'Your name and email come from your account. Signed out, your plans belong to this browser.',
        helpArticle: 'guestVsAccount',
      },
      {
        kind: 'trash',
        key: 'trash',
        section: 'Your Data',
        label: 'Trash',
        keywords:
          'trash bin recycle deleted undo undelete restore recover get back project diagram permanently empty plan',
        description: 'Deleted plans wait here for 30 days, ready to restore.',
        helpArticle: 'trash',
      },
      {
        kind: 'deleteAccount',
        key: 'deleteAccount',
        section: 'Danger Zone',
        label: 'Delete Account',
        keywords: 'delete account remove wipe erase close cancel data gdpr',
        description:
          'Removes your liveplanner plans, folders and settings, then signs you out. There is no undo.',
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
          'A brief note when something happens off screen, like moving a plan to a folder. Errors and warnings always show.',
        read: (p) => p.notificationsEnabled !== false,
        write: (p, v) => ({ ...p, notificationsEnabled: v }),
        event: { category: 'UI', on: 'NotificationsOn', off: 'NotificationsOff' },
      },
      // A guest gets the stand-in row instead of email switches that could
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
          'We can email you when someone joins one of your plans, comments on it, fills in one of your forms, and for a few other moments. Which ones is an account setting.',
        available: (ctx) => ctx.emailEnabled && !ctx.signedIn,
      },
      emailSwitch('notifyProjectJoin', {
        event: { category: 'UI', on: 'NotifyProjectJoinOn', off: 'NotifyProjectJoinOff' },
        keywords: 'email join collaborator opened',
        label: 'Someone Joins My Plan',
        description: 'A new person opens one of your shared plans.',
      }),
      emailSwitch('notifyComments', {
        event: { category: 'UI', on: 'NotifyCommentsOn', off: 'NotifyCommentsOff' },
        keywords: 'email comment reply feedback',
        label: 'Someone Comments on My Plan',
        description: 'Someone leaves a comment on a plan you own.',
      }),
      emailSwitch('notifyMentions', {
        event: { category: 'UI', on: 'NotifyMentionsOn', off: 'NotifyMentionsOff' },
        keywords: 'email mention tag at comment',
        label: 'Someone Mentions Me in a Comment',
        description: 'A teammate @mentions you in a comment.',
      }),
      emailSwitch('notifyActionAssigned', {
        event: { category: 'UI', on: 'NotifyActionAssignedOn', off: 'NotifyActionAssignedOff' },
        keywords: 'email action assigned task todo',
        label: 'Someone Assigns Me an Action',
        description: 'A teammate assigns you an action on a plan.',
      }),
      emailSwitch('notifyFormResponses', {
        event: { category: 'UI', on: 'NotifyFormResponsesOn', off: 'NotifyFormResponsesOff' },
        keywords: 'email form response survey submission answer',
        label: 'Someone Fills In My Form',
        description:
          'Someone responds to a form in a plan you own (at most one email every 15 minutes per form).',
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
        description: 'A note when you hit one, like sharing your first plan.',
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
          'Let your scripts, and AI tools connected over MCP, use liveplanner as you. Treat each like a password: it lasts six months, and you can revoke it any time.',
        helpArticle: 'apiTokens',
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

// A section's target id: "Your Data" → "your-data". Settings can open on one
// (docs/specs/007-editor/user-preferences.md).
export function settingsSectionId(section: string): string {
  return section.trim().toLowerCase().replace(/\s+/g, '-');
}

// The categories actually offered right now, with each one's rows filtered to
// those that apply. A category left with no applicable rows drops out entirely
// rather than becoming a row that pushes a blank pane.
export function visibleCategories(ctx: SettingsRowContext): SettingsCategorySpec[] {
  return SETTINGS_CATEGORIES.filter((c) => !ctx.workbench || !hiddenInWorkbench(c))
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
// Surface table): the account and everything beyond the one project. A category nested under one
// goes with it, so nothing is left without its parent.
const WORKBENCH_HIDDEN_CATEGORIES = new Set(['projects', 'account', 'tokens']);

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

// A category's name as a path from the top level: "Panels › Collaborate" for a
// sub-category, just the label otherwise. Where the name is shown away from
// the list that nests it (the canvas search's "in …").
export function settingsCategoryPath(category: SettingsCategorySpec): string {
  const parent = category.parent && SETTINGS_CATEGORIES.find((c) => c.id === category.parent);
  return parent ? `${parent.label} › ${category.label}` : category.label;
}

// A choice row's telemetry type carries the option picked, as a toggle's
// carries its new state (docs/specs/017-telemetry/telemetry.md): 'Size' + 'tall' →
// 'SizeTall', so the dashboard shows which way people moved, not
// just that they touched the setting. Option ids are catalogue constants,
// never user content.
export function choiceTelemetryType(changed: string, optionId: string): string {
  return `${changed}${optionId.charAt(0).toUpperCase()}${optionId.slice(1)}`;
}
