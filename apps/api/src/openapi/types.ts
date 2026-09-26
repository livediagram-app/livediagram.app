// Minimal structural types for the OpenAPI 3.1 document the worker serves at
// GET /api/openapi.json (docs/specs/015-api/api-documentation.md). Deliberately loose: a JSON Schema / OpenAPI
// object is an open recursive shape, and the value is built from the
// (typechecked) route manifest + the generated component schemas, so a full
// nominal model would add friction without catching real bugs here. The DTO
// payload shapes ARE strongly typed — in @livediagram/api-schema, where the
// component schemas are generated from.

/** A single JSON Schema object (draft 2020-12, the dialect OpenAPI 3.1 uses). */
export type JsonSchema = Record<string, unknown>;

/** The `components.schemas` map: type name → schema. */
export type ComponentSchemas = Record<string, JsonSchema>;

/** A request/response body schema in the manifest: either a `$ref`-able
 *  component name (a key of the generated schemas) or an inline JSON Schema
 *  (used for the small response envelopes that wrap a payload, e.g.
 *  `{ diagrams: DiagramSummary[] }`). */
export type BodySchema = string | JsonSchema;

export interface OpenApiDocument {
  openapi: string;
  info: Record<string, unknown>;
  servers: { url: string; description?: string }[];
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: ComponentSchemas; securitySchemes: Record<string, unknown> };
  tags: { name: string; description?: string }[];
}
