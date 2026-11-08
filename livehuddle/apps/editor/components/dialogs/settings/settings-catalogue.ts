import { DATA_EXPORT_CATEGORY } from '@liveworkspace/settings/account';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import type { HelpArticleKey } from '@/lib/help-articles';
import {
  HIDE_CURSORS_HINT,
  HIDE_CURSORS_LABEL,
} from '@liveworkspace/workbench/components/dialogs/HideCursorsSwitch';
import type { SettingsCategoryId, SettingsIconId } from './settings-icons';
import type { TelemetryCategory } from '@livehuddle/api-schema';
import {
  panelEnabled,
  type MapSize,
  type PanelSwitch,
  type UserPreferences,
} from '@/lib/user-preferences';
import {
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
} from '@liveworkspace/workbench/lib/ui-scale';
import { setUiScalePreview } from '@liveworkspace/workbench/lib/ui-scale-preview';
import type { SettingsIllustrationId } from '@liveworkspace/workbench/components/dialogs/settings/settings-illustrations';

// One email notification switch (docs/specs/014-identity/profile-and-email-notifications.md): only
// where the deployment sends email AND the reader is signed in, since a guest has no address.
type EmailKey =
  | 'notifyDocumentJoin'
  | 'notifyInviteResponse'
  | 'notifyComments'
  | 'notifyActionAssigned'
  | 'notifyMentions'
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
// the Palette / Layers / Map gear popovers that used to carry
// them are gone (docs/specs/007-editor/user-preferences.md). One setting, one place. The panels kept their
// reset-position button, which was the only non-preference thing those
// popovers held.
//
// This is a flat catalogue, so it stays one file however long it gets.

// What a row needs to know about the deployment / session to decide whether
// it applies at all. Email rows need BOTH: email configured (the api's EMAIL binding, docs/specs/014-identity/transactional-email.md), or
// nothing can send, AND a signed-in account, or there is no address to send
// to. A guest flipping them would be writing preferences that can never
// apply, so they are absent rather than dead.
// `preferences` (the live values) lets a nested row follow its parent switch
// for the same reason: a setting for a panel that is off has nothing to act on.
type SettingsRowContext = {
  emailEnabled: boolean;
  signedIn: boolean;
  preferences?: UserPreferences;
  // The tab on screen draws other people's cursors (docs/specs/012-collaboration/collaborator-enhancements.md
  // "Only where cursors are drawn"); absent reads as drawn.
  cursorsDrawn?: boolean;
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
  // A page that says more, under the description, opened in a new tab.
  link?: { href: string; label: string };
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
  // several unrelated clusters (Editor's Canvas and Mouse rows) reads as one long undifferentiated list without them. Rows
  // sharing a section must be ADJACENT; the pane groups consecutive runs, so
  // a section cannot be split and silently re-headed further down.
  section?: string;
  // The key of a row in the same category this one belongs to: it renders
  // directly beneath that row, indented, in a group named after it
  // (docs/specs/007-editor/user-preferences.md).
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
// (`livehuddle:v2:ui-mode`), because a pre-hydration script has to apply it
// before first paint to avoid a theme flash (docs/specs/007-editor/editor-app.md). It therefore carries
// no read/write here and is rendered against its own store.
export type SettingsAppearanceRowSpec = RowBase & { kind: 'appearance' };

// API tokens (docs/specs/015-api/public-api-and-tokens.md#36-management-the-settings-dialogs-api-tokens-category):
// the whole manager, create, one-time reveal, list and revoke. Not a
// preference at all: it reads account state from the api, so like the
// appearance row it carries no read/write pair.
export type SettingsTokensRowSpec = RowBase & { kind: 'tokens' };

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

// Hide Participant Cursors (docs/specs/012-collaboration/collaborator-enhancements.md): per-device like the
// shortcuts switch, so it too carries no read/write pair and is rendered against its own store
// (@liveworkspace/workbench's useHideCursors), the one the Collaborators modal's switch reads.
export type SettingsHideCursorsRowSpec = RowBase & { kind: 'hideCursors' };

// The shortcut catalogue itself (shortcut-sections.ts), rendered as the
// collapsible reference list that used to be its own Keyboard Shortcuts
// window. Read-only, so no read/write pair either.
export type SettingsShortcutListRowSpec = RowBase & { kind: 'shortcutList' };

// Account identity, read from the account, and account deletion. Neither is a
// preference: they moved here from /explorer/profile (docs/specs/014-identity/profile-and-email-notifications.md) when that page
// was retired, because everything else it held was already in this dialog.
export type SettingsIdentityRowSpec = RowBase & { kind: 'identity' };
export type SettingsDeleteAccountRowSpec = RowBase & { kind: 'deleteAccount' };
// Reset All Settings (docs/specs/007-editor/user-preferences.md): every preference back to its default, above Delete
// Account in the Danger Zone. Not a preference itself: it clears them.
export type SettingsResetSettingsRowSpec = RowBase & { kind: 'resetSettings' };

// Default Folders (docs/specs/013-workspace/default-folders.md "Settings"): where new canvases go when made without
// a place. Not a preference: the shared Explorer reads and writes them on the index.
export type SettingsDefaultFoldersRowSpec = RowBase & { kind: 'defaultFolders' };

export type SettingsRowSpec =
  | SettingsToggleRowSpec
  | SettingsChoiceRowSpec
  | SettingsSliderRowSpec
  | SettingsAppearanceRowSpec
  | SettingsTokensRowSpec
  | SettingsNoteRowSpec
  | SettingsShortcutsRowSpec
  | SettingsHideCursorsRowSpec
  | SettingsShortcutListRowSpec
  | SettingsIdentityRowSpec
  | SettingsResetSettingsRowSpec
  | SettingsDeleteAccountRowSpec
  | SettingsDefaultFoldersRowSpec;

export type SettingsCategorySpec = {
  id: SettingsCategoryId;
  label: string;
  // The top-level category this is a sub-category of (Panels holds one per
  // panel, Editor one per mode with settings of its own, Account its
  // Notifications and API Tokens). The list nests it, untiled and indented, beneath its
  // parent; it is still its own pane. A parent's sub-categories follow it
  // directly, like a section's rows.
  parent?: SettingsIconId;
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

// The Mouse section's rows answer a hover and a middle button, which a phone has neither of, so they are inert there
// and share this note.
const MOUSE_DESKTOP_ONLY =
  'A mouse setting, so it has no effect on a phone. Your choice still applies on a larger screen.';

// The panel switches (docs/specs/007-editor/user-preferences.md), each on
// unless stored `false`. One row per Panels sub-category, first in its pane,
// with that panel's other rows nested beneath it (`parent`), so they are
// offered only while it is on (see `visibleCategories`).
function panelSwitch(
  key: PanelSwitch,
  row: Pick<SettingsToggleRowSpec, 'label' | 'keywords' | 'description' | 'event' | 'section'>,
): SettingsToggleRowSpec {
  return {
    kind: 'toggle',
    key,
    ...row,
    read: (p) => panelEnabled(p, key),
    write: (p, v) => ({ ...p, [key]: v }),
  };
}

// A tour's switch (docs/specs/007-editor/user-preferences.md "Getting Started"). INVERTED against its stored
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

// One element tour's switch (docs/specs/007-editor/element-tours.md "Settings"): on while its kind is still offered;
// on forgets its answer, off answers it. A stored `elementToursSeen` (the switch over them all, gone while the Portal
// is the only toured kind) still reads as every kind taken.
function elementTourSwitch(
  kind: ElementTourKind,
  row: Pick<SettingsToggleRowSpec, 'label' | 'description' | 'helpArticle' | 'keywords' | 'event'>,
): SettingsToggleRowSpec {
  return {
    kind: 'toggle',
    key: `elementTour-${kind}`,
    section: ELEMENT_TOURS_SECTION,
    ...row,
    read: (p) => !elementTourSeen(p, kind),
    write: (p, v) => (v ? offerElementTourAgain(p, kind) : markElementTourSeen(p, kind)),
  };
}

// Element tours are called Show Me wherever a person sees them (docs/specs/007-editor/element-tours.md "Naming").
const ELEMENT_TOURS_SECTION = 'Show Me';

type TourSeenKey = 'avatarTourSeen';

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
        // docs/specs/008-canvas/element-indicators.md: how an element shows its link, note,
        // action and comments.
        kind: 'choice',
        key: 'elementIndicatorStyle',
        keywords:
          'badges icons note action comment link markers indicators top corner footer metadata chip hide off',
        section: 'Canvas',
        label: 'Element Indicators',
        description:
          'How an element shows it has comments, an action or other markers: quiet icons at its top, a labelled footer, or nothing.',
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
        key: 'middleMousePan',
        keywords: 'scroll wheel drag pan navigate mouse',
        section: 'Mouse',
        desktopOnly: MOUSE_DESKTOP_ONLY,
        label: 'Middle-Mouse Pan',
        description:
          'Hold the middle button and drag to pan, whatever tool is active. Off leaves the button to your browser.',
        read: (p) => p.middleMousePan !== false,
        write: (p, v) => ({ ...p, middleMousePan: v }),
        event: { category: 'UI', on: 'MiddleMousePanOn', off: 'MiddleMousePanOff' },
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
          'button labels names text captions bottom bar corner buttons zoom style icons only',
        section: 'Interface',
        label: 'Button Labels',
        description:
          'Names the buttons along the bottom (Search, Settings, the theme, Style) beside their icons.',
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
          'zoom size bigger smaller larger text font scale magnify low vision chrome interface ui accessibility',
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
        keywords: 'panels explorer palette popover size bigger smaller zoom panel scale',
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
        keywords: 'undo redo zoom controls theme corner buttons size bigger smaller scale',
        description: 'Undo and Redo, Style and zoom.',
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
    // Each panel's settings were a sub-category of their own (Panels › Layers) until they became its sections: their
    // old ids still land here.
    aliases: ['map', 'collaborate'],
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
      {
        section: 'Map',
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
        section: 'Map',
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
        section: 'Map',
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
      panelSwitch('collaboratePanelEnabled', {
        section: 'Collaborate',
        label: 'Enable Collaborate Panel',
        keywords: 'collaborate comments threads actions tasks panel enable hide show turn off',
        description:
          "Lists the tab's comments and actions, behind a corner button that shows once there are some. Off, they still work on the elements.",
        event: { category: 'UI', on: 'CollaboratePanelOn', off: 'CollaboratePanelOff' },
      }),
      {
        section: 'Collaborate',
        kind: 'hideCursors',
        key: 'hideCursors',
        available: (ctx) => ctx.cursorsDrawn !== false,
        label: HIDE_CURSORS_LABEL,
        keywords:
          'cursors pointers names pills participants collaborators hide show busy session distracting',
        description: HIDE_CURSORS_HINT,
      },
      {
        section: 'Collaborate',
        // Your hearing ring (docs/specs/012-collaboration/proximity-audio.md "Your hearing ring"). Missing means shown.
        kind: 'toggle',
        key: 'hearingRing',
        label: 'Audio Proximity Ring',
        keywords:
          'audio proximity ring hearing range call voice microphone talking who can hear me circle zone show hide',
        description:
          'While you talk, a ring round your character shows where people can hear you. Off, nothing else about your microphone or the call changes.',
        read: (p) => p.hearingRing !== false,
        write: (p, v) => ({ ...p, hearingRing: v }),
        event: { category: 'UI', on: 'HearingRingOn', off: 'HearingRingOff' },
      },
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
    ],
  },
  {
    // The guided tours (docs/specs/007-editor/user-preferences.md "Getting Started"), one switch each, a tour of several
    // tracks one per track ("Boards Tour", "Slides Tour"). A tour starts from the footer's Start Tour button
    // (docs/specs/007-editor/editor-tour.md "Where it appears"), and its switch turns itself off once taken.
    id: 'tours',
    label: 'Getting Started',
    // Was named Tours: its old place in the panel still lands here.
    aliases: ['/tours'],
    collapsedSections: [ELEMENT_TOURS_SECTION],
    sectionNotes: {
      [ELEMENT_TOURS_SECTION]: {
        note: 'Select a complex element and press Start Tour in the bottom bar to see how it works. A switch is on until you have taken its tour.',
      },
      'Offer Again': {
        note: 'Start a tour from the Start Tour button in the bottom bar, left of Search: it offers the tour for what you are working on. A switch is on until you have taken its tour; switch one back on and close Settings to take it again now.',
      },
    },
    rows: [
      tourSwitch('avatarTourSeen', {
        label: "Receptionist's Welcome",
        event: { category: 'UI', on: 'AvatarTourSeenOff', off: 'AvatarTourSeenOn' },
        keywords:
          'receptionist receptionist welcome tour walkthrough onboarding tutorial avatar character walk pad topics ask replay',
        description: 'The Receptionist greets you on the Avatar Pad with what to try first.',
        helpArticle: 'avatarTour',
      }),
      // Element tours (docs/specs/007-editor/element-tours.md "Settings"): their own closed section, one switch per
      // toured kind. No switch over them all while the Portal is the only one.
      elementTourSwitch('portal', {
        label: 'Portal',
        event: { category: 'UI', on: 'PortalTourSeenOff', off: 'PortalTourSeenOn' },
        keywords:
          'portal link travel teleport avatar shortcut tour walkthrough tutorial element show me how to use learn replay',
        description: 'With a portal selected.',
        helpArticle: 'portals',
      }),
    ],
  },
  {
    id: 'documents',
    label: 'Explorer',
    // Was its own category (Settings › Spaces) beside the Explorer's: its old place in the panel still lands here.
    aliases: ['/spaces'],
    sectionNotes: {
      'Default Folders': {
        note: 'Where each kind of new space is saved when you create it without choosing a place.',
        helpArticle: 'defaultFolders',
      },
    },
    rows: [
      {
        // Automatically Open Explorer, a common setting (liveworkspace/docs/specs/004-index/one-explorer.md "Opening on
        // the Explorer"): the homepage opens the Explorer instead. The preferences write mirrors it into this address's
        // cookie, which the router reads (@liveworkspace/sites/open-explorer).
        kind: 'toggle',
        key: 'autoOpenExplorer',
        keywords: 'automatically open explorer redirect home homepage start landing skip straight',
        label: 'Automatically Open Explorer',
        description:
          'Opening the homepage while signed in takes you straight to your Explorer. A link to the homepage from inside the app still shows it.',
        read: (p) => p.autoOpenExplorer === true,
        write: (p, v) => ({ ...p, autoOpenExplorer: v }),
        event: { category: 'UI', on: 'AutoOpenExplorerOn', off: 'AutoOpenExplorerOff' },
      },
      {
        // Home's banner (docs/specs/013-workspace/explorer-home.md "Hiding the banner"): its own close writes `false`,
        // and this switch brings it back. The shared Explorer draws it (@liveworkspace/explorer's HomeHero).
        kind: 'toggle',
        key: 'homeBanner',
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
        label: 'Where New Spaces Go',
        keywords:
          'default folder where new spaces canvases documents go save location place file automatically always save placement',
        description: 'New spaces you make without choosing a place are saved in this folder.',
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
          'Your name and email come from your account. Signed out, your spaces belong to this browser.',
        helpArticle: 'guestVsAccount',
      },
      {
        kind: 'resetSettings',
        key: 'resetSettings',
        section: 'Danger Zone',
        label: 'Reset All Settings',
        keywords: 'reset restore default defaults factory clear settings preferences start over',
        description:
          'Puts every setting back to its default, in every liveworkspace app. Your profile, API tokens, webhooks and sign-ins stay as they are.',
      },
      {
        kind: 'deleteAccount',
        key: 'deleteAccount',
        section: 'Danger Zone',
        label: 'Delete Account',
        keywords: 'delete account remove wipe erase close cancel data gdpr',
        description:
          'Removes your livehuddle spaces, folders and settings, then signs you out. There is no undo.',
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
          'A brief note when something happens off screen, like moving a space to a folder. Errors and warnings always show.',
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
          'We can email you when someone joins one of your spaces, comments on it, assigns you an action, and for a few other moments. Which ones is an account setting.',
        available: (ctx) => ctx.emailEnabled && !ctx.signedIn,
      },
      emailSwitch('notifyComments', {
        event: { category: 'UI', on: 'NotifyCommentsOn', off: 'NotifyCommentsOff' },
        keywords: 'email comment reply feedback',
        label: 'Someone Comments on My Space',
        description: 'Someone leaves a comment on a space you own.',
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
        description: 'A teammate assigns you an action on an element, or a card on a board.',
      }),
      emailSwitch('notifyInviteResponse', {
        event: { category: 'UI', on: 'NotifyInviteResponseOn', off: 'NotifyInviteResponseOff' },
        keywords: 'email invite team accepted declined',
        label: 'Someone Responds to a Team Invite',
        description: 'Someone you invited accepts or declines, for teams you are an admin of.',
      }),
      emailSwitch('notifyDocumentJoin', {
        event: { category: 'UI', on: 'NotifyDocumentJoinOn', off: 'NotifyDocumentJoinOff' },
        keywords: 'email join collaborator opened document',
        label: 'Someone Joins My Space',
        description: 'A new person opens one of your shared spaces.',
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
        description: 'A note when you hit one, like sharing your first space.',
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
        // Signed in, the Account section draws the tokens in place (the shared panel's API Tokens), and this editor
        // has no workbench pairings to add under it: the row is a guest's way in alone.
        available: (ctx) => !ctx.signedIn,
        keywords: 'api token key integration script developer access create revoke secret',
        label: 'API Tokens',
        description:
          'Let your scripts use livehuddle as you. Treat each like a password: it lasts six months, and you can revoke it any time.',
        helpArticle: 'apiTokens',
      },
    ],
  },
  // Your Data (liveworkspace/docs/specs/003-accounts/data-export.md "Settings"): downloading everything an account owns,
  // made in liveworkspace's Settings. Signed in, the Account section's Your Data draws it in place; a guest gets this
  // stand-in, as for API Tokens.
  {
    id: 'data',
    label: DATA_EXPORT_CATEGORY.label,
    parent: 'account',
    rows: [
      {
        kind: 'note',
        key: 'dataExportSignIn',
        keywords: DATA_EXPORT_CATEGORY.keywords,
        label: DATA_EXPORT_CATEGORY.label,
        description: DATA_EXPORT_CATEGORY.description,
        note: DATA_EXPORT_CATEGORY.signInNote,
        signIn: true,
        available: (ctx) => !ctx.signedIn,
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
          'Small events like “a tab was added” that show us which features help. Never your content or who you are, and no third-party trackers. Every event we collect is listed in public, with how often each is sent.',
        link: { href: `${PLATFORM_SITE.url}/telemetry`, label: 'See Every Event' },
        helpArticle: 'whatWeCollect',
        read: (p) => p.telemetryEnabled !== false,
        write: (p, v) => ({ ...p, telemetryEnabled: v }),
        event: { category: 'UI', on: 'TelemetryOn', off: 'TelemetryOff' },
      },
    ],
  },
];

// A section's target id: "This Browser" → "this-browser". Settings can open on one
// (docs/specs/007-editor/user-preferences.md).
export function settingsSectionId(section: string): string {
  return section.trim().toLowerCase().replace(/\s+/g, '-');
}

// The categories actually offered right now, with each one's rows filtered to
// those that apply. A category left with no applicable rows drops out entirely rather than
// becoming a row that pushes a blank pane.
export function visibleCategories(ctx: SettingsRowContext): SettingsCategorySpec[] {
  return SETTINGS_CATEGORIES.map((c) => ({
    ...c,
    rows: c.rows.filter(
      (r) => (!r.available || r.available(ctx)) && parentSwitchOn(c, r, ctx.preferences),
    ),
  })).filter((c) => c.rows.length > 0);
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

// A category's name as a path from the top level: "Account › Notifications" for a
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
