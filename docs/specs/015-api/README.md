# API

Follow the references below only as needed; never upfront.

- ./api.md - when working on API app: REST + WebSocket API: D1 storage + Durable Object realtime room
- ./api-documentation.md - when working on API documentation (OpenAPI): Generated OpenAPI 3.1 doc served at `/api/openapi.json`, drift-tested against the schema package
- ./public-api-and-tokens.md - when working on Public API and API tokens: Implemented: signed-in-only API tokens (gated like teams) for external callers + an HMAC requirement on X-Owner-Id to close a current owner-impersonation escalation; input hardening shipped
- ./mcp-server.md - when working on MCP server: Implemented: standalone Cloudflare Worker exposing find/read/create/update diagram tools to the user's own AI tool via MCP; OAuth 2.1 minting an lvd\_ token; inline PNG render + server-side auto-layout; the calling LLM does the thinking, not /api/ai
