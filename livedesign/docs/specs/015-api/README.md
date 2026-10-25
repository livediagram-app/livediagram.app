# API

Follow the references below only as needed; never upfront.

- ./api.md - when working on API app: REST + WebSocket API: each design's own SQLite-backed Durable Object (its content and realtime room), no D1
- ./api-documentation.md - when working on API documentation (OpenAPI): Generated OpenAPI 3.1 doc served at `/api/openapi.json`, drift-tested against the schema package
- ./public-api-and-tokens.md - when working on Public API and API tokens: Shipped: signed-in-only API tokens (gated like teams) for external callers, who the API accepts (verified Bearer identities only, guests included) and how the index's grant decides a design's access, and input hardening
- ./mcp-server.md - when working on MCP server: Implemented: standalone Cloudflare Worker exposing find/read/create/update design tools to the user's own AI tool via MCP; OAuth 2.1 minting an lvd\_ token; inline PNG render + server-side auto-layout; the calling LLM does the thinking, not /api/ai
- ./cli.md - when working on the livedesign CLI: commands, help budgets, output, exit codes, auth, profiles, pull and push, distribution
- ./blueprints/README.md - when implementing the CLI from its blueprint
