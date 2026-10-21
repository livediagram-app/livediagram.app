// Naming a form's parts as the builder names them (docs/specs/030-forms/forms.md "Agents", blueprint §15 "Names and
// refusals"): a Form tab by id or name, a question by id or prompt, a section by id, title or place, a board by its
// tab's name or its title, a column by name, a sheet by its name in Responses Go To. An unknown name is refused with
// the names there are.
import {
  promptOf,
  questionsOf,
  type FormDefinition,
  type FormQuestion,
  type FormSection,
} from '@liveplanner/forms';
import type { BoardRef, SheetRef, TabRef } from './form-world';

export type FormRefusal = { ok: false; code: string; message: string };
export type Named<T> = ({ ok: true } & T) | FormRefusal;

export const refuse = (code: string, message: string): FormRefusal => ({
  ok: false,
  code,
  message,
});

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const quoted = (names: readonly string[]) =>
  names.length ? names.map((n) => `"${n}"`).join(', ') : 'none';

// The Form tab named (by id or name), else the document's first.
export function resolveFormTab(
  tabs: readonly TabRef[],
  ref: string | undefined,
): Named<{ tab: TabRef }> {
  const forms = tabs.filter((t) => t.kind === 'form');
  const tab = ref
    ? (tabs.find((t) => t.id === ref) ?? tabs.find((t) => same(t.name, ref)))
    : forms[0];
  if (!tab) {
    if (!forms.length)
      return refuse('form_tab_none', 'That document has no Form tab. Make one with add_form.');
    return refuse(
      'form_tab_unknown',
      `No tab "${ref}". Form tabs: ${quoted(forms.map((t) => `${t.name} (${t.id})`))}.`,
    );
  }
  if (tab.kind !== 'form')
    return refuse(
      'not_a_form_tab',
      `"${tab.name}" is no Form tab. Form tabs: ${quoted(forms.map((t) => t.name))}.`,
    );
  return { ok: true, tab };
}

// A question by id, else by its prompt (case and spaces aside); two prompts alike are ambiguous.
export function resolveQuestion(
  form: FormDefinition,
  ref: string,
): Named<{ question: FormQuestion }> {
  const all = questionsOf(form);
  const byId = all.find((q) => q.id === ref);
  if (byId) return { ok: true, question: byId };
  const matches = all.filter((q) => same(promptOf(q), ref));
  if (matches.length === 1) return { ok: true, question: matches[0]! };
  if (matches.length > 1)
    return refuse(
      'question_ambiguous',
      `${matches.length} questions read "${ref}": name it by id (${matches.map((q) => q.id).join(', ')}).`,
    );
  return refuse(
    'question_unknown',
    `No question "${ref}". Questions: ${quoted(all.map((q) => `${promptOf(q)} (${q.id})`))}.`,
  );
}

// A section by id, title, or place (1 the first).
export function resolveSection(
  form: FormDefinition,
  ref: string | number,
): Named<{ section: FormSection; index: number }> {
  const text = String(ref).trim();
  let index = form.sections.findIndex((s) => s.id === text);
  if (index < 0) index = form.sections.findIndex((s) => s.title && same(s.title, text));
  if (index < 0 && /^\d+$/.test(text)) index = Number(text) - 1;
  const section = form.sections[index];
  if (section) return { ok: true, section, index };
  return refuse(
    'section_unknown',
    `No section "${text}". Sections: ${quoted(
      form.sections.map((s, i) => `${i + 1}${s.title ? ` ${s.title}` : ''} (${s.id})`),
    )}.`,
  );
}

// A Board tab's board by the tab's name or the board's title (or ids).
export function resolveBoard(boards: readonly BoardRef[], ref: string): Named<{ board: BoardRef }> {
  const board =
    boards.find((b) => b.tabId === ref || b.elementId === ref) ??
    boards.find((b) => same(b.tabName, ref)) ??
    boards.find((b) => !!b.title && same(b.title, ref));
  if (board) return { ok: true, board };
  return refuse(
    'board_unknown',
    `No Board tab "${ref}" (responses go to a Board tab’s board). Board tabs: ${quoted(
      boards.map((b) => b.tabName),
    )}; or {"to": "board"} alone for a new one.`,
  );
}

export function resolveColumn(
  board: BoardRef,
  ref: string,
): Named<{ column: BoardRef['columns'][number] }> {
  const column =
    board.columns.find((c) => same(c.name, ref)) ?? board.columns.find((c) => c.status === ref);
  if (column) return { ok: true, column };
  return refuse(
    'column_unknown',
    `No column "${ref}" on that board. Columns: ${quoted(board.columns.map((c) => c.name))}.`,
  );
}

// A sheet by its Responses Go To name ("Budget", "Budget 2"), or its id.
export function resolveSheet(sheets: readonly SheetRef[], ref: string): Named<{ sheet: SheetRef }> {
  const sheet = sheets.find((s) => s.sheetId === ref) ?? sheets.find((s) => same(s.name, ref));
  if (sheet) return { ok: true, sheet };
  return refuse(
    'sheet_unknown',
    `No sheet "${ref}". Sheets: ${quoted(sheets.map((s) => s.name))}; or {"to": "sheet"} alone for a new one.`,
  );
}
