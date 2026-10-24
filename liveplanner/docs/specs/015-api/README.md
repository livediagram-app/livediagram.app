# API

Follow the references below only as needed; never upfront.

- ./api.md - when working on API app: REST + WebSocket API: each plan's content and realtime room in its own Durable Object
- ./api-documentation.md - when working on API documentation (OpenAPI): Generated OpenAPI 3.1 doc served at `/api/openapi.json`, drift-tested against the schema package
- ./public-api-and-tokens.md - when working on Public API and API tokens: Shipped: signed-in-only API tokens (gated like teams) for external callers, the guest-header hardening that closed an owner-impersonation escalation (history in §2; the header itself is retired, guests now carry liveworkspace guest tokens), and input hardening
- ./mcp-server.md - when working on MCP server: Implemented: standalone Cloudflare Worker exposing find/read/create/update project tools to the user's own AI tool via MCP; OAuth 2.1 minting an lvd\_ token; inline PNG render + server-side auto-layout; the calling LLM does the thinking; liveplanner runs no model
- ./cli.md - when working on the liveplanner CLI: commands, help budgets, output, exit codes, auth, profiles, pull and push, distribution
- ./blueprints/README.md - when implementing the CLI from its blueprint
