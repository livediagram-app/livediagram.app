// The share page's head (docs/specs/013-workspace/share-link-previews.md), liveworkspace's for every app
// (@liveworkspace/media createSharePage, liveworkspace/docs/previews.md "The share page's head"):
// `/document/shared?s=<code>` is the same static shell as every document, so for a link whose preview may name its
// document the head is rewritten to carry its name and share card. Only livedocuments' words are here.

import { createSharePage } from '@liveworkspace/media';

// What a named preview says under the document's name.
export const SHARE_PITCH =
  'Open it in livedocuments: articles, slide decks and infographics, made together.';

export const { isSharePagePath, sharePage } = createSharePage({
  app: 'livedocuments',
  pagePath: /^\/(?:document|diagram)\/shared\/?$/,
  untitled: 'Untitled document',
  pitch: SHARE_PITCH,
});
