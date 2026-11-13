// The Add a Question gallery's groups (docs/specs/030-forms/forms.md "The form card, top to bottom"): every question
// type, grouped by what it collects, each with a line on what that is and its group's tone.

import type { QuestionType } from '@liveplanner/forms';
import type { SceneTone } from '@/components/tile-picker/tile-scene';

export type QuestionGroupId = 'text' | 'choices' | 'ratings' | 'dates' | 'contact';

export const QUESTION_GROUPS: readonly {
  id: QuestionGroupId;
  name: string;
  tone: SceneTone;
  types: readonly QuestionType[];
}[] = [
  { id: 'text', name: 'Text', tone: 'blue', types: ['short', 'paragraph'] },
  { id: 'choices', name: 'Choices', tone: 'violet', types: ['single', 'multi', 'checkbox'] },
  { id: 'ratings', name: 'Ratings and Numbers', tone: 'orange', types: ['rating', 'number'] },
  { id: 'dates', name: 'Dates', tone: 'emerald', types: ['date', 'datetime', 'daterange'] },
  { id: 'contact', name: 'Contact Details', tone: 'blue', types: ['email', 'phone', 'link'] },
];

export const QUESTION_LINES: Readonly<Record<QuestionType, string>> = {
  short: 'A name, a title or any answer on one line.',
  paragraph: 'A longer answer, such as feedback or the steps to a bug.',
  single: 'One pick from your options, as buttons or a dropdown.',
  multi: 'Any of your options, with the fewest and most picks.',
  checkbox: 'One box to tick, such as agreeing to terms.',
  rating: 'A score from 1 up to 3 to 10, as stars or numbers.',
  number: 'A number, with a minimum, a maximum or whole numbers only.',
  date: 'A day, picked from a calendar.',
  datetime: 'A day and a time, in the respondent’s own time zone.',
  daterange: 'A From and a To, with times if you switch them on.',
  email: 'An email address, so you can write back.',
  phone: 'A phone number, typed on a phone’s number pad.',
  link: 'A web address, such as a portfolio or a page.',
};
