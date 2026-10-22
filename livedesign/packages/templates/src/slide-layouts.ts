// Slide layouts (docs/specs/007-editor/pages-mode.md "Slide layouts"): the layouts a slide
// page starts from, at least nine to a category. Seven built for a slide here, more in the
// category files (slide-layouts-openers.ts and its siblings, slide-layouts-pictures.ts and
// slide-layouts-designed.ts), the rest the infographic layouts
// that already set things side by side on a landscape page, filed under the slide categories. Pure builders like
// the page layouts: the slide's content box in, ordinary themed elements out, in proportions of
// the box so a 16:9 and a 4:3 slide both fit. Type is sized up for reading across a room.
import type { Element } from '@livepages/document';
import { heading, kit, type Kit, type LayoutBox } from './page-layout-kit';
import { bullets, rule, slideType } from './slide-layout-kit';
import {
  bigChartSlide,
  chartInsightsSlide,
  goalsProgressSlide,
  threeStatsSlide,
} from './slide-layouts-data';
import {
  agendaGridSlide,
  keynoteSlide,
  objectivesSlide,
  openingQuestionSlide,
  speakerSlide,
  titleImageSlide,
} from './slide-layouts-openers';
import {
  fourIdeasSlide,
  fullImageSlide,
  takeawaySlide,
  threePointsSlide,
} from './slide-layouts-content';
import {
  heroImageSlide,
  imageBandSlide,
  imageMosaicSlide,
  imageSideCardSlide,
  quoteImageSlide,
  splitImageLeftSlide,
  splitImageRightSlide,
  threeImagesSlide,
  twoImagesSlide,
} from './slide-layouts-pictures';
import {
  agendaImageSlide,
  compareCardsSlide,
  sidebarTitleSlide,
  statImageSlide,
  teamThreeSlide,
  titleOnlySlide,
} from './slide-layouts-designed';
import { milestonesSlide, nowNextLaterSlide, processFlowSlide } from './slide-layouts-steps';
import {
  callToActionSlide,
  contactSlide,
  nextStepsSlide,
  questionsSlide,
  resourcesSlide,
  summarySlide,
  thanksImageSlide,
} from './slide-layouts-closers';

export { slideType } from './slide-layout-kit';
import { PAGE_LAYOUTS, type PageLayout, type PageLayoutId } from './page-layouts';

export type SlideLayoutId =
  | 'slide-title'
  | 'slide-section'
  | 'slide-bullets'
  | 'slide-two-columns'
  | 'slide-image-text'
  | 'slide-statement'
  | 'slide-closing'
  | 'slide-title-image'
  | 'slide-keynote'
  | 'slide-question'
  | 'slide-speaker'
  | 'slide-objectives'
  | 'slide-agenda-grid'
  | 'slide-three-points'
  | 'slide-full-image'
  | 'slide-takeaway'
  | 'slide-four-ideas'
  | 'slide-three-stats'
  | 'slide-big-chart'
  | 'slide-chart-insights'
  | 'slide-goals'
  | 'slide-process-flow'
  | 'slide-milestones'
  | 'slide-now-next-later'
  | 'slide-summary'
  | 'slide-cta'
  | 'slide-next-steps'
  | 'slide-contact'
  | 'slide-questions'
  | 'slide-thanks-image'
  | 'slide-resources'
  | 'slide-split-image-right'
  | 'slide-split-image-left'
  | 'slide-image-band'
  | 'slide-hero-image'
  | 'slide-image-side-card'
  | 'slide-three-images'
  | 'slide-two-images'
  | 'slide-image-mosaic'
  | 'slide-quote-image'
  | 'slide-agenda-image'
  | 'slide-sidebar-title'
  | 'slide-compare-cards'
  | 'slide-title-only'
  | 'slide-stat-image'
  | 'slide-team-three';

type SlideLayoutCategoryId =
  | 'slide-openers'
  | 'slide-content'
  | 'slide-pictures'
  | 'slide-data'
  | 'slide-steps'
  | 'slide-closers';

export const SLIDE_LAYOUT_CATEGORIES: readonly { id: SlideLayoutCategoryId; label: string }[] = [
  { id: 'slide-openers', label: 'Openers' },
  { id: 'slide-content', label: 'Content' },
  { id: 'slide-pictures', label: 'Pictures' },
  { id: 'slide-data', label: 'Data' },
  { id: 'slide-steps', label: 'Steps and Time' },
  { id: 'slide-closers', label: 'Closers' },
];

function titleSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const top = H * 0.26;
  return [
    k.title(0, top, W * 0.85, u * 18, 'Your presentation title'),
    rule(k, 0, top + u * 21),
    k.text(
      0,
      top + u * 25,
      W * 0.75,
      u * 12,
      'A subtitle that sets up the story',
      slideType(k, 5.4),
    ),
    k.text(0, H - u * 7, W * 0.6, u * 7, 'Presenter name · October 2026', {
      ...slideType(k, 3.2),
      textAlignY: 'bottom',
    }),
  ];
}

function sectionSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const top = H * 0.2;
  return [
    k.title(0, top, W * 0.3, u * 26, '01'),
    rule(k, 0, top + u * 29),
    k.title(0, top + u * 33, W * 0.8, u * 13, 'Section title'),
    k.text(0, top + u * 49, W * 0.7, u * 10, 'One line on what this section covers.', slideType(k)),
  ];
}

function bulletsSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const head = heading(k, 'Slide title');
  return [
    ...head.els,
    ...bullets(k, 0, head.top, W * 0.9, H - head.top, [
      'Lead with the point you most want remembered',
      'Keep each line to a single idea',
      'Back it with a number or an example',
      'Say what changes because of it',
      'End on what you need from the room',
    ]),
  ];
}

function twoColumnsSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Two sides of the story');
  const gap = u * 8;
  const colW = (W - gap) / 2;
  const column = (x: number, title: string, lines: string[]) => [
    k.text(x, head.top, colW, u * 9, title, { ...slideType(k, 5), textBold: true }),
    ...bullets(k, x, head.top + u * 12, colW, H - head.top - u * 12, lines),
  ];
  return [
    ...head.els,
    ...column(0, 'Today', ['Where we stand', 'What holds us back', 'What it costs']),
    ...column(colW + gap, 'Tomorrow', ['Where we are going', 'What unlocks it', 'What it earns']),
  ];
}

function imageTextSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const imageW = W * 0.46;
  const x = imageW + u * 8;
  const w = W - x;
  return [
    k.image(0, 0, imageW, H),
    k.title(x, H * 0.08, w, u * 11, 'The picture says it'),
    k.text(
      x,
      H * 0.08 + u * 14,
      w,
      u * 14,
      'One line on what to notice in the image.',
      slideType(k),
    ),
    ...bullets(k, x, H * 0.08 + u * 32, w, H * 0.92 - u * 32, [
      'A first detail',
      'A second detail',
      'What it means',
    ]),
  ];
}

function statementSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const textH = H * 0.42;
  const top = (H - textH - u * 14) / 2;
  return [
    // A short accent rule, centred, over the statement.
    rule(k, (W - u * 14) / 2, Math.max(0, top - u * 6)),
    k.text(W * 0.06, top, W * 0.88, textH, 'One sentence that changes how the room sees it.', {
      ...slideType(k, 9),
      textBold: true,
      textAlignX: 'center',
      textAlignY: 'middle',
    }),
    k.text(W * 0.15, top + textH + u * 4, W * 0.7, u * 10, 'The line that backs it up.', {
      ...slideType(k),
      textAlignX: 'center',
    }),
  ];
}

function closingSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const top = H * 0.24;
  return [
    k.title(0, top, W * 0.7, u * 22, 'Thank you'),
    rule(k, 0, top + u * 25),
    k.text(0, top + u * 29, W * 0.7, u * 11, 'Questions?', { ...slideType(k, 6), textBold: true }),
    k.text(0, H - u * 7, W * 0.7, u * 7, 'your.name@example.com · example.com', {
      ...slideType(k, 3.2),
      textAlignY: 'bottom',
    }),
  ];
}

type SlideLayout = Omit<PageLayout, 'id' | 'category'> & {
  id: PageLayoutId;
  category: SlideLayoutCategoryId;
};

const own = (
  id: SlideLayoutId,
  category: SlideLayoutCategoryId,
  label: string,
  description: string,
  build: (k: Kit) => Element[],
): SlideLayout => ({ id, category, label, description, build: (b: LayoutBox) => build(kit(b)) });

// An infographic layout filed under a slide category: the same layout, the same build.
const reused = (id: PageLayoutId, category: SlideLayoutCategoryId): SlideLayout => ({
  ...PAGE_LAYOUTS.find((l) => l.id === id)!,
  category,
});

export const SLIDE_LAYOUTS: readonly SlideLayout[] = [
  own(
    'slide-title',
    'slide-openers',
    'Title Slide',
    'A large title, a subtitle and the presenter',
    titleSlide,
  ),
  own(
    'slide-section',
    'slide-openers',
    'Section Header',
    'A section number, its title and a line',
    sectionSlide,
  ),
  reused('agenda', 'slide-openers'),
  own(
    'slide-title-image',
    'slide-openers',
    'Title and Image',
    'A title and subtitle beside a full-height picture',
    titleImageSlide,
  ),
  own(
    'slide-keynote',
    'slide-openers',
    'Keynote Title',
    'A large title, centred, over the event',
    keynoteSlide,
  ),
  own(
    'slide-question',
    'slide-openers',
    'Opening Question',
    'One question set large to open the talk',
    openingQuestionSlide,
  ),
  own(
    'slide-speaker',
    'slide-openers',
    'About the Speaker',
    'A round photo, name, role and three facts',
    speakerSlide,
  ),
  own(
    'slide-objectives',
    'slide-openers',
    'Objectives',
    'Three numbered cards: what the room will leave with',
    objectivesSlide,
  ),
  own(
    'slide-agenda-grid',
    'slide-openers',
    'Agenda Grid',
    'Four numbered parts on cards, each with its time',
    agendaGridSlide,
  ),
  own(
    'slide-agenda-image',
    'slide-openers',
    'Agenda and Image',
    'A picture down the left edge, four numbered parts beside it',
    agendaImageSlide,
  ),
  own(
    'slide-bullets',
    'slide-content',
    'Title and Bullets',
    'A title over five bullet points',
    bulletsSlide,
  ),
  own(
    'slide-two-columns',
    'slide-content',
    'Two Columns',
    'A title over two columns of bullet points',
    twoColumnsSlide,
  ),
  own(
    'slide-image-text',
    'slide-content',
    'Image and Text',
    'An image on the left, a title and points on the right',
    imageTextSlide,
  ),
  own(
    'slide-statement',
    'slide-content',
    'Statement',
    'One sentence set very large, and a line under it',
    statementSlide,
  ),
  reused('quote', 'slide-content'),
  own(
    'slide-three-points',
    'slide-content',
    'Three Points',
    'Three icons, each with a heading and a line',
    threePointsSlide,
  ),
  own(
    'slide-full-image',
    'slide-content',
    'Full Image',
    'A picture filling the slide under a caption card',
    fullImageSlide,
  ),
  own(
    'slide-takeaway',
    'slide-content',
    'Key Takeaway',
    'The one thing to remember on a card, and why',
    takeawaySlide,
  ),
  own(
    'slide-four-ideas',
    'slide-content',
    'Four Ideas',
    'Four cards, two by two, each an icon and a line',
    fourIdeasSlide,
  ),
  own(
    'slide-title-only',
    'slide-content',
    'Title Only',
    'A title and a lead line, the rest of the slide yours',
    titleOnlySlide,
  ),
  own(
    'slide-sidebar-title',
    'slide-content',
    'Sidebar Title',
    'A panel down the left edge holding the title, five points beside it',
    sidebarTitleSlide,
  ),
  own(
    'slide-compare-cards',
    'slide-content',
    'Compare Two',
    'Two options on cards side by side, a "vs" between',
    compareCardsSlide,
  ),
  own(
    'slide-split-image-right',
    'slide-pictures',
    'Text and Picture',
    'Words on the left, a picture filling the right half to the edges',
    splitImageRightSlide,
  ),
  own(
    'slide-split-image-left',
    'slide-pictures',
    'Picture and Text',
    'A picture filling the left to the edges, words on the right',
    splitImageLeftSlide,
  ),
  own(
    'slide-hero-image',
    'slide-pictures',
    'Hero Picture',
    'A picture filling the slide, darkened, a large title over it',
    heroImageSlide,
  ),
  own(
    'slide-image-band',
    'slide-pictures',
    'Picture Band',
    'A picture across the top edge, a title and a paragraph under it',
    imageBandSlide,
  ),
  own(
    'slide-image-side-card',
    'slide-pictures',
    'Picture and Card',
    'A picture filling the slide, a card of points on its right',
    imageSideCardSlide,
  ),
  own(
    'slide-quote-image',
    'slide-pictures',
    'Quote and Picture',
    'A quote and who said it, a picture filling the right',
    quoteImageSlide,
  ),
  own(
    'slide-two-images',
    'slide-pictures',
    'Two Pictures',
    'Two pictures side by side, a caption under each',
    twoImagesSlide,
  ),
  own(
    'slide-three-images',
    'slide-pictures',
    'Three Pictures',
    'Three pictures side by side, a caption under each',
    threeImagesSlide,
  ),
  own(
    'slide-image-mosaic',
    'slide-pictures',
    'Picture Mosaic',
    'A title beside one large picture and two small ones',
    imageMosaicSlide,
  ),
  reused('big-number', 'slide-data'),
  own(
    'slide-stat-image',
    'slide-data',
    'Number and Picture',
    'A picture down the left edge, one large figure beside it',
    statImageSlide,
  ),
  reused('key-stats', 'slide-data'),
  reused('chart-story', 'slide-data'),
  reused('comparison', 'slide-data'),
  own(
    'slide-three-stats',
    'slide-data',
    'Three Big Numbers',
    'Three figures across, a caption and note under each',
    threeStatsSlide,
  ),
  own(
    'slide-big-chart',
    'slide-data',
    'Big Chart',
    'A full-height bar chart and its headline figure',
    bigChartSlide,
  ),
  own(
    'slide-chart-insights',
    'slide-data',
    'Chart and Insights',
    'A trend beside three numbered insights',
    chartInsightsSlide,
  ),
  own(
    'slide-goals',
    'slide-data',
    'Goals Progress',
    'Three progress rings against their targets',
    goalsProgressSlide,
  ),
  reused('kpi-dashboard', 'slide-data'),
  reused('market-share', 'slide-data'),
  reused('process', 'slide-steps'),
  reused('timeline', 'slide-steps'),
  reused('roadmap', 'slide-steps'),
  own(
    'slide-process-flow',
    'slide-steps',
    'Process Flow',
    'Four steps as pills joined by arrows, a note under each',
    processFlowSlide,
  ),
  own(
    'slide-milestones',
    'slide-steps',
    'Milestones',
    'Five years along a rail, what happened under each',
    milestonesSlide,
  ),
  own(
    'slide-now-next-later',
    'slide-steps',
    'Now, Next, Later',
    'A roadmap in three columns of cards',
    nowNextLaterSlide,
  ),
  reused('funnel', 'slide-steps'),
  reused('cycle', 'slide-steps'),
  reused('project-plan', 'slide-steps'),
  own(
    'slide-closing',
    'slide-closers',
    'Thank You',
    'A thank you, a call for questions and a contact line',
    closingSlide,
  ),
  reused('team', 'slide-closers'),
  own(
    'slide-team-three',
    'slide-closers',
    'Team of Three',
    'Three round photos, each a name, a role and a line',
    teamThreeSlide,
  ),
  own(
    'slide-summary',
    'slide-closers',
    'Summary',
    'Three numbered takeaways to end on',
    summarySlide,
  ),
  own(
    'slide-cta',
    'slide-closers',
    'Call to Action',
    'One bold ask, a button and where to start',
    callToActionSlide,
  ),
  own(
    'slide-next-steps',
    'slide-closers',
    'Next Steps',
    'Four actions with who owns each and by when',
    nextStepsSlide,
  ),
  own(
    'slide-contact',
    'slide-closers',
    'Contact',
    'A round photo, name and where to find them',
    contactSlide,
  ),
  own(
    'slide-questions',
    'slide-closers',
    'Questions',
    'Questions set large under an icon',
    questionsSlide,
  ),
  own(
    'slide-thanks-image',
    'slide-closers',
    'Thank You and Image',
    'A thank you beside a full-height picture',
    thanksImageSlide,
  ),
  own(
    'slide-resources',
    'slide-closers',
    'Resources',
    'Four links to read further, each with an icon',
    resourcesSlide,
  ),
];
