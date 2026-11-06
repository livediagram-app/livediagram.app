// The Import dialog's formats by the tab's kind (docs/specs/020-import-export/markdown-import.md "Where it is
// offered"): Markdown and Word become an article and PowerPoint a slide deck, so each is offered only on a tab of
// that kind or on an empty tab (its only page still offering the choice of kind), where it sets the kind. JSON
// restores any tab, so every tab takes it.
import { offersPageKindChoice, pageKindOf, pagesOf, type Tab } from '@livedocuments/document';

/** The import formats, in the dialog's catalogue order. */
export type ImportFormatKey = 'json' | 'markdown' | 'word' | 'powerpoint';

const EVERY: readonly ImportFormatKey[] = ['json', 'markdown', 'word', 'powerpoint'];
const ARTICLE: readonly ImportFormatKey[] = ['json', 'markdown', 'word'];
const SLIDE: readonly ImportFormatKey[] = ['json', 'powerpoint'];
const JSON_ONLY: readonly ImportFormatKey[] = ['json'];

/** The formats the Import dialog offers on this tab. */
export function importFormatsFor(
  tab: Pick<Tab, 'pages' | 'pageOrientation' | 'elements'>,
): readonly ImportFormatKey[] {
  const pages = pagesOf(tab);
  const first = pages[0];
  if (!first || offersPageKindChoice(pages, first.id, tab.elements.length)) return EVERY;
  const kind = pageKindOf(first);
  return kind === 'article' ? ARTICLE : kind === 'slide' ? SLIDE : JSON_ONLY;
}
