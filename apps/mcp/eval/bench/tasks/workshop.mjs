// The workshop tasks of the benchmark (docs/instructions/evaluate-mcp-output.md). Each prompt is what a user would type;
// `checks` judge what the run made from the prompt's own requirements (see checks.mjs).
import {
  arrows,
  atLeast,
  elementsFor,
  itemsOf,
  mentionsAll,
  shapes,
  sketched,
  tabsOf,
} from '../checks.mjs';

const stickies = (snap) => shapes(snap, 'sticky').filter((s) => (s.label ?? '').trim());
// The containers a cluster can sit in.
const themes = (snap) => ['frame', 'lane', 'boundary'].flatMap((k) => shapes(snap, k));
// A note people add to a board: a sticky on the canvas, or a card on a Plan board (a retro's own way).
const notes = (snap) => [
  ...stickies(snap).map((s) => s.label),
  ...itemsOf(snap).map((i) => i.title ?? ''),
];

export default [
  {
    id: 'F1',
    level: 'easy',
    prompt: 'Set up a retro for sprint 14 with a few seeded notes in each column.',
    checks: [
      ['a retro for sprint 14', ({ snap }) => mentionsAll(snap, [/retro/i, /sprint\s*14/i])],
      [
        'columns to sort notes into',
        ({ snap }) =>
          mentionsAll(snap, [/well|keep|liked|glad/i, /improve|better|wrong|stop|sad|lacked/i]),
      ],
      ['a few seeded notes', ({ snap }) => atLeast(6, notes(snap).length, 'notes')],
    ],
  },
  {
    id: 'F2',
    level: 'medium',
    prompt:
      'A workshop kickoff board for a 2-hour product discovery session with agenda, goals, ground rules and an icebreaker.',
    checks: [
      [
        'agenda, goals, ground rules and an icebreaker',
        ({ snap }) =>
          mentionsAll(snap, [
            /agenda/i,
            /goal/i,
            /ground rules|norms|working agreement/i,
            /icebreaker|warm.?up/i,
          ]),
      ],
      ['a product discovery session', ({ snap }) => mentionsAll(snap, [/discovery/i])],
      [
        'the agenda fits two hours',
        ({ snap }) => mentionsAll(snap, [/\d+\s*(min|mins|minutes)|\d{1,2}[:.]\d{2}/i]),
      ],
    ],
  },
  {
    id: 'F3',
    level: 'medium',
    prompt:
      "A brainstorm board on 'how to reduce churn' with 15 sticky ideas clustered into themes.",
    checks: [
      ['about reducing churn', ({ snap }) => mentionsAll(snap, [/churn/i])],
      ['15 sticky ideas', ({ snap }) => atLeast(15, stickies(snap).length, 'stickies')],
      ['clustered into themes', ({ snap }) => atLeast(3, themes(snap).length, 'theme groups')],
      [
        'the ideas sit in their themes',
        ({ snap }) => {
          const groups = themes(snap);
          const inGroup = stickies(snap).filter((s) =>
            groups.some(
              (g) =>
                s.x >= g.x &&
                s.y >= g.y &&
                s.x + (s.width ?? 0) <= g.x + g.width &&
                s.y + (s.height ?? 0) <= g.y + g.height,
            ),
          );
          return atLeast(12, inGroup.length, 'stickies inside a theme');
        },
      ],
    ],
  },
  {
    id: 'F4',
    level: 'easy',
    prompt: 'A town hall Q&A board for our all-hands with 5 seeded questions.',
    checks: [
      ['a Q&A board', ({ snap }) => mentionsAll(snap, [/q\s*&\s*a/i])],
      ['for the all-hands town hall', ({ snap }) => mentionsAll(snap, [/town hall|all.?hands/i])],
      [
        '5 seeded questions',
        ({ snap }) => atLeast(5, notes(snap).filter((n) => /\?/.test(n)).length, 'questions'),
      ],
    ],
  },
  {
    id: 'W1',
    level: 'medium',
    prompt:
      'Sketch a hand-drawn whiteboard of our customer onboarding flow, like someone drew it in a meeting.',
    checks: [
      ['drawn by hand', ({ snap }) => tabsOf(snap).some(sketched)],
      ['the onboarding flow', ({ snap }) => mentionsAll(snap, [/onboard|sign.?up|welcome/i])],
      ['steps joined by arrows', ({ snap }) => atLeast(4, arrows(snap).length, 'arrows')],
    ],
  },
  {
    id: 'W2',
    level: 'medium',
    // Every fact the sketchnote needs is in the prompt: an assistant rightly declines to invent a real talk's quotes.
    prompt:
      "Make a sketchnote of a talk I went to on remote work. The big idea: async-first beats office-first. Three key points: write things down, overlap hours on purpose, and measure outcomes not hours. Two quotes I liked: 'Meetings are the exception, not the default' and 'Trust is built in writing'.",
    checks: [
      ['drawn by hand', ({ snap }) => tabsOf(snap).some(sketched)],
      ['the big idea', ({ snap }) => mentionsAll(snap, [/async/i])],
      [
        'the three key points',
        ({ snap }) => elementsFor(snap, [/write|writing it down/i, /overlap/i, /outcome/i]),
      ],
      [
        'both quotes, in their words',
        ({ snap }) =>
          mentionsAll(snap, [/exception, not the default/i, /trust is built in writing/i]),
      ],
    ],
  },
];
