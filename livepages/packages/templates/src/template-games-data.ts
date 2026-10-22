// The worked content of the game boards (docs/specs/012-collaboration/game-templates.md): the icebreaker
// questions, the would-you-rather dilemmas, the bingo prompts and the two-truths players. Pure data, read by
// template-builders-icebreakers.ts and template-builders-party-games.ts.

// The sticky paper and ink each player writes on: the sticky presets' own pairs, so the colour picker names them.
import { BLUE, LILAC, PINK } from './template-workshop-stickies';

// Each under the Picker's two-line result at its width (about 80 characters).
export const ICEBREAKER_QUESTIONS: readonly string[] = [
  'What was your first job?',
  'What is the best meal you have ever had?',
  'Which skill would you love to learn?',
  'What is on your desk that has a story?',
  'What did you want to be as a child?',
  'Where would you go with a free week?',
  'What is a small thing that makes your day?',
  'Which film could you watch again and again?',
  'What is the best advice you have been given?',
  'Tea, coffee or neither?',
  'What is a hobby you would recommend?',
  'What song always gets you dancing?',
];

type Dilemma = { a: string; b: string };

// Each side fits a poll answer (POLL_OPTION_MAX, 60 characters).
export const WOULD_YOU_RATHER: readonly Dilemma[] = [
  { a: 'Always be ten minutes early', b: 'Always be ten minutes late' },
  { a: 'Only work from a beach', b: 'Only work from a mountain cabin' },
  { a: 'Read minds', b: 'Be invisible' },
  { a: 'Give up meetings', b: 'Give up email' },
  { a: 'Time travel to the past', b: 'Time travel to the future' },
  { a: 'Have a personal chef', b: 'Have a personal driver' },
];

// "Find someone who…": sixteen distinct prompts for a 4 x 4 card.
export const BINGO_PROMPTS: readonly string[] = [
  'Has lived in another country',
  'Speaks three languages',
  'Can juggle',
  'Has run a marathon',
  'Was born in a leap year',
  'Has a pet with a human name',
  'Plays a musical instrument',
  'Has been on TV',
  'Can name every planet in order',
  'Has never seen Star Wars',
  'Grows their own vegetables',
  'Has met someone famous',
  'Can cook a meal without a recipe',
  'Has the same birthday month as you',
  'Learned to ride a bike as an adult',
  'Has climbed a mountain',
];

type TwoTruthsPlayer = {
  initials: string;
  name: string;
  colour: string;
  // The three statements, or null for a row left for the player to write.
  statements: readonly [string, string, string] | null;
  sticky: { fillColor: string; textColor: string };
};

export const TWO_TRUTHS_PLAYERS: readonly TwoTruthsPlayer[] = [
  {
    initials: 'MC',
    name: 'Maya',
    colour: '#7c3aed',
    statements: [
      'I have climbed Ben Nevis.',
      'I once sang on live radio.',
      'I have never eaten pizza.',
    ],
    sticky: LILAC,
  },
  {
    initials: 'DP',
    name: 'Dev',
    colour: '#0891b2',
    statements: null,
    sticky: BLUE,
  },
  {
    initials: 'PN',
    name: 'Priya',
    colour: '#db2777',
    statements: null,
    sticky: PINK,
  },
];
