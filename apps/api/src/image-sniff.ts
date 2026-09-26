// Magic-number sniffing for image uploads. A malicious client could
// send Content-Type: image/png with an SVG body, smuggling an XSS
// surface in through the front door (SVG is XML and can carry
// inline <script>). Match the first bytes against each format's
// signature so the declared content-type is independently verified
// at the api boundary before the bytes ever reach R2.
//
// The signatures themselves live in api-schema (the mcp worker's image
// embedder needs them too); this module stays the api's named security
// boundary, so image-sniff.test.ts exercises it in isolation without
// importing index.ts and the whole worker handler.

// The accepted list itself lives in api-schema: the api serialises it in its
// 415 body, so it's wire contract the editor reads too. The signature table
// lives there as well, because the workers' image embedder sniffs with it
// too; both are re-exported here because every caller of `sniffImageType` at
// the upload boundary wants the pair together.
export {
  ACCEPTED_IMAGE_TYPES,
  sniffImageType,
  type AcceptedImageType,
} from '@livediagram/api-schema';
