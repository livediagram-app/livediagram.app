// A question's range (docs/specs/030-forms/forms.md "Question types"): a Minimum above the Maximum, or Fewest Picks
// above Most Picks, would make the question impossible to answer. The one just set wins and the other is cleared,
// as readForm would drop it. Pure.
import type { FormQuestion } from '@livedesign/forms';

type Range = Pick<FormQuestion, 'min' | 'max'>;

export const withMin = (q: Range, min: number | undefined): Range =>
  min !== undefined && q.max !== undefined && min > q.max ? { min, max: undefined } : { min };

export const withMax = (q: Range, max: number | undefined): Range =>
  max !== undefined && q.min !== undefined && max < q.min ? { max, min: undefined } : { max };
