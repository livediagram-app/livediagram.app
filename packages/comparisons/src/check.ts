import { COMPETITOR_LOOK } from './looks';
import type { Comparisons } from './types';

// What every app's list must hold, as a list of problems (empty when it is sound). Each app's
// lib/alternatives.test.ts expects none. The list drives the static route's params, every page's
// metadata, the hub and the sitemap, so a drift (a duplicated slug, a missing field, a slug that would
// 404 in a static export) breaks SEO and routing in ways a render doesn't show.
//
// The honesty rules (README.md "Golden rule") are not enforceable here, but these pin the shape
// they depend on: both sides of "Which to pick" are filled, every row has both cells, and so on.
// Each app's product-claims test keeps out claims found false, and its counts test keeps written
// counts in step with its catalogue.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// A search result shows about 160 characters of a meta description and cuts the rest; under about
// 50 is too thin to earn the click.
const DESCRIPTION = { min: 50, max: 160 };
// A card's chip stays on one line.
const CHIP_MAX = 24;

export function comparisonProblems(c: Comparisons): string[] {
  const problems: string[] = [];
  const add = (where: string, what: string) => problems.push(`${where}: ${what}`);

  if (!c.app) add('comparisons', 'no app name');
  if (!/^https:\/\/[^/]+$/.test(c.siteUrl))
    add('comparisons', `siteUrl ${c.siteUrl} is not an origin`);
  if (Number.isNaN(c.updated.getTime())) add('comparisons', 'no review date');
  for (const field of ['title', 'description', 'heading', 'lede'] as const) {
    if (!c.hub[field]) add('hub', `no ${field}`);
  }
  if (c.hub.description.length < DESCRIPTION.min || c.hub.description.length > DESCRIPTION.max) {
    add('hub', `description is ${c.hub.description.length} characters`);
  }
  if (c.alternatives.length === 0) add('comparisons', 'none listed');

  const seen = new Set<string>();
  for (const alt of c.alternatives) {
    const at = alt.slug || alt.name || '(unnamed)';
    if (!SLUG.test(alt.slug)) add(at, 'slug is not lowercase words joined by hyphens');
    if (seen.has(alt.slug)) add(at, 'slug is listed twice');
    seen.add(alt.slug);
    if (!COMPETITOR_LOOK[alt.slug]) add(at, 'no look in COMPETITOR_LOOK');

    for (const field of ['name', 'title', 'description', 'h1', 'lede'] as const) {
      if (!alt[field]) add(at, `no ${field}`);
    }
    if (alt.description.length < DESCRIPTION.min || alt.description.length > DESCRIPTION.max) {
      add(at, `description is ${alt.description.length} characters`);
    }

    if (alt.highlights.length !== 3) add(at, 'not three highlights');
    for (const chip of alt.highlights) {
      if (!chip || chip.length > CHIP_MAX)
        add(at, `highlight "${chip}" is not 1 to ${CHIP_MAX} characters`);
    }

    if (alt.rows.length === 0) add(at, 'no rows');
    for (const row of alt.rows) {
      if (!row.label || !row.us || !row.them) add(at, `row "${row.label}" is missing a cell`);
    }

    if (alt.usBest.length === 0) add(at, 'no reasons to pick us');
    if (alt.themBest.length === 0) add(at, 'no reasons to pick them');
    for (const point of [...alt.usBest, ...alt.themBest]) if (!point) add(at, 'an empty reason');

    if (alt.sections.length === 0) add(at, 'no deep-dive sections');
    for (const section of alt.sections) {
      if (!section.heading) add(at, 'a section with no heading');
      if (section.paragraphs.length === 0 || section.paragraphs.some((p) => !p)) {
        add(at, `section "${section.heading}" has an empty paragraph or none`);
      }
    }

    // Each answer feeds the FAQPage JSON-LD.
    if (alt.faqs.length === 0) add(at, 'no FAQs');
    for (const faq of alt.faqs) if (!faq.q || !faq.a) add(at, `FAQ "${faq.q}" is unanswered`);
  }
  return problems;
}

// What an app's public/_redirects must not do to its comparisons: catch the hub or a live page (a
// rule for a retired comparison is fine, and must be permanent). Each app with redirects under
// /alternatives runs it from a test.
export function redirectProblems(redirects: string, c: Comparisons): string[] {
  const live = new Set([
    '/alternatives',
    ...c.alternatives.map((alt) => `/alternatives/${alt.slug}`),
  ]);
  const problems: string[] = [];
  for (const line of redirects.split('\n')) {
    const [from, , status] = line.trim().split(/\s+/);
    if (!from || from.startsWith('#') || !from.startsWith('/alternatives')) continue;
    const path = from.replace(/\/$/, '');
    const pattern = new RegExp(
      `^${path
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/:\w+/g, '[^/]+')}$`,
    );
    for (const page of live) if (pattern.test(page)) problems.push(`${from} catches ${page}`);
    if (status !== '301') problems.push(`${from} is not a permanent (301) redirect`);
  }
  return problems;
}
