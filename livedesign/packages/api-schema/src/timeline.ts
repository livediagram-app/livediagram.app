// An Offline Mode conversion (docs/specs/006-design/offline-mode.md), declared by the editor on the request
// that performs it, so the feed can say what actually happened. The values and their reading are
// liveworkspace's (@liveworkspace/api-schema/document-conversion); the header is this product's, a
// two-sided contract the client and the worker both read from here.
export const DESIGN_CONVERSION_HEADER = 'X-Design-Conversion';

export {
  readDocumentConversion as readDesignConversion,
  type DocumentConversion as DesignConversion,
} from '@liveworkspace/api-schema/document-conversion';
