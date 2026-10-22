// Each question type's icon (docs/specs/030-forms/forms.md "Question types"): in the Add Question menu, the Type list
// and a question's type button.
import { lucideGlyph } from '@liveplanner/ui';
import {
  lucideAlignLeft,
  lucideAtSign,
  lucideCalendar,
  lucideCircleDot,
  lucideHash,
  lucideLink,
  lucideListChecks,
  lucideSquareCheck,
  lucideStar,
  lucideTextCursorInput,
} from '@liveplanner/icons/lucide';
import type { QuestionType } from '@liveplanner/forms';

export const QUESTION_TYPE_ICONS: Readonly<Record<QuestionType, ReturnType<typeof lucideGlyph>>> = {
  short: lucideGlyph(lucideTextCursorInput, 16),
  paragraph: lucideGlyph(lucideAlignLeft, 16),
  number: lucideGlyph(lucideHash, 16),
  email: lucideGlyph(lucideAtSign, 16),
  link: lucideGlyph(lucideLink, 16),
  date: lucideGlyph(lucideCalendar, 16),
  single: lucideGlyph(lucideCircleDot, 16),
  multi: lucideGlyph(lucideListChecks, 16),
  rating: lucideGlyph(lucideStar, 16),
  checkbox: lucideGlyph(lucideSquareCheck, 16),
};

// The order the types are offered in: the everyday ones first.
export const QUESTION_TYPE_ORDER: readonly QuestionType[] = [
  'short',
  'paragraph',
  'single',
  'multi',
  'rating',
  'email',
  'number',
  'date',
  'link',
  'checkbox',
];
