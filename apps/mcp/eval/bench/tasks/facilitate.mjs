// The facilitate tasks of the benchmark (docs/instructions/evaluate-mcp-output.md). Each prompt is what a user would type;
// `checks` judge what the run made from the prompt's own requirements (see checks.mjs).
import { arrows, atLeast, find, mentionsAll, shapes, sketched, tabsOf } from '../checks.mjs';

const stickies = (snap) => shapes(snap, 'sticky').filter((s) => (s.label ?? '').trim());

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
      ['a few seeded notes', ({ snap }) => atLeast(6, stickies(snap).length, 'stickies')],
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
      [
        'clustered into themes',
        ({ snap }) =>
          atLeast(3, shapes(snap, 'frame').length + shapes(snap, 'lane').length, 'theme groups'),
      ],
      [
        'the ideas sit in their themes',
        ({ snap }) => {
          const groups = [...shapes(snap, 'frame'), ...shapes(snap, 'lane')];
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
      [
        'a Q&A board',
        ({ snap }) => shapes(snap, 'qa-board').length > 0 || mentionsAll(snap, [/q\s*&\s*a/i]).pass,
      ],
      ['for the all-hands town hall', ({ snap }) => mentionsAll(snap, [/town hall|all.?hands/i])],
      [
        '5 seeded questions',
        ({ snap }) =>
          atLeast(5, stickies(snap).filter((s) => /\?/.test(s.label)).length, 'question stickies'),
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
    prompt:
      'A sketchnote summarising a talk on remote work: the big idea, three key points and a couple of quotes.',
    checks: [
      ['drawn by hand', ({ snap }) => tabsOf(snap).some(sketched)],
      ['about remote work', ({ snap }) => mentionsAll(snap, [/remote/i])],
      [
        'the big idea, three key points',
        ({ snap }) => mentionsAll(snap, [/idea/i, /1|one|first/i]),
      ],
      [
        'a couple of quotes',
        ({ snap }) =>
          atLeast(
            2,
            find(snap, /["“”]|—\s*\w|quote/i).length + shapes(snap, 'speech-bubble').length,
            'quotes',
          ),
      ],
    ],
  },
];
