import type { ReactNode } from 'react';

// The Settings view's model (docs: each app's docs/specs/007-editor/user-preferences.md, "One
// Settings view for every app"). Presentational and app-agnostic: a category says what it is called
// and which icon it carries, a row says what it shows, its current value and what to do when it
// changes. Where the value lives (an editor's preferences, liveworkspace.app's stored scopes) is the
// caller's business, which is what lets one view serve both.

// What every row shows, whatever its control.
export type SettingsRowText = {
  // Stable within the dialog. Doubles as the React key, the label's and description's element ids,
  // and the scroll memory's anchor.
  key: string;
  label: string;
  // One or two short lines, under the label.
  description: string;
  // Space-separated, lowercase search synonyms, searched with the label and description.
  keywords?: string;
  // The sub-heading the row sits under within its category. Rows sharing one are adjacent.
  section?: string;
  // The key of a row in the same category this one nests under.
  parent?: string;
  // A help article, drawn by the kit's HelpLink.
  helpArticle?: string;
  // Where the same setting also has an in-context control.
  alsoIn?: string;
  // A drawing under the row, drawn by the kit's Illustration.
  illustration?: string;
  // The note shown on a phone, where the row has no effect: it stays visible, greyed and inert.
  desktopOnly?: string;
  // The app this row is one app's own, in the All view's merged categories: a key into its category's
  // `appHeadings`, drawn under that app's logo and name. Rows of one app are adjacent.
  app?: string;
};

export type SettingsRowBase = SettingsRowText & {
  // The setting is one every liveworkspace app shares: the row says "All apps".
  allApps?: boolean;
};

export type SettingsToggleRow = SettingsRowBase & {
  kind: 'toggle';
  value: boolean;
  onChange: (next: boolean) => void;
};

export type SettingsChoiceOption = { id: string; label: string; disabled?: boolean };

export type SettingsChoiceRow = SettingsRowBase & {
  kind: 'choice';
  options: readonly SettingsChoiceOption[];
  value: string;
  onChange: (next: string) => void;
};

export type SettingsSliderRow = SettingsRowBase & {
  kind: 'slider';
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  value: number;
  // Called once, on release, with the value the thumb came to rest on.
  onCommit: (next: number) => void;
  // Shows the value under the thumb while it moves; null once it is released or the row goes away.
  preview?: (value: number | null) => void;
};

export type SettingsToggleGroupRow = SettingsRowBase & {
  kind: 'toggleGroup';
  toggles: readonly {
    key: string;
    label: string;
    value: boolean;
    onChange: (next: boolean) => void;
  }[];
};

// A way into another category of this dialog, opened in place.
export type SettingsLinkRow = SettingsRowBase & { kind: 'link'; target: string; cta: string };

// A card with no control, standing in for settings the reader can't use yet. `signIn` ends the note
// with the kit's Sign In link.
export type SettingsNoteRow = SettingsRowBase & { kind: 'note'; note: string; signIn?: boolean };

// One line of the "Set By Power User Mode" readout.
export type SettingsPresetSummaryLine = {
  setting: string;
  rowKey: string;
  categoryId: string;
  categoryLabel: string;
  label: string;
  value: string;
  // Switching on recorded a baseline for it, so switching off can restore it.
  restorable: boolean;
  // Changed since the mode switched on, so switching off keeps it.
  changed: boolean;
  // Its row is offered in this dialog right now, so "Change" can go to it.
  reachable: boolean;
};

export type SettingsPresetSummaryRow = SettingsRowBase & {
  kind: 'presetSummary';
  lines: readonly SettingsPresetSummaryLine[];
};

export type SettingsShortcutSection = {
  heading: string;
  rows: readonly { label: string; keys: readonly string[] }[];
};

// The keyboard shortcut reference, as collapsible groups.
export type SettingsShortcutListRow = SettingsRowBase & {
  kind: 'shortcutList';
  sections: readonly SettingsShortcutSection[];
};

// A row the app draws itself (API tokens, the Trash, account rows, Cloud Sync and the rest), with
// SettingsRowShell for the common cell. `render` is called where the row is drawn, so a row backed
// by a hook returns its own component.
export type SettingsCustomRow = SettingsRowBase & { kind: 'custom'; render: () => ReactNode };

export type SettingsRow =
  | SettingsToggleRow
  | SettingsChoiceRow
  | SettingsSliderRow
  | SettingsToggleGroupRow
  | SettingsLinkRow
  | SettingsNoteRow
  | SettingsPresetSummaryRow
  | SettingsShortcutListRow
  | SettingsCustomRow;

export type SettingsSectionNote = { note: string; helpArticle?: string };

export type SettingsCategory = {
  id: string;
  label: string;
  // A top-level category's tile, or a sub-category's plain glyph.
  icon?: ReactNode;
  // The top-level category this nests under.
  parent?: string;
  // The heading it is listed under (SettingsGroupHeading's id), in the All view: the account, or an app.
  group?: string;
  // A line under a section's heading, for what every row in it shares.
  sectionNotes?: Readonly<Record<string, SettingsSectionNote>>;
  // Sections drawn as a closed accordion.
  collapsedSections?: readonly string[];
  // The apps whose own rows sit here under their logo and name (a row's `app`), with each app's section notes
  // and closed sections, which may differ between apps.
  appHeadings?: Readonly<Record<string, SettingsAppHeading>>;
  // Ids this category also answers to: an old layout's (a remembered `livediagram.app:editor`, `common:editor`) or a
  // bare deep link's (`editor`).
  aliases?: readonly string[];
  rows: readonly SettingsRow[];
};

// An app's sub-heading inside a category of the All view: its logo and name.
export type SettingsAppHeading = {
  label: string;
  icon?: ReactNode;
  sectionNotes?: Readonly<Record<string, SettingsSectionNote>>;
  collapsedSections?: readonly string[];
};

// A heading the rail lists categories under, in the order given: the All view's Account, with its logo. A `flat`
// one has no heading: its categories are listed as they are, always shown (All's merged categories).
export type SettingsGroupHeading = { id: string; label: string; icon?: ReactNode; flat?: boolean };

// A section's target id: "Cloud Sync" → "cloud-sync".
export function settingsSectionId(section: string): string {
  return section.trim().toLowerCase().replace(/\s+/g, '-');
}

// A category's name from the top level: "Panels › Layers" for a sub-category.
export function settingsCategoryPath(
  category: Pick<SettingsCategory, 'label' | 'parent'>,
  categories: readonly Pick<SettingsCategory, 'id' | 'label'>[],
): string {
  const parent = category.parent && categories.find((c) => c.id === category.parent);
  return parent ? `${parent.label} › ${category.label}` : category.label;
}
