import { useEffect } from 'react';
import { brushPageId } from '../../lib/format-page-brush';

// A Format brush holding a page that has gone (deleted, undone, another tab) holds nothing any more
// (docs/specs/007-editor/pages-mode.md "Copying a background"), as an element's brush does once its element
// goes. Emptied as soon as the page goes, so the next press, on an element or on a page, works at once rather than
// first having to clear a brush that cannot paint.
export function useDeadPageBrush(
  formatSourceId: string | null,
  pageIds: readonly string[] | undefined,
  setFormatSourceId: (id: string | null) => void,
): void {
  const brushed = brushPageId(formatSourceId);
  const gone = brushed !== null && !(pageIds ?? []).includes(brushed);
  useEffect(() => {
    if (gone) setFormatSourceId(null);
  }, [gone, setFormatSourceId]);
}
