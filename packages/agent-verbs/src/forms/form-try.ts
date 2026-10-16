// try_form (docs/specs/030-forms/forms.md "Agents"): the builder's Preview for an agent. Answers, by question id or
// prompt, are checked as the form link checks them, then make what a response makes, titled "Preview: ..." as the
// editor's Submit in Preview does: a published form, or one whose responses go to a sheet, takes it through the api's
// form-preview route (a published form counts it, numbered); an unpublished board form's card is made here through
// the items route, uncounted, as the editor makes it itself. Nothing is sent when an answer is wrong.
import type { ApiClient } from '@livediagram/api-client';
import { ApiError } from '@livediagram/api-client';
import type { FormResponseAccepted, ItemResponse } from '@livediagram/api-schema';
import {
  OTHER_ANSWER,
  answerErrorMessage,
  checkResponse,
  destinationType,
  promptOf,
  questionsOf,
  responseCard,
  shownQuestions,
  type AnswerError,
  type FormDefinition,
  type FormQuestion,
} from '@livediagram/forms';
import { itemsPath, tabPath } from '../verbs/shared';
import { guarded, readingOf } from './form-calls';
import { refuse, resolveQuestion, type FormRefusal } from './form-names';
import type { BoardRef, FormWorld } from './form-world';

export type FormTryDone = {
  ok: true;
  documentId: string;
  tabId: string;
  // A card on a board, or a row in a sheet.
  made: 'card' | 'row';
  // The response number a published form gave it; null when nothing counts it.
  number: number | null;
  // Where it went, in words: the board and column, or the sheet.
  where: string;
  // The card's title (a row has none), and its id when it was made here.
  title: string | null;
  itemId: string | null;
  lines: string[];
};
export type FormTryResult = FormTryDone | FormRefusal;

const listed = (q: FormQuestion) => `"${promptOf(q)}" (${q.id})`;

// Why each answer was refused, with the options a choice takes.
function invalidMessage(
  form: FormDefinition,
  errors: Readonly<Record<string, AnswerError>>,
): FormRefusal {
  const byId = new Map(questionsOf(form).map((q) => [q.id, q]));
  const lines = Object.entries(errors).map(([id, error]) => {
    const q = byId.get(id);
    if (!q) return `${id}: ${error}`;
    const options =
      error === 'not_an_option' && q.options?.length
        ? ` (options: ${q.options.map((o) => `"${o}"`).join(', ')}${q.other ? ', or any other text' : ''})`
        : '';
    return `${listed(q)}: ${answerErrorMessage(q, error)}${options}`;
  });
  // The api names no question when the form changed under it in a way it cannot say: read it again.
  return refuse(
    'invalid_answers',
    lines.length
      ? `Nothing was sent. ${lines.join('. ')}.`
      : 'Nothing was sent: the form refused the answers. Read it again with read_form, then try again.',
  );
}

// The answers by question id, a choice's text that is no option taken as its Other answer (when it has Other).
function bodyOf(
  form: FormDefinition,
  given: Readonly<Record<string, unknown>>,
): { answers: Record<string, unknown>; other: Record<string, string> } | FormRefusal {
  const answers: Record<string, unknown> = {};
  const other: Record<string, string> = {};
  for (const [ref, value] of Object.entries(given ?? {})) {
    const named = resolveQuestion(form, ref);
    if (!named.ok) return named;
    const q = named.question;
    const options = q.options ?? [];
    if (q.other && q.type === 'single' && typeof value === 'string' && !options.includes(value)) {
      answers[q.id] = OTHER_ANSWER;
      other[q.id] = value;
    } else if (q.other && q.type === 'multi' && Array.isArray(value)) {
      const picks = value as unknown[];
      const typed = picks.filter((v): v is string => typeof v === 'string' && !options.includes(v));
      answers[q.id] = typed.length
        ? [...picks.filter((v) => !typed.includes(v as string)), OTHER_ANSWER]
        : picks;
      if (typed.length) other[q.id] = typed.join(', ');
    } else answers[q.id] = value;
  }
  return { answers, other };
}

// A card's title, which every card's fields hold as text.
const titleOf = (fields: Readonly<Record<string, unknown>>): string => fields['title'] as string;

// The board and column a board form's cards land in, in words.
function boardWhere(
  world: FormWorld,
  form: FormDefinition,
): { board: BoardRef; where: string } | null {
  const status = form.destination?.status;
  const board = world.boards.find((b) => b.columns.some((c) => c.status === status));
  const column = board?.columns.find((c) => c.status === status);
  return board && column
    ? { board, where: `the "${board.tabName}" board, column ${column.name}` }
    : null;
}

export async function tryForm(
  api: ApiClient,
  documentId: string,
  tabRef: string | undefined,
  given: Readonly<Record<string, unknown>>,
): Promise<FormTryResult> {
  return guarded(async (): Promise<FormTryResult> => {
    const read = await readingOf(api, documentId, tabRef);
    if (!read.ok) return read;
    const { form, tab, world, link } = read;
    const body = bodyOf(form, given);
    if ('ok' in body) return body;
    const checked = checkResponse(form, body);
    if (!checked.ok) return invalidMessage(form, checked.errors);
    const asked = new Set(shownQuestions(form, body.answers).map((q) => q.id));
    const lines = Object.keys(body.answers)
      .filter((id) => !asked.has(id))
      .map((id) => {
        const q = questionsOf(form).find((x) => x.id === id)!;
        return `${listed(q)} was left out: its section does not show for these answers`;
      });
    const sheet = form.sheet ? world.sheets.find((s) => s.sheetId === form.sheet!.sheetId) : null;
    const target = form.sheet ? null : boardWhere(world, form);
    const type = destinationType(form.destination, world.types);
    const nowhere = refuse(
      'form_destination_missing',
      'A preview has nowhere to go until responses go to a board and column, or a sheet: set responds_to with change_form.',
    );
    if (!form.sheet && (!form.destination || !type)) return nowhere;
    const where = sheet
      ? `the sheet "${sheet.name}"`
      : form.sheet
        ? 'its sheet'
        : (target?.where ?? 'its board');
    const done = (
      fields: Omit<FormTryDone, 'ok' | 'documentId' | 'tabId' | 'where' | 'lines'>,
    ) => ({
      ok: true as const,
      documentId,
      tabId: tab.id,
      where,
      lines,
      ...fields,
    });

    // A published form counts it, and a sheet's row is the api's to write either way.
    if (link?.link || form.sheet) {
      let sent: FormResponseAccepted;
      try {
        sent = await api.json<FormResponseAccepted>(`${tabPath(documentId, tab.id)}/form-preview`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      } catch (err) {
        // The api checks the answers again: the form may have changed since it was read.
        if (err instanceof ApiError && err.code === 'invalid_answers') {
          const errors = (JSON.parse(err.body) as { errors?: Record<string, AnswerError> }).errors;
          return invalidMessage(form, errors ?? {});
        }
        throw err;
      }
      const number = link?.link && sent.number > 0 ? sent.number : null;
      const title = form.sheet
        ? null
        : titleOf(responseCard(form, tab.id, checked.answers, type!, number, true).fields);
      return done({ made: form.sheet ? 'row' : 'card', number, title, itemId: null });
    }

    // Unpublished, to a board: the card the editor's Preview makes itself, numbered by nothing, on a board the document
    // still has.
    if (!target) return nowhere;
    const card = responseCard(form, tab.id, checked.answers, type!, null, true);
    const { item } = await api.json<ItemResponse>(itemsPath(documentId), {
      method: 'POST',
      body: JSON.stringify({
        type: card.type,
        fields: card.fields,
        place: { status: form.destination!.status },
      }),
    });
    return done({
      made: 'card',
      number: null,
      title: titleOf(item.fields),
      itemId: item.id,
    });
  });
}
