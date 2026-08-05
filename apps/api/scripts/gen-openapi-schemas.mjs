// Generates the OpenAPI component schemas for `/api/openapi.json` from the
// `@livediagram/api-schema` TypeScript types — the single source of truth for
// every wire-format DTO (spec/37). Run `pnpm --filter @livediagram/api
// gen:openapi` after changing a DTO; the output is committed as
// `src/openapi/schemas.generated.ts` and served verbatim by the worker.
//
// The drift test (`src/openapi/manifest.test.ts`) imports
// `generateComponentSchemas()` from here and asserts the committed file still
// matches, so a DTO change that isn't regenerated turns CI red — the schemas
// can never silently desync from the types (the one thing spec/37 most wants to
// avoid). Nothing in the worker runtime imports this file; the heavy generator
// dependency stays out of the bundle.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createGenerator } from 'ts-json-schema-generator';

const here = dirname(fileURLToPath(import.meta.url));
const apiSchemaDir = resolve(here, '../../../packages/api-schema');
const OUTPUT = resolve(here, '../src/openapi/schemas.generated.ts');

// The DTOs the route manifest references by `$ref`. Transitive dependencies
// (e.g. Element / Anchor under Tab) are pulled in automatically by the
// generator, so this lists only the roots the manifest names. A manifest entry
// that references a type missing here fails the drift test's reference check;
// add the type below and regenerate.
export const ROOT_TYPES = [
  'Diagram',
  'DiagramSummary',
  'DiagramSource',
  'TabSummary',
  'Tab',
  'Folder',
  'CustomTheme',
  'CustomThemeDefinition',
  'ShareLink',
  'ShareLinkExpiry',
  'ShareRole',
  'ApiToken',
  'TimelineEvent',
  'ImageSummary',
  'ChangeLogEntry',
  'ChangeLogKind',
  'SharedWithItem',
  'ParticipantRecord',
  'Team',
  'TeamListItem',
  'TeamMember',
  'TeamRole',
  'TeamInvite',
  'TeamInviteLink',
  'TeamInviteLinkInfo',
  'TelemetryEvent',
  'TelemetrySummary',
  'AiRequest',
  'CapabilitiesResponse',
  'UnfurlResult',
];

// Recursively rewrite the generator's draft-07 `#/definitions/<Name>` refs to
// OpenAPI's `#/components/schemas/<Name>`, and drop the per-schema `$schema`
// dialect marker (the document declares the dialect once at the top level).
function toOpenApiRefs(value) {
  if (Array.isArray(value)) return value.map(toOpenApiRefs);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === '$schema') continue;
      if (key === '$ref' && typeof val === 'string') {
        out.$ref = val.replace('#/definitions/', '#/components/schemas/');
      } else {
        out[key] = toOpenApiRefs(val);
      }
    }
    return out;
  }
  return value;
}

// Deterministic key ordering so the committed file is stable across runs and
// the drift test's deep-equal compare doesn't depend on insertion order.
function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortObject(value[k])]),
    );
  }
  return value;
}

/**
 * Build the `{ <TypeName>: <JSON Schema> }` map for every ROOT_TYPE and its
 * transitive dependencies, with refs rewritten for OpenAPI components.
 * Pure (reads the api-schema source, returns an object); used by both the CLI
 * writer below and the drift test.
 */
export function generateComponentSchemas() {
  const generator = createGenerator({
    path: resolve(apiSchemaDir, 'src/index.ts'),
    tsconfig: resolve(apiSchemaDir, 'tsconfig.json'),
    type: '*',
    // Only name exported types as components; inline anonymous/utility types
    // (Record<…>, Partial<…>) instead of giving them generator-coined names
    // with characters OpenAPI forbids in a component key.
    expose: 'export',
    topRef: true,
    skipTypeCheck: true,
    additionalProperties: false,
  });

  const schemas = {};
  for (const type of ROOT_TYPES) {
    const { definitions = {} } = generator.createSchema(type);
    for (const [name, schema] of Object.entries(definitions)) {
      schemas[name] = schema;
    }
  }
  return sortObject(toOpenApiRefs(schemas));
}

function writeGeneratedFile() {
  const schemas = generateComponentSchemas();
  const banner = `// GENERATED FILE — do not edit by hand.
// Produced by scripts/gen-openapi-schemas.mjs from @livediagram/api-schema.
// Regenerate with: pnpm --filter @livediagram/api gen:openapi
// Served as the \`components.schemas\` of GET /api/openapi.json (spec/37).
import type { ComponentSchemas } from './types';

export const COMPONENT_SCHEMAS: ComponentSchemas = ${JSON.stringify(schemas, null, 2)};
`;
  writeFileSync(OUTPUT, banner);
  return Object.keys(schemas).length;
}

// CLI entry: write the file when run directly (not when imported by the test).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = writeGeneratedFile();
  console.log(`Wrote ${count} component schemas to ${OUTPUT}`);
}
