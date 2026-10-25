// Where a project came from when a tool made it (docs/specs/013-workspace/folders.md "Provenance"):
// liveworkspace's rule (@liveworkspace/api-schema/document-source), under this product's noun. The
// type is declared here so the api's OpenAPI document keeps naming it `ProjectSource`.
import type { DOCUMENT_SOURCES } from '@liveworkspace/api-schema/document-source';

export type ProjectSource = (typeof DOCUMENT_SOURCES)[number];

export {
  DOCUMENT_SOURCES as PROJECT_SOURCES,
  isDocumentSource as isProjectSource,
  isMadeByAiSource,
} from '@liveworkspace/api-schema/document-source';
