// Everything a stored tab needs settled on the way in, in one call: the api worker's tab read and
// thumbnail render, the offline store's tab load and a file import all run this, so a new step is
// added once and reaches every entry point.
import { settleStoredArticles } from './article-flow';
import { withArticleContinuous } from './continuous-article';
import { withKnowledgebasePage } from './knowledgebase-page';
import { withoutPageLooks } from './page-looks';
import { migrateRetiredPattern } from './retired-patterns';
import { migrateRetiredTheme } from './retired-themes';
import { migrateStoredElements } from './stored-elements';
import { settleStacks } from './stack';
import { settleTabFields } from './tab-fields';
import type { Element, Tab } from './index';
import { isRecord } from '@liveworkspace/model-core/is-record';

export function migrateStoredTab<
  T extends Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor' | 'elements'>,
>(tab: T): T {
  // The fields that renderers read raw (layers, the background colours) are settled before anything reads them.
  // A retired background pattern (./retired-patterns) and a retired theme (./retired-themes) move onto their
  // replacements.
  // An article's legacy suggestions read as rejected (docs/specs/007-editor/suggestions.md "Writing stored with a
  // suggestion"), here so the plain tab JSON a Community visitor or an agent reads never carries one.
  // A page's own background, style and lock are not in liveknowledge (./page-looks): read without them.
  // An article that arrives on paper sheets reads as one continuous page (./continuous-article).
  const settled = withArticleContinuous(
    withoutPageLooks(
      settleStoredArticles(migrateRetiredPattern(migrateRetiredTheme(settleTabFields(tab)))),
    ),
  );
  if (!Array.isArray(settled.elements)) return settled;
  // Stacks lay out last (docs/specs/009-elements/stack.md), over the settled elements.
  const elements = settleStacks(migrateStoredElements(settled.elements));
  const stacked = elements === settled.elements ? settled : { ...settled, elements };
  // A tab with nothing on it and no page of a kind (an agent's, a script's, an older client's) is an empty knowledgebase
  // page (docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen"): it opens as an article page.
  return withKnowledgebasePage(stacked as T & Pick<Tab, 'pages' | 'articles'>);
}

/**
 * The same migrations for a tab that arrives from outside (an api write, a realtime peer, a file):
 * untrusted, so anything that is not an object whose elements are all objects passes through
 * unchanged for validation to refuse. Run before `isValidTab`, so a former stored shape is
 * converted, not refused.
 */
export function migrateIncomingTab(tab: unknown): unknown {
  if (!isRecord(tab) || !Array.isArray(tab.elements) || !tab.elements.every(isRecord)) return tab;
  const elements = tab.elements.length;
  return readableOr(tab, elements, () =>
    migrateStoredTab(tab as Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor' | 'elements'>),
  );
}

/** Untrusted elements (a paste, a file) through the stored-element migrations; non-objects dropped. */
export function migrateIncomingElements(elements: readonly unknown[]): Element[] {
  const records = elements.filter(isRecord) as unknown as Element[];
  return readableOr(records, records.length, () => migrateStoredElements(records));
}

// The migrations run before validation and read an element's fields as their types (a chip's label as text): a
// malformed element can make one throw. Untrusted input that does is handed back as it came, for validation to refuse
// as it refuses any malformed input, never thrown out of an api route, a peer's op or an import.
function readableOr<T>(received: T, elements: number, migrate: () => T): T {
  try {
    return migrate();
  } catch {
    console.warn('[migrate] incoming-unreadable', { elements });
    return received;
  }
}
