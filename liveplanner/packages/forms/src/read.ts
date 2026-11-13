// readForm (docs/specs/030-forms/blueprints/forms.md §2): a stored or received form, made safe. It never throws and
// never refuses a form for one bad part: the part is dropped or capped, so a form from an older or newer editor, an
// agent or a hand-edited file still opens.
import { CUSTOM_FIELD_ID_PATTERN, ITEM_TYPE_PATTERN } from '@liveplanner/items';
import { parseColourBackground } from '@liveworkspace/page-background';
import { AXIS_ID_PATTERN, SHEET_ID_PATTERN } from '@liveplanner/sheets';
import {
  FORM_DESCRIPTION_MAX,
  FORM_HEADING_MAX,
  FIXED_DAYS_MAX,
  FIXED_FIELDS_MAX,
  FIXED_TEXT_MAX,
  FORM_RESPONSE_LIMIT_MAX,
  HELP_MAX,
  MESSAGE_MAX,
  OPTIONS_MAX,
  OPTION_MAX,
  PLACEHOLDER_MAX,
  PROMPT_MAX,
  QUESTIONS_MAX,
  RATING_SCALE_DEFAULT,
  RATING_SCALE_MAX,
  RATING_SCALE_MIN,
  SCALE_LABEL_MAX,
  SECTIONS_MAX,
  SECTION_TITLE_MAX,
  SHEET_COLUMNS_MAX,
  SHEET_FIXED_MAX,
  TYPE_RULES_MAX,
  UNTITLED_FORM,
} from './limits';
import { isBuiltInFixedId } from './fixed';
import {
  FORM_VERSION,
  STARTER_IDS,
  isQuestionType,
  type AnswerTarget,
  type CardTypeRule,
  type FormCover,
  type FormDefinition,
  type FormDestination,
  type FormQuestion,
  type FormSection,
  type FixedValue,
  type SheetFixedColumn,
  type StarterId,
  type SubmittedDay,
} from './model';

const FORM_ID_PATTERN = /^[a-z0-9-]{1,24}$/;

// A sheet form's remembered columns (forms.md "Linked by column, not by heading"): `#`, `at` or a question id, each to
// a column id; anything else dropped, at most SHEET_COLUMNS_MAX kept, absent when none is left.
function readSheetColumns(raw: unknown): Record<string, string> | undefined {
  if (!isObj(raw)) return undefined;
  const out: Record<string, string> = {};
  let n = 0;
  for (const [key, col] of Object.entries(raw)) {
    if (n >= SHEET_COLUMNS_MAX) break;
    if (key !== '#' && key !== 'at' && !FORM_ID_PATTERN.test(key)) continue;
    if (typeof col !== 'string' || !AXIS_ID_PATTERN.test(col)) continue;
    out[key] = col;
    n += 1;
  }
  return n ? out : undefined;
}
const STATUS_ID = /^[^\s].{0,63}$/s;
const TAB_ID = /^[A-Za-z0-9_-]{1,64}$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

// A string trimmed and capped; undefined when empty or not a string.
function text(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function readTarget(v: unknown): AnswerTarget | undefined {
  if (!isObj(v)) return undefined;
  if (v['to'] === 'title') return { to: 'title' };
  if (v['to'] === 'field' && typeof v['fieldId'] === 'string') {
    const fieldId = v['fieldId'];
    if (CUSTOM_FIELD_ID_PATTERN.test(fieldId)) return { to: 'field', fieldId };
  }
  // Description is the default, so it is never stored.
  return undefined;
}

// Options trimmed, capped, empty and repeated (ignoring case) ones dropped, at most OPTIONS_MAX.
export function readOptions(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of v) {
    const t = text(o, OPTION_MAX);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length === OPTIONS_MAX) break;
  }
  return out;
}

function readQuestion(v: unknown): FormQuestion | null {
  if (!isObj(v)) return null;
  const { id, type } = v;
  if (typeof id !== 'string' || !FORM_ID_PATTERN.test(id) || !isQuestionType(type)) return null;
  const q: FormQuestion = { id, type, prompt: text(v['prompt'], PROMPT_MAX) ?? '' };
  const help = text(v['help'], HELP_MAX);
  if (help) q.help = help;
  if (v['required'] === true) q.required = true;
  if (
    type === 'short' ||
    type === 'paragraph' ||
    type === 'number' ||
    type === 'email' ||
    type === 'phone' ||
    type === 'link'
  ) {
    const placeholder = text(v['placeholder'], PLACEHOLDER_MAX);
    if (placeholder) q.placeholder = placeholder;
  }
  if (type === 'single' || type === 'multi') {
    q.options = readOptions(v['options']);
    if (v['other'] === true) q.other = true;
  }
  if (type === 'single' && v['dropdown'] === true) q.dropdown = true;
  if (type === 'number' || type === 'multi') {
    let min = finite(v['min']) ? v['min'] : undefined;
    let max = finite(v['max']) ? v['max'] : undefined;
    if (type === 'multi') {
      // Picks are whole and within the options.
      const n = q.options!.length + (q.other ? 1 : 0);
      min = min !== undefined && Number.isInteger(min) && min >= 1 && min <= n ? min : undefined;
      max = max !== undefined && Number.isInteger(max) && max >= 1 && max <= n ? max : undefined;
    }
    if (min !== undefined && max !== undefined && min > max) max = undefined;
    if (min !== undefined) q.min = min;
    if (max !== undefined) q.max = max;
  }
  if (type === 'number' && v['whole'] === true) q.whole = true;
  if (type === 'daterange' && v['withTime'] === true) q.withTime = true;
  if (type === 'rating') {
    const scale = v['scale'];
    q.scale =
      Number.isInteger(scale) &&
      (scale as number) >= RATING_SCALE_MIN &&
      (scale as number) <= RATING_SCALE_MAX
        ? (scale as number)
        : RATING_SCALE_DEFAULT;
    q.style = v['style'] === 'numbers' ? 'numbers' : 'stars';
    if (q.style === 'numbers') {
      const low = text(v['lowLabel'], SCALE_LABEL_MAX);
      const high = text(v['highLabel'], SCALE_LABEL_MAX);
      if (low) q.lowLabel = low;
      if (high) q.highLabel = high;
    }
  }
  const goesTo = readTarget(v['goesTo']);
  if (goesTo) q.goesTo = goesTo;
  return q;
}

// The cover: a colour background (@liveworkspace/page-background), nothing kept when it is not one.
const readCover = (v: unknown): FormCover | undefined => parseColourBackground(v);

// A time zone as Intl names one ("Europe/London", "UTC", "Etc/GMT+5"); an unknown one reads as UTC when used.
const ZONE = /^[A-Za-z0-9_+\-/]{1,64}$/;

// The submitted day (forms.md "Filled in automatically"): `days` a whole 0..FIXED_DAYS_MAX (absent reads as 0).
function readSubmitted(v: unknown): SubmittedDay | undefined {
  if (!isObj(v)) return undefined;
  const days = v['days'] ?? 0;
  if (!Number.isInteger(days) || (days as number) < 0 || (days as number) > FIXED_DAYS_MAX)
    return undefined;
  const out: SubmittedDay = { days: days as number };
  if (typeof v['tz'] === 'string' && ZONE.test(v['tz'])) out.tz = v['tz'];
  return out;
}

// A set value: the submitted day, or a text, a number or some texts (labels, picks), trimmed and capped.
function readFixedValue(v: unknown, list: boolean): FixedValue | undefined {
  if (!isObj(v)) return undefined;
  if ('submitted' in v) {
    const submitted = readSubmitted(v['submitted']);
    return submitted ? { submitted } : undefined;
  }
  const value = v['value'];
  if (finite(value)) return { value };
  const t = text(value, FIXED_TEXT_MAX);
  if (t) return { value: t };
  if (list && Array.isArray(value)) {
    const picks = readOptions(value);
    return picks.length ? { value: picks } : undefined;
  }
  return undefined;
}

// A board destination's set fields, by field id (a custom field's, or Priority, Labels, Start or Due); at most
// FIXED_FIELDS_MAX, absent when none is left.
function readFixed(v: unknown): Record<string, FixedValue> | undefined {
  if (!isObj(v)) return undefined;
  const out: Record<string, FixedValue> = {};
  let n = 0;
  for (const [id, raw] of Object.entries(v)) {
    if (n >= FIXED_FIELDS_MAX) break;
    if (!isBuiltInFixedId(id) && !CUSTOM_FIELD_ID_PATTERN.test(id)) continue;
    const value = readFixedValue(raw, true);
    if (!value) continue;
    out[id] = value;
    n += 1;
  }
  return n ? out : undefined;
}

// A sheet destination's extra columns: each a distinct id, a header and a text, a number or the submitted day.
function readSheetFixed(v: unknown): SheetFixedColumn[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: SheetFixedColumn[] = [];
  const ids = new Set<string>();
  for (const c of v) {
    if (out.length === SHEET_FIXED_MAX) break;
    if (!isObj(c) || typeof c['id'] !== 'string' || !FORM_ID_PATTERN.test(c['id'])) continue;
    const header = text(c['header'], PROMPT_MAX);
    const value = readFixedValue(c, false);
    if (!header || !value || ids.has(c['id'])) continue;
    ids.add(c['id']);
    out.push({ id: c['id'], header, ...value } as SheetFixedColumn);
  }
  return out.length ? out : undefined;
}

// A rule's fields: a question id to a custom field id, at most one question per field.
function readRuleFields(v: unknown): Record<string, string> | undefined {
  if (!isObj(v)) return undefined;
  const out: Record<string, string> = {};
  const taken = new Set<string>();
  for (const [qid, fid] of Object.entries(v)) {
    if (Object.keys(out).length === QUESTIONS_MAX) break;
    if (!FORM_ID_PATTERN.test(qid) || typeof fid !== 'string') continue;
    if (!CUSTOM_FIELD_ID_PATTERN.test(fid) || taken.has(fid)) continue;
    taken.add(fid);
    out[qid] = fid;
  }
  return Object.keys(out).length ? out : undefined;
}

// A board destination's card type rules (forms.md "Choosing the card type by an answer"): each a distinct id and type
// (never the default's), a question id, its answers and a status; at most TYPE_RULES_MAX, absent when none is left.
function readTypeRules(v: unknown, defaultType: string): CardTypeRule[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: CardTypeRule[] = [];
  const ids = new Set<string>();
  const typesSeen = new Set<string>([defaultType]);
  for (const r of v) {
    if (out.length === TYPE_RULES_MAX) break;
    if (!isObj(r)) continue;
    const { id, questionId, typeId, status } = r;
    if (typeof id !== 'string' || !FORM_ID_PATTERN.test(id) || ids.has(id)) continue;
    if (typeof questionId !== 'string' || !FORM_ID_PATTERN.test(questionId)) continue;
    if (typeof typeId !== 'string' || !ITEM_TYPE_PATTERN.test(typeId) || typesSeen.has(typeId))
      continue;
    if (typeof status !== 'string' || !STATUS_ID.test(status)) continue;
    const anyOf = readOptions(r['anyOf']);
    if (!anyOf.length) continue;
    ids.add(id);
    typesSeen.add(typeId);
    const rule: CardTypeRule = { id, questionId, anyOf, typeId, status };
    const fields = readRuleFields(r['fields']);
    if (fields) rule.fields = fields;
    out.push(rule);
  }
  return out.length ? out : undefined;
}

function readDestination(v: unknown): FormDestination | undefined {
  if (!isObj(v)) return undefined;
  const { tabId, typeId, status } = v;
  if (typeof tabId !== 'string' || !TAB_ID.test(tabId)) return undefined;
  if (typeof typeId !== 'string' || !ITEM_TYPE_PATTERN.test(typeId)) return undefined;
  if (typeof status !== 'string' || !STATUS_ID.test(status)) return undefined;
  const out: FormDestination = { tabId, typeId, status };
  const fixed = readFixed(v['fixed']);
  if (fixed) out.fixed = fixed;
  const typeRules = readTypeRules(v['typeRules'], typeId);
  if (typeRules) out.typeRules = typeRules;
  return out;
}

export function readForm(raw: unknown): FormDefinition | null {
  if (!isObj(raw)) return null;
  const form: FormDefinition = {
    v: FORM_VERSION,
    heading: text(raw['heading'], FORM_HEADING_MAX) ?? UNTITLED_FORM,
    sections: [],
  };
  const description = text(raw['description'], FORM_DESCRIPTION_MAX);
  if (description) form.description = description;
  // An `accent` an earlier build stored is dropped: the form follows its tab theme's colour.
  const cover = readCover(raw['cover']);
  if (cover) form.cover = cover;
  const sectionIds = new Set<string>();
  const questionIds = new Set<string>();
  let questions = 0;
  for (const s of Array.isArray(raw['sections']) ? raw['sections'] : []) {
    if (form.sections.length === SECTIONS_MAX) break;
    if (!isObj(s) || typeof s['id'] !== 'string' || !FORM_ID_PATTERN.test(s['id'])) continue;
    if (sectionIds.has(s['id'])) continue;
    sectionIds.add(s['id']);
    const section: FormSection = {
      id: s['id'],
      title: text(s['title'], SECTION_TITLE_MAX) ?? '',
      questions: [],
    };
    const sd = text(s['description'], FORM_DESCRIPTION_MAX);
    if (sd) section.description = sd;
    const rule = s['showIf'];
    if (form.sections.length > 0 && isObj(rule) && typeof rule['questionId'] === 'string') {
      const anyOf = readOptions(rule['anyOf']);
      if (FORM_ID_PATTERN.test(rule['questionId']) && anyOf.length)
        section.showIf = { questionId: rule['questionId'], anyOf };
    }
    for (const qv of Array.isArray(s['questions']) ? s['questions'] : []) {
      if (questions === QUESTIONS_MAX) break;
      const q = readQuestion(qv);
      if (!q || questionIds.has(q.id)) continue;
      questionIds.add(q.id);
      section.questions.push(q);
      questions += 1;
    }
    form.sections.push(section);
  }
  if (form.sections.length === 0) form.sections.push({ id: 's-1', title: '', questions: [] });
  // One question at most goes to Title: the first keeps it.
  let titled = false;
  for (const q of form.sections.flatMap((s) => s.questions)) {
    if (q.goesTo?.to !== 'title') continue;
    if (titled) delete q.goesTo;
    titled = true;
  }
  const destination = readDestination(raw['destination']);
  if (destination) form.destination = destination;
  const sheet = raw['sheet'];
  if (
    isObj(sheet) &&
    typeof sheet['tabId'] === 'string' &&
    TAB_ID.test(sheet['tabId']) &&
    typeof sheet['sheetId'] === 'string' &&
    SHEET_ID_PATTERN.test(sheet['sheetId'])
  ) {
    form.sheet = { tabId: sheet['tabId'], sheetId: sheet['sheetId'] };
    const columns = readSheetColumns(sheet['columns']);
    if (columns) form.sheet.columns = columns;
    const fixed = readSheetFixed(sheet['fixed']);
    if (fixed) form.sheet.fixed = fixed;
  }
  if (finite(raw['closesAt']) && raw['closesAt'] > 0) form.closesAt = raw['closesAt'];
  const limit = raw['limit'];
  if (
    Number.isInteger(limit) &&
    (limit as number) >= 1 &&
    (limit as number) <= FORM_RESPONSE_LIMIT_MAX
  )
    form.limit = limit as number;
  const confirmation = text(raw['confirmation'], MESSAGE_MAX);
  if (confirmation) form.confirmation = confirmation;
  const closedMessage = text(raw['closedMessage'], MESSAGE_MAX);
  if (closedMessage) form.closedMessage = closedMessage;
  if ((STARTER_IDS as readonly unknown[]).includes(raw['starter']))
    form.starter = raw['starter'] as StarterId;
  return form;
}
