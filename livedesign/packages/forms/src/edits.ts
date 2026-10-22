// The Form tab builder's edits (docs/specs/030-forms/forms.md "Building a form", blueprint §12, §15), shared by the
// editor and agents: pure functions from a form to the next form, so each is one undo step when committed and each is
// tested apart from the page. Ids come from `newId` (newFormPartId).
import { OPTIONS_MAX, QUESTIONS_MAX, RATING_SCALE_DEFAULT, SECTIONS_MAX } from './limits';
import { TITLE_TYPES } from './mapping';
import {
  questionsOf,
  type AnswerTarget,
  type FormDefinition,
  type FormQuestion,
  type FormSection,
  type QuestionType,
} from './model';

type NewId = (prefix: 'q' | 's') => string;

type QuestionAt = { section: number; index: number };

export function findQuestion(form: FormDefinition, id: string): QuestionAt | null {
  for (let s = 0; s < form.sections.length; s += 1) {
    const index = form.sections[s]!.questions.findIndex((q) => q.id === id);
    if (index >= 0) return { section: s, index };
  }
  return null;
}

export function questionById(form: FormDefinition, id: string | null): FormQuestion | undefined {
  if (!id) return undefined;
  const at = findQuestion(form, id);
  return at ? form.sections[at.section]!.questions[at.index] : undefined;
}

function withSections(form: FormDefinition, sections: FormSection[]): FormDefinition {
  return { ...form, sections };
}

function mapQuestion(
  form: FormDefinition,
  id: string,
  fn: (q: FormQuestion) => FormQuestion,
): FormDefinition {
  const at = findQuestion(form, id);
  if (!at) return form;
  const sections = form.sections.map((s, i) =>
    i === at.section
      ? { ...s, questions: s.questions.map((q, j) => (j === at.index ? fn(q) : q)) }
      : s,
  );
  return withSections(form, sections);
}

// The settings a new question of each type starts with.
export function blankQuestion(type: QuestionType, id: string): FormQuestion {
  const q: FormQuestion = { id, type, prompt: '' };
  if (type === 'single' || type === 'multi') q.options = ['Option 1', 'Option 2'];
  if (type === 'rating') {
    q.scale = RATING_SCALE_DEFAULT;
    q.style = 'stars';
  }
  return q;
}

export const canAddQuestion = (form: FormDefinition) => questionsOf(form).length < QUESTIONS_MAX;
export const canAddSection = (form: FormDefinition) => form.sections.length < SECTIONS_MAX;

// A new question after `afterId` (in its section), else at the end of the last section.
export function addQuestion(
  form: FormDefinition,
  type: QuestionType,
  afterId: string | null,
  newId: NewId,
): { form: FormDefinition; id: string | null } {
  if (!canAddQuestion(form)) return { form, id: null };
  const q = blankQuestion(type, newId('q'));
  const at = afterId ? findQuestion(form, afterId) : null;
  const section = at ? at.section : form.sections.length - 1;
  const index = at ? at.index + 1 : form.sections[section]!.questions.length;
  const sections = form.sections.map((s, i) =>
    i === section
      ? { ...s, questions: [...s.questions.slice(0, index), q, ...s.questions.slice(index)] }
      : s,
  );
  return { form: withSections(form, sections), id: q.id };
}

// A copy below the question; a copy never goes to Title or a field (two answers would fight over one place).
export function duplicateQuestion(
  form: FormDefinition,
  id: string,
  newId: NewId,
): { form: FormDefinition; id: string | null } {
  const at = findQuestion(form, id);
  if (!at || !canAddQuestion(form)) return { form, id: null };
  const { goesTo: _goesTo, ...rest } = form.sections[at.section]!.questions[at.index]!;
  const copy: FormQuestion = {
    ...rest,
    id: newId('q'),
    ...(rest.options ? { options: [...rest.options] } : {}),
  };
  const sections = form.sections.map((s, i) =>
    i === at.section
      ? {
          ...s,
          questions: [
            ...s.questions.slice(0, at.index + 1),
            copy,
            ...s.questions.slice(at.index + 1),
          ],
        }
      : s,
  );
  return { form: withSections(form, sections), id: copy.id };
}

export function deleteQuestion(form: FormDefinition, id: string): FormDefinition {
  const at = findQuestion(form, id);
  if (!at) return form;
  return withSections(
    form,
    form.sections.map((s, i) =>
      i === at.section ? { ...s, questions: s.questions.filter((q) => q.id !== id) } : s,
    ),
  );
}

// The question after the one deleted, else before it: where selection goes.
export function neighbourOf(form: FormDefinition, id: string): string | null {
  const all = questionsOf(form);
  const i = all.findIndex((q) => q.id === id);
  if (i < 0) return null;
  return all[i + 1]?.id ?? all[i - 1]?.id ?? null;
}

// One place up or down in form order, crossing into the next or previous section at its edge.
export function moveQuestion(form: FormDefinition, id: string, by: -1 | 1): FormDefinition {
  const at = findQuestion(form, id);
  if (!at) return form;
  const section = form.sections[at.section]!;
  const q = section.questions[at.index]!;
  const sections = form.sections.map((s) => ({ ...s, questions: [...s.questions] }));
  const next = at.index + by;
  if (next >= 0 && next < section.questions.length) {
    sections[at.section]!.questions.splice(at.index, 1);
    sections[at.section]!.questions.splice(next, 0, q);
    return withSections(form, sections);
  }
  const target = at.section + by;
  if (target < 0 || target >= sections.length) return form;
  sections[at.section]!.questions.splice(at.index, 1);
  // Into the neighbouring section: at its end going up, its start going down.
  if (by < 0) sections[target]!.questions.push(q);
  else sections[target]!.questions.unshift(q);
  return withSections(form, sections);
}

// `id` placed at `index` of section `section` (a drag's drop).
export function placeQuestion(
  form: FormDefinition,
  id: string,
  section: number,
  index: number,
): FormDefinition {
  const at = findQuestion(form, id);
  if (!at || section < 0 || section >= form.sections.length) return form;
  const q = form.sections[at.section]!.questions[at.index]!;
  const sections = form.sections.map((s) => ({
    ...s,
    questions: s.questions.filter((x) => x.id !== id),
  }));
  // A drop below its own place in the same section counts the gap it left.
  const target = section === at.section && index > at.index ? index - 1 : index;
  const list = sections[section]!.questions;
  list.splice(Math.max(0, Math.min(target, list.length)), 0, q);
  const moved = withSections(form, sections);
  return JSON.stringify(moved.sections) === JSON.stringify(form.sections) ? form : moved;
}

export function updateQuestion(
  form: FormDefinition,
  id: string,
  patch: Partial<Omit<FormQuestion, 'id' | 'type'>>,
): FormDefinition {
  return mapQuestion(form, id, (q) => {
    const next: FormQuestion = { ...q, ...patch };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete next[k as keyof FormQuestion];
    }
    return next;
  });
}

// A new type keeps the prompt, help and required; options carry between the two choice types; anything the new type
// cannot use goes, and so does a Title mapping it cannot take (a field mapping is checked where it is shown, as a
// field may fit or not by its options).
export function setQuestionType(
  form: FormDefinition,
  id: string,
  type: QuestionType,
): FormDefinition {
  return mapQuestion(form, id, (q) => {
    if (q.type === type) return q;
    const next = blankQuestion(type, q.id);
    next.prompt = q.prompt;
    if (q.help) next.help = q.help;
    if (q.required) next.required = true;
    const choice = (t: QuestionType) => t === 'single' || t === 'multi';
    if (choice(q.type) && choice(type)) {
      next.options = [...(q.options ?? [])];
      if (q.other) next.other = true;
    }
    if (q.goesTo?.to === 'title' && TITLE_TYPES.includes(type)) next.goesTo = q.goesTo;
    if (q.goesTo?.to === 'field') next.goesTo = q.goesTo;
    return next;
  });
}

// Where the answer goes. Title is one question's at most: taking it moves it here.
export function setTarget(form: FormDefinition, id: string, target: AnswerTarget): FormDefinition {
  const unset = (q: FormQuestion): FormQuestion => {
    const { goesTo: _g, ...rest } = q;
    return rest;
  };
  const taken = (q: FormQuestion) =>
    q.id !== id &&
    ((target.to === 'title' && q.goesTo?.to === 'title') ||
      (target.to === 'field' && q.goesTo?.to === 'field' && q.goesTo.fieldId === target.fieldId));
  return withSections(
    form,
    form.sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) => {
        if (q.id === id) return target.to === 'description' ? unset(q) : { ...q, goesTo: target };
        return taken(q) ? unset(q) : q;
      }),
    })),
  );
}

// --- Options ----------------------------------------------------------------------------------------------------

export function setOptions(form: FormDefinition, id: string, options: string[]): FormDefinition {
  return mapQuestion(form, id, (q) => ({ ...q, options: options.slice(0, OPTIONS_MAX) }));
}

// A name not already among `options` (ignoring case): "Option 3", or "Option 3 (2)" style when needed.
export function nextOptionName(options: readonly string[]): string {
  const taken = new Set(options.map((o) => o.toLowerCase()));
  for (let n = options.length + 1; ; n += 1) {
    const name = `Option ${n}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

// Lines pasted into an option: each a new option after it, blanks and repeats dropped.
export function pastedOptions(
  options: readonly string[],
  index: number,
  text: string,
): string[] | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const out = [...options];
  let at = index;
  // The pasted-into option takes the first line when it was empty.
  if (!out[index]?.trim()) {
    out.splice(index, 1);
    at -= 1;
  }
  const seen = new Set(out.map((o) => o.toLowerCase()));
  for (const line of lines) {
    if (seen.has(line.toLowerCase()) || out.length >= OPTIONS_MAX) continue;
    seen.add(line.toLowerCase());
    at += 1;
    out.splice(at, 0, line);
  }
  return out;
}

// --- Sections ---------------------------------------------------------------------------------------------------

// A new section after `afterSection`, taking the questions that followed `afterQuestionId` in it (so Add Section
// splits where you are), else empty at the end.
export function addSection(
  form: FormDefinition,
  newId: NewId,
  afterQuestionId: string | null,
): { form: FormDefinition; id: string | null } {
  if (!canAddSection(form)) return { form, id: null };
  const section: FormSection = { id: newId('s'), title: '', questions: [] };
  const at = afterQuestionId ? findQuestion(form, afterQuestionId) : null;
  if (!at) return { form: withSections(form, [...form.sections, section]), id: section.id };
  const host = form.sections[at.section]!;
  section.questions = host.questions.slice(at.index + 1);
  const sections = [...form.sections];
  sections.splice(
    at.section,
    1,
    { ...host, questions: host.questions.slice(0, at.index + 1) },
    section,
  );
  return { form: withSections(form, sections), id: section.id };
}

export function updateSection(
  form: FormDefinition,
  id: string,
  patch: Partial<Pick<FormSection, 'title' | 'description' | 'showIf'>>,
): FormDefinition {
  return withSections(
    form,
    form.sections.map((s) => {
      if (s.id !== id) return s;
      const next = { ...s, ...patch };
      if (!next.description) delete next.description;
      // An empty rule is none: the section always shows.
      if (!next.showIf?.anyOf.length) delete next.showIf;
      return next;
    }),
  );
}

// A section removed, its questions joining the section before it (the first section is never removed).
export function deleteSection(form: FormDefinition, id: string): FormDefinition {
  const i = form.sections.findIndex((s) => s.id === id);
  if (i <= 0) return form;
  const sections = [...form.sections];
  const [gone] = sections.splice(i, 1);
  sections[i - 1] = {
    ...sections[i - 1]!,
    questions: [...sections[i - 1]!.questions, ...gone!.questions],
  };
  return withSections(form, sections);
}

// --- The form ---------------------------------------------------------------------------------------------------

export function patchForm(
  form: FormDefinition,
  patch: Partial<Omit<FormDefinition, 'v' | 'sections'>>,
): FormDefinition {
  const next: FormDefinition = { ...form, ...patch };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k as keyof FormDefinition];
  }
  return next;
}
