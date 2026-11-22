// The Explainers layouts (docs/specs/007-editor/pages-mode.md "Layouts"), category
// 'explainers': pages that teach or explain one thing. Pure builders on the shared kit
// (page-layout-kit.ts), laid out in proportions of the page's content box so each fits every size
// and orientation, in the tab's theme. The builders live in three files by kind: diagrams,
// reference sheets and lessons.
import type { PageLayout } from './page-layouts';
import {
  buildAnatomy,
  buildHowItWorks,
  buildKeyConcepts,
} from './page-layouts-set-explainers-diagrams';
import {
  buildFactFile,
  buildFormula,
  buildLessonSummary,
} from './page-layouts-set-explainers-lessons';
import {
  buildCheatSheet,
  buildGlossary,
  buildMythsFacts,
} from './page-layouts-set-explainers-reference';

export type ExplainersSetLayoutId =
  | 'explain-how-it-works'
  | 'explain-anatomy'
  | 'explain-key-concepts'
  | 'explain-cheat-sheet'
  | 'explain-glossary'
  | 'explain-myths-facts'
  | 'explain-fact-file'
  | 'explain-lesson-summary'
  | 'explain-formula';

export const EXPLAINERS_SET_LAYOUTS: readonly PageLayout[] = [
  {
    id: 'explain-how-it-works',
    category: 'explainers',
    label: 'How It Works',
    description: 'An image with numbered hotspots, a key to each step and the figure that sells it',
    build: buildHowItWorks,
  },
  {
    id: 'explain-anatomy',
    category: 'explainers',
    label: 'Anatomy',
    description: 'An image down the middle, six parts named either side on leader lines',
    build: buildAnatomy,
  },
  {
    id: 'explain-key-concepts',
    category: 'explainers',
    label: 'Key Concepts',
    description: 'One big idea in a hub, the six ideas behind it round it',
    build: buildKeyConcepts,
  },
  {
    id: 'explain-cheat-sheet',
    category: 'explainers',
    label: 'Cheat Sheet',
    description: 'Four groups of shortcuts, the keys on keycaps beside what they do',
    build: buildCheatSheet,
  },
  {
    id: 'explain-glossary',
    category: 'explainers',
    label: 'Glossary',
    description: 'Eight terms A to Z, each under its letter with a plain definition',
    build: buildGlossary,
  },
  {
    id: 'explain-myths-facts',
    category: 'explainers',
    label: 'Myths and Facts',
    description: 'Four myths, each led by an arrow to the fact that corrects it',
    build: buildMythsFacts,
  },
  {
    id: 'explain-fact-file',
    category: 'explainers',
    label: 'Fact File',
    description: 'An image, a table of six key facts and one surprising one',
    build: buildFactFile,
  },
  {
    id: 'explain-lesson-summary',
    category: 'explainers',
    label: 'Lesson Summary',
    description: 'What you can now do, key points, key words and a quiz question',
    build: buildLessonSummary,
  },
  {
    id: 'explain-formula',
    category: 'explainers',
    label: 'Formula Explained',
    description: 'A rule set large, each term led to its meaning, and a worked example',
    build: buildFormula,
  },
];
