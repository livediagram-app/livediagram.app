// The Add a Question gallery's groups (docs/specs/030-forms/forms.md "The form card, top to bottom"): every question
// type, grouped by what it collects, each with a line on what that is and its group's tone, then the content blocks
// (forms.md "Content blocks"), which ask nothing.

import { CONTENT_BLOCKS, type ContentBlock, type QuestionType } from '@liveplanner/forms';
import type { SceneTone } from '@liveworkspace/automations-ui/tile-picker/tile-scene';

export type QuestionGroupId = 'text' | 'choices' | 'ratings' | 'dates' | 'contact' | 'content';

// What a gallery tile adds: a question of a type, or a content block of a kind (`content-text`).
export type AddKind = Exclude<QuestionType, 'content'> | `content-${ContentBlock}`;
export const contentKind = (k: AddKind): ContentBlock | null =>
  k.startsWith('content-') ? (k.slice('content-'.length) as ContentBlock) : null;

export const QUESTION_GROUPS: readonly {
  id: QuestionGroupId;
  name: string;
  tone: SceneTone;
  types: readonly AddKind[];
}[] = [
  { id: 'text', name: 'Text', tone: 'blue', types: ['short', 'paragraph'] },
  {
    id: 'choices',
    name: 'Choices',
    tone: 'violet',
    types: ['single', 'multi', 'checkbox', 'colour'],
  },
  {
    id: 'ratings',
    name: 'Ratings and Numbers',
    tone: 'orange',
    types: ['rating', 'number', 'duration'],
  },
  { id: 'dates', name: 'Dates', tone: 'emerald', types: ['date', 'datetime', 'daterange'] },
  { id: 'contact', name: 'Contact Details', tone: 'blue', types: ['email', 'phone', 'link'] },
  {
    id: 'content',
    name: 'Content',
    tone: 'emerald',
    types: CONTENT_BLOCKS.map((b) => `content-${b}` as const),
  },
];

export const QUESTION_LINES: Readonly<Record<AddKind, string>> = {
  short: 'A name, a title or any answer on one line.',
  paragraph: 'A longer answer, such as feedback or the steps to a bug.',
  single: 'One pick from your options, as buttons or a dropdown.',
  multi: 'Any of your options, with the fewest and most picks.',
  checkbox: 'One box to tick, such as agreeing to terms.',
  colour: 'A colour, picked from swatches.',
  rating: 'A score from 1 up to 3 to 10, as stars or numbers.',
  number: 'A number, with a minimum, a maximum or whole numbers only.',
  duration: 'How long, typed as 2h 30m, 90m or 1.5h.',
  date: 'A day, picked from a calendar.',
  datetime: 'A day and a time, in the respondent’s own time zone.',
  daterange: 'A From and a To, with times if you switch them on.',
  email: 'An email address, so you can write back.',
  phone: 'A phone number, typed on a phone’s number pad.',
  link: 'A web address, such as a portfolio or a page.',
  'content-text': 'A heading and words to explain something. Asks nothing.',
  'content-callout': 'A tinted note that stands out: a tip, some help or a warning.',
  'content-link': 'A button to a page, such as your policy or a guide.',
  'content-image': 'A picture, such as a diagram or a map, with a caption.',
};
