import type { SiteId } from '@liveworkspace/sites';

// The shape of one comparison page (liveworkspace/docs/comparison-pages.md "Page shape").

type ComparisonRow = {
  label: string;
  // Short, factual cell text. `us` = the app (or apps) the page is about, `them` = the competitor.
  us: string;
  them: string;
};

type DeepDiveSection = {
  // On-page h2 for the section.
  heading: string;
  // One to three prose paragraphs expanding on a key value theme for this comparison. Rendered as
  // plain <p> elements.
  paragraphs: string[];
};

type Faq = {
  q: string;
  // Plain string (no JSX) so the same text feeds the on-page answer and the FAQPage JSON-LD
  // verbatim.
  a: string;
};

// One comparison as an app's own list writes it: everything but which apps it is about.
export type AppAlternative = {
  slug: string;
  // Competitor display name + how we refer to it in prose.
  name: string;
  // SEO. Title targets the "<tool> alternative" query; description is the meta + social
  // description.
  title: string;
  description: string;
  // On-page hero.
  h1: string;
  lede: string;
  // Comparison table rows (us vs competitor).
  rows: ComparisonRow[];
  // Fairness section: genuine reasons to pick the competitor.
  themBest: string[];
  // Shipped differentiators for this comparison.
  usBest: string[];
  // Deep-dive prose: competitor-specific sections expanding the key value themes (collaboration
  // model, open-source story, structure, interop). This is where the page earns its depth.
  sections: DeepDiveSection[];
  // Competitor-specific questions, rendered on-page and emitted as FAQPage JSON-LD.
  faqs: Faq[];
};

export type Alternative = AppAlternative & {
  // The apps that answer this competitor. One app's comparison names that app; a suite
  // comparison names every app it draws on, and the page speaks for liveworkspace.
  apps: SiteId[];
  // When the comparison was last reviewed, for the page's disclaimer, the sitemap and
  // `article:modified_time`.
  updated: Date;
};
