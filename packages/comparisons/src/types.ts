// The shape of one comparison page (README.md "Page shape"). Each app writes its own list in its
// marketing site's lib/alternatives.ts; this package draws them.

export type ComparisonRow = {
  label: string;
  // Short, factual cell text. `us` = the app, `them` = the competitor.
  us: string;
  them: string;
};

export type DeepDiveSection = {
  // The section's h2.
  heading: string;
  // One to three paragraphs expanding on a key value theme for this comparison, as plain <p>s.
  paragraphs: string[];
};

export type Faq = {
  q: string;
  // Plain string (no JSX), so the same text feeds the on-page answer and the FAQPage JSON-LD
  // verbatim.
  a: string;
};

export type Alternative = {
  // The page's address, /alternatives/<slug>, and its key in COMPETITOR_LOOK.
  slug: string;
  // The competitor's display name, as prose names it.
  name: string;
  // SEO. The title targets the "<tool> alternative" query; the description is the meta and social
  // description.
  title: string;
  description: string;
  // The hero.
  h1: string;
  lede: string;
  // Three short chips on the comparison's card: what the app offers that this comparison turns on.
  highlights: [string, string, string];
  // The at-a-glance table, app against competitor.
  rows: ComparisonRow[];
  // The fairness section: genuine reasons to pick the competitor.
  themBest: string[];
  // Shipped differentiators.
  usBest: string[];
  // Deep-dive prose, competitor by competitor: the collaboration model, the free and open-source
  // story, structure, interop.
  sections: DeepDiveSection[];
  // Competitor-specific questions, on the page and as FAQPage JSON-LD.
  faqs: Faq[];
};

// One app's comparisons and the words around them: everything the shared pages need from the app.
export type Comparisons = {
  // The app's name as the pages say it: "livediagram vs Miro".
  app: string;
  // The app's canonical origin, no trailing slash (its SITE_URL).
  siteUrl: string;
  // When the comparisons were last reviewed: the pages' "Last reviewed" line, their
  // `article:modified_time` and their sitemap `lastModified`.
  updated: Date;
  // The hub's own words.
  hub: { title: string; description: string; heading: string; lede: string };
  alternatives: Alternative[];
};
