// image_refs: the image reference index (docs/specs/009-elements/images.md, "Reference index"), in the design's own
// SQLite. A projection of the image elements (and image page backgrounds) inside `tabs.data`, so the media
// service's references, the usage map and share-visitor reads never read a tab body.
//
// Writes are STATEMENTS appended to the batch that writes the body, so the index lands in the same transaction as
// the body it mirrors. There are no foreign keys: a dangling row (its tab gone) is ignored by every reader, which is
// what makes every gap here fail towards keeping bytes. A change to a design's set queues it for the media service
// through the outbox triggers (design-room/design-schema.ts).

// The SQL is @liveworkspace/api-kit's image-ref-index.ts; this binds the design's database.

import { createImageRefWriters } from '@liveworkspace/api-kit/image-ref-index';
import type { DesignEnv } from '../types';

export const { imageRefReplaceStatements, imageRefAddStatements, imageRefPruneTabStatement } =
  createImageRefWriters((env: DesignEnv) => env.DESIGN_DB);
