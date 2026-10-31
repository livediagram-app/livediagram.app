import { elementsOnPage, laidOutPagesOf, type Tab } from '@livedesign/design';

// Whether the open first tab plainly has nothing to show on its first page (docs/specs/025-community/community.md
// "Something to show": the first page has at least one element or a photo, since that page is the post's card
// picture). The Share dialog's Community tab then holds Share to Community and says why. Only a certain empty counts:
// a photo page is left to the server, which counts its layers from the stored design even while the editor is still
// loading the photo, and so is anything the editor does not hold.
export function firstPageLooksEmpty(tab: Tab): boolean {
  const pages = laidOutPagesOf(tab);
  const first = pages[0];
  if (!first) return tab.elements.length === 0;
  if (first.kind === 'photo') return false;
  return elementsOnPage(tab.elements, pages, first.id).length === 0;
}
