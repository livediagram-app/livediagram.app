import type { HelpArticleKey } from '@/lib/help-articles';
import type { SettingsCategoryId, SettingsIconId } from './settings-icons';
import type { TelemetryCategory } from '@livediagram/api-schema';
import {
  autoRebindArrowsEnabled,
  showProfilePictureEnabled,
  panelEnabled,
  resolvePanelLayout,
  withPanelLayout,
  type MapSize,
  type PanelLayout,
  type PanelSwitch,
  type UserPreferences,
} from '@/lib/user-preferences';
import { isPowerUserMode, setPowerUserMode } from '@/lib/power-user-mode';
import {
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_STEP,
  resolveUiScale,
  resolveUiScalePart,
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
import type { SettingsIllustrationId } from './settings-illustrations';
import type { PlacementDefaultKey } from '@livediagram/api-schema';
import { DEFAULT_KEY_ENTRIES } from '@/lib/placement-defaults/default-key-entries';
import {
  CLOUD_SYNC_PROVIDERS,
  CLOUD_SYNC_SECTION,
  type CloudSyncProviderId,
} from '@/lib/cloud-sync/providers';

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
export type SettingsRowContext = {
  emailEnabled: boolean;
  signedIn: boolean;
  authEnabled?: boolean;
  powerUserMode?: boolean;
  preferences?: UserPreferences;
  // Cloud Sync providers the deployment offers (docs/specs/022-drive-mirror/drive-mirror.md).
  cloudProviders?: readonly CloudSyncProviderId[];
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
  // `desktopOnly` options are shown but can't be picked on a phone-sized
  // viewport, with a note saying so (the panel layouts: a phone is always
  // docked, docs/specs/007-editor/toolbar-layout.md).
  options: { id: string; label: string; desktopOnly?: boolean }[];
  // `mobile` asks for the value a phone shows, which can differ when the
  // stored one is desktop only (Floating shows as Toolbar there).
  read: (prefs: UserPreferences, view?: { mobile?: boolean }) => string;
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
  // panel, Editor one per mode with settings of its own). The list nests it, untiled and indented, beneath its
  // parent; it is still its own pane. A parent's sub-categories follow it
  // directly, like a section's rows.
  parent?: SettingsIconId;
  // Only rendered when the api worker advertises AI capability (docs/specs/007-editor/ai-assistance.md).
  requiresAi?: boolean;
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

export const SETTINGS_CATEGORIES: SettingsCategorySpec[] = [
  {
    id: 'editor',
    label: 'Editor',
    rows: [
      {
        kind: 'toggle',
        key: 'quickAddOnHover',
        keywords: 'plus menu hover add shortcut',
        label: 'Quick-Add on Hover',
        description:
          "Opens an element's quick-add “+” menu when you hover it, instead of waiting for a click; moving away closes it again. The “+” buttons still only appear on the selected element either way.",
        helpArticle: 'quickAddOnHover',
        read: (p) => p.quickAddOnHover === true,
        write: (p, v) => ({ ...p, quickAddOnHover: v }),
        event: { category: 'UI', on: 'QuickAddHoverOn', off: 'QuickAddHoverOff' },
      },
      {
        kind: 'toggle',
        key: 'alignmentGuides',
        keywords: 'snap lines smart guides align',
        illustration: 'alignmentGuides',
        label: 'Alignment Guides',
        description:
          'Shows snap lines while you move or resize an element, so it lines up with its neighbours.',
        helpArticle: 'alignmentGuides',
        read: (p) => p.alignmentGuides !== false,
        write: (p, v) => ({ ...p, alignmentGuides: v }),
        event: { category: 'UI', on: 'AlignmentGuidesOn', off: 'AlignmentGuidesOff' },
      },
      {
        kind: 'toggle',
        key: 'autoRebindArrows',
        keywords: 'connector reattach sticky arrows connections',
        label: 'Auto-Attach Arrows',
        description:
          'When a move leaves an arrow running through a shape it connects, its end moves to the side facing the other end and keeps its corner, quarter or middle spot.',
        helpArticle: 'autoAttachArrows',
        // On by default (docs/specs/007-editor/user-preferences.md); the editor gates the rebind on this
        // same helper, so the switch and the behaviour cannot disagree.
        read: autoRebindArrowsEnabled,
        write: (p, v) => ({ ...p, autoRebindArrows: v }),
        event: { category: 'UI', on: 'AutoRebindOn', off: 'AutoRebindOff' },
      },
      {
        kind: 'toggle',
        key: 'middleMousePan',
        keywords: 'scroll wheel drag pan navigate mouse',
        label: 'Middle-Mouse Pan',
        description:
          'Hold the middle mouse button and drag to pan the canvas in any direction, from anywhere, over empty space or over elements, whatever tool is active. Turn off to leave the middle button to your browser.',
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
          'Applies a set of recommended settings for people who know their way around: the Toolbar layout, alignment guides and auto-attach arrows on, the welcome tour marked as seen, and AI suggested prompts off. Change any of them afterwards and the mode stays on. Switching it off puts back the settings you did not change.',
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
          'Hides labels and hints you no longer need: palette captions, panel titles, the selection caption, status bar text and onboarding notices. Every control stays; its name shows when you hover or focus it.',
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
        description:
          'What switching the mode on set. Change any of them in its own row; switching the mode off restores the ones you left alone.',
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
          "Where Draw mode's dock of pens, shapes and tools sits. Top keeps it where the Toolbar layout keeps its tools; Bottom puts it closer to hand when drawing on a tablet. Only Draw mode has a dock, so Diagram mode is unchanged.",
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
    id: 'appearance',
    label: 'Appearance',
    rows: [
      {
        kind: 'appearance',
        key: 'appearance',
        keywords: 'dark mode light theme colour color night scheme',
        label: 'Theme',
        description:
          "Sets whether the editor chrome is light or dark. System follows your device. A tab's own canvas theme is a separate setting, except for Default, which follows this one. Stored on this device only, so it does not sync with your other settings.",
        alsoIn: 'the editor’s footer bar',
        illustration: 'appearance',
      },
      // UI scale (docs/specs/007-editor/ui-scale.md): the working chrome only,
      // never the canvas, dialogs or menus. The master sets every part; each
      // part's row beneath it overrides that part alone.
      {
        ...UI_SCALE_SLIDER,
        key: 'uiScale',
        keywords:
          'zoom size bigger smaller larger text font scale magnify chrome interface ui accessibility',
        label: 'UI Scale',
        description:
          'Makes the panels, the toolbar and the buttons in the bottom-right corner bigger or smaller. The canvas, dialogs and menus stay as they are. Sets all three; adjust one on its own below.',
        read: (p: UserPreferences) => resolveUiScale(p),
        write: (p: UserPreferences, v: number) => withUiScalePatch(p, uiScalePatch(v)),
        preview: (v) => setUiScalePreview(v === null ? null : uiScalePatch(v)),
        event: { category: 'UI', changed: 'UiScale' },
      },
      uiScalePartRow('panels', {
        label: 'Panel Scale',
        keywords: 'panels explorer palette layers popover size bigger smaller zoom',
        description: 'Every panel, floating or opened from a button, and the Quick Style panel.',
        changed: 'UiScalePanels',
      }),
      uiScalePartRow('toolbar', {
        label: 'Toolbar Scale',
        keywords: 'toolbar strip top bar menu button size bigger smaller zoom',
        description: 'The Toolbar layout’s strip and its menu button.',
        changed: 'UiScaleToolbar',
      }),
      uiScalePartRow('cornerButtons', {
        label: 'Corner Buttons Scale',
        keywords: 'undo redo zoom controls layers theme corner buttons size bigger smaller',
        description:
          'The buttons in the bottom-right corner: Undo and Redo, Layers, theme and zoom.',
        changed: 'UiScaleCornerButtons',
      }),
    ],
  },
  {
    // The shortcuts master switch first, then every binding it gates. This
    // replaced the Keyboard Shortcuts window and its tab-bar button: the
    // list and the switch that turns it off belong on one screen, and the
    // `?` key now opens Settings here.
    id: 'keyboard',
    label: 'Keyboard',
    rows: [
      {
        kind: 'shortcuts',
        key: 'shortcutsEnabled',
        keywords: 'hotkeys keybindings keys accelerators cmd ctrl',
        label: 'Keyboard Shortcuts',
        description:
          'Binds the editor’s keyboard shortcuts, undo, delete, Escape to cancel a mode, and the rest. Turn off if you dictate into this browser, or share it with something that needs the keys. Stored on this device only, so it does not sync with your other settings.',
        helpArticle: 'keyboardShortcuts',
      },
      {
        kind: 'shortcutList',
        key: 'shortcutList',
        keywords: 'hotkeys keybindings list reference cheat sheet keys cmd ctrl',
        label: 'All Shortcuts',
        description: '⌘ = Cmd on Mac, Ctrl on Windows / Linux.',
      },
    ],
  },
  {
    id: 'panels',
    label: 'Panels',
    rows: [
      {
        // Two layouts, one choice (docs/specs/007-editor/toolbar-layout.md).
        kind: 'choice',
        key: 'panelLayout',
        keywords: 'compact hide panels layout tidy toolbar strip top bar excalidraw floating',
        label: 'Panel Layout',
        description:
          'Floating shows the Explorer, Palette and other panels over the canvas. Toolbar keeps the floating panels but puts the Palette in one strip across the top of the canvas, and opens the Explorer from a button in the top-left. On a phone, Floating becomes Toolbar.',
        helpArticle: 'toolbarLayout',
        illustration: 'panelLayout',
        options: [
          { id: 'floating', label: 'Floating', desktopOnly: true },
          { id: 'toolbar', label: 'Toolbar' },
        ],
        read: (p, view) => resolvePanelLayout(p, view),
        write: (p, v) => withPanelLayout(p, v as PanelLayout),
        event: { category: 'UI', changed: 'PanelLayout' },
      },
      {
        kind: 'slider',
        key: 'panelOpacity',
        keywords: 'transparency translucent fade see through alpha',
        label: 'Panel Opacity',
        description:
          'Fades every panel, in every layout, so the canvas shows through behind it; a panel snaps back to fully opaque while hovered or focused. Buttons stay opaque.',
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
        keywords: 'layers panel hide show turn off remove move to layer',
        description:
          'Shows the Layers panel, its button in the bottom-right corner and the “Move to layer” choices in the element menu. Turned off, layers keep working: their order, visibility and lock still apply.',
        event: { category: 'UI', on: 'LayersPanelOn', off: 'LayersPanelOff' },
      }),
      {
        kind: 'toggle',
        key: 'layersShowPreview',
        parent: 'layersPanelEnabled',
        keywords: 'thumbnail preview layer picture',
        illustration: 'layerThumbnails',
        label: 'Layer Thumbnails',
        description:
          'Draws a small preview of each layer’s contents beside its row in the Layers panel.',
        read: (p) => p.layersShowPreview !== false,
        write: (p, v) => ({ ...p, layersShowPreview: v }),
        event: { category: 'UI', on: 'LayerPreviewOn', off: 'LayerPreviewOff' },
      },
      {
        kind: 'toggle',
        key: 'layersShowCount',
        parent: 'layersPanelEnabled',
        keywords: 'number badge count layer',
        label: 'Layer Element Counts',
        description:
          'Shows how many elements each layer holds, beside its name in the Layers panel.',
        read: (p) => p.layersShowCount !== false,
        write: (p, v) => ({ ...p, layersShowCount: v }),
        event: { category: 'UI', on: 'LayerCountOn', off: 'LayerCountOff' },
      },
      {
        kind: 'toggle',
        key: 'layerHoverPreview',
        parent: 'layersPanelEnabled',
        keywords: 'highlight hover layer preview',
        label: 'Preview Layer on Hover',
        description:
          'Highlights a layer’s elements on the canvas while you hover its row, so you can find what a layer holds without selecting it.',
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
        keywords: 'minimap overview thumbnail navigator birds eye hide show turn off',
        illustration: 'showMinimap',
        label: 'Enable Map',
        desktopOnly: MINIMAP_DESKTOP_ONLY,
        description:
          'Shows the Map, a small overview of the whole canvas in the bottom-left corner, once a tab has a few elements. Tap or drag it to jump around; scroll on it to zoom. Desktop only.',
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
        description:
          'Shades the part of the Map that falls outside what you are currently looking at, so the viewport rectangle stands out.',
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
        description: 'How much of the bottom-left corner the Map takes up.',
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
        keywords: 'collaborate comments threads actions tasks panel hide show turn off',
        description:
          'Shows the Collaborate panel, a list of the tab’s comment threads and actions, and its button in the bottom-right corner. It only appears while the tab has a comment or an action. Turned off, comments and actions still work from the elements themselves.',
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
        keywords: 'quick style colour color stroke fill width panel selection hide show turn off',
        description:
          'Shows the Quick Style panel beside a selected shape or arrow, with its most-used colours, widths and alignments. Turned off, every style is still in the element’s right-click menu.',
        event: { category: 'UI', on: 'QuickStylePanelOn', off: 'QuickStylePanelOff' },
      }),
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    rows: [
      {
        kind: 'toggle',
        key: 'notificationsEnabled',
        keywords: 'toast popup confirmation message alert',
        section: 'In the editor',
        label: 'In-Editor Notifications',
        description:
          "Shows a brief confirmation when you do something whose result isn't on screen, like moving a document to a folder or linking a tab. Errors are always shown so a failure is never hidden. Turn off for a quieter editor.",
        read: (p) => p.notificationsEnabled !== false,
        write: (p, v) => ({ ...p, notificationsEnabled: v }),
        event: { category: 'UI', on: 'NotificationsOn', off: 'NotificationsOff' },
      },
      // The email rows below were reachable only from the Explorer's Profile
      // pane, so the category named after notifications held one of seven.
      // A guest gets the stand-in card instead of six switches that could
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
      {
        kind: 'toggle',
        key: 'notifyDocumentJoin',
        keywords: 'email join collaborator opened',
        section: 'Email',
        label: 'Someone Joins My Document',
        description: 'When a new person opens one of your shared documents for the first time.',
        available: (ctx) => ctx.emailEnabled && ctx.signedIn,
        read: (p) => p.notifyDocumentJoin !== false,
        write: (p, v) => ({ ...p, notifyDocumentJoin: v }),
        event: { category: 'UI', on: 'NotifyDocumentJoinOn', off: 'NotifyDocumentJoinOff' },
      },
      {
        kind: 'toggle',
        key: 'notifyInviteResponse',
        keywords: 'email invite team accepted declined',
        section: 'Email',
        label: 'Someone Responds to a Team Invite',
        description: 'When someone you invited accepts or declines, for teams you’re an admin of.',
        available: (ctx) => ctx.emailEnabled && ctx.signedIn,
        read: (p) => p.notifyInviteResponse !== false,
        write: (p, v) => ({ ...p, notifyInviteResponse: v }),
        event: { category: 'UI', on: 'NotifyInviteResponseOn', off: 'NotifyInviteResponseOff' },
      },
      {
        kind: 'toggle',
        key: 'notifyComments',
        keywords: 'email comment reply feedback',
        section: 'Email',
        label: 'Someone Comments on My Document',
        description: 'When someone leaves a comment on a document you own.',
        available: (ctx) => ctx.emailEnabled && ctx.signedIn,
        read: (p) => p.notifyComments !== false,
        write: (p, v) => ({ ...p, notifyComments: v }),
        event: { category: 'UI', on: 'NotifyCommentsOn', off: 'NotifyCommentsOff' },
      },
      {
        kind: 'toggle',
        key: 'notifyActionAssigned',
        keywords: 'email action assigned task todo',
        section: 'Email',
        label: 'Someone Assigns Me an Action',
        description: 'When a teammate assigns you an action on an element.',
        available: (ctx) => ctx.emailEnabled && ctx.signedIn,
        read: (p) => p.notifyActionAssigned !== false,
        write: (p, v) => ({ ...p, notifyActionAssigned: v }),
        event: { category: 'UI', on: 'NotifyActionAssignedOn', off: 'NotifyActionAssignedOff' },
      },
      {
        kind: 'toggle',
        key: 'notifyMentions',
        keywords: 'email mention tag at comment',
        section: 'Email',
        label: 'Someone Mentions Me in a Comment',
        description: 'When a teammate @mentions you in a comment.',
        available: (ctx) => ctx.emailEnabled && ctx.signedIn,
        read: (p) => p.notifyMentions !== false,
        write: (p, v) => ({ ...p, notifyMentions: v }),
        event: { category: 'UI', on: 'NotifyMentionsOn', off: 'NotifyMentionsOff' },
      },
      {
        kind: 'toggle',
        key: 'notifyTips',
        keywords: 'email tips onboarding nudge newsletter',
        section: 'Email',
        label: 'Tips and Check-Ins',
        description:
          'Occasional getting-started tips, and a friendly nudge if you’ve been away for a while.',
        available: (ctx) => ctx.emailEnabled && ctx.signedIn,
        read: (p) => p.notifyTips !== false,
        write: (p, v) => ({ ...p, notifyTips: v }),
        event: { category: 'UI', on: 'NotifyTipsOn', off: 'NotifyTipsOff' },
      },
      {
        kind: 'toggle',
        key: 'notifyMilestones',
        keywords: 'email milestone achievement celebrate',
        section: 'Email',
        label: 'Milestones',
        description:
          'A note when you hit a milestone, like sharing your first document or reaching your tenth.',
        available: (ctx) => ctx.emailEnabled && ctx.signedIn,
        read: (p) => p.notifyMilestones !== false,
        write: (p, v) => ({ ...p, notifyMilestones: v }),
        event: { category: 'UI', on: 'NotifyMilestonesOn', off: 'NotifyMilestonesOff' },
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
          "Turns off the editor's decorative animations and transitions (panels, popovers, the snap guides, etc.) so the interface appears instantly instead of sliding or popping. Your device's own 'reduce motion' setting is always respected; this lets you force it on here too, and it syncs across your devices.",
        read: (p) => p.reduceMotion === true,
        write: (p, v) => ({ ...p, reduceMotion: v }),
        event: { category: 'UI', on: 'ReduceMotionOn', off: 'ReduceMotionOff' },
      },
      {
        kind: 'toggle',
        key: 'tourSeen',
        keywords: 'walkthrough onboarding intro show me around getting started',
        label: 'Show Welcome Tour',
        description:
          'Offers the Show me around tour the next time you open a document. It switches itself off once you have taken or dismissed the tour, so it only ever offers itself once. Turn it back on and close Settings to run the tour again straight away.',
        helpArticle: 'welcomeTour',
        // INVERTED against the stored preference: the row asks "show me the
        // tour?", `tourSeen` records "already seen". Switch on === not seen.
        read: (p) => p.tourSeen !== true,
        write: (p, v) => ({ ...p, tourSeen: !v }),
        // The tokens still track the PREFERENCE, not the switch, so the
        // dashboard series keeps meaning what it has always meant: turning
        // the row ON sets tourSeen=false, which is 'TourSeenOff'.
        event: { category: 'UI', on: 'TourSeenOff', off: 'TourSeenOn' },
      },
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
          'Shows an AI panel in the editor with two modes: Ask questions about the active tab, and Clean to tidy up labels, sizes, and styles. Off by default.',
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
        label: 'Suggested Prompts',
        description:
          'Offers a few starter questions in the AI panel when you have not typed anything yet.',
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
        description:
          'Tokens let your own scripts, and AI tools connected over MCP, call the livediagram API as you. They have their own category in Settings.',
        available: (ctx) => ctx.authEnabled === true,
      },
    ],
  },
  {
    // Experimental (docs/specs/007-editor/editor-modes.md "Experimental modes"): ideas being
    // tried out, each off until switched on here. Listed after AI Tools.
    id: 'experimental',
    label: 'Experimental',
    rows: [
      {
        kind: 'toggle',
        key: 'infographicModeEnabled',
        keywords: 'infographic page a4 poster editor mode experiment labs beta',
        label: 'Infographic Mode',
        description:
          'Adds Infographic mode to the editor mode switch: an A4 page to lay out icons, stickers, charts, components and media on. An experiment, so it may change or go away. Off by default.',
        read: (p) => p.infographicModeEnabled === true,
        write: (p, v) => ({ ...p, infographicModeEnabled: v }),
        event: { category: 'UI', on: 'InfographicModeOn', off: 'InfographicModeOff' },
      },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    // One row per default folder entry, in list order: guests have defaults too.
    rows: DEFAULT_KEY_ENTRIES.map((entry): SettingsPlacementDefaultRowSpec => ({
      kind: 'placementDefault',
      key: `placementDefault-${entry.key}`,
      placementKey: entry.key,
      section: 'Where New Documents Go',
      label: titleCase(entry.label),
      keywords:
        'default folder where new documents go save location place file automatically always save placement',
      description: `Where new ${entry.noun} go when you create one without choosing a place.`,
      helpArticle: 'defaultFolders',
    })),
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
          'Your name, email and picture come from your account and are changed there, not here. Signing in keeps your documents across browsers and devices; without it they belong to this browser alone.',
        helpArticle: 'guestVsAccount',
      },
      {
        kind: 'toggle',
        key: 'showProfilePicture',
        keywords: 'profile picture photo avatar google show hide privacy collaborators',
        section: 'You',
        label: 'Show My Profile Picture',
        description:
          'Signed-in collaborators see your picture on presence, cursors, comments and teams. People who open your share links without signing in always see your initials. You always see it yourself.',
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
        description:
          'Deleted documents wait here for 30 days before they are removed for good. Restore one to put it back where it was.',
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
          'Removes your documents, folders, and the account itself, everywhere. There is no undo and no recovery, so you are asked to type your email to confirm.',
      },
    ],
  },
  {
    id: 'tokens',
    label: 'API Tokens',
    rows: [
      {
        kind: 'tokens',
        key: 'apiTokens',
        keywords: 'api token key mcp integration script developer access create revoke secret',
        label: 'API Tokens',
        description:
          'Tokens let your own scripts, and AI tools connected over MCP, call the livediagram API as you. Treat one like a password. Each expires six months after it is created, and you can revoke any of them at any time.',
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
          'Sends the small, first-party events listed on /telemetry (no user content, no third-party trackers) so we can see which features actually help. Turn off to keep everything you do strictly on your device.',
        helpArticle: 'whatWeCollect',
        read: (p) => p.telemetryEnabled !== false,
        write: (p, v) => ({ ...p, telemetryEnabled: v }),
        event: { category: 'UI', on: 'TelemetryOn', off: 'TelemetryOff' },
      },
    ],
  },
];

// Settings labels are title case ("Kanban Boards"); the entries' own labels are sentence case.
function titleCase(label: string): string {
  return label.replace(/\b\w/g, (c) => c.toUpperCase());
}

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
    .map((c) => ({
      ...c,
      rows: c.rows.filter(
        (r) => (!r.available || r.available(ctx)) && parentSwitchOn(c, r, ctx.preferences),
      ),
    }))
    .filter((c) => c.rows.length > 0);
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

// A choice row by key, for a surface outside Settings that offers the same
// choice (the welcome tour's layout picker, docs/specs/007-editor/editor-tour.md) and must read, write
// and report it exactly as the row does.
export function choiceRow(key: string): SettingsChoiceRowSpec {
  for (const c of SETTINGS_CATEGORIES) {
    const row = c.rows.find((r) => r.key === key);
    if (row?.kind === 'choice') return row;
  }
  throw new Error(`No settings choice row "${key}"`);
}

// A choice row's telemetry type carries the option picked, as a toggle's
// carries its new state (docs/specs/017-telemetry/telemetry.md): 'PanelLayout' + 'toolbar' →
// 'PanelLayoutToolbar', so the dashboard shows which way people moved, not
// just that they touched the setting. Option ids are catalogue constants,
// never user content.
export function choiceTelemetryType(changed: string, optionId: string): string {
  return `${changed}${optionId.charAt(0).toUpperCase()}${optionId.slice(1)}`;
}
