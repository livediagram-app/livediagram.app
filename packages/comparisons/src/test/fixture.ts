import type { Alternative, Comparisons } from '../types';

// A small, sound list for the package's own tests, in the shape an app writes.
export function alternative(slug: string, name: string): Alternative {
  return {
    slug,
    name,
    title: `${name} alternative · testapp`,
    description: `An honest, side-by-side comparison of testapp with ${name}, including where each is the better pick.`,
    h1: `The free ${name} alternative`,
    lede: `${name} is a fine tool. testapp is smaller.`,
    highlights: ['Free, no tiers', 'No sign-up', 'Open source'],
    rows: [{ label: 'Price', us: 'Free', them: 'Paid plans' }],
    themBest: [`${name} has a larger community.`],
    usBest: ['Live by default.'],
    sections: [{ heading: 'Working together', paragraphs: ['Everyone edits at once.'] }],
    faqs: [{ q: `Is testapp a ${name} alternative?`, a: 'For many teams, yes.' }],
  };
}

export function comparisons(overrides: Partial<Comparisons> = {}): Comparisons {
  return {
    app: 'testapp',
    siteUrl: 'https://testapp.example',
    updated: new Date('2026-10-23'),
    hub: {
      title: 'How testapp compares · alternatives',
      description:
        'Honest, side-by-side comparisons of testapp with Miro and Trello, including where each is the better pick.',
      heading: 'How testapp compares',
      lede: 'Thinking about another tool?',
    },
    alternatives: [
      alternative('miro', 'Miro'),
      alternative('trello', 'Trello'),
      alternative('figma', 'Figma'),
      alternative('jira', 'Jira'),
    ],
    ...overrides,
  };
}
