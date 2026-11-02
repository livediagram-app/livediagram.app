// Checks a product's server.json (its MCP Registry descriptor, each product's docs/specs/015-api/mcp-server.md
// §4.16) for a test: valid against the registry's schema, vendored here as server.schema.json (2025-12-11), and
// equal to what the product's listing says, so a copied or stale field fails before anyone publishes it.
// Test-time only: the Workers never import it, so ajv stays out of their bundles.
import { Ajv } from 'ajv';
import addFormatsModule from 'ajv-formats';
import { DESCRIPTION_MAX, registryDescriptor, type McpListing } from './listing';
import schema from './server.schema.json';

// ajv-formats ships CommonJS; under ESM interop its plugin is either the default export or that export's default.
const addFormats = ((addFormatsModule as { default?: unknown }).default ??
  addFormatsModule) as typeof addFormatsModule;

// The schema carries `example` annotations ajv's strict mode would refuse; formats (uri) are checked.
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

// Every way `json` differs from a valid descriptor for `listing`; empty when it is right.
export function serverJsonProblems(json: unknown, listing: McpListing): string[] {
  const problems: string[] = [];
  if (!validate(json)) {
    for (const error of validate.errors ?? []) {
      problems.push(`schema: ${error.instancePath || '/'} ${error.message ?? 'is invalid'}`);
    }
  }
  if (listing.description.length > DESCRIPTION_MAX) {
    problems.push(`listing: description is over ${DESCRIPTION_MAX} characters`);
  }
  const expected = registryDescriptor(listing);
  const actual = (json ?? {}) as Record<string, unknown>;
  for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    if (JSON.stringify(actual[key]) !== JSON.stringify(expected[key])) {
      problems.push(
        `${key}: expected ${JSON.stringify(expected[key])}, found ${JSON.stringify(actual[key])}`,
      );
    }
  }
  return problems;
}
