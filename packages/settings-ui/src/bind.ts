import { choiceTelemetryType } from '@liveworkspace/settings/catalogue';
import type { SettingsRow, SettingsRowText } from './model';

// Binding an app's own Settings catalogue (each editor's settings-catalogue.ts: rows that read and
// write themselves over the app's preferences) onto the view's model. The kinds every app shares
// are bound here, once; the rest are the app's own (custom rows).

export type SettingsTrack = (category: string, action: 'Toggled' | 'Changed', type: string) => void;

type ToggleEvent = { category: string; on: string; off: string };
type ChangeEvent = { category: string; changed: string };

export type BindableToggle<P> = SettingsRowText & {
  kind: 'toggle';
  read: (prefs: P) => boolean;
  write: (prefs: P, next: boolean) => P;
  event: ToggleEvent;
};

export type BindableChoice<P> = SettingsRowText & {
  kind: 'choice';
  options: readonly { id: string; label: string }[];
  read: (prefs: P) => string;
  write: (prefs: P, next: string) => P;
  event: ChangeEvent;
};

export type BindableSlider<P> = SettingsRowText & {
  kind: 'slider';
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  read: (prefs: P) => number;
  write: (prefs: P, next: number) => P;
  preview?: (value: number | null) => void;
  event: ChangeEvent;
};

export type BindableToggleGroup<P> = SettingsRowText & {
  kind: 'toggleGroup';
  toggles: readonly {
    key: string;
    label: string;
    read: (prefs: P) => boolean;
    write: (prefs: P, next: boolean) => P;
    event: ToggleEvent;
  }[];
};

export type BindableLink = SettingsRowText & { kind: 'link'; target: string; cta: string };
export type BindableNote = SettingsRowText & { kind: 'note'; note: string; signIn?: boolean };

export type BindableRow<P> =
  | BindableToggle<P>
  | BindableChoice<P>
  | BindableSlider<P>
  | BindableToggleGroup<P>
  | BindableLink
  | BindableNote;

const BINDABLE = new Set(['toggle', 'choice', 'slider', 'toggleGroup', 'link', 'note']);

/** Whether the view binds this row itself; any other kind is the app's to draw. */
export function isBindableRow<R extends { kind: string }>(
  row: R,
): row is Extract<R, { kind: BindableRow<unknown>['kind'] }> {
  return BINDABLE.has(row.kind);
}

export type BindContext<P> = {
  settings: P;
  onChange: (next: P) => void;
  // Fired BEFORE the write, so an opt-out event still reaches the wire ahead of the preference
  // that gates it.
  track: SettingsTrack;
};

// The row's text, without the read/write half.
function text(row: SettingsRowText): SettingsRowText {
  return {
    key: row.key,
    label: row.label,
    description: row.description,
    ...(row.keywords !== undefined ? { keywords: row.keywords } : {}),
    ...(row.section !== undefined ? { section: row.section } : {}),
    ...(row.parent !== undefined ? { parent: row.parent } : {}),
    ...(row.helpArticle !== undefined ? { helpArticle: row.helpArticle } : {}),
    ...(row.alsoIn !== undefined ? { alsoIn: row.alsoIn } : {}),
    ...(row.illustration !== undefined ? { illustration: row.illustration } : {}),
    ...(row.desktopOnly !== undefined ? { desktopOnly: row.desktopOnly } : {}),
  };
}

/** One of the shared kinds, bound to the live preferences: its value read, each change tracked and
 *  then written. */
export function bindRow<P>(
  row: BindableRow<P>,
  { settings, onChange, track }: BindContext<P>,
  allApps = false,
): SettingsRow {
  const base = { ...text(row), ...(allApps ? { allApps } : {}) };
  switch (row.kind) {
    case 'toggle':
      return {
        ...base,
        kind: 'toggle',
        value: row.read(settings),
        onChange: (next) => {
          track(row.event.category, 'Toggled', next ? row.event.on : row.event.off);
          onChange(row.write(settings, next));
        },
      };
    case 'choice':
      return {
        ...base,
        kind: 'choice',
        options: row.options,
        value: row.read(settings),
        onChange: (next) => {
          track(row.event.category, 'Changed', choiceTelemetryType(row.event.changed, next));
          onChange(row.write(settings, next));
        },
      };
    case 'slider':
      return {
        ...base,
        kind: 'slider',
        min: row.min,
        max: row.max,
        step: row.step,
        format: row.format,
        value: row.read(settings),
        ...(row.preview ? { preview: row.preview } : {}),
        onCommit: (next) => {
          track(row.event.category, 'Changed', row.event.changed);
          onChange(row.write(settings, next));
        },
      };
    case 'toggleGroup':
      return {
        ...base,
        kind: 'toggleGroup',
        toggles: row.toggles.map((toggle) => ({
          key: toggle.key,
          label: toggle.label,
          value: toggle.read(settings),
          onChange: (next: boolean) => {
            track(toggle.event.category, 'Toggled', next ? toggle.event.on : toggle.event.off);
            onChange(toggle.write(settings, next));
          },
        })),
      };
    case 'link':
      return { ...base, kind: 'link', target: row.target, cta: row.cta };
    case 'note':
      return { ...base, kind: 'note', note: row.note, ...(row.signIn ? { signIn: true } : {}) };
  }
}
