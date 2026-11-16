// A new roadmap's settings and the dialog's rules (docs/specs/026-plan/public-roadmap.md "The settings"). Pure.
import {
  ROADMAP_DEFAULT_FIELDS,
  ROADMAP_TITLE_MAX,
  type RoadmapBoard,
  type RoadmapForm,
  type RoadmapSettings,
} from '@liveplanner/api-schema';

// Column names that read like triage: unticked to begin with, so a suggestion stays hidden until the team moves it.
const TRIAGE_NAMES = new Set([
  'under review',
  'inbox',
  'backlog',
  'triage',
  'ideas',
  'to review',
  'new',
  'suggestions',
]);

export const readsLikeTriage = (name: string) => TRIAGE_NAMES.has(name.trim().toLowerCase());

/** A new roadmap of the board: its title, every column but the triage ones, every type, Description, voting on. */
export function defaultRoadmapSettings(board: RoadmapBoard): RoadmapSettings {
  const shown = board.columns.filter((c) => !readsLikeTriage(c.name)).map((c) => c.status);
  return {
    title: (board.title.trim() || board.tabName.trim() || 'Roadmap').slice(0, ROADMAP_TITLE_MAX),
    // At least one column: a board of triage columns alone shows them all.
    columns: shown.length > 0 ? shown : board.columns.map((c) => c.status),
    types: board.types.map((t) => t.id),
    fields: [...ROADMAP_DEFAULT_FIELDS],
    voting: true,
    formCode: null,
  };
}

/** Whether a form may take suggestions for these columns: none of its cards would land in a shown one. */
export const formFits = (form: RoadmapForm, columns: readonly string[]) =>
  form.statuses.every((s) => !columns.includes(s));

/** Whether the settings may be saved: a title, a column and a card type. */
export const settingsReady = (s: RoadmapSettings) =>
  s.title.trim().length > 0 && s.columns.length > 0 && s.types.length > 0;

/** The settings with one list entry flipped, kept in the board's order. */
export function toggled(list: readonly string[], id: string, order: readonly string[]): string[] {
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  return order.filter((x) => next.includes(x));
}

/** The settings with a column flipped: a suggestion form whose cards would now show is let go. */
export function withColumnToggled(
  s: RoadmapSettings,
  status: string,
  board: RoadmapBoard,
  forms: readonly RoadmapForm[],
): RoadmapSettings {
  const columns = toggled(
    s.columns,
    status,
    board.columns.map((c) => c.status),
  );
  const form = forms.find((f) => f.code === s.formCode);
  return { ...s, columns, formCode: form && formFits(form, columns) ? s.formCode : null };
}
