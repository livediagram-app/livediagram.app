import { tidyPageElements } from '../page-tidy';
import type { PageTidyCheckRequest, PageTidyCheckResponse } from './page-tidy-check-protocol';

// The Tidy check's worker (docs/specs/007-editor/pages-mode.md "Tidy"): whether a Tidy would change a page, worked out
// off the main thread, so a drop on a page of hundreds of elements is not held up deciding whether to show its button.
const scope = self as unknown as {
  postMessage: (message: PageTidyCheckResponse) => void;
  addEventListener: (type: 'message', fn: (e: MessageEvent<PageTidyCheckRequest>) => void) => void;
};

scope.addEventListener('message', ({ data }) => {
  scope.postMessage({
    id: data.id,
    can: tidyPageElements(data.elements, data.input) !== data.elements,
  });
});
