import type { HelpArticleKey } from '@/lib/help-articles';
import type { SettingsCategoryId } from './settings-icons';
import type { TelemetryCategory } from '@livediagram/api-schema';
import {
  autoRebindArrowsEnabled,
  resolvePanelLayout,
  withPanelLayout,
  type MapSize,
  type PanelLayout,
  type UserPreferences,
} from '@/lib/user-preferences';
import type { SettingsIllustrationId } from './settings-illustrations';

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
// the Palette / Layers / Activity / AI / Map gear popovers that used to carry
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
export type SettingsRowContext = { emailEnabled: boolean; signedIn: boolean };

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
  // several unrelated clusters (Panels covers Layers, Activity and the
  // minimap) reads as one long undifferentiated list without them. Rows
  // sharing a section must be ADJACENT; the pane groups consecutive runs, so
  // a section cannot be split and silently re-headed further down.
  section?: string;
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
  event: { category: TelemetryCategory; changed: string };
};

// Appearance is the one row that is NOT a UserPreference: it is device-local
// (`livediagram:v2:ui-mode`), because a pre-hydration script has to apply it
// before first paint to avoid a theme flash (docs/specs/007-editor/live-app.md). It therefore carries
// no read/write here and is rendered against its own store.
export type SettingsAppearanceRowSpec = RowBase & { kind: 'appearance' };

// API tokens (docs/specs/015-api/public-api-and-tokens.md): a read-only listing plus a link out to the Explorer's
// tokens page. Not a preference at all: it reads account state from the api
//, so like the appearance row it carries no read/write pair.
export type SettingsTokensRowSpec = RowBase & { kind: 'tokens' };

// A card with no control: it stands in for settings the reader cannot use
// yet and says why. A section whose rows all vanish would otherwise take the
// section heading with it, so the reader never learns the settings exist ,
// which is the opposite of what a "find everything here" panel is for.
export type SettingsNoteRowSpec = RowBase & { kind: 'note'; note: string };

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

export type SettingsRowSpec =
  | SettingsToggleRowSpec
  | SettingsChoiceRowSpec
  | SettingsSliderRowSpec
  | SettingsAppearanceRowSpec
  | SettingsTokensRowSpec
  | SettingsNoteRowSpec
  | SettingsShortcutsRowSpec
  | SettingsShortcutListRowSpec
  | SettingsIdentityRowSpec
  | SettingsDeleteAccountRowSpec;

export type SettingsCategorySpec = {
  id: SettingsCategoryId;
  label: string;
  // Only rendered when the api worker advertises AI capability (docs/specs/007-editor/ai-assistance.md).
  requiresAi?: boolean;
  rows: SettingsRowSpec[];
};

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
          'Re-pins an arrow to the nearest face of the shape it connects as that shape moves, so a connection follows its endpoints instead of drifting.',
        helpArticle: 'autoAttachArrows',
        // Opt-in (docs/specs/007-editor/user-preferences.md), and the editor gates the rebind on this same
        // helper. Re-deriving it as `!== false` here showed the switch ON for
        // a fresh profile while the feature was off, so the first click
        // "turned it off" and it never ran.
        read: autoRebindArrowsEnabled,
        write: (p, v) => ({ ...p, autoRebindArrows: v }),
        event: { category: 'UI', on: 'AutoRebindOn', off: 'AutoRebindOff' },
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
        section: 'Theme',
        label: 'Theme',
        description:
          "Sets whether the editor chrome is light or dark. System follows your device. A tab's own canvas theme is a separate setting, except for Default, which follows this one. Stored on this device only, so it does not sync with your other settings.",
        alsoIn: 'the editor’s footer bar',
        illustration: 'appearance',
      },
      {
        // Three layouts, one choice (docs/specs/007-editor/toolbar-layout.md). Replaced the Minimal Panel
        // Layout toggle when the Toolbar layout arrived; the key is new so
        // the telemetry token is too, and the old On/Off tokens simply stop.
        kind: 'choice',
        key: 'panelLayout',
        keywords:
          'minimal compact dock button bar hide panels layout tidy toolbar strip top bar excalidraw floating',
        section: 'Layout',
        label: 'Panel Layout',
        description:
          'Floating shows the Explorer, Palette and other panels over the canvas. Minimal collapses them into a compact button bar that opens each as a popover. Toolbar keeps the floating panels but puts the Palette in one strip across the top of the canvas, and opens the Explorer from a button in the top-left. On a phone, Floating falls back to the button bar.',
        helpArticle: 'toolbarLayout',
        illustration: 'panelLayout',
        options: [
          { id: 'floating', label: 'Floating', desktopOnly: true },
          { id: 'minimal', label: 'Minimal' },
          { id: 'toolbar', label: 'Toolbar' },
        ],
        read: (p) => resolvePanelLayout(p),
        write: (p, v) => withPanelLayout(p, v as PanelLayout),
        event: { category: 'UI', changed: 'PanelLayout' },
      },
      {
        kind: 'toggle',
        key: 'showMinimap',
        keywords: 'map overview thumbnail navigator birds eye',
        section: 'Layout',
        illustration: 'showMinimap',
        label: 'Show Minimap',
        description:
          'Shows a small overview of the whole canvas in the bottom-left corner once a tab has a few elements and the Activity panel is minimised. Tap or drag it to jump around; scroll on it to zoom. Desktop only.',
        read: (p) => p.showMinimap !== false,
        write: (p, v) => ({ ...p, showMinimap: v }),
        event: { category: 'UI', on: 'MinimapOn', off: 'MinimapOff' },
      },
      {
        kind: 'slider',
        key: 'panelOpacity',
        keywords: 'transparency translucent fade see through alpha',
        section: 'Layout',
        label: 'Panel Opacity',
        description:
          'Fades the floating panels so the canvas shows through behind them; they snap back to fully opaque while hovered or focused. The minimal button bar is unaffected.',
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
    id: 'controls',
    label: 'Controls',
    rows: [
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
        kind: 'toggle',
        key: 'layersShowPreview',
        keywords: 'thumbnail preview layer picture',
        section: 'Layers',
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
        keywords: 'number badge count layer',
        section: 'Layers',
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
        keywords: 'highlight hover layer preview',
        section: 'Layers',
        label: 'Preview Layer on Hover',
        description:
          'Highlights a layer’s elements on the canvas while you hover its row, so you can find what a layer holds without selecting it.',
        read: (p) => p.layerHoverPreview !== false,
        write: (p, v) => ({ ...p, layerHoverPreview: v }),
        event: { category: 'UI', on: 'LayerHoverPreviewOn', off: 'LayerHoverPreviewOff' },
      },
      {
        kind: 'toggle',
        key: 'activityRevertHoverPreview',
        keywords: 'undo history revert preview hover activity',
        section: 'Activity',
        label: 'Preview Revert on Hover',
        description:
          'Shows what the canvas would look like after a revert while you hover that entry in the Activity panel, so you can check before committing to it.',
        read: (p) => p.activityRevertHoverPreview !== false,
        write: (p, v) => ({ ...p, activityRevertHoverPreview: v }),
        event: { category: 'UI', on: 'ActivityRevertPreviewOn', off: 'ActivityRevertPreviewOff' },
      },
      {
        kind: 'toggle',
        key: 'mapDimOutside',
        keywords: 'shade minimap viewport dim map',
        section: 'Minimap',
        illustration: 'mapDimOutside',
        label: 'Dim Outside the View',
        description:
          'Shades the part of the minimap that falls outside what you are currently looking at, so the viewport rectangle stands out.',
        read: (p) => p.mapDimOutside !== false,
        write: (p, v) => ({ ...p, mapDimOutside: v }),
        event: { category: 'UI', on: 'MapDimOn', off: 'MapDimOff' },
      },
      {
        kind: 'choice',
        key: 'mapSize',
        keywords: 'minimap height short medium tall map size',
        section: 'Minimap',
        label: 'Minimap Size',
        description: 'How much of the bottom-left corner the minimap takes up.',
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
          "Shows a brief confirmation when you do something whose result isn't on screen, like moving a diagram to a folder or linking a tab. Errors are always shown so a failure is never hidden. Turn off for a quieter editor.",
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
        description:
          'We can email you when someone joins one of your diagrams, comments on it, assigns you an action, and for a few other moments. Which ones is an account setting.',
        available: (ctx) => ctx.emailEnabled && !ctx.signedIn,
      },
      {
        kind: 'toggle',
        key: 'notifyDiagramJoin',
        keywords: 'email join collaborator opened',
        section: 'Email',
        label: 'Someone Joins My Diagram',
        description: 'When a new person opens one of your shared diagrams for the first time.',
        available: (ctx) => ctx.emailEnabled && ctx.signedIn,
        read: (p) => p.notifyDiagramJoin !== false,
        write: (p, v) => ({ ...p, notifyDiagramJoin: v }),
        event: { category: 'UI', on: 'NotifyDiagramJoinOn', off: 'NotifyDiagramJoinOff' },
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
        label: 'Someone Comments on My Diagram',
        description: 'When someone leaves a comment on a diagram you own.',
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
        description: 'When a teammate assigns you an action on a diagram element.',
        available: (ctx) => ctx.emailEnabled && ctx.signedIn,
        read: (p) => p.notifyActionAssigned !== false,
        write: (p, v) => ({ ...p, notifyActionAssigned: v }),
        event: { category: 'UI', on: 'NotifyActionAssignedOn', off: 'NotifyActionAssignedOff' },
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
          'A note when you hit a milestone, like sharing your first diagram or reaching your tenth.',
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
          'Offers the Show me around tour the next time you open a diagram. It switches itself off once you have taken or dismissed the tour, so it only ever offers itself once. Turn it back on and close Settings to run the tour again straight away.',
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
        kind: 'tokens',
        key: 'apiTokens',
        keywords: 'api token key mcp integration script developer access',
        section: 'API Access',
        label: 'API Tokens',
        description:
          'Tokens let your own scripts, and AI tools connected over MCP, call the livediagram API as you. Each one expires six months after it is created, and you can revoke any of them at any time.',
        alsoIn: 'the Explorer’s API Tokens page',
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
          'Your name and email come from your account and are changed there, not here. Signing in keeps your diagrams across browsers and devices; without it they belong to this browser alone.',
        helpArticle: 'guestVsAccount',
      },
      {
        kind: 'deleteAccount',
        key: 'deleteAccount',
        section: 'Danger Zone',
        label: 'Delete Account',
        keywords: 'delete account remove wipe erase close cancel data gdpr',
        description:
          'Removes your diagrams, folders, and the account itself, everywhere. There is no undo and no recovery, so you are asked to type your email to confirm.',
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
    .map((c) => ({ ...c, rows: c.rows.filter((r) => !r.available || r.available(ctx)) }))
    .filter((c) => c.rows.length > 0);
}
