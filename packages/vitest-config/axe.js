// axe-core over what a test rendered, so a screen reader markup rule (a landmark, a table's structure, a role's
// allowed children) is held by a unit test rather than found later in a browser audit.
import axe from 'axe-core';

// Rules a rendered component cannot be judged by in jsdom: colour contrast needs layout and paint (the apps'
// contrast guards and e2e audits hold it), and the rest judge a whole page (its title, language, one main, one h1,
// a skip link), which a test that renders one component has not.
const NOT_IN_A_COMPONENT_TEST = [
  'color-contrast',
  'document-title',
  'html-has-lang',
  'landmark-one-main',
  'page-has-heading-one',
  'bypass',
];

/**
 * The axe violations on the page, as `id: target` strings (empty when clean), so a failing expectation names each
 * rule and the element it found. Runs over the whole document: the "region" rule only means something there.
 *
 * @param {{ disable?: string[] }} [options] further rules to leave out
 * @returns {Promise<string[]>}
 */
export async function axeViolations(options = {}) {
  const rules = Object.fromEntries(
    [...NOT_IN_A_COMPONENT_TEST, ...(options.disable ?? [])].map((id) => [id, { enabled: false }]),
  );
  const results = await axe.run(document, { rules, resultTypes: ['violations'] });
  return results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`));
}
