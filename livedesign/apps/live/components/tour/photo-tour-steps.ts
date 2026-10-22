// The steps of Show Me on a photo page (docs/specs/031-photo/photo-pages.md "Working on a photo
// page"), and the Pages tour's Photo track: the rail of tools, the Layers panel, the page's menus.
// Each step rings a real control of the page it was started on, which stays usable.
import type { PageTourApi, PageTourStep } from './page-tour-api';

export const PHOTO_WELCOME: PageTourStep = {
  id: 'welcome',
  card: 'welcome',
  title: 'Getting started with photos?',
  body: 'A quick look at the tools, layers, adjustments and filters?',
};

const TOOLS: PageTourStep = {
  id: 'tools',
  title: 'Pick a Tool',
  body: 'Brushes, selections, retouching and more. Hold a button for the rest of its group.',
  selector: () => '[data-photo-rail]',
};

const LAYERS: PageTourStep = {
  id: 'layers',
  title: 'Work in Layers',
  body: 'Photo opens the layers: stack, blend and mask them. Adjust adds changes you can undo at any time.',
  selector: () => '[data-tour-id="photo-panel-button"]',
};

const titleButton = (name: string) => (api: PageTourApi) =>
  `[data-photo-title-bar="${api.pageId}"] button[aria-label="${name}"]`;

const MENUS: PageTourStep = {
  id: 'menus',
  title: 'Image, Select, Filter',
  body: 'Resize and rotate, select the subject or remove the background, and apply filters.',
  selector: titleButton('Filter'),
};

const OUTRO: PageTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is a Photo Page',
  body: 'Export › Photo saves a PNG, JPEG, WebP or a layered PSD.',
};

export function photoTourSteps(): PageTourStep[] {
  return [TOOLS, LAYERS, MENUS, OUTRO];
}
