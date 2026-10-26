// The share page's head (docs/specs/013-workspace/share-link-previews.md), liveworkspace's for every app
// (@liveworkspace/media createSharePage, liveworkspace/docs/specs/006-media/previews.md "The share page's head"):
// `/design/shared?s=<code>` is the same static shell as every design, so for a link whose preview may name its design
// the head is rewritten to carry its name and share card. Only livedesign's words are here.

import { createSharePage } from '@liveworkspace/media';

// What a named preview says under the design's name.
export const SHARE_PITCH =
  'Open it in livedesign: logos, wireframes and photos, designed together.';

export const { isSharePagePath, sharePage } = createSharePage({
  app: 'livedesign',
  pagePath: /^\/(?:design|diagram)\/shared\/?$/,
  untitled: 'Untitled design',
  pitch: SHARE_PITCH,
});
