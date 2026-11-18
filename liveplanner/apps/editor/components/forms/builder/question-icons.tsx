// Each question type's icon (docs/specs/030-forms/forms.md "Question types"): in the Add a Question gallery, the Type
// list and a question's type button.
import { lucideGlyph } from '@liveplanner/ui';
import {
  lucideAlignLeft,
  lucideAtSign,
  lucideCalendar,
  lucideCalendarClock,
  lucideCalendarRange,
  lucideCircleDot,
  lucideExternalLink,
  lucideHash,
  lucideImage,
  lucideInfo,
  lucidePalette,
  lucidePilcrow,
  lucideTimer,
  lucideLink,
  lucideListChecks,
  lucidePhone,
  lucideSquareCheck,
  lucideStar,
  lucideTextCursorInput,
} from '@liveworkspace/icons/lucide';
import type { ContentBlock, QuestionType } from '@liveplanner/forms';

export const QUESTION_TYPE_ICONS: Readonly<Record<QuestionType, ReturnType<typeof lucideGlyph>>> = {
  short: lucideGlyph(lucideTextCursorInput, 16),
  paragraph: lucideGlyph(lucideAlignLeft, 16),
  number: lucideGlyph(lucideHash, 16),
  email: lucideGlyph(lucideAtSign, 16),
  link: lucideGlyph(lucideLink, 16),
  phone: lucideGlyph(lucidePhone, 16),
  date: lucideGlyph(lucideCalendar, 16),
  datetime: lucideGlyph(lucideCalendarClock, 16),
  daterange: lucideGlyph(lucideCalendarRange, 16),
  single: lucideGlyph(lucideCircleDot, 16),
  multi: lucideGlyph(lucideListChecks, 16),
  rating: lucideGlyph(lucideStar, 16),
  checkbox: lucideGlyph(lucideSquareCheck, 16),
  duration: lucideGlyph(lucideTimer, 16),
  colour: lucideGlyph(lucidePalette, 16),
  content: lucideGlyph(lucidePilcrow, 16),
};

// Each content block's icon (forms.md "Content blocks").
export const CONTENT_BLOCK_ICONS: Readonly<Record<ContentBlock, ReturnType<typeof lucideGlyph>>> = {
  text: lucideGlyph(lucidePilcrow, 16),
  callout: lucideGlyph(lucideInfo, 16),
  link: lucideGlyph(lucideExternalLink, 16),
  image: lucideGlyph(lucideImage, 16),
};

// The order the types are offered in: the everyday ones first.
export const QUESTION_TYPE_ORDER: readonly QuestionType[] = [
  'short',
  'paragraph',
  'single',
  'multi',
  'rating',
  'email',
  'phone',
  'number',
  'date',
  'datetime',
  'daterange',
  'link',
  'checkbox',
  'duration',
  'colour',
];
