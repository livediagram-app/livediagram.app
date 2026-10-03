// Further page layouts (docs/specs/007-editor/infographic-pages.md "Layouts"): a section divider, a
// poster, survey results, a progress report, a roadmap, an agenda, questions and answers, and a
// profile. Same contract as page-layouts.ts: the page's content box in, uncoloured elements out, a
// tall page stacking and a wide one setting side by side.
import type { Element } from '@livediagram/document';
import { heading, kit, type Kit, type LayoutBox } from './page-layout-kit';

function sectionDivider(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const numberH = k.wide ? H * 0.34 : H * 0.22;
  const top = (H - numberH - u * 40) / 2;
  return [
    k.title(0, top, W * 0.5, numberH, '01'),
    k.shape('square', 0, top + numberH + u * 4, u * 14, u * 1.2, {
      label: '',
      borderRadius: 'full',
    }),
    k.title(0, top + numberH + u * 9, W, u * 14, 'Section title'),
    k.text(0, top + numberH + u * 26, W * 0.8, u * 14, 'A line on what this part covers.', {
      textSize: 'lg',
    }),
  ];
}

function poster(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const lines = (x: number, y: number, w: number) => [
    k.title(x, y, w, u * 16, 'Make it bold'),
    k.text(x, y + u * 18, w, u * 16, 'One line that makes people stop and look twice.', {
      textSize: 'lg',
    }),
    k.text(x, H - u * 6, w, u * 6, 'livediagram.app · 2026', { textBold: true }),
  ];
  if (k.wide) {
    const imgW = W * 0.55;
    return [k.image(0, 0, imgW, H), ...lines(imgW + u * 6, H * 0.3, W - imgW - u * 6)];
  }
  return [k.image(0, 0, W, H * 0.58), ...lines(0, H * 0.62, W)];
}

const ANSWERS = [
  { label: 'Every day', value: 46 },
  { label: 'Weekly', value: 31 },
  { label: 'Monthly', value: 15 },
  { label: 'Rarely', value: 8 },
];

function surveyResults(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'What people told us', 'Answers from 1,200 people.');
  const foot = u * 9;
  const avail = H - head.top - foot;
  const pie = (x: number, y: number, w: number, h: number) =>
    k.shape('pie-chart', x, y, w, h, {
      pieSlices: ANSWERS.map((a) => ({ ...a })),
      chartLegend: true,
      chartLegendPosition: 'right',
    });
  const source = k.text(0, H - u * 6, W, u * 6, 'Source: say who you asked, and when.');
  const figures: [string, string][] = [
    ['77%', 'weekly users'],
    ['1,200', 'people answered'],
    ['4.6', 'average rating'],
  ];
  if (k.wide) {
    const pieW = W * 0.56;
    const colX = pieW + u * 6;
    const rowH = avail / figures.length;
    return [
      ...head.els,
      pie(0, head.top, pieW, avail),
      ...figures.flatMap(([figure, caption], i) => [
        k.title(colX, head.top + i * rowH, W - colX, rowH * 0.55, figure),
        k.text(colX, head.top + i * rowH + rowH * 0.58, W - colX, u * 7, caption),
      ]),
      source,
    ];
  }
  const pieH = avail * 0.58;
  return [
    ...head.els,
    pie(0, head.top, W, pieH),
    k.shape('stat-row', 0, head.top + pieH + u * 6, W, Math.min(u * 20, avail - pieH - u * 6), {
      borderRadius: 'md',
      stats: figures.map(([value, caption]) => ({ value, caption })),
    }),
    source,
  ];
}

const GOALS = [
  ['New customers', 82],
  ['Revenue target', 64],
  ['Support response', 91],
  ['Product launches', 40],
] as const;

function progressReport(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Where we are', "Progress against this year's goals.");
  const foot = u * 9;
  const rowH = Math.min(u * 26, (H - head.top - foot) / GOALS.length);
  return [
    ...head.els,
    ...GOALS.flatMap(([goal, pct], i) => {
      const y = head.top + i * rowH;
      return [
        k.text(0, y, W * 0.7, u * 8, goal, { textSize: 'lg', textBold: true }),
        k.text(W * 0.7, y, W * 0.3, u * 8, `${pct}%`, { textSize: 'lg', textAlignX: 'right' }),
        k.shape('progress-bar', 0, y + u * 10, W, u * 5, { progress: pct }),
      ];
    }),
    k.text(0, H - u * 6, W, u * 6, 'Updated every Monday.'),
  ];
}

const ROADMAP = [
  ['Now', ['Faster sign-up', 'Dark mode', 'Team billing']],
  ['Next', ['Mobile app', 'Templates library', 'Single sign-on']],
  ['Later', ['Offline mode', 'Public API', 'Integrations']],
] as const;

function roadmap(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Roadmap', 'What we are working on, and what comes after.');
  const gap = u * 4;
  const colW = (W - gap * 2) / 3;
  const headerH = u * 12;
  const cardsTop = head.top + headerH + u * 4;
  const cardH = Math.min(u * 22, (H - cardsTop) / 3 - u * 4);
  return [
    ...head.els,
    ...ROADMAP.flatMap(([stage, items], c) => {
      const x = c * (colW + gap);
      return [
        k.shape('square', x, head.top, colW, headerH, {
          label: stage,
          textBold: true,
          textSize: 'lg',
          borderRadius: 'md',
        }),
        ...items.map((item, r) =>
          k.shape('square', x, cardsTop + r * (cardH + u * 4), colW, cardH, {
            label: item,
            borderRadius: 'md',
          }),
        ),
      ];
    }),
  ];
}

const AGENDA = [
  ['09:00', 'Welcome', 'Coffee and introductions.'],
  ['09:30', 'Where we are', 'The year so far, in numbers.'],
  ['10:30', 'Break', 'Fifteen minutes.'],
  ['10:45', 'Workshops', 'Three rooms, pick one.'],
  ['12:30', 'Lunch', 'In the garden, weather allowing.'],
  ['13:30', 'What is next', 'Plans and questions.'],
] as const;

function agenda(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Agenda', 'Saturday 14 November');
  // A page not clearly taller than wide runs the day in two columns of three.
  const cols = W >= H * 0.9 ? 2 : 1;
  const gap = u * 6;
  const colW = (W - gap * (cols - 1)) / cols;
  const perCol = Math.ceil(AGENDA.length / cols);
  const rowH = (H - head.top) / perCol;
  const timeW = colW * (cols > 1 ? 0.3 : 0.22);
  return [
    ...head.els,
    ...AGENDA.flatMap(([time, item, note], i) => {
      const x = Math.floor(i / perCol) * (colW + gap);
      const y = head.top + (i % perCol) * rowH;
      return [
        k.text(x, y, timeW, u * 8, time, { textSize: 'lg', textBold: true }),
        k.text(x + timeW, y, colW - timeW, u * 8, item, { textSize: 'lg' }),
        k.text(x + timeW, y + u * 9, colW - timeW, Math.max(u * 5, rowH - u * 11), note),
      ];
    }),
  ];
}

const FAQ = [
  ['Who is it for?', 'Anyone who needs to explain something on one page.'],
  ['How long does it take?', 'Most pages come together in under ten minutes.'],
  ['Can I share it?', 'Export a PDF or an image, or present it as slides.'],
  ['Does it cost anything?', 'No. Every feature is free for everyone.'],
] as const;

function questions(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Questions and answers');
  const rowH = (H - head.top) / FAQ.length;
  return [
    ...head.els,
    ...FAQ.flatMap(([q, a], i) => {
      const y = head.top + i * rowH;
      return [
        k.text(0, y, W, u * 8, q, { textSize: 'lg', textBold: true }),
        k.text(0, y + u * 9, W, Math.max(u * 8, rowH - u * 12), a, { textSize: 'lg' }),
      ];
    }),
  ];
}

function profile(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const d = Math.min(u * 40, (k.wide ? H : W) * 0.4);
  const stats = (y: number, x = 0, w = W) =>
    k.shape('stat-row', x, y, w, u * 20, {
      borderRadius: 'md',
      stats: [
        { value: '12', caption: 'Years in design' },
        { value: '40+', caption: 'Products shipped' },
        { value: '3', caption: 'Countries' },
      ],
    });
  const bio = 'Two or three lines on who this person is, what they do and what they care about.';
  if (k.wide) {
    const x = d + u * 8;
    return [
      { ...k.image(0, (H - d) / 2, d, d), borderRadius: 'full', aspectLocked: true },
      k.title(x, H * 0.12, W - x, u * 14, 'Alex Morgan'),
      k.text(x, H * 0.12 + u * 15, W - x, u * 8, 'Head of Product, Acme', { textSize: 'lg' }),
      k.text(x, H * 0.12 + u * 26, W - x, u * 20, bio),
      stats(H - u * 20, x, W - x),
    ] as Element[];
  }
  return [
    { ...k.image((W - d) / 2, 0, d, d), borderRadius: 'full', aspectLocked: true },
    k.title(0, d + u * 6, W, u * 14, 'Alex Morgan'),
    k.text(0, d + u * 21, W, u * 8, 'Head of Product, Acme', { textSize: 'lg' }),
    k.text(0, d + u * 32, W, u * 24, bio, { textSize: 'lg' }),
    stats(H - u * 20),
  ] as Element[];
}

export const buildSectionDivider = (b: LayoutBox) => sectionDivider(kit(b));
export const buildPoster = (b: LayoutBox) => poster(kit(b));
export const buildSurveyResults = (b: LayoutBox) => surveyResults(kit(b));
export const buildProgressReport = (b: LayoutBox) => progressReport(kit(b));
export const buildRoadmap = (b: LayoutBox) => roadmap(kit(b));
export const buildAgenda = (b: LayoutBox) => agenda(kit(b));
export const buildQuestions = (b: LayoutBox) => questions(kit(b));
export const buildProfile = (b: LayoutBox) => profile(kit(b));
