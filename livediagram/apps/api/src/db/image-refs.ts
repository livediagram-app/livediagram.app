// image_refs: the image reference index (docs/specs/009-elements/images.md, "Reference index"), in the
// document's own SQLite (docs/specs/015-api/api.md "Storage"). A projection of the image elements inside
// `tabs.data`, so the share check and the push to the media service never read a tab body.
//
// Writes are STATEMENTS appended to the batch that writes the body, so the index lands in the same transaction
// as the blob it mirrors. Each change fills the document's outbox (document-room/document-schema.ts), and the
// room's next push writes its placement grants and sends the document's whole set to the media service
// (document-room/document-outbox.ts). A tab's rows go with the tab
// (a foreign key).
//
// The SQL is @liveworkspace/api-kit's image-ref-index.ts; this binds livediagram's document database and its tabs.

import {
  createImageRefReaders,
  createImageRefWriters,
} from '@liveworkspace/api-kit/image-ref-index';
import type { DocumentEnv } from '../types';

const db = (env: DocumentEnv) => env.DOCUMENT_DB;

export const { imageRefReplaceStatements, imageRefAddStatements } = createImageRefWriters(db);

export const { itemImageIds: documentImageIds, itemPlacesImage: documentPlacesImage } =
  createImageRefReaders(db, { table: 'document_tabs', item: 'document_id' });
