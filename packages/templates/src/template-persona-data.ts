// The worked content of the User persona template (template-builders-persona.ts):
// Maya Chen, a Plateful customer, as a UX research team would hand her over.
// Pure data, kept apart from the layout so the copy can be tuned without
// touching geometry. See docs/specs/008-canvas/canvas-and-palette.md "Templates".

// A tinted section: its hue family, the deep header ink, a line-art glyph and
// the sticky paper + ink its notes are written on.
export type PersonaHue = {
  fill: string;
  stroke: string;
  header: string;
  sticky: { fill: string; text: string };
};

export type PersonaSection = PersonaHue & {
  label: string;
  hint: string;
  icon: string;
  notes: [string, string, string];
};

export const PERSONA_SECTIONS: [PersonaSection, PersonaSection, PersonaSection] = [
  {
    label: 'Goals',
    hint: 'What she is trying to get done',
    icon: 'target',
    fill: '#dcfce7',
    stroke: '#86efac',
    header: '#15803d',
    sticky: { fill: '#bbf7d0', text: '#052e16' },
    notes: [
      'Dinner sorted in under a minute',
      'Feed the kids something she feels good about',
      'Keep weeknight spend under £45',
    ],
  },
  {
    label: 'Frustrations',
    hint: 'What gets in her way today',
    icon: 'alert-triangle',
    fill: '#ffe4e6',
    stroke: '#fda4af',
    header: '#be123c',
    sticky: { fill: '#fecdd3', text: '#4c0519' },
    notes: [
      'Rebuilding the same order item by item',
      'Her usual dish quietly drops off the menu',
      'Fees that only appear at checkout',
    ],
  },
  {
    label: 'Behaviours',
    hint: 'What she actually does',
    icon: 'activity',
    fill: '#dbeafe',
    stroke: '#93c5fd',
    header: '#1d4ed8',
    sticky: { fill: '#bae6fd', text: '#082f49' },
    notes: [
      'Orders the same three meals most weeks',
      'Decides on the train home, around 5:30pm',
      'Screenshots the basket for her partner',
    ],
  },
];

// Profile facts, one glyph each, read top to bottom like a passport page.
export const PERSONA_FACTS: { icon: string; text: string }[] = [
  { icon: 'briefcase', text: '34 · Product manager, hybrid' },
  { icon: 'map-pin', text: 'Leeds, UK' },
  { icon: 'home', text: 'Partner and two kids, 6 and 9' },
  { icon: 'smartphone', text: 'iPhone · Plateful since 2023' },
];

// The numbers the research team leads with.
export const PERSONA_STATS = [
  { value: '3x', caption: 'orders a week' },
  { value: '£38', caption: 'usual basket' },
  { value: '6pm', caption: 'order time' },
];

// The shorthand the team files her under.
export const PERSONA_TAGS = ['Busy parent', 'Loyal regular', 'Mobile-first'];

export const PERSONA_QUOTE =
  '“By six I’ve made a hundred decisions. Dinner shouldn’t be one more.”';

// Personality spectrums: where she sits between two poles, 0 = left pole,
// 100 = right pole.
export const PERSONA_SPECTRUMS: { left: string; right: string; value: number }[] = [
  { left: 'Price-first', right: 'Convenience-first', value: 72 },
  { left: 'Planner', right: 'Spontaneous', value: 30 },
  { left: 'Creature of habit', right: 'Adventurous', value: 20 },
  { left: 'Cooks from scratch', right: 'Orders in', value: 64 },
];

// Where to reach her, and how she responds there.
export const PERSONA_CHANNELS: { icon: string; name: string; note: string }[] = [
  { icon: 'bell', name: 'Plateful app', note: 'Push at 5pm, taps it' },
  { icon: 'camera', name: 'Instagram', note: 'Saves recipe reels' },
  { icon: 'mail', name: 'Email', note: 'Skims Friday deals' },
];

// The needs the product has to meet, each answered by what we build.
export const PERSONA_HELP: { need: string; answer: string }[] = [
  {
    need: 'Decide in seconds',
    answer: 'A “Your usual” card on home: reorder in two taps.',
  },
  {
    need: 'Trust the total',
    answer: 'Fees and the final price shown before the first tap.',
  },
  {
    need: 'Agree it together',
    answer: 'Send the basket to her partner to approve in one tap.',
  },
];
