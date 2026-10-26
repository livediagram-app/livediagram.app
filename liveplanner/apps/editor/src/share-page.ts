// The share page's head (docs/specs/013-workspace/share-link-previews.md), liveworkspace's for every app
// (@liveworkspace/media createSharePage, liveworkspace/docs/specs/006-media/previews.md "The share page's head"):
// `/project/shared?s=<code>` is the same static shell as every project, so for a link whose preview may name its
// project the head is rewritten to carry its name and share card. Only liveplanner's words are here.

import { createSharePage } from '@liveworkspace/media';
import { SITE_PITCH } from '@liveplanner/ui/site';

// What a named preview says under the project's name: the site's own pitch (packages/ui/src/site.ts).
export const SHARE_PITCH = `Open it in liveplanner: ${SITE_PITCH}.`;

export const { isSharePagePath, sharePage } = createSharePage({
  app: 'liveplanner',
  pagePath: /^\/(?:project|diagram)\/shared\/?$/,
  untitled: 'Untitled plan',
  pitch: SHARE_PITCH,
});
