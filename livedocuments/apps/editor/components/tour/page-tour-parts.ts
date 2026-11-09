// The steps several tracks of the Pages tour share (docs/specs/007-editor/pages-tour.md "The steps", "On a phone"): a
// look control's popover (its title-bar button, or a phone's Appearance), the Add step, and the tour page's row in
// Contents and its menu (Contents opened from its button while it is minimised, and always on a phone).
import type { PageTourApi, PageTourStep } from './page-tour-api';
import {
  addPageRequires,
  addPageTarget,
  closeContents,
  closeTitlePopover,
  contentsRequires,
  contentsRow,
  contentsRowMenu,
  openContents,
  openTitlePopover,
  pageLook,
  pageOrPopover,
  prepareAddPage,
} from './page-tour-dom';
import { opensFrom } from '@liveworkspace/workbench/components/tour/tour-open';

/** How a track is built: on a phone, its copy says what a phone does differently. */
export type TrackOptions = { phone?: boolean };

type Copy = { id: string; title: string; body: string };

/** A step that opens the tour page's look control `name` (Layout, Background, Style, Text) and rings it. */
export function lookStep(copy: Copy, name: string): PageTourStep {
  return {
    ...copy,
    selector: (api) => pageOrPopover(api.pageId, name),
    requires: (api) => pageLook(api.pageId, name),
    prepare: (api) => openTitlePopover(api.pageId, name),
    cleanup: (api) => closeTitlePopover(api.pageId, name),
  };
}

/** The Add step: the + in the window, else Contents' Add Page, Contents opened for it when it is a button. */
export function addPageStep(copy: Copy): PageTourStep {
  return {
    ...copy,
    selector: addPageTarget,
    requires: addPageRequires,
    prepare: (api) => prepareAddPage(api.pageId),
    cleanup: () => closeContents(),
  };
}

/** The tour page's row in Contents. */
export function contentsRowStep(copy: Copy): PageTourStep {
  return {
    ...copy,
    selector: (api) => contentsRow(api.pageId),
    requires: (api) => contentsRequires(api.pageId),
    prepare: (api) => openContents(api.pageId),
    cleanup: () => closeContents(),
  };
}

/** The tour page's ⋯ menu in Contents, opened. */
export function contentsMenuStep(copy: Copy): PageTourStep {
  return opensFrom(contentsRowStep(copy), (api: PageTourApi) => contentsRowMenu(api.pageId));
}
