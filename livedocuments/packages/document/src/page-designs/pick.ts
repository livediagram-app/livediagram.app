// Picking a design for a tab's words (docs/specs/011-theme/blueprints/page-designs.md "Pick"): what an agent's
// "auto" design means. Each design's keywords against the words; most matches wins, ties to catalogue order. Pure.
import { PAGE_DESIGNS, type PageDesignId } from './catalogue';

const FALLBACK: PageDesignId = 'soft-mesh';

/** The design that best suits the words. */
export function pickPageDesign(words: string): PageDesignId {
  const have = new Set(words.toLowerCase().match(/[a-z]+/g) ?? []);
  let best: PageDesignId = FALLBACK;
  let most = 0;
  for (const d of PAGE_DESIGNS) {
    const hits = d.keywords.reduce((sum, k) => sum + (have.has(k) ? 1 : 0), 0);
    if (hits > most) {
      most = hits;
      best = d.id;
    }
  }
  return best;
}
