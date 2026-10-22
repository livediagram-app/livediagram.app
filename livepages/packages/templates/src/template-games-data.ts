// The worked content of the game boards (docs/specs/012-collaboration/game-templates.md): the icebreaker
// questions and the bingo prompts. Pure data, read by template-builders-icebreakers.ts and
// template-builders-party-games.ts.

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
