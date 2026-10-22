// The Plan card functions (docs/specs/029-sheets/formulas.md "Plan cards"): CARDCOUNT, CARDSUM, CARD and CARDS
// read the document's live cards through the frame's CardSource. Before the cards arrive they read PENDING.
import type { CardRow, CardSource } from '../../cards';
import type { EvalValue, Frame } from '../../engine/frame';
import { MANY, fn, intArg, scalarArg, textArg, tooBig, type FnDef } from '../fn';
import { makeCriterion, type Criterion } from '../criteria';
import { PENDING, err, isError, type SheetError, type Value } from '../values';

type Filter = { field: string; test: Criterion };

function filtersFrom(
  args: EvalValue[],
  start: number,
  f: Frame,
  cards: CardSource,
): Filter[] | SheetError {
  const rest = args.slice(start);
  if (rest.length % 2 !== 0) return err('#N/A', 'Pairs of field and value are needed');
  const out: Filter[] = [];
  for (let i = 0; i < rest.length; i += 2) {
    const field = textArg(rest[i]!, f);
    if (isError(field)) return field;
    if (!cards.knowsField(field)) return err('#NAME?', `There is no card field "${field}"`);
    out.push({ field, test: makeCriterion(scalarArg(rest[i + 1]!, f)) });
  }
  return out;
}

function matching(cards: CardSource, filters: Filter[]): CardRow[] {
  return cards
    .cards()
    .filter((c) => filters.every((fl) => fl.test(cards.fieldOf(c, fl.field) ?? null)));
}

function withCards(f: Frame, body: (cards: CardSource) => Value): Value {
  f.readsCards();
  return f.cards ? body(f.cards) : PENDING;
}

export const CARD_FUNCTIONS: Record<string, FnDef> = {
  CARDCOUNT: fn(0, MANY, (args, f) =>
    withCards(f, (cards) => {
      const filters = filtersFrom(args, 0, f, cards);
      return isError(filters) ? filters : matching(cards, filters).length;
    }),
  ),
  CARDSUM: fn(1, MANY, (args, f) =>
    withCards(f, (cards) => {
      const field = textArg(args[0]!, f);
      if (isError(field)) return field;
      if (!cards.knowsField(field)) return err('#NAME?', `There is no card field "${field}"`);
      const filters = filtersFrom(args, 1, f, cards);
      if (isError(filters)) return filters;
      let s = 0;
      for (const c of matching(cards, filters)) {
        const v = cards.fieldOf(c, field);
        if (typeof v === 'number') s += v;
      }
      return s;
    }),
  ),
  CARD: fn(2, 2, (args, f) =>
    withCards(f, (cards) => {
      const key = intArg(args[0]!, f);
      if (isError(key)) return key;
      const field = textArg(args[1]!, f);
      if (isError(field)) return field;
      if (!cards.knowsField(field)) return err('#NAME?', `There is no card field "${field}"`);
      const card = cards.cards().find((c) => c.key === key);
      if (!card) return err('#N/A', `There is no card #${key}`);
      return cards.fieldOf(card, field) ?? null;
    }),
  ),
  CARDS: fn(1, MANY, (args, f) =>
    withCards(f, (cards) => {
      const list = textArg(args[0]!, f);
      if (isError(list)) return list;
      const fields = list
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (fields.length === 0) return err('#VALUE!', 'Name at least one field');
      for (const field of fields)
        if (!cards.knowsField(field)) return err('#NAME?', `There is no card field "${field}"`);
      const filters = filtersFrom(args, 1, f, cards);
      if (isError(filters)) return filters;
      const rows = matching(cards, filters);
      if (tooBig(rows.length + 1, fields.length)) return err('#NUM!', 'The result is too large');
      return {
        rows: [fields, ...rows.map((c) => fields.map((fl) => cards.fieldOf(c, fl) ?? null))],
      };
    }),
  ),
};
