// change_form's changes (docs/specs/030-forms/forms.md "Agents"), applied to a draft in order through the builder's
// own edits. A refusal names its change (1 the first) and nothing is written.
import {
  FORM_DESCRIPTION_MAX,
  FORM_HEADING_MAX,
  FORM_RESPONSE_LIMIT_MAX,
  MESSAGE_MAX,
  SECTION_TITLE_MAX,
  addQuestion,
  addSection,
  canAddQuestion,
  canAddSection,
  deleteQuestion,
  deleteSection,
  findQuestion,
  patchForm,
  placeQuestion,
  promptOf,
  questionById,
  ruleChoices,
  ruleQuestions,
  setQuestionType,
  updateSection,
  QUESTIONS_MAX,
  SECTIONS_MAX,
  type FormDefinition,
  type FormQuestion,
  type SectionRule,
} from '@livediagram/forms';
import { parseColourBackground, type ColourBackground } from '@livediagram/page-background';
import {
  setGoesTo,
  setRespondsTo,
  syncChoiceField,
  type FormDraft,
  type RespondsToInput,
} from './form-draft';
import {
  refuse,
  resolveQuestion,
  resolveSection,
  type FormRefusal,
  type Named,
} from './form-names';
import {
  applyQuestionSet,
  questionFrom,
  type QuestionInput,
  type QuestionSet,
} from './form-question';

export type SectionRef = string | number;
export interface SectionRuleInput {
  question: string;
  anyOf: string[];
}

export type FormChange =
  | { op: 'add_question'; question: QuestionInput; section?: SectionRef; after?: string }
  | { op: 'set_question'; question: string; set: QuestionSet }
  | { op: 'delete_question'; question: string }
  | { op: 'move_question'; question: string; section?: SectionRef; after?: string }
  | {
      op: 'add_section';
      title?: string;
      description?: string;
      after?: string;
      showIf?: SectionRuleInput;
    }
  | {
      op: 'set_section';
      section: SectionRef;
      title?: string;
      description?: string;
      showIf?: SectionRuleInput | null;
    }
  | { op: 'delete_section'; section: SectionRef }
  | { op: 'set_form'; heading?: string; description?: string; cover?: unknown }
  | {
      op: 'settings';
      closesAt?: string | null;
      limit?: number | null;
      confirmation?: string | null;
      closedMessage?: string | null;
    }
  | ({ op: 'responds_to' } & RespondsToInput);

// The changes a form taking responses still takes.
export const SETTINGS_OPS: ReadonlySet<FormChange['op']> = new Set(['settings']);

const tooLong = (what: string, max: number) =>
  refuse('too_long', `${what} holds at most ${max} characters.`);

function text(v: string, max: number, what: string): Named<{ text: string }> {
  const t = v.trim();
  return [...t].length > max ? tooLong(what, max) : { ok: true, text: t };
}

// A question added: made, placed (after a question, or at the end of a section or the form), mapped.
export function addQuestionTo(
  d: FormDraft,
  input: QuestionInput,
  place: { section?: SectionRef; after?: string },
): FormRefusal | null {
  if (!canAddQuestion(d.form))
    return refuse('questions_full', `A form holds at most ${QUESTIONS_MAX} questions.`);
  const made = questionFrom(input, d.newId('q'));
  if (!made.ok) return made;
  const added = addQuestion(d.form, made.question.type, null, () => made.question.id);
  d.form = mapOne(added.form, made.question.id, () => made.question);
  const placed = placeAt(d, made.question.id, place);
  if (placed) return placed;
  d.lines.push(`added "${promptOf(made.question)}" (${made.question.id})`);
  return input.goesTo !== undefined ? setGoesTo(d, made.question, input.goesTo) : null;
}

function mapOne(
  form: FormDefinition,
  id: string,
  fn: (q: FormQuestion) => FormQuestion,
): FormDefinition {
  return {
    ...form,
    sections: form.sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) => (q.id === id ? fn(q) : q)),
    })),
  };
}

// `id` placed after the question `after` (in its section), else at the end of `section`; neither leaves it.
function placeAt(
  d: FormDraft,
  id: string,
  place: { section?: SectionRef; after?: string },
): FormRefusal | null {
  if (place.after !== undefined) {
    const after = resolveQuestion(d.form, place.after);
    if (!after.ok) return after;
    if (after.question.id === id)
      return refuse('invalid_value', 'A question cannot go after itself.');
    const at = findQuestion(d.form, after.question.id)!;
    // Indexes count the section as it stands; placeQuestion closes the gap a move down leaves.
    d.form = placeQuestion(d.form, id, at.section, at.index + 1);
    return null;
  }
  if (place.section !== undefined) {
    const s = resolveSection(d.form, place.section);
    if (!s.ok) return s;
    d.form = placeQuestion(d.form, id, s.index, s.section.questions.length);
  }
  return null;
}

function setQuestion(d: FormDraft, ref: string, set: QuestionSet): FormRefusal | null {
  const found = resolveQuestion(d.form, ref);
  if (!found.ok) return found;
  const id = found.question.id;
  if (set.type !== undefined && set.type !== found.question.type)
    d.form = setQuestionType(d.form, id, set.type);
  const { type: _type, goesTo, ...rest } = set;
  const applied = applyQuestionSet(questionById(d.form, id)!, rest);
  if (!applied.ok) return applied;
  d.form = mapOne(d.form, id, () => applied.question);
  d.lines.push(`changed "${promptOf(applied.question)}"`);
  if (goesTo !== undefined) return setGoesTo(d, applied.question, goesTo);
  return syncChoiceField(d, id);
}

// A section rule: an earlier choice or checkbox question, and the answers that show the section.
function ruleFor(
  d: FormDraft,
  index: number,
  input: SectionRuleInput,
): Named<{ rule: SectionRule }> {
  if (index === 0)
    return refuse(
      'rule_on_first',
      'The first section always shows: a rule goes on a later section.',
    );
  const fits = ruleQuestions(d.form, index);
  const found = resolveQuestion(d.form, input.question);
  if (!found.ok) return found;
  if (!fits.some((q) => q.id === found.question.id))
    return refuse(
      'rule_question_unfit',
      `A section shows on an earlier Single Choice, Multiple Choice or Checkbox question. Earlier ones: ${
        fits.map((q) => `"${promptOf(q)}"`).join(', ') || 'none yet: add one first'
      }.`,
    );
  const choices = ruleChoices(found.question);
  const anyOf: string[] = [];
  for (const a of input.anyOf) {
    const match = choices.find((c) => c.toLowerCase() === a.trim().toLowerCase());
    if (!match)
      return refuse(
        'rule_answer_unknown',
        `"${promptOf(found.question)}" offers no "${a}". Its answers: ${choices.join(', ')}.`,
      );
    if (!anyOf.includes(match)) anyOf.push(match);
  }
  if (!anyOf.length)
    return refuse('rule_answer_none', 'A rule shows its section on at least one answer.');
  return { ok: true, rule: { questionId: found.question.id, anyOf } };
}

function sectionPatch(
  d: FormDraft,
  index: number,
  c: { title?: string; description?: string; showIf?: SectionRuleInput | null },
): Named<{ patch: Parameters<typeof updateSection>[2] }> {
  const patch: Parameters<typeof updateSection>[2] = {};
  if ((c.title !== undefined || c.description !== undefined) && index === 0)
    return refuse(
      'first_section_is_form',
      'The first section’s title and description are the form’s heading and description: change them with set_form.',
    );
  if (c.title !== undefined) {
    const t = text(c.title, SECTION_TITLE_MAX, 'A section title');
    if (!t.ok) return t;
    patch.title = t.text;
  }
  if (c.description !== undefined) {
    const t = text(c.description, FORM_DESCRIPTION_MAX, 'A section description');
    if (!t.ok) return t;
    patch.description = t.text;
  }
  if (c.showIf === null) patch.showIf = undefined;
  else if (c.showIf !== undefined) {
    const r = ruleFor(d, index, c.showIf);
    if (!r.ok) return r;
    patch.showIf = r.rule;
  }
  return { ok: true, patch };
}

// A cover as agents give it (as change_pages takes a background): a colour or a gradient, perhaps moving, and a
// pattern; read as the editor reads a stored cover.
function coverOf(raw: unknown): ColourBackground | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as {
    color?: string;
    gradient?: [string, string];
    angle?: number;
    motion?: string;
    pattern?: string;
  };
  const fill = c.gradient
    ? {
        kind: 'gradient',
        from: c.gradient[0],
        to: c.gradient[1],
        angle: c.angle ?? 160,
        ...(c.motion ? { motion: c.motion } : {}),
      }
    : c.color
      ? { kind: 'solid', color: c.color }
      : undefined;
  const cover = parseColourBackground({
    ...(fill ? { fill } : {}),
    ...(c.pattern ? { pattern: c.pattern } : {}),
  });
  return cover && (cover.fill || cover.pattern) ? cover : undefined;
}

function setForm(d: FormDraft, c: Extract<FormChange, { op: 'set_form' }>): FormRefusal | null {
  const patch: Partial<FormDefinition> = {};
  if (c.heading !== undefined) {
    const t = text(c.heading, FORM_HEADING_MAX, 'A heading');
    if (!t.ok) return t;
    if (!t.text) return refuse('heading_empty', 'A form needs a heading.');
    patch.heading = t.text;
  }
  if (c.description !== undefined) {
    const t = text(c.description, FORM_DESCRIPTION_MAX, 'A description');
    if (!t.ok) return t;
    patch.description = t.text || undefined;
  }
  if (c.cover === null) patch.cover = undefined;
  else if (c.cover !== undefined) {
    const cover = coverOf(c.cover);
    if (!cover)
      return refuse(
        'cover_invalid',
        'A cover is {color: "#hex"} or {gradient: ["#hex", "#hex"], angle?, motion?}, and pattern?: dots, grid or lines.',
      );
    patch.cover = cover;
  }
  d.form = patchForm(d.form, patch);
  d.lines.push('changed the form');
  return null;
}

function settings(d: FormDraft, c: Extract<FormChange, { op: 'settings' }>): FormRefusal | null {
  const patch: Partial<FormDefinition> = {};
  if (c.closesAt === null) patch.closesAt = undefined;
  else if (c.closesAt !== undefined) {
    // A time with no offset is UTC, wherever the call runs.
    const iso = c.closesAt.trim();
    const at = Date.parse(/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(iso) ? `${iso}Z` : iso);
    if (!Number.isFinite(at))
      return refuse(
        'invalid_value',
        'closesAt is an ISO date and time, like 2026-11-01T18:00:00Z.',
      );
    patch.closesAt = at;
  }
  if (c.limit === null) patch.limit = undefined;
  else if (c.limit !== undefined) {
    if (!Number.isInteger(c.limit) || c.limit < 1 || c.limit > FORM_RESPONSE_LIMIT_MAX)
      return refuse(
        'invalid_value',
        `limit is a whole number from 1 to ${FORM_RESPONSE_LIMIT_MAX}.`,
      );
    patch.limit = c.limit;
  }
  for (const key of ['confirmation', 'closedMessage'] as const) {
    const v = c[key];
    if (v === null) patch[key] = undefined;
    else if (v !== undefined) {
      const t = text(
        v,
        MESSAGE_MAX,
        `The ${key === 'confirmation' ? 'confirmation' : 'closed'} message`,
      );
      if (!t.ok) return t;
      patch[key] = t.text || undefined;
    }
  }
  d.form = patchForm(d.form, patch);
  d.lines.push('changed the settings');
  return null;
}

function applyOne(d: FormDraft, c: FormChange): FormRefusal | null {
  switch (c.op) {
    case 'add_question':
      return addQuestionTo(d, c.question, c);
    case 'set_question':
      return setQuestion(d, c.question, c.set);
    case 'delete_question': {
      const found = resolveQuestion(d.form, c.question);
      if (!found.ok) return found;
      d.form = deleteQuestion(d.form, found.question.id);
      d.lines.push(`deleted "${promptOf(found.question)}"`);
      return null;
    }
    case 'move_question': {
      const found = resolveQuestion(d.form, c.question);
      if (!found.ok) return found;
      if (c.after === undefined && c.section === undefined)
        return refuse(
          'invalid_value',
          'move_question names where: after a question, or a section to end.',
        );
      const placed = placeAt(d, found.question.id, c);
      if (!placed) d.lines.push(`moved "${promptOf(found.question)}"`);
      return placed;
    }
    case 'add_section': {
      if (!canAddSection(d.form))
        return refuse('sections_full', `A form holds at most ${SECTIONS_MAX} sections.`);
      let after: string | null = null;
      if (c.after !== undefined) {
        const found = resolveQuestion(d.form, c.after);
        if (!found.ok) return found;
        after = found.question.id;
      }
      const added = addSection(d.form, d.newId, after);
      d.form = added.form;
      const index = d.form.sections.findIndex((s) => s.id === added.id);
      const p = sectionPatch(d, index, c);
      if (!p.ok) return p;
      d.form = updateSection(d.form, added.id!, p.patch);
      d.lines.push(
        `added section ${index + 1}${c.title ? ` "${c.title.trim()}"` : ''} (${added.id})`,
      );
      return null;
    }
    case 'set_section': {
      const s = resolveSection(d.form, c.section);
      if (!s.ok) return s;
      const p = sectionPatch(d, s.index, c);
      if (!p.ok) return p;
      d.form = updateSection(d.form, s.section.id, p.patch);
      d.lines.push(`changed section ${s.index + 1}`);
      return null;
    }
    case 'delete_section': {
      const s = resolveSection(d.form, c.section);
      if (!s.ok) return s;
      if (s.index === 0)
        return refuse('first_section', 'The first section stays: a form has at least one.');
      d.form = deleteSection(d.form, s.section.id);
      d.lines.push(`deleted section ${s.index + 1}, its questions joining the one before`);
      return null;
    }
    case 'set_form':
      return setForm(d, c);
    case 'settings':
      return settings(d, c);
    case 'responds_to': {
      const { op: _op, ...r } = c;
      return setRespondsTo(d, r);
    }
  }
}

// Every change in order; a refusal names its change, as the agent counts them.
export function applyFormChanges(d: FormDraft, changes: readonly FormChange[]): FormRefusal | null {
  for (const [i, c] of changes.entries()) {
    const refused = applyOne(d, c);
    if (refused)
      return {
        ...refused,
        message: `Change ${i + 1} (${c.op}): ${refused.message} Nothing was written.`,
      };
  }
  return null;
}
