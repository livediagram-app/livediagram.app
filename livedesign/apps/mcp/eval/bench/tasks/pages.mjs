// The pages tasks of the benchmark (docs/instructions/evaluate-mcp-output.md). Each prompt is what a user would type;
// `checks` judge what the run made from the prompt's own requirements (see checks.mjs).
import { atLeast, elementsOf, mentionsAll, pagesOf } from '../checks.mjs';

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
      'Wireframe the 5 onboarding screens of a coffee subscription app: welcome, sign up, pick your roast, delivery schedule, payment.',
    checks: [
      [
        '5 screens',
        ({ snap }) => ({
          pass: pagesOfKind(snap, 'wireframe').length === 5,
          detail: `${pagesOfKind(snap, 'wireframe').length} wireframe pages`,
        }),
      ],
      [
        'welcome, sign up, roast, delivery, payment',
        ({ snap }) =>
          mentionsAll(snap, [/welcome/i, /sign up|create account/i, /roast/i, /deliver/i, /pay/i]),
      ],
      [
        'every screen has content',
        ({ snap }) =>
          atLeast(
            5,
            pagesOfKind(snap, 'wireframe').filter((p) => (p.elements ?? 0) >= 2).length,
            'screens with 2+ elements',
          ),
      ],
      ['about coffee subscriptions', ({ snap }) => mentionsAll(snap, [/coffee/i, /subscri/i])],
    ],
  },
  {
    id: 'I3',
    level: 'easy',
    prompt: 'Wireframe the sign-in screen of a mobile banking app.',
    checks: [
      [
        'one phone wireframe',
        ({ snap }) => ({
          pass: pagesOfKind(snap, 'wireframe').length === 1,
          detail: `${pagesOfKind(snap, 'wireframe').length} wireframe pages`,
        }),
      ],
      [
        'an email or username, a password and a sign-in button',
        ({ snap }) => mentionsAll(snap, [/email|username/i, /password/i, /sign in|log in/i]),
      ],
      ['about banking', ({ snap }) => mentionsAll(snap, [/bank/i])],
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
      'Wireframe a landing page for our product that shows the three screenshots I uploaded to livedesign: the planning board, the sales sheet and the RSVP form. Give each one a short caption saying what it shows.',
    checks: [
      [
        'a wireframe page',
        ({ snap }) => atLeast(1, pagesOfKind(snap, 'wireframe').length, 'wireframe pages'),
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
