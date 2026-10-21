// The pages tasks of the benchmark (docs/instructions/evaluate-mcp-output.md). Each prompt is what a user would type;
// `checks` judge what the run made from the prompt's own requirements (see checks.mjs).
import { atLeast, elementsOf, find, mentionsAll, pagesOf } from '../checks.mjs';

const pagesOfKind = (snap, kind) => pagesOf(snap).filter((p) => p.kind === kind);
// The pictures placed, and the gallery the run started with (its `gallery`, seeded before the run).
const placed = (snap) => elementsOf(snap).filter((e) => e.type === 'image' && e.imageId);
const galleryIds = (snap) => new Set((snap.gallery ?? []).map((g) => g.id));
// A picture shows whole: fitted (contain, the default), or in a box of its own proportions (within 5%).
const uncropped = (snap, el) => {
  if (el.objectFit !== 'cover') return true;
  const g = (snap.gallery ?? []).find((x) => x.id === el.imageId);
  return !!g && Math.abs(el.width / el.height / (g.width / g.height) - 1) <= 0.05;
};
const onAPage = (snap, el) =>
  pagesOf(snap).some(
    (p) =>
      el.x >= p.x &&
      el.y >= p.y &&
      el.x + el.width <= p.x + p.width &&
      el.y + el.height <= p.y + p.height,
  );

export default [
  {
    id: 'I1',
    level: 'medium',
    prompt:
      'A 6-slide pitch deck for a coffee subscription startup: problem, solution, market, business model, traction, ask.',
    checks: [
      [
        '6 slides',
        ({ snap }) => ({
          pass: pagesOfKind(snap, 'slide').length === 6,
          detail: `${pagesOfKind(snap, 'slide').length} slides`,
        }),
      ],
      [
        'problem, solution, market, business model, traction, ask',
        ({ snap }) =>
          mentionsAll(snap, [
            /problem/i,
            /solution/i,
            /market/i,
            /business model|revenue|pricing/i,
            /traction/i,
            /\bask\b|raising|invest/i,
          ]),
      ],
      [
        'every slide has content',
        ({ snap }) =>
          atLeast(
            6,
            pagesOfKind(snap, 'slide').filter((p) => (p.elements ?? 0) >= 2).length,
            'slides with 2+ elements',
          ),
      ],
      ['about coffee subscriptions', ({ snap }) => mentionsAll(snap, [/coffee/i, /subscri/i])],
    ],
  },
  {
    id: 'I2',
    level: 'medium',
    prompt: 'An infographic explaining how coffee goes from farm to cup in 6 steps.',
    checks: [
      [
        'an infographic page',
        ({ snap }) => atLeast(1, pagesOfKind(snap, 'infographic').length, 'infographic pages'),
      ],
      [
        '6 steps',
        ({ snap }) =>
          atLeast(
            6,
            find(
              snap,
              /^\s*(step\s*)?[1-6]\b|farm|grow|harvest|pick|process|dry|roast|grind|brew|ship|export|cup/i,
            ).length,
            'step elements',
          ),
      ],
      [
        'from farm to cup',
        ({ snap }) =>
          mentionsAll(snap, [/farm|grow|plant/i, /harvest|pick/i, /roast/i, /brew|cup/i]),
      ],
    ],
  },
  {
    id: 'I3',
    level: 'easy',
    prompt: 'Write a one-page Q3 engineering report: highlights, metrics, risks, next quarter.',
    checks: [
      [
        'a one-page article',
        ({ snap }) => ({
          pass: pagesOfKind(snap, 'article').length === 1,
          detail: `${pagesOfKind(snap, 'article').length} article pages`,
        }),
      ],
      [
        'highlights, metrics, risks, next quarter',
        ({ snap }) => mentionsAll(snap, [/highlight/i, /metric/i, /risk/i, /next quarter|q4/i]),
      ],
      ['about Q3 engineering', ({ snap }) => mentionsAll(snap, [/q3/i, /engineering/i])],
    ],
  },
  {
    id: 'I4',
    level: 'medium',
    prompt: 'Design a logo for a bakery called Crumb & Co.',
    checks: [
      ['a logo page', ({ snap }) => atLeast(1, pagesOfKind(snap, 'logo').length, 'logo pages')],
      ['says Crumb & Co', ({ snap }) => mentionsAll(snap, [/crumb\s*(&|and)\s*co/i])],
      [
        'a mark beside the words (an icon or a shape)',
        ({ snap }) =>
          atLeast(
            2,
            pagesOf(snap)
              .filter((p) => p.kind === 'logo')
              .reduce((n, p) => n + (p.elements ?? 0), 0),
            'logo elements',
          ),
      ],
    ],
  },
  {
    id: 'I5',
    level: 'hard',
    prompt: 'A 5-panel LinkedIn carousel on 5 tips for better code review.',
    checks: [
      [
        '5 panels',
        ({ snap }) => ({
          pass: pagesOf(snap).filter((p) => p.kind !== 'article').length === 5,
          detail: `${pagesOf(snap).length} pages`,
        }),
      ],
      [
        'square panels for LinkedIn',
        ({ snap }) => ({
          pass:
            pagesOf(snap).length > 0 &&
            pagesOf(snap).every((p) => /square|1:1|4:5|portrait|carousel|linkedin/i.test(p.format)),
          detail: [...new Set(pagesOf(snap).map((p) => p.format))].join(', '),
        }),
      ],
      ['5 tips on code review', ({ snap }) => mentionsAll(snap, [/code review/i, /tip/i])],
      [
        'every panel has content',
        ({ snap }) =>
          atLeast(
            5,
            pagesOf(snap).filter((p) => (p.elements ?? 0) >= 2).length,
            'panels with 2+ elements',
          ),
      ],
    ],
  },
  {
    id: 'I6',
    level: 'medium',
    // The user's own screenshots, uploaded in the editor under the names a screenshot tool gives: which is which
    // shows only in the pictures (list_images' contact sheet).
    gallery: [
      { file: 'board.png', name: 'Screenshot 2026-10-14 at 10.12.31.png' },
      { file: 'sheet.png', name: 'Screenshot 2026-10-14 at 10.14.07.png' },
      { file: 'form.png', name: 'Screenshot 2026-10-14 at 10.15.52.png' },
    ],
    prompt:
      'Make an infographic about our product using the three screenshots I uploaded to liveplanner: the planning board, the sales sheet and the RSVP form. Give each one a short caption saying what it shows.',
    checks: [
      [
        'an infographic page',
        ({ snap }) => atLeast(1, pagesOfKind(snap, 'infographic').length, 'infographic pages'),
      ],
      [
        'every screenshot is placed',
        ({ snap }) => {
          const ids = new Set(placed(snap).map((e) => e.imageId));
          const missing = (snap.gallery ?? []).filter((g) => !ids.has(g.id));
          return {
            pass: (snap.gallery ?? []).length > 0 && missing.length === 0,
            detail: missing.length ? `not placed: ${missing.map((g) => g.name).join(', ')}` : null,
          };
        },
      ],
      [
        'only the user’s pictures',
        ({ snap }) => ({
          pass:
            placed(snap).length > 0 && placed(snap).every((e) => galleryIds(snap).has(e.imageId)),
        }),
      ],
      [
        'each shown whole',
        ({ snap }) => {
          const cropped = placed(snap).filter((e) => !uncropped(snap, e));
          return {
            pass: placed(snap).length > 0 && cropped.length === 0,
            detail: cropped.length ? `cropped: ${cropped.map((e) => e.id).join(', ')}` : null,
          };
        },
      ],
      [
        'on the page',
        ({ snap }) => ({
          pass: placed(snap).length > 0 && placed(snap).every((e) => onAPage(snap, e)),
        }),
      ],
      [
        'a caption for each',
        ({ snap }) => mentionsAll(snap, [/board|plan/i, /sheet|sales/i, /form|rsvp/i]),
      ],
    ],
  },
];
