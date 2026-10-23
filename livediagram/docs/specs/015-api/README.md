# API

Follow the references below only as needed; never upfront.

- ./api.md - when working on API app: REST + WebSocket API: Durable Object storage and realtime room, liveworkspace's index for where documents are and who may open them
- ./api-documentation.md - when working on API documentation (OpenAPI): Generated OpenAPI 3.1 doc served at `/api/openapi.json`, drift-tested against the schema package
- ./public-api-and-tokens.md - when working on Public API and API tokens: Shipped: signed-in-only API tokens (gated like teams) for external callers, the verified guest token that closed an owner-impersonation escalation (history in §2), and input hardening
- ./mcp-server.md - when working on MCP server: Implemented: standalone Cloudflare Worker exposing find/read/create/update document tools to the user's own AI tool via MCP; OAuth 2.1 minting an lvd\_ token; inline PNG render + server-side auto-layout; the calling LLM does the thinking, not /api/ai
- ./cli.md - when working on the livediagram CLI: commands, help budgets, output, exit codes, auth, profiles, sync, distribution
- ./blueprints/README.md - when implementing the CLI from its blueprint
