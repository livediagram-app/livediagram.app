// How a product's MCP server introduces itself to registries and clients (each product's
// docs/specs/015-api/mcp-server.md §4.16): the one identity its server.json, its `initialize` response's
// serverInfo and its server card are all made from, so the three cannot drift apart.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { LATEST_PROTOCOL_VERSION, type Implementation } from '@modelcontextprotocol/sdk/types.js';
import type { jsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/types.js';

// Every product lists under the GitHub organisation that owns the monorepo (livediagram-app/livediagram.app), so
// one GitHub sign-in, or the repo's own OIDC token, proves the namespace for all of them.
export const REGISTRY_NAMESPACE = 'io.github.livediagram-app';
export const REPOSITORY_URL = 'https://github.com/livediagram-app/livediagram.app';
// The registry's own limit on a listing's description.
export const DESCRIPTION_MAX = 100;
export const SERVER_CARD_PATH = '/.well-known/mcp/server-card.json';

// The card only lists tools and never calls one, so their output schemas need no validators. The SDK's default
// compiles each with ajv, which generates code at runtime, and workerd refuses that.
const SKIP_OUTPUT_SCHEMAS: jsonSchemaValidator = {
  getValidator: () => (input) => ({ valid: true, data: input as never, errorMessage: undefined }),
};

export type McpListing = {
  // The product's name, lowercase ("livediagram"): serverInfo.name, the title and its domain's first label.
  readonly product: string;
  // Registry name: `io.github.livediagram-app/<product>`.
  readonly registryName: string;
  readonly title: string;
  readonly description: string;
  readonly version: string;
  readonly websiteUrl: string;
  readonly iconUrl: string;
  readonly documentationUrl: string;
  // The hosted streamable-http endpoint the registry lists.
  readonly remoteUrl: string;
};

// A product's listing from its name: every address follows the product's www. host and its mcp. Worker.
export function mcpListing(input: {
  product: string;
  description: string;
  version: string;
}): McpListing {
  const { product, description, version } = input;
  const site = `https://www.${product}.app`;
  return {
    product,
    registryName: `${REGISTRY_NAMESPACE}/${product}`,
    title: product,
    description,
    version,
    websiteUrl: site,
    iconUrl: `${site}/${product}-icon-512.png`,
    documentationUrl: `${site}/help/account-and-data/connect-ai-mcp`,
    remoteUrl: `https://mcp.${product}.app/mcp`,
  };
}

// The `serverInfo` an `initialize` response carries.
export function serverIdentity(listing: McpListing): Implementation {
  return {
    name: listing.product,
    title: listing.title,
    version: listing.version,
    description: listing.description,
    websiteUrl: listing.websiteUrl,
    icons: [{ src: listing.iconUrl, mimeType: 'image/png', sizes: ['512x512'] }],
  };
}

// The server.json the registry is given: what `<product>/server.json` must hold, field for field.
export function registryDescriptor(listing: McpListing): Record<string, unknown> {
  return {
    $schema: 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
    name: listing.registryName,
    title: listing.title,
    description: listing.description,
    version: listing.version,
    websiteUrl: listing.websiteUrl,
    repository: {
      url: REPOSITORY_URL,
      source: 'github',
      subfolder: `${listing.product}/apps/mcp`,
    },
    icons: [{ src: listing.iconUrl, mimeType: 'image/png', sizes: ['512x512'] }],
    remotes: [{ type: 'streamable-http', url: listing.remoteUrl }],
  };
}

// The server card (/.well-known/mcp/server-card.json): what a directory or client shows before anyone signs in,
// since /mcp answers only a signed-in caller. The tools, resources and prompts are read from a server built the
// way /mcp builds one, over an in-memory transport, so the card lists exactly what /mcp offers.
export async function serverCard(
  listing: McpListing,
  server: McpServer,
  origin: string,
): Promise<Record<string, unknown>> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client(
    { name: 'server-card', version: listing.version },
    { jsonSchemaValidator: SKIP_OUTPUT_SCHEMAS },
  );
  await client.connect(clientSide);
  try {
    const capabilities = client.getServerCapabilities() ?? {};
    const [tools, resources, prompts] = await Promise.all([
      capabilities.tools ? client.listTools().then((r) => r.tools) : [],
      capabilities.resources ? client.listResources().then((r) => r.resources) : [],
      capabilities.prompts ? client.listPrompts().then((r) => r.prompts) : [],
    ]);
    return {
      $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
      version: '1.0',
      protocolVersion: LATEST_PROTOCOL_VERSION,
      serverInfo: serverIdentity(listing),
      description: listing.description,
      iconUrl: listing.iconUrl,
      documentationUrl: listing.documentationUrl,
      registryName: listing.registryName,
      transport: { type: 'streamable-http', endpoint: `${origin}/mcp` },
      capabilities,
      authentication: {
        required: true,
        schemes: ['oauth2'],
        resourceMetadata: `${origin}/.well-known/oauth-protected-resource`,
      },
      instructions: client.getInstructions(),
      tools,
      resources,
      prompts,
    };
  } finally {
    await client.close();
  }
}
