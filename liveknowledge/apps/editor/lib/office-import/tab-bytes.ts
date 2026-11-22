// A tab's saved size, apart from the readers so an import that reads no Office file can ask it too
// (lib/knowledge-import/page-content.ts).
import type { Tab } from '@liveknowledge/document';

/** A tab's saved size, as the api counts it near enough: its content as UTF-8 JSON. */
export function tabBytes(tab: Pick<Tab, 'elements' | 'pages' | 'articles'>): number {
  const json = JSON.stringify({ elements: tab.elements, pages: tab.pages, articles: tab.articles });
  return new TextEncoder().encode(json).byteLength;
}
