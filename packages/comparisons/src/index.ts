// Every app's comparison pages, built once (README.md). An app hands over its list and its words;
// its routes wrap these in its own header, hero, call to action and footer.

export type { Alternative, Comparisons, ComparisonRow, DeepDiveSection, Faq } from './types';
export {
  comparisonCard,
  comparisonPath,
  comparisonSitemap,
  comparisonSlugs,
  faqJsonLd,
  getComparison,
  HUB_PATH,
  hubItemListJsonLd,
  otherComparisons,
  reviewedOn,
} from './catalogue';
export { comparisonProblems, redirectProblems } from './check';
export { COMPETITOR_LOOK, type CompetitorLook, lookOf } from './looks';
export type { Mark } from './components/mark';
export { AlternativeCard } from './components/AlternativeCard';
export { ComparisonArticle } from './components/ComparisonArticle';
export { ComparisonHub } from './components/ComparisonHub';
export { ComparisonTable } from './components/ComparisonTable';
export { VsBadge } from './components/VsBadge';
