// readForm (docs/specs/030-forms/blueprints/forms.md §2): a stored or received form, made safe. It never throws and
// never refuses a form for one bad part: the part is dropped or capped, so a form from an older or newer editor, an
// agent or a hand-edited file still opens.
import { CUSTOM_FIELD_ID_PATTERN, ITEM_TYPE_PATTERN } from '@livediagram/items';
import {
  FORM_DESCRIPTION_MAX,
  FORM_HEADING_MAX,
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
  UNTITLED_FORM,
} from './limits';
import {
  FORM_VERSION,
  STARTER_IDS,
  isQuestionType,
  type AnswerTarget,
  type FormCover,
  type FormDefinition,
  type FormDestination,
  type FormQuestion,
  type FormSection,
  type StarterId,
} from './model';

export const FORM_ID_PATTERN = /^[a-z0-9-]{1,24}$/;
const HEX = /^#[0-9a-f]{6}$/i;
// An image id as the image store mints it.
const IMAGE_ID = /^[A-Za-z0-9_-]{1,64}$/;
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

function readCover(v: unknown): FormCover | undefined {
  if (!isObj(v)) return undefined;
  const cover: FormCover = {};
  if (typeof v['color'] === 'string' && HEX.test(v['color']))
    cover.color = v['color'].toLowerCase();
  if (typeof v['imageId'] === 'string' && IMAGE_ID.test(v['imageId'])) cover.imageId = v['imageId'];
  return cover.color || cover.imageId ? cover : undefined;
}

function readDestination(v: unknown): FormDestination | undefined {
  if (!isObj(v)) return undefined;
  const { tabId, typeId, status } = v;
  if (typeof tabId !== 'string' || !TAB_ID.test(tabId)) return undefined;
  if (typeof typeId !== 'string' || !ITEM_TYPE_PATTERN.test(typeId)) return undefined;
  if (typeof status !== 'string' || !STATUS_ID.test(status)) return undefined;
  return { tabId, typeId, status };
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
  if (typeof raw['accent'] === 'string' && HEX.test(raw['accent']))
    form.accent = raw['accent'].toLowerCase();
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
