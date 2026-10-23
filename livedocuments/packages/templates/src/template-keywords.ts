// The words people search for a template by, beyond its title and description (docs/specs/008-canvas/canvas-and-palette.md
// "Template categories", Search): other names for it and the job it does. Pure data.
import type { TemplateKind } from './templates';

const OWN_KEYWORDS: Readonly<Record<TemplateKind, readonly string[]>> = {
  // The blanks.
  blank: ['empty', 'scratch', 'new', 'canvas', 'nothing'],
  'blank-illustration': ['empty', 'page', 'infographic', 'poster', 'design'],
  'blank-slide-deck': [
    'empty',
    'slide',
    'slides',
    'deck',
    'presentation',
    'powerpoint',
    'keynote',
    'pitch',
  ],
  'blank-article': [
    'empty',
    'article',
    'document',
    'doc',
    'write',
    'writing',
    'report',
    'essay',
    'word',
  ],
  'blank-infographic': ['empty', 'infographic', 'page', 'poster', 'flyer', 'handout', 'layout'],
  'working-backwards': [
    'pr faq',
    'prfaq',
    'press release',
    'amazon',
    'six pager',
    'product proposal',
    'faq',
    'launch',
  ],
  storyboard: ['story', 'scenes', 'frames', 'film', 'video', 'ux'],
  'floor-plan': ['floorplan', 'layout', 'room', 'office', 'house', 'architecture'],
  // Presentations.
  'slide-deck': ['presentation', 'slides', 'deck', 'pitch', 'powerpoint', 'keynote'],
  article: ['article', 'project', 'document', 'doc', 'brief', 'report', 'writing', 'memo', 'blog'],
  'how-it-works': ['steps', 'explainer', 'onboarding', 'guide', 'infographic'],
  'data-story': ['infographic', 'statistics', 'numbers', 'charts', 'report'],
  'year-in-review': ['annual report', 'recap', 'wrapped', 'review', 'highlights'],
  versus: ['vs', 'compare', 'comparison', 'pros and cons', 'social post'],
  'social-carousel': ['linkedin', 'instagram', 'carousel', 'social media', 'post', 'tips'],
  'launch-keynote': [
    'presentation',
    'slides',
    'keynote',
    'launch',
    'product',
    'announcement',
    'deck',
  ],
  'quarterly-review': [
    'presentation',
    'slides',
    'qbr',
    'quarterly',
    'business review',
    'report',
    'deck',
  ],
  'team-welcome': [
    'presentation',
    'slides',
    'onboarding',
    'welcome',
    'new joiner',
    'induction',
    'deck',
  ],
  'workshop-kickoff': [
    'presentation',
    'slides',
    'workshop',
    'kickoff',
    'agenda',
    'facilitation',
    'deck',
  ],
  'event-poster': ['poster', 'flyer', 'event', 'invitation', 'promo'],
  resume: ['resume', 'cv', 'curriculum vitae', 'job', 'career'],
  'recipe-card': ['recipe', 'cooking', 'food', 'ingredients', 'menu'],
  'live-card': ['card', 'greeting', 'birthday', 'farewell', 'leaving card', 'thank you'],
};

/** The words a template is searched by. */
export function templateKeywords(kind: TemplateKind): readonly string[] {
  return OWN_KEYWORDS[kind];
}
