// More Compare layouts (docs/specs/007-editor/pages-mode.md "Layouts"), category 'compare':
// pure builders on the shared kit (page-layout-kit.ts), laid out in proportions of the page's
// content box so each fits every size and orientation, in the tab's theme. The builders live in
// page-layouts-set-compare-2.ts to -5.ts, two each; this file names and lists them.
import type { PageLayout } from './page-layouts';
import { buildPricingTiers, buildVersus } from './page-layouts-set-compare-2';
import { buildSpectrum, buildThreeOptions } from './page-layouts-set-compare-3';
import { buildEffortImpact, buildSwot } from './page-layouts-set-compare-4';
import { buildScorecard, buildVenn } from './page-layouts-set-compare-5';

export type CompareSetLayoutId =
  | 'versus'
  | 'pricing-tiers'
  | 'swot'
  | 'effort-impact'
  | 'scorecard'
  | 'spectrum'
  | 'venn'
  | 'three-options';

export const COMPARE_SET_LAYOUTS: readonly PageLayout[] = [
  {
    id: 'versus',
    category: 'compare',
    label: 'Versus',
    description: 'Two contenders face to face, a VS badge and four stats scored side by side',
    build: buildVersus,
  },
  {
    id: 'pricing-tiers',
    category: 'compare',
    label: 'Pricing Tiers',
    description:
      'Three plan cards, each a price, four features and a button, the middle one badged',
    build: buildPricingTiers,
  },
  {
    id: 'swot',
    category: 'compare',
    label: 'SWOT',
    description: 'Strengths, weaknesses, opportunities and threats in a two by two grid',
    build: buildSwot,
  },
  {
    id: 'effort-impact',
    category: 'compare',
    label: 'Effort vs Impact',
    description:
      'Seven numbered ideas plotted on a two by two of effort against impact, with a key',
    build: buildEffortImpact,
  },
  {
    id: 'scorecard',
    category: 'compare',
    label: 'Scorecard',
    description: 'Three options, each an overall score in a ring and star ratings on four criteria',
    build: buildScorecard,
  },
  {
    id: 'spectrum',
    category: 'compare',
    label: 'Spectrum',
    description: 'Five options placed along a scale from simple to powerful, one picked',
    build: buildSpectrum,
  },
  {
    id: 'venn',
    category: 'compare',
    label: 'Venn',
    description: 'Two overlapping circles: what sets each apart, and what they share',
    build: buildVenn,
  },
  {
    id: 'three-options',
    category: 'compare',
    label: 'Three Options',
    description:
      'Three options side by side, each an image, its cost, two points for and one against',
    build: buildThreeOptions,
  },
];
