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

// Where a row's value lives in the app's scope: a key, or one field of an object kept under a key
// (a presenter's settings, say, kept as one object). Writing a field keeps the object's other fields.
export interface CatalogueBinding {
  key: string;
  field?: string;
}

interface RowCommon {
  // The app's own row key: unique within its category.
  id: string;
  label: string;
  description: string;
  // The sub-heading the row sits under in the app's pane.
  section?: string;
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
  // "Editor", or "Editor › Draw" for a sub-category, as the app's Settings path names it.
  label: string;
  rows: CatalogueRow[];
}

export interface AppCatalogue {
  categories: CatalogueCategory[];
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
  read(prefs: Prefs): unknown;
  write(prefs: Prefs, next: boolean): Prefs;
}

export interface SourceRow {
  kind: string;
  key: string;
  label: string;
  description: string;
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
}

export interface SourceCategory {
  id: string;
  label: string;
  parent?: string;
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

function deriveRow(row: SourceRow, category: SourceCategory): CatalogueRow | null {
  const offered = availability(row);
  if (offered === 'never') return null;
  const common: RowCommon = {
    id: row.key,
    label: row.label,
    description: row.description,
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
    return toggle && appScoped(toggle) ? { kind: 'toggle', ...common, ...toggle } : null;
  }
  if (row.kind === 'choice') {
    const choice = deriveChoice(row);
    return choice && appScoped(choice) ? { kind: 'choice', ...common, ...choice } : null;
  }
  if (row.kind === 'slider') {
    const slider = deriveSlider(row);
    return slider && appScoped(slider) ? { kind: 'slider', ...common, ...slider } : null;
  }
  if (row.kind === 'toggleGroup' && row.toggles) {
    const toggles = row.toggles.flatMap((toggle) => {
      const bound = probeToggle(toggle.read.bind(toggle), toggle.write.bind(toggle) as Write);
      return bound && appScoped(bound) ? [{ id: toggle.key, label: toggle.label, ...bound }] : [];
    });
    return toggles.length > 0 ? { kind: 'toggleGroup', ...common, toggles } : null;
  }
  // Appearance, tokens, shortcuts, the trash, notes, links and the rest: the app's own.
  return null;
}

// An app's catalogue as the site shows it: its categories in order, each with the rows the site can
// show, and none left empty.
export function deriveCatalogue(categories: readonly SourceCategory[]): AppCatalogue {
  const labelOf = new Map(categories.map((category) => [category.id, category.label]));
  return {
    categories: categories.flatMap((category) => {
      const rows = category.rows.flatMap((row) => deriveRow(row, category) ?? []);
      if (rows.length === 0) return [];
      const parent = category.parent ? labelOf.get(category.parent) : undefined;
      return [
        {
          id: category.id,
          label: parent ? `${parent} › ${category.label}` : category.label,
          rows,
        },
      ];
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
