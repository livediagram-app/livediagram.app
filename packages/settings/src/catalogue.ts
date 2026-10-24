// Each app's own settings as plain data (liveworkspace/docs/accounts.md "Settings"), for
// liveworkspace.app to show and change outside the app: the settings in the app's scope that are one
// stored value each, worded, grouped and ordered as the app's own Settings shows them.
//
// The apps' Settings catalogues (each editor's settings-catalogue.ts) say how a row reads and writes
// itself as code over the editor's preferences, which the site can't load without the editor. So
// `deriveCatalogue` runs each row's read and write against probe values and keeps what they show:
// which stored key (or which field of a stored object) the row holds, and the stored value for each
// of its states. A row it can't pin down that way, or one that isn't a preference at all (appearance,
// tokens, shortcuts, the trash and the rest), is left to the app's own Settings. Each app keeps its
// result in ./catalogues/<app>.ts, and a test beside its catalogue fails when the two drift.
//
// Pure data and helpers, with no editor code: the site loads one app's catalogue when its dialog opens.
import { isAllSetting, type SettingsBlob } from './index';

export type StoredValue = string | number | boolean | null;

// What the app's own Settings reports when the row changes (each editor's settings-catalogue.ts `event`): a switch's
// `<Category>·Toggled·<on|off>`, a choice's `<Category>·Changed·<changed><Option>`, a slider's
// `<Category>·Changed·<changed>`. liveworkspace.app reports the same when the row is changed there, so each app's
// dashboard counts a change once, wherever it was made.
export interface SettingEvent {
  category: string;
  on?: string;
  off?: string;
  changed?: string;
}

// Where a row's value lives in the app's scope: a key, or one field of an object kept under a key
// (a presenter's settings, say, kept as one object). Writing a field keeps the object's other fields.
export interface CatalogueBinding {
  key: string;
  field?: string;
  event?: SettingEvent;
}

// A row carries the same text the app's own Settings row does, so liveworkspace.app draws it with the
// same view (@liveworkspace/settings-ui). Its id is the app's row key (`key` here is where its value
// is stored).
interface RowCommon {
  // The app's own row key: unique within its category.
  id: string;
  label: string;
  description: string;
  // Space-separated search synonyms the Settings search matches, as in the app.
  keywords?: string;
  // The sub-heading the row sits under in the app's pane.
  section?: string;
  // The row (by id) it is drawn nested under, when that row is shown here too.
  parent?: string;
  // Shown only while another switch is on (the app nests it beneath that switch). The switch's
  // binding may be a shared key, so it is read from both scopes together.
  when?: ToggleBinding;
  // Offered only with Power User Mode on (a shared key), as in the app.
  powerUser?: true;
}

export interface ToggleBinding extends CatalogueBinding {
  on: StoredValue;
  off: StoredValue;
  // What the switch shows when nothing (or something else) is stored.
  fallback: boolean;
}

export interface CatalogueToggle extends RowCommon, ToggleBinding {
  kind: 'toggle';
}

export interface CatalogueChoice extends RowCommon, CatalogueBinding {
  kind: 'choice';
  options: { id: string; label: string; value: StoredValue }[];
  fallback: string;
}

export interface CatalogueSlider extends RowCommon, CatalogueBinding {
  kind: 'slider';
  min: number;
  max: number;
  step: number;
  // The app's own label for each step from min to max, as its slider shows it.
  labels: string[];
  fallback: number;
}

// Several switches under one heading and description (the apps' guided tours).
export interface CatalogueToggleGroup extends RowCommon {
  kind: 'toggleGroup';
  toggles: (ToggleBinding & { id: string; label: string })[];
}

export type CatalogueRow =
  CatalogueToggle | CatalogueChoice | CatalogueSlider | CatalogueToggleGroup;

export interface CatalogueCategory {
  id: string;
  label: string;
  // The category it sits under ("Draw" under "Editor"), when that one is shown here too. A
  // sub-category whose parent isn't shown takes the path as its label ("Editor › Draw") instead.
  parent?: string;
  // The top-level category's tile in the app's Settings list (@liveworkspace/settings-ui's tiles), or
  // for a sub-category named by its path, its parent's.
  tile?: string;
  // A section's note under its sub-heading, and the sections drawn collapsed, as in the app.
  sectionNotes?: Record<string, string>;
  collapsedSections?: string[];
  rows: CatalogueRow[];
}

// A switch the app's Settings keeps in the `all` scope every app shares (a notification email, say), with what the
// app reports when it flips: the settings page on liveworkspace.app reports a flip in the name of the app it was
// opened for.
export interface SharedToggle extends ToggleBinding {
  event: SettingEvent;
}

export interface AppCatalogue {
  categories: CatalogueCategory[];
  shared: SharedToggle[];
}

// --- Reading and writing a row against the stored scopes ---

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredValue(value: unknown): value is StoredValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

export function readStored(blob: SettingsBlob, binding: CatalogueBinding): unknown {
  const value = blob[binding.key];
  if (binding.field === undefined) return value;
  return isPlainObject(value) ? value[binding.field] : undefined;
}

// The patch that stores `value` for a row: its key whole, or for a field, the key's object with that
// field changed and the rest kept (a stored key is replaced whole, never merged).
export function storedPatch(
  blob: SettingsBlob,
  binding: CatalogueBinding,
  value: StoredValue,
): SettingsBlob {
  if (binding.field === undefined) return { [binding.key]: value };
  const current = blob[binding.key];
  return { [binding.key]: { ...(isPlainObject(current) ? current : {}), [binding.field]: value } };
}

export function readToggleValue(blob: SettingsBlob, toggle: ToggleBinding): boolean {
  const value = readStored(blob, toggle);
  if (value === toggle.on) return true;
  if (value === toggle.off) return false;
  return toggle.fallback;
}

export function readChoiceValue(blob: SettingsBlob, row: CatalogueChoice): string {
  const value = readStored(blob, row);
  return row.options.find((option) => option.value === value)?.id ?? row.fallback;
}

export function readSliderValue(blob: SettingsBlob, row: CatalogueSlider): number {
  const value = readStored(blob, row);
  if (typeof value !== 'number' || !Number.isFinite(value)) return row.fallback;
  return Math.min(row.max, Math.max(row.min, value));
}

// --- Deriving a catalogue from an app's own ---

type Prefs = Record<string, unknown>;

// The shape every app's settings catalogue shares, as far as this needs it. Methods, so an app's
// rows (typed over its own preferences) fit.
export interface SourceToggle {
  key: string;
  label: string;
  event?: SettingEvent;
  read(prefs: Prefs): unknown;
  write(prefs: Prefs, next: boolean): Prefs;
}

export interface SourceRow {
  kind: string;
  key: string;
  label: string;
  description: string;
  keywords?: string;
  section?: string;
  parent?: string;
  available?(ctx: SourceContext): boolean;
  read?(prefs: Prefs): unknown;
  write?(prefs: Prefs, next: never): Prefs;
  options?: readonly { id: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  format?(value: number): string;
  toggles?: readonly SourceToggle[];
  event?: SettingEvent;
}

export interface SourceCategory {
  id: string;
  label: string;
  parent?: string;
  sectionNotes?: Readonly<Record<string, { note: string }>>;
  collapsedSections?: readonly string[];
  rows: readonly SourceRow[];
}

// What a row may ask of the place it's shown. liveworkspace.app shows a signed-in person's settings,
// on a deployment that sends email, outside any workbench.
export interface SourceContext {
  emailEnabled: boolean;
  signedIn: boolean;
  authEnabled?: boolean;
  powerUserMode?: boolean;
  workbench?: boolean;
}

const SITE_CONTEXT: SourceContext = {
  emailEnabled: true,
  signedIn: true,
  authEnabled: true,
  powerUserMode: false,
  workbench: false,
};

// A slider with more steps than this is left to the app (no app has one).
const MAX_SLIDER_STEPS = 400;

type Write = (prefs: Prefs, next: unknown) => Prefs;

function attempt<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

// Where a set of writes made from nothing lands, and the stored value each one put there: one key
// they all write, holding a stored value; or one object they all write, with exactly one field
// that differs between them. Null for anything else.
function locate(written: Prefs[]): { binding: CatalogueBinding; values: StoredValue[] } | null {
  const keys = new Set(written.flatMap((prefs) => Object.keys(prefs)));
  if (keys.size !== 1) return null;
  const [key] = [...keys] as [string];
  const values = written.map((prefs) => prefs[key]);
  if (values.every(isStoredValue)) return { binding: { key }, values };
  if (!values.every(isPlainObject)) return null;
  const objects = values as Record<string, unknown>[];
  const fields = new Set(objects.flatMap((object) => Object.keys(object)));
  const differing = [...fields].filter((field) =>
    objects.some((object) => object[field] !== objects[0]![field]),
  );
  if (differing.length !== 1) return null;
  const [field] = differing as [string];
  const fieldValues = objects.map((object) => object[field]);
  if (!fieldValues.every(isStoredValue)) return null;
  return { binding: { key, field }, values: fieldValues };
}

function probeToggle(read: (p: Prefs) => unknown, write: Write): ToggleBinding | null {
  const written = attempt(() => [write({}, true), write({}, false)]);
  if (!written) return null;
  const located = locate(written);
  if (!located) return null;
  const [on, off] = located.values as [StoredValue, StoredValue];
  const { binding } = located;
  const toggle: ToggleBinding = { ...binding, on, off, fallback: attempt(() => read({})) === true };
  // The row must read back what it wrote, from that value alone.
  if (attempt(() => read(storedPatch({}, binding, on))) !== true) return null;
  if (attempt(() => read(storedPatch({}, binding, off))) !== false) return null;
  return toggle;
}

function deriveToggle(row: SourceRow): ToggleBinding | null {
  if (!row.read || !row.write) return null;
  return probeToggle(row.read.bind(row), row.write.bind(row) as Write);
}

function deriveChoice(row: SourceRow): Omit<CatalogueChoice, keyof RowCommon | 'kind'> | null {
  const { read, write, options } = row;
  if (!read || !write || !options || options.length < 2) return null;
  const written = attempt(() => options.map((option) => (write as Write)({}, option.id)));
  if (!written) return null;
  const located = locate(written);
  if (!located) return null;
  const { binding, values } = located;
  for (const [index, option] of options.entries()) {
    if (attempt(() => read(storedPatch({}, binding, values[index]!))) !== option.id) return null;
  }
  const fallback = attempt(() => read({}));
  if (typeof fallback !== 'string') return null;
  return {
    ...binding,
    options: options.map((option, index) => ({
      id: option.id,
      label: option.label,
      value: values[index]!,
    })),
    fallback,
  };
}

function deriveSlider(row: SourceRow): Omit<CatalogueSlider, keyof RowCommon | 'kind'> | null {
  const { read, write, min, max, step, format } = row;
  if (!read || !write || !format || min === undefined || max === undefined || !step) return null;
  const count = Math.round((max - min) / step) + 1;
  if (count < 2 || count > MAX_SLIDER_STEPS) return null;
  const at = (index: number) => Math.round((min + index * step) * 1e6) / 1e6;
  const probes = [at(0), at(count - 1), at(Math.floor(count / 2))];
  const written = attempt(() => probes.map((value) => (write as Write)({}, value)));
  if (!written) return null;
  const located = locate(written);
  // The stored value is the slider's own value, and reads back as it.
  if (!located || located.values.some((value, index) => value !== probes[index])) return null;
  const { binding } = located;
  if (probes.some((value) => attempt(() => read(storedPatch({}, binding, value))) !== value)) {
    return null;
  }
  const fallback = attempt(() => read({}));
  if (typeof fallback !== 'number') return null;
  const labels = attempt(() => Array.from({ length: count }, (_, index) => format(at(index))));
  if (!labels) return null;
  return { ...binding, min, max, step, labels, fallback };
}

// Whether the row is offered on the site: always, only with Power User Mode on, or never.
function availability(row: SourceRow): 'always' | 'powerUser' | 'never' {
  if (!row.available) return 'always';
  if (attempt(() => row.available!(SITE_CONTEXT)) === true) return 'always';
  if (attempt(() => row.available!({ ...SITE_CONTEXT, powerUserMode: true })) === true) {
    return 'powerUser';
  }
  return 'never';
}

const appScoped = (binding: CatalogueBinding) => !isAllSetting(binding.key);

// The row's event, as plain data.
const withEvent = (event: SettingEvent | undefined) => (event ? { event: { ...event } } : {});

function deriveRow(row: SourceRow, category: SourceCategory): CatalogueRow | null {
  const offered = availability(row);
  if (offered === 'never') return null;
  const common: RowCommon = {
    id: row.key,
    label: row.label,
    description: row.description,
    ...(row.keywords ? { keywords: row.keywords } : {}),
    ...(row.section ? { section: row.section } : {}),
    ...(offered === 'powerUser' ? { powerUser: true as const } : {}),
  };
  if (row.parent) {
    const parent = category.rows.find((r) => r.key === row.parent);
    const when = parent?.kind === 'toggle' ? deriveToggle(parent) : null;
    if (when) common.when = when;
  }
  if (row.kind === 'toggle') {
    const toggle = deriveToggle(row);
    return toggle && appScoped(toggle)
      ? { kind: 'toggle', ...common, ...toggle, ...withEvent(row.event) }
      : null;
  }
  if (row.kind === 'choice') {
    const choice = deriveChoice(row);
    return choice && appScoped(choice)
      ? { kind: 'choice', ...common, ...choice, ...withEvent(row.event) }
      : null;
  }
  if (row.kind === 'slider') {
    const slider = deriveSlider(row);
    return slider && appScoped(slider)
      ? { kind: 'slider', ...common, ...slider, ...withEvent(row.event) }
      : null;
  }
  if (row.kind === 'toggleGroup' && row.toggles) {
    const toggles = row.toggles.flatMap((toggle) => {
      const bound = probeToggle(toggle.read.bind(toggle), toggle.write.bind(toggle) as Write);
      return bound && appScoped(bound)
        ? [{ id: toggle.key, label: toggle.label, ...bound, ...withEvent(toggle.event) }]
        : [];
    });
    return toggles.length > 0 ? { kind: 'toggleGroup', ...common, toggles } : null;
  }
  // Appearance, tokens, shortcuts, the trash, notes, links and the rest: the app's own.
  return null;
}

// The app's switches over one whole `all` key, with their events, for the settings page. The first row for a key
// wins (an app shows each shared switch once).
function deriveShared(categories: readonly SourceCategory[]): SharedToggle[] {
  const shared = new Map<string, SharedToggle>();
  for (const row of categories.flatMap((category) => category.rows)) {
    if (row.kind !== 'toggle' || !row.event) continue;
    const toggle = deriveToggle(row);
    if (!toggle || appScoped(toggle) || toggle.field !== undefined || shared.has(toggle.key))
      continue;
    shared.set(toggle.key, { ...toggle, event: { ...row.event } });
  }
  return [...shared.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// A category's rows the site can show; a row nested under one that isn't shown here sits at the top
// level instead.
function deriveRows(category: SourceCategory): CatalogueRow[] {
  const rows = category.rows.flatMap((row) => deriveRow(row, category) ?? []);
  const shown = new Set(rows.map((row) => row.id));
  return rows.map((row) => {
    const parent = category.rows.find((r) => r.key === row.id)?.parent;
    return parent && shown.has(parent) ? { ...row, parent } : row;
  });
}

// An app's catalogue as the site shows it: its categories in order, each with the rows the site can
// show, and none left empty; and its shared switches' events. `tiles` names each top-level
// category's tile, as the app's own Settings list draws it.
export function deriveCatalogue(
  categories: readonly SourceCategory[],
  { tiles = {} }: { tiles?: Readonly<Record<string, string>> } = {},
): AppCatalogue {
  const derived = categories.flatMap((category) => {
    const rows = deriveRows(category);
    return rows.length > 0 ? [{ category, rows }] : [];
  });
  const shown = new Set(derived.map(({ category }) => category.id));
  const labelOf = new Map(categories.map((category) => [category.id, category.label]));
  return {
    shared: deriveShared(categories),
    categories: derived.map(({ category, rows }): CatalogueCategory => {
      const parent = category.parent;
      const nested = parent !== undefined && shown.has(parent);
      const sections = new Set(rows.flatMap((row) => (row.section ? [row.section] : [])));
      const notes = Object.entries(category.sectionNotes ?? {}).filter(([s]) => sections.has(s));
      const collapsed = (category.collapsedSections ?? []).filter((s) => sections.has(s));
      // A top-level category's own tile; a sub-category drawn at the top level takes its parent's.
      const tile = parent === undefined ? tiles[category.id] : nested ? undefined : tiles[parent];
      return {
        id: category.id,
        label:
          parent !== undefined && !nested
            ? `${labelOf.get(parent) ?? parent} › ${category.label}`
            : category.label,
        ...(nested ? { parent } : {}),
        ...(tile ? { tile } : {}),
        ...(notes.length > 0
          ? { sectionNotes: Object.fromEntries(notes.map(([s, n]) => [s, n.note])) }
          : {}),
        ...(collapsed.length > 0 ? { collapsedSections: collapsed } : {}),
        rows,
      };
    }),
  };
}

// The source of a catalogue file, as written by the apps' catalogue tests.
export function catalogueSource(app: string, catalogue: AppCatalogue): string {
  return `// ${app}'s own settings as liveworkspace.app shows them: generated from its Settings catalogue by
// deriveCatalogue (../catalogue.ts). Don't edit by hand: run its settings-site-catalogue test with
// UPDATE_SITE_CATALOGUE=1.
import type { AppCatalogue } from '../catalogue';

export const CATALOGUE: AppCatalogue = ${JSON.stringify(catalogue, null, 2)};
`;
}

// --- What a change reports ---

export interface SettingTelemetryEvent {
  category: string;
  action: 'Toggled' | 'Changed';
  type: string;
}

// A choice's type: the setting's name and the option's id, capitalised (every editor's choiceTelemetryType).
export function choiceTelemetryType(changed: string, optionId: string): string {
  return `${changed}${optionId.charAt(0).toUpperCase()}${optionId.slice(1)}`;
}

function isChoice(binding: CatalogueBinding): binding is CatalogueChoice {
  return Array.isArray((binding as Partial<CatalogueChoice>).options);
}

/** What the app's own Settings would report for storing `stored` through a row (or one switch of a group), or
 *  null when the row carries no event. */
export function settingChangeEvent(
  binding: CatalogueBinding,
  stored: StoredValue,
): SettingTelemetryEvent | null {
  const event = binding.event;
  if (!event) return null;
  if (isChoice(binding)) {
    const option = binding.options.find((o) => o.value === stored);
    return option && event.changed
      ? {
          category: event.category,
          action: 'Changed',
          type: choiceTelemetryType(event.changed, option.id),
        }
      : null;
  }
  if (event.on !== undefined && event.off !== undefined) {
    const on = (binding as Partial<ToggleBinding>).on;
    return {
      category: event.category,
      action: 'Toggled',
      type: stored === on ? event.on : event.off,
    };
  }
  return event.changed
    ? { category: event.category, action: 'Changed', type: event.changed }
    : null;
}

/** What flipping a shared switch on the settings page reports for this app, or null when the app has no such
 *  switch. */
export function sharedToggleEvent(
  catalogue: AppCatalogue,
  key: string,
  next: boolean,
): SettingTelemetryEvent | null {
  const toggle = catalogue.shared.find((t) => t.key === key);
  if (!toggle?.event.on || !toggle.event.off) return null;
  return {
    category: toggle.event.category,
    action: 'Toggled',
    type: next ? toggle.event.on : toggle.event.off,
  };
}

/** The events its shared switches report (the `all` scope every app shares): what liveworkspace.app may send in its
 *  own name for a switch flipped on its settings page opened for no app. */
export function sharedCatalogueEvents(catalogue: AppCatalogue): SettingTelemetryEvent[] {
  return catalogue.shared.flatMap((shared) =>
    shared.event.on && shared.event.off
      ? [
          { category: shared.event.category, action: 'Toggled', type: shared.event.on },
          { category: shared.event.category, action: 'Toggled', type: shared.event.off },
        ]
      : [],
  );
}

/** Every event a change made through this catalogue can report: the closed list liveworkspace.app may send in the
 *  app's name. */
export function catalogueEvents(catalogue: AppCatalogue): SettingTelemetryEvent[] {
  const out: SettingTelemetryEvent[] = [];
  const toggle = (event: SettingEvent | undefined) => {
    if (event?.on && event.off) {
      out.push({ category: event.category, action: 'Toggled', type: event.on });
      out.push({ category: event.category, action: 'Toggled', type: event.off });
    }
  };
  for (const row of catalogue.categories.flatMap((category) => category.rows)) {
    if (row.kind === 'toggle') toggle(row.event);
    else if (row.kind === 'toggleGroup') for (const t of row.toggles) toggle(t.event);
    else if (row.kind === 'choice' && row.event?.changed) {
      for (const option of row.options) {
        out.push({
          category: row.event.category,
          action: 'Changed',
          type: choiceTelemetryType(row.event.changed, option.id),
        });
      }
    } else if (row.kind === 'slider' && row.event?.changed) {
      out.push({ category: row.event.category, action: 'Changed', type: row.event.changed });
    }
  }
  for (const shared of catalogue.shared) toggle(shared.event);
  return out;
}
