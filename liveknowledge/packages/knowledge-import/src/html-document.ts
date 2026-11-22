// The one place archive HTML is parsed (docs/specs/020-import-export/knowledgebase-import.md): through the
// trusted-types `parseInert`, which answers an inert document. Nothing in it runs, loads or is inserted into the
// page; the import only reads its elements and text.

import { parseInert } from '@liveworkspace/trusted-types';

export const parseHtmlDocument = (source: string): Document => parseInert(source, 'text/html');
