// The words of the Résumé template (template-builders-resume.ts): a made-up product designer's
// one-page CV, specific enough that the user edits it rather than invents it. Pure data.

export const NAME = 'Maya Lindqvist';
export const ROLE = 'Senior Product Designer';

export const CONTACTS = [
  { iconId: 'mail', text: 'maya@lindqvist.design' },
  { iconId: 'phone', text: '+44 7700 900418' },
  { iconId: 'map-pin', text: 'Bristol, UK' },
  { iconId: 'globe', text: 'lindqvist.design' },
] as const;

export const PROFILE =
  'Product designer with nine years of turning messy problems into calm, usable products. I lead discovery, prototype fast and stay close to engineering until it ships. Happiest on small teams that talk to their users every week.';

// Each role's achievements, and how many lines they take at the column's width (the builder
// sizes each block from it).
export const ROLES = [
  {
    title: 'Lead Product Designer',
    company: 'Tidewater Labs',
    dates: '2022 to now',
    points: [
      'Redesigned the booking flow, lifting completed bookings by 31%.',
      'Built the design system four product teams now ship with.',
      'Hire and mentor a team of five designers.',
    ],
    lines: 5,
  },
  {
    title: 'Senior Product Designer',
    company: 'Kestrel Bank',
    dates: '2019 to 2022',
    points: [
      'Designed the first mobile app, rated 4.8 by 200,000 customers.',
      'Ran weekly research sessions with small-business owners.',
    ],
    lines: 4,
  },
  {
    title: 'Product Designer',
    company: 'Northwind Travel',
    dates: '2016 to 2019',
    points: [
      'Shipped the trip planner 1.2 million travellers use a year.',
      'Brought usability testing into every release.',
    ],
    lines: 4,
  },
] as const;

export const SKILLS = [
  'User research',
  'Figma',
  'Prototyping',
  'Motion',
  'Design systems',
  'Accessibility',
  'Workshops',
] as const;

export const EDUCATION = [
  { course: 'MA Interaction Design', school: 'Royal College of Art', year: '2016' },
  { course: 'BA Graphic Design', school: 'University of the West of England', year: '2014' },
] as const;

export const LANGUAGES: readonly (readonly [string, string])[] = [
  ['English', 'Fluent'],
  ['Swedish', 'Native'],
  ['Spanish', 'Conversational'],
];

export const INTERESTS = 'Sea swimming, risograph printing and a very slow sourdough habit.';
